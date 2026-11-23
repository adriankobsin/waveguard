#!/usr/bin/env bash
# WaveGuard management command — installed as /usr/local/bin/waveguard
set -uo pipefail

SELF="$(readlink -f "${BASH_SOURCE[0]}")"
INSTALL_DIR="$(cd "$(dirname "$SELF")/.." && pwd)"
DATA_DIR=/var/lib/waveguard
ENV_FILE=/etc/waveguard/waveguard.env
KEEP_BACKUPS=${KEEP_BACKUPS:-14}

need_root() { [[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo waveguard $*" >&2; exit 1; }; }

usage() {
  cat <<EOF
WaveGuard management

  waveguard status          Service state, version, web address
  waveguard logs            Follow the live log (Ctrl+C to stop)
  waveguard restart         Restart the service
  waveguard update          Download the latest version from GitHub and restart
  waveguard backup          Save a copy of all data to $DATA_DIR/backups
  waveguard restore FILE    Restore data from a backup archive
  waveguard reset-admin     Set a new password for the 'admin' account
  waveguard config          Edit the server settings ($ENV_FILE)
EOF
}

cmd=${1:-help}
shift || true

case "$cmd" in
  status)
    systemctl --no-pager --lines=0 status waveguard | head -5
    PORT=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)
    echo
    echo "Version:  $(git -C "$INSTALL_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null) @ $(git -C "$INSTALL_DIR" rev-parse --short HEAD 2>/dev/null)"
    for ip in $(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | head -3); do
      echo "Web UI:   http://$ip$([[ "${PORT:-80}" == "80" ]] || echo ":$PORT")/"
    done
    echo "Data:     $DATA_DIR ($(du -sh "$DATA_DIR" 2>/dev/null | cut -f1))"
    ;;
  logs)
    journalctl -u waveguard -f -n 100
    ;;
  restart)
    need_root "$cmd"
    systemctl restart waveguard && echo "Restarted."
    ;;
  update)
    need_root "$cmd"
    exec "$INSTALL_DIR/deploy/update.sh" "$@"
    ;;
  backup)
    need_root "$cmd"
    QUIET=0; LABEL=""
    while [[ $# -gt 0 ]]; do
      case "$1" in --quiet) QUIET=1 ;; --label) LABEL="-$2"; shift ;; esac
      shift
    done
    install -d -m 0750 -o waveguard -g waveguard "$DATA_DIR/backups"
    FILE="$DATA_DIR/backups/waveguard-$(date +%Y%m%d-%H%M%S)$LABEL.tar.gz"
    # sqlite files are copied consistently because WAL is checkpointed on read by the next open;
    # the JSON store is written atomically, so a live copy is safe.
    tar -czf "$FILE" -C "$DATA_DIR" --exclude=./backups --exclude=./captures --exclude=./update.log . 2>/dev/null
    tar -czf "$FILE.etc.tar.gz" -C / etc/waveguard 2>/dev/null || true
    chmod 600 "$FILE" "$FILE.etc.tar.gz" 2>/dev/null
    chown waveguard:waveguard "$FILE" "$FILE.etc.tar.gz" 2>/dev/null
    # Keep the newest N backups.
    ls -1t "$DATA_DIR"/backups/waveguard-*.tar.gz 2>/dev/null | grep -v '\.etc\.tar\.gz$' | tail -n +$((KEEP_BACKUPS + 1)) | while read -r old; do rm -f "$old" "$old.etc.tar.gz"; done
    [[ $QUIET -eq 1 ]] || echo "Backup saved: $FILE ($(du -h "$FILE" | cut -f1))"
    ;;
  restore)
    need_root "$cmd"
    FILE=${1:-}
    [[ -f "$FILE" ]] || { echo "Usage: sudo waveguard restore $DATA_DIR/backups/waveguard-YYYYMMDD-HHMMSS.tar.gz" >&2; ls -1t "$DATA_DIR"/backups/*.tar.gz 2>/dev/null | grep -v etc.tar | head -10; exit 1; }
    read -r -p "Replace ALL current WaveGuard data with $FILE? [y/N] " yn
    [[ "$yn" =~ ^[Yy]$ ]] || exit 0
    "$SELF" backup --label before-restore
    systemctl stop waveguard
    find "$DATA_DIR" -mindepth 1 -maxdepth 1 ! -name backups -exec rm -rf {} +
    tar -xzf "$FILE" -C "$DATA_DIR"
    chown -R waveguard:waveguard "$DATA_DIR"
    systemctl start waveguard && echo "Restored and restarted."
    ;;
  reset-admin)
    need_root "$cmd"
    systemctl stop waveguard
    set -a; . "$ENV_FILE"; set +a
    cd "$INSTALL_DIR/mock-server" && runuser -u waveguard -- env WAVEGUARD_DATA_DIR="$WAVEGUARD_DATA_DIR" node scripts/reset-admin.js "$@"
    systemctl start waveguard
    ;;
  config)
    need_root "$cmd"
    "${EDITOR:-nano}" "$ENV_FILE" && systemctl restart waveguard && echo "Saved and restarted."
    ;;
  help|-h|--help|*)
    usage
    ;;
esac
