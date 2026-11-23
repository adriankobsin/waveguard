#!/usr/bin/env bash
# =============================================================================
#  WaveGuard — standalone installer for Debian 12+/Ubuntu 22.04+ (mini PC)
#
#  Usage (on the mini PC):
#     sudo apt install -y git
#     sudo git clone https://github.com/adriankobsin/waveguard.git /opt/waveguard
#     sudo /opt/waveguard/deploy/install.sh
#
#  Options:
#     --port N              Web port (default 80)
#     --import-from DIR     Copy data from an older WaveGuard checkout
#                           (the folder that contains mock-server/data/)
#     --admin-password PW   Set the admin password instead of generating one
#     --skip-tools          Don't install the network tool packages
#
#  Safe to run again: it upgrades packages, rebuilds and restarts, and never
#  touches existing data in /var/lib/waveguard.
# =============================================================================
set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR=/var/lib/waveguard
CONF_DIR=/etc/waveguard
ENV_FILE=$CONF_DIR/waveguard.env
SVC_USER=waveguard
PORT=80
IMPORT_FROM=""
ADMIN_PASSWORD=""
SKIP_TOOLS=0
NODE_MAJOR=22

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --import-from) IMPORT_FROM="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --skip-tools) SKIP_TOOLS=1; shift ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

c_blue=$'\033[1;34m'; c_green=$'\033[1;32m'; c_yellow=$'\033[1;33m'; c_red=$'\033[1;31m'; c_off=$'\033[0m'
step() { echo; echo "${c_blue}==> $*${c_off}"; }
ok()   { echo "${c_green}    ✓ $*${c_off}"; }
warn() { echo "${c_yellow}    ! $*${c_off}"; }
die()  { echo "${c_red}ERROR: $*${c_off}" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo:  sudo $0"
[[ -f "$INSTALL_DIR/package.json" && -d "$INSTALL_DIR/mock-server" ]] || die "Run this from inside the WaveGuard repository (deploy/install.sh)"

# ----------------------------------------------------------------------------- OS check
step "Checking the operating system"
. /etc/os-release
case "${ID:-}" in
  debian) [[ "${VERSION_ID%%.*}" -ge 12 ]] || warn "Debian ${VERSION_ID} is older than 12 — continuing, but 12 or newer is recommended" ;;
  ubuntu|raspbian|linuxmint|pop) ;;
  *) warn "Untested distribution '${ID}'. Continuing as Debian-compatible." ;;
esac
ok "$PRETTY_NAME on $(dpkg --print-architecture)"

export DEBIAN_FRONTEND=noninteractive

# ----------------------------------------------------------------------------- packages
step "Installing system packages"
apt-get update -qq
BASE_PKGS=(ca-certificates curl gnupg git build-essential python3 openssl jq iproute2 iputils-ping)
apt-get install -y -qq "${BASE_PKGS[@]}" >/dev/null
ok "Base packages"

if [[ $SKIP_TOOLS -eq 0 ]]; then
  # Let the waveguard group capture packets with tshark/dumpcap.
  echo "wireshark-common wireshark-common/install-setuid boolean true" | debconf-set-selections
  TOOL_PKGS=(
    traceroute mtr-tiny nmap arp-scan            # path + discovery
    snmp                                         # snmpget / snmpwalk for switch polling
    tshark tcpdump                               # packet capture / Wireshark analysis
    lldpd                                        # which switch port are we plugged into
    avahi-daemon avahi-utils                     # Bonjour / mDNS browsing
    iperf3 dnsutils ethtool net-tools whois      # throughput, DNS, link diagnostics
    ieee-data                                    # MAC manufacturer database
    netcat-openbsd
  )
  apt-get install -y -qq "${TOOL_PKGS[@]}" >/dev/null || warn "Some tool packages failed to install — the related tools will show as missing"
  # iperf3 asks whether to start a daemon; we only use the client.
  systemctl disable --now iperf3 >/dev/null 2>&1 || true
  systemctl enable --now lldpd >/dev/null 2>&1 || true
  systemctl enable --now avahi-daemon >/dev/null 2>&1 || true
  ok "Network tools: ping traceroute mtr nmap arp-scan snmp tshark tcpdump lldpd avahi iperf3 dig ethtool"
fi

# ----------------------------------------------------------------------------- Node.js
step "Installing Node.js $NODE_MAJOR"
current_major=0
if command -v node >/dev/null 2>&1; then current_major=$(node -p 'process.versions.node.split(".")[0]'); fi
if [[ $current_major -lt 20 ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v), npm $(npm -v)"

# ----------------------------------------------------------------------------- user + dirs
step "Creating the service account and folders"
if ! id "$SVC_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$SVC_USER"
fi
getent group wireshark >/dev/null && usermod -aG wireshark "$SVC_USER" || true
install -d -m 0750 -o "$SVC_USER" -g "$SVC_USER" "$DATA_DIR" "$DATA_DIR/backups" "$DATA_DIR/leap-certs"
install -d -m 0750 -o root -g "$SVC_USER" "$CONF_DIR"
# Service reads code but cannot modify it.
chown -R root:root "$INSTALL_DIR"
git config --system --get-all safe.directory 2>/dev/null | grep -qx "$INSTALL_DIR" || git config --system --add safe.directory "$INSTALL_DIR"
ok "User '$SVC_USER', data in $DATA_DIR, config in $CONF_DIR"

# ----------------------------------------------------------------------------- import old data
import_dir() {
  local src="$1"
  local data="$src/mock-server/data"
  [[ -d "$data" ]] || data="$src"
  if [[ -f "$DATA_DIR/waveguard-data.json" ]]; then
    warn "Data already exists in $DATA_DIR — not importing (move it away first to re-import)"
    return
  fi
  if [[ -f "$data/waveguard-data.json" ]]; then
    cp -a "$data/waveguard-data.json" "$DATA_DIR/"
    for f in integrations.db integrations.db-wal integrations.db-shm; do [[ -f "$data/$f" ]] && cp -a "$data/$f" "$DATA_DIR/"; done
    [[ -d "$src/mock-server/uploads" ]] && cp -a "$src/mock-server/uploads" "$DATA_DIR/" || true
    for certs in "$src/mock-server/leap-certs" "$src/leap-certs"; do
      [[ -d "$certs" ]] && cp -a "$certs/." "$DATA_DIR/leap-certs/" || true
    done
    chown -R "$SVC_USER:$SVC_USER" "$DATA_DIR"
    ok "Imported equipment, cables, settings and Lutron pairing from $src"
  else
    warn "No waveguard-data.json found under $src — nothing imported"
  fi
}
if [[ -n "$IMPORT_FROM" ]]; then
  step "Importing data from $IMPORT_FROM"
  import_dir "$IMPORT_FROM"
elif [[ -f "$INSTALL_DIR/mock-server/data/waveguard-data.json" && ! -f "$DATA_DIR/waveguard-data.json" ]]; then
  step "Found data from the previous version in this folder — importing it"
  import_dir "$INSTALL_DIR"
fi

# ----------------------------------------------------------------------------- config
step "Writing configuration"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
# WaveGuard server configuration. Restart after editing:  sudo systemctl restart waveguard
NODE_ENV=production
PORT=$PORT
HOST=0.0.0.0
WAVEGUARD_DATA_DIR=$DATA_DIR
WAVEGUARD_CONFIG_DIR=$DATA_DIR/leap-certs
# Set to true only for demos without a real network.
WAVEGUARD_USE_MOCK_SCAN=false
# Days of monitoring history to keep.
WAVEGUARD_MONITOR_HISTORY_DAYS=60
# Set to true if you put WaveGuard behind an HTTPS reverse proxy.
WAVEGUARD_SECURE_COOKIES=false
# Optional machine-to-machine API token (Authorization: Bearer ...).
WAVEGUARD_API_TOKEN=
EOF
  if [[ -n "$ADMIN_PASSWORD" ]]; then echo "WAVEGUARD_ADMIN_PASSWORD=$ADMIN_PASSWORD" >> "$ENV_FILE"; fi
  chown root:"$SVC_USER" "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
  ok "Created $ENV_FILE"
else
  sed -i "s/^PORT=.*/PORT=$PORT/" "$ENV_FILE"
  ok "Kept existing $ENV_FILE (port set to $PORT)"
fi

# ----------------------------------------------------------------------------- build
step "Installing application dependencies and building the web UI (a few minutes)"
cd "$INSTALL_DIR"
npm ci --no-audit --no-fund --loglevel=error
npm run build --silent
ok "Web UI built into $INSTALL_DIR/dist"

# ----------------------------------------------------------------------------- systemd
step "Installing services"
for unit in waveguard.service waveguard-update.path waveguard-update.service waveguard-backup.service waveguard-backup.timer; do
  sed "s#@INSTALL_DIR@#$INSTALL_DIR#g" "$INSTALL_DIR/deploy/systemd/$unit" > "/etc/systemd/system/$unit"
done
chmod +x "$INSTALL_DIR/deploy/"*.sh
ln -sf "$INSTALL_DIR/deploy/waveguard-cli.sh" /usr/local/bin/waveguard
systemctl daemon-reload
systemctl enable waveguard.service waveguard-update.path waveguard-backup.timer >/dev/null
systemctl restart waveguard.service
systemctl start waveguard-update.path waveguard-backup.timer
ok "waveguard.service, nightly backup timer, web-UI update watcher"

# ----------------------------------------------------------------------------- wait + report
step "Starting WaveGuard"
for i in $(seq 1 45); do
  if curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  journalctl -u waveguard -n 40 --no-pager || true
  die "WaveGuard did not start. See the log above, or run: sudo journalctl -u waveguard -e"
fi
ok "Running"
# The admin password is only needed for the very first start.
sed -i '/^WAVEGUARD_ADMIN_PASSWORD=/d' "$ENV_FILE"

IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | head -3 | tr '\n' ' ')
URL_PORT=$([[ "$PORT" == "80" ]] && echo "" || echo ":$PORT")
echo
echo "${c_green}=================================================================${c_off}"
echo "${c_green}  WaveGuard is installed${c_off}"
echo
for ip in $IPS; do echo "  Open:      http://$ip$URL_PORT/"; done
if [[ -f "$DATA_DIR/initial-admin-password.txt" ]]; then
  echo
  echo "  First login (change it straight away in Settings → My account):"
  sed 's/^/             /' "$DATA_DIR/initial-admin-password.txt"
elif [[ -n "$ADMIN_PASSWORD" ]]; then
  echo "  Login:     admin / (the password you supplied)"
fi
echo
echo "  Manage:    waveguard status | logs | restart | update | backup | reset-admin"
echo "${c_green}=================================================================${c_off}"
