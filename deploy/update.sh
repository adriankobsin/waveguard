#!/usr/bin/env bash
# =============================================================================
#  WaveGuard updater — pulls the latest code from GitHub, rebuilds, restarts.
#  Takes a data backup first and rolls back automatically if the new version
#  doesn't start.
#
#     sudo waveguard update            (or: sudo /opt/waveguard/deploy/update.sh)
#
#  Also run by waveguard-update.service when an admin clicks
#  Settings → Server & updates → Install update.
# =============================================================================
set -uo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR=/var/lib/waveguard
LOG=$DATA_DIR/update.log
FLAG=$DATA_DIR/update-requested
ENV_FILE=/etc/waveguard/waveguard.env

[[ $EUID -eq 0 ]] || { echo "Run with sudo" >&2; exit 1; }
rm -f "$FLAG"

if [[ "${1:-}" == "--from-ui" ]]; then
  exec >>"$LOG" 2>&1
else
  exec > >(tee -a "$LOG") 2>&1
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2); PORT=${PORT:-80}

health() {
  for _ in $(seq 1 45); do
    curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

build() {
  cd "$INSTALL_DIR" || return 1
  npm ci --no-audit --no-fund --loglevel=error && npm run build --silent
}

log "===== WaveGuard update started ====="
cd "$INSTALL_DIR" || exit 1
BRANCH=$(git rev-parse --abbrev-ref HEAD)
OLD=$(git rev-parse HEAD)
log "Current: $BRANCH @ ${OLD:0:7}"

log "Backing up data…"
"$INSTALL_DIR/deploy/waveguard-cli.sh" backup --quiet --label pre-update || log "WARNING: backup failed — continuing"

log "Fetching from GitHub…"
if ! git fetch --quiet origin "$BRANCH"; then
  log "ERROR: could not reach GitHub. Nothing changed."
  exit 1
fi
NEW=$(git rev-parse "origin/$BRANCH")
if [[ "$OLD" == "$NEW" ]]; then
  log "Already up to date."
  exit 0
fi
log "Updating ${OLD:0:7} → ${NEW:0:7}"
git --no-pager log --oneline "$OLD..$NEW" | head -20 | sed 's/^/    /'
git reset --hard --quiet "$NEW"

# Pick up any new OS packages / service files the new version needs.
if [[ -x "$INSTALL_DIR/deploy/install.sh" ]] && ! git diff --quiet "$OLD" "$NEW" -- deploy/; then
  log "Deployment files changed — re-running the installer steps"
  "$INSTALL_DIR/deploy/install.sh" --port "$PORT" && { log "===== Update complete (${NEW:0:7}) ====="; exit 0; }
  log "ERROR: installer failed — rolling back"
else
  log "Installing dependencies and building…"
  if build; then
    systemctl restart waveguard
    if health; then
      log "===== Update complete (${NEW:0:7}) ====="
      exit 0
    fi
    log "ERROR: new version did not start — rolling back"
  else
    log "ERROR: build failed — rolling back"
  fi
fi

git reset --hard --quiet "$OLD"
build && systemctl restart waveguard
if health; then
  log "Rolled back to ${OLD:0:7}. WaveGuard is running the previous version."
else
  log "CRITICAL: rollback did not start either. Check: journalctl -u waveguard -e"
fi
exit 1
