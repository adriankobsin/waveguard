# Installing WaveGuard on a Debian mini PC

WaveGuard runs as a single service on a small Linux PC in the rack. The PC serves the web console to any laptop, tablet or phone on the vessel network. It needs no cloud account and keeps working offline.

## What you need

- A mini PC with **Debian 12 or newer** (Ubuntu 22.04+ also works), 64-bit (amd64 or arm64), 4 GB RAM and 32 GB disk or more.
- A wired connection to the vessel's management network, ideally on the same VLAN as the switches and AV/control equipment.
- Internet access **during installation and updates only**.

## New installation

Log in to the mini PC (keyboard and screen, or SSH) and run:

```bash
sudo apt update && sudo apt install -y git
sudo git clone https://github.com/adriankobsin/waveguard.git /opt/waveguard
sudo /opt/waveguard/deploy/install.sh
```

The installer takes about 5–10 minutes. It:

1. Installs Node.js 22 and the network tools WaveGuard uses: `ping`, `traceroute`, `mtr`, `nmap`, `arp-scan`, `snmp`, `tshark`, `tcpdump`, `lldpd`, `avahi`, `iperf3`, `dig`, `ethtool`, plus the IEEE MAC-manufacturer database.
2. Creates a locked-down `waveguard` service account. Data lives in `/var/lib/waveguard` and settings in `/etc/waveguard/waveguard.env`.
3. Builds the web console and installs these systemd services:
   - `waveguard` — the app. Starts at boot and restarts if it crashes.
   - `waveguard-backup.timer` — a data backup every night at 02:30 (the newest 14 are kept).
   - `waveguard-update.path` — lets an administrator update from the web console.
4. Prints the web address and a **one-time admin password**.

Open the address it prints (for example `http://192.168.1.20/`) and sign in as `admin` with that password. You'll be asked to set your own password. Do that first.

### Options

| Option | Meaning |
|---|---|
| `--port 8080` | Serve on a different port (default 80) |
| `--admin-password 'Something-Long-1'` | Use your own admin password instead of a generated one |
| `--import-from /path/to/old/waveguard` | Bring across data from an older WaveGuard install (see below) |
| `--skip-tools` | Don't install the network tool packages |

## Moving from the old version on the boat

The old version kept its data inside the code folder, in `mock-server/data/waveguard-data.json`. That file held equipment, cables, settings, the credentials vault and the Lutron connection. The new version keeps data separate from the code, and the installer can copy it across:

```bash
# Example: the old copy is in /home/wave/waveguard
sudo git clone https://github.com/adriankobsin/waveguard.git /opt/waveguard
sudo /opt/waveguard/deploy/install.sh --import-from /home/wave/waveguard
```

It copies equipment, cables, settings, the credentials vault, uploaded logos and documents, and the Lutron LEAP pairing certificates. Stored device passwords are encrypted on disk the first time the new version saves.

User accounts are **not** carried over. The old ones used default passwords, so you get a fresh `admin` account instead. Create a personal account for each person under **Settings → Users & roles**.

When the new version is working, stop the old one (`Ctrl+C` in its terminal, or remove whatever started `npm run dev:all`).

## Day-to-day management

```bash
waveguard status          # running? which version? web address
waveguard logs            # live log (Ctrl+C to stop)
sudo waveguard restart
sudo waveguard update     # latest version from GitHub, with automatic rollback
sudo waveguard backup     # backup now -> /var/lib/waveguard/backups
sudo waveguard restore /var/lib/waveguard/backups/waveguard-YYYYMMDD-HHMMSS.tar.gz
sudo waveguard reset-admin   # forgotten the admin password
sudo waveguard config        # edit port and other server settings
```

To update from the web console instead: **Settings → Server & updates → Check for updates → Install update now**. WaveGuard backs up the data, downloads the new version, rebuilds and restarts. If the new version fails to start, it rolls back on its own.

## User roles

| Role | Can do |
|---|---|
| Administrator | Everything, including users, credentials, alert channels, updates, factory reset |
| Technician | Network scans, monitors, config backups, discovery, device settings |
| Crew / operator | Day-to-day control: lighting, audio, HVAC, maintenance tasks |
| Viewer | Look at everything, change nothing |

## Getting alerts off the boat

On the **Monitoring** page:

1. Click **Import from equipment** to start a ping monitor for every device that has an IP address. Switches, routers, processors, NVRs and UPSs are marked *critical*.
2. Add extra checks with **Add monitor**: a TCP port such as Crestron 41794 or Lutron 8081, a web page, DNS, or a certificate's expiry date.
3. Open **Alert channels → Add channel** and pick one:
   - **Email (SMTP)**, for example an Office 365 mailbox for the Wave support team.
   - **Telegram**: make a bot with @BotFather and add it to a crew group.
   - **ntfy**: install the ntfy app on your phone and subscribe to a hard-to-guess topic name.
   - **Slack, Teams or Discord** through a webhook.
4. Press **Test** on each channel.

Use **Maintenance mode** while you work on the rack, so restarts don't send alerts.

## HTTPS (optional)

WaveGuard serves plain HTTP on the vessel LAN. If the console is reachable from outside the management network, put it behind a reverse proxy with TLS (for example Caddy or nginx) and set `WAVEGUARD_SECURE_COOKIES=true` in `/etc/waveguard/waveguard.env`. For remote support, a VPN such as Tailscale or WireGuard is a better option than port-forwarding.

## Troubleshooting

- **The page doesn't load:** run `waveguard status` and `waveguard logs`.
- **"Not installed on this server" on Network Tools:** re-run `sudo /opt/waveguard/deploy/install.sh`. It is safe to run again and keeps your data.
- **No LLDP neighbours:** enable LLDP on the switch port. On Cisco Catalyst 1300 it's on by default.
- **No PTP or Dante traffic in the Dante / AES67 tool:** the mini PC has to be on the Dante VLAN, and IGMP snooping must let 224.0.1.129 reach its port.
