import { useState } from "react";
import {
  HelpCircle, Server, Cpu, Lightbulb, Music, Network, Zap,
  ChevronDown, ChevronRight, BookOpen, Globe, Shield,
  Radio, CheckCircle2, AlertTriangle, Info, FileDown, Loader2
} from "lucide-react";
import { base44 } from "@/api/base44Client";

// ─── Data ────────────────────────────────────────────────────────────────────

const USAGE_SECTIONS = [
  {
    id: "overview",
    icon: BookOpen,
    title: "Platform Overview",
    steps: [
      {
        label: "What is Wave Guard?",
        body: `Wave Guard is an enterprise AV & network management platform designed for superyachts, large vessels, commercial facilities, and marine environments. It centralises:

• Real-time SNMP network monitoring across all devices
• Interactive network topology mapping
• Preventative maintenance scheduling & tracking
• Physical cable register management
• Multi-protocol lighting control (Lutron, DALI, DMX, KNX)
• AI-assisted fault diagnostics and natural language control
• Automated alerting and rule-based actions
• PDF/CSV report generation

The platform runs as a web application and can be self-hosted on a local server with zero internet dependency.`
      },
      {
        label: "User Roles",
        body: `Two roles exist:

Admin — Full access to all pages, settings, integrations, device management, and user management. Only admins can configure SNMP credentials, create automation rules, and deploy firmware changes.

User — Read access to dashboards, topology, maintenance tasks, and reports. Can mark maintenance tasks complete and view lighting status but cannot modify system settings.

To change a user's role: go to Settings → Users → edit the user record.`
      }
    ]
  },
  {
    id: "dashboard",
    icon: Server,
    title: "Dashboard",
    steps: [
      {
        label: "Step 1 — Understanding the Dashboard",
        body: `The Dashboard is the home screen showing real-time KPIs across your network and AV infrastructure. Default widgets include:
• Network health score (% devices online)
• Active alarms count
• Recent SNMP events
• Maintenance tasks due this week
• Bandwidth utilisation charts`
      },
      {
        label: "Step 2 — Customising Widgets",
        body: `1. Click the Edit Layout button (pencil icon, top-right of dashboard)
2. Drag widgets to reposition them on the grid
3. Use the resize handle (bottom-right corner of each widget) to resize
4. Click + Add Widget to add new widgets from the library
5. Click the × on any widget to remove it
6. Click Save Layout when done — your layout persists across sessions`
      },
      {
        label: "Step 3 — Reading Alarms",
        body: `The bell icon in the top bar shows unread alarms. Click it to see:
• Red (Critical) — immediate action required, e.g. device offline
• Amber (Warning) — degraded performance, e.g. high latency
• Blue (Info) — informational events, e.g. device rebooted

Click any alarm to navigate to the affected device's detail page.`
      }
    ]
  },
  {
    id: "topology",
    icon: Network,
    title: "Topology & Network Map",
    steps: [
      {
        label: "Step 1 — Scanning the Network",
        body: `1. Navigate to Topology from the sidebar
2. Click Refresh (top toolbar) to trigger a fresh SNMP scan
3. The scan polls all configured SNMP devices and rebuilds the node graph
4. Devices are categorised automatically: Network, Camera, AV, Server, Power
5. Status dots (green/amber/red) update in real time`
      },
      {
        label: "Step 2 — Navigating the Map",
        body: `• Scroll wheel — zoom in/out
• Click + drag on empty canvas — pan the view
• Click + drag a node — reposition it (position is saved with your layout)
• Click a node — opens the detail panel on the right showing IP, MAC, firmware, uptime, connections
• Use the Legend (bottom-left) to filter by category or status`
      },
      {
        label: "Step 3 — Tracing a Signal Path",
        body: `1. Click Trace Path in the toolbar
2. Click the source device (highlighted orange)
3. Click the destination device
4. The shortest path is highlighted with animated orange arrows
5. A hop count and ordered node list appears at the bottom
6. Click Cancel Path Trace or × to clear`
      },
      {
        label: "Step 4 — Creating Device Groups",
        body: `1. Click the Groups button (bottom-left of map)
2. Click + New Group, enter a name and pick a colour
3. Select devices from the list to add to the group
4. Groups appear in the legend and can be used to filter the map
5. Collapse a group to simplify the topology view`
      },
      {
        label: "Step 5 — Importing Devices via CSV",
        body: `1. Click Import CSV in the toolbar
2. Download the template CSV for the correct column format
3. Fill in: name, ip, mac, category, status, model, location, firmware
4. Upload the completed file
5. Preview the rows — uncheck any you want to skip
6. Click Import — devices are added to the topology immediately`
      },
      {
        label: "Step 6 — Saving Layouts",
        body: `1. Arrange nodes as desired by dragging them
2. Click Save Layout — enter a name
3. Optionally set it as the Default layout (loaded on next visit)
4. Use the Layout Selector dropdown to switch between saved layouts
5. Layouts store node X/Y positions and custom connections`
      }
    ]
  },
  {
    id: "maintenance",
    icon: Zap,
    title: "Maintenance Scheduling",
    steps: [
      {
        label: "Step 1 — Creating a Maintenance Task",
        body: `1. Go to Maintenance in the sidebar
2. Click + Add Task
3. Fill in:
   • Title (required) — e.g. "Camera lens cleaning"
   • Description — detailed instructions for the technician
   • Equipment — device name this task applies to
   • Due Date — when the task is next due
   • Interval (days) — how often it recurs (e.g. 30, 90, 365)
   • Assigned To — person responsible
   • Status — start as Pending
4. Click Create Task — it appears on the calendar`
      },
      {
        label: "Step 2 — Using the Calendar View",
        body: `• Navigate months with ← → arrows
• Click any date to see tasks due that day in the right panel
• Colour dots on dates: Amber=Pending, Blue=In Progress, Green=Completed, Red=Not Completed
• Click + Add next to the date panel to create a task pre-filled with that date
• Overdue tasks (past due and not completed) appear in the red banner at the top`
      },
      {
        label: "Step 3 — Updating Task Status",
        body: `From either the calendar day-panel or the List view, each task card has action buttons:
• Start — moves task to In Progress (ETO has begun the work)
• Complete — marks as Completed, records today as last_performed_at
• Reopen — moves a completed task back to Not Completed if issues found
• Edit — opens the edit modal to change any field

When a task is completed, the next occurrence should be created manually or via the automation rules.`
      },
      {
        label: "Step 4 — Searching Tasks",
        body: `1. Click the Search tab in the top view toggle
2. Type in the search box to filter by title, equipment, description, or assigned person
3. Optionally pick a specific date to filter by due date
4. Results update live as you type`
      }
    ]
  },
  {
    id: "cables",
    icon: Radio,
    title: "Cable Register",
    steps: [
      {
        label: "Step 1 — Adding a Cable Manually",
        body: `1. Go to Cables in the sidebar
2. Click + Add Cable
3. Fill in: Label (e.g. C-007), From device, To device, Cable type, System category, Length, Deck/location, Status, Notes
4. Click Save — the cable appears in the register table immediately`
      },
      {
        label: "Step 2 — Importing via CSV",
        body: `1. Click Import CSV
2. Download the template — columns: label, type, system_category, from_equipment, to_equipment, length, deck, status, notes
3. Fill in your cable schedule spreadsheet and save as CSV
4. Upload the file — a preview table shows all rows
5. Uncheck any rows you want to skip
6. Click Import X cables to commit
7. All imported cables appear instantly in the register`
      },
      {
        label: "Step 3 — Searching & Filtering",
        body: `Use the search bar to filter by any field: label, device names, cable type, deck, or notes. Results filter live.`
      },
      {
        label: "Step 4 — SNMP Port Fault Detection",
        body: `Expand the SNMP Port Map panel at the bottom of the Cables page. This cross-references cable endpoints with live SNMP port status. If a port is reported DOWN by the switch, the corresponding cable row is highlighted red with a fault indicator.`
      }
    ]
  },
  {
    id: "security-usage",
    icon: Shield,
    title: "Security Best Practices",
    steps: [
      {
        label: "Network Segmentation",
        body: `• Place the Wave Guard server on a dedicated Management VLAN
• AV/control devices (Crestron, QSC, Lutron, DALI gateways) should be on a separate AV VLAN
• Guest and crew Wi-Fi must be isolated from both management and AV VLANs
• Use the Cisco switch ACLs to restrict inter-VLAN routing to only required ports`
      },
      {
        label: "Credentials & API Keys",
        body: `• Never hardcode passwords or API keys in source files
• Store all secrets in the .env file on the local server
• Rotate SNMP community strings quarterly
• Use SNMP v3 with AuthPriv (AES-128 + SHA) wherever supported
• Revoke and regenerate API tokens if a device is decommissioned or crew changes`
      },
      {
        label: "Access Control",
        body: `• Only grant Admin role to the ETO and senior AV technician
• Crew and guest accounts should have User role only
• Review user list monthly — remove accounts for crew who have left
• Enable browser session timeout in Settings → Security`
      }
    ]
  }
];

const DEPLOY_STEPS = [
  {
    label: "Step 1 — Prepare the Server Hardware",
    body: `Minimum requirements:
• OS: Ubuntu 22.04 LTS (recommended) / Debian 12 / Windows Server 2022
• CPU: 4-core x86_64 (Intel i5 8th gen or equivalent)
• RAM: 8 GB (16 GB recommended for larger networks)
• Storage: 50 GB SSD
• Network: 1 GbE NIC with static IP on the local network
• Optional: secondary NIC for out-of-band management

Recommended server hardware for maritime deployment:
• Advantech ARK-3520 (fanless, vibration-resistant)
• Intel NUC 12 Pro (compact, low power)
• Any mini-PC with passive cooling`
  },
  {
    label: "Step 2 — Install the Operating System",
    body: `On Ubuntu 22.04:
1. Download Ubuntu Server 22.04 LTS from ubuntu.com
2. Flash to USB using Balena Etcher
3. Boot server from USB, follow installer
4. During install: set static IP, enable OpenSSH server
5. After install, update the system:

   sudo apt update && sudo apt upgrade -y

6. Set the hostname:
   sudo hostnamectl set-hostname guardian-ai`
  },
  {
    label: "Step 3 — Install Node.js & Dependencies",
    body: `# Install Node.js 20 LTS via NodeSource:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify:
node --version   # should show v20.x.x
npm --version    # should show 10.x.x

# Install 'serve' for production static serving:
sudo npm install -g serve

# Install git:
sudo apt install -y git`
  },
  {
    label: "Step 4 — Deploy the Application",
    body: `# Create application directory:
sudo mkdir -p /opt/guardian-ai
sudo chown $USER:$USER /opt/guardian-ai

# Copy your built app files to the server (from your dev machine):
scp -r ./dist/* user@<server-ip>:/opt/guardian-ai/

# Or clone from your GitHub repo:
git clone https://github.com/<your-org>/guardian-ai.git /opt/guardian-ai
cd /opt/guardian-ai
npm install
npm run build`
  },
  {
    label: "Step 5 — Configure Environment Variables",
    body: `# Create the .env file:
nano /opt/guardian-ai/.env

# Add your configuration:
NODE_ENV=production
PORT=8080

# SNMP
SNMP_COMMUNITY=your_community_string
SNMP_VERSION=2c

# Cisco
CISCO_RESTCONF_HOST=192.168.1.1
CISCO_RESTCONF_USER=admin
CISCO_RESTCONF_PASS=yourpassword
CISCO_MERAKI_API_KEY=your_meraki_key

# QSC Q-SYS
QSYS_HOST=192.168.1.50
QSYS_PORT=1710

# Crestron
CRESTRON_HOST=192.168.1.100
CRESTRON_API_USER=admin
CRESTRON_API_PASS=yourpassword

# Lutron
LUTRON_HOST=192.168.1.200

# DALI Gateway
DALI_GATEWAY_HOST=192.168.1.201

# DMX / Art-Net
DMX_ARTNET_HOST=192.168.1.202

# KNX
KNX_GATEWAY_HOST=192.168.1.203

# Save and close: Ctrl+X, Y, Enter`
  },
  {
    label: "Step 6 — Test the Application",
    body: `# Start the app manually first to verify it works:
cd /opt/guardian-ai
serve -s dist -l 8080

# From another machine on the same network, open a browser:
# http://<server-ip>:8080

# Check you can see the Wave Guard login page
# Log in with your admin credentials
# Verify the Dashboard loads correctly

# Press Ctrl+C to stop the test server before proceeding to Step 7`
  },
  {
    label: "Step 7 — Create a systemd Service (Auto-start)",
    body: `# Create service file:
sudo nano /etc/systemd/system/guardian-ai.service

# Paste the following:
[Unit]
Description=Wave Guard Platform
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=guardian
Group=guardian
WorkingDirectory=/opt/guardian-ai
ExecStart=/usr/bin/serve -s dist -l 8080
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=guardian-ai
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Create a dedicated user for security:
sudo useradd -r -s /bin/false guardian
sudo chown -R guardian:guardian /opt/guardian-ai

# Enable and start:
sudo systemctl daemon-reload
sudo systemctl enable guardian-ai
sudo systemctl start guardian-ai

# Check status:
sudo systemctl status guardian-ai`
  },
  {
    label: "Step 8 — Set Up Nginx Reverse Proxy (HTTPS)",
    body: `# Install Nginx:
sudo apt install -y nginx

# Generate a self-signed certificate (or use Let's Encrypt):
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \\
  -keyout /etc/ssl/private/guardian.key \\
  -out /etc/ssl/certs/guardian.crt \\
  -subj "/CN=guardian.local/O=Wave Guard"

# Create Nginx config:
sudo nano /etc/nginx/sites-available/guardian-ai

# Paste:
server {
    listen 80;
    server_name guardian.local;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name guardian.local;
    ssl_certificate     /etc/ssl/certs/guardian.crt;
    ssl_certificate_key /etc/ssl/private/guardian.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable and reload:
sudo ln -s /etc/nginx/sites-available/guardian-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable --now nginx`
  },
  {
    label: "Step 9 — Configure Local DNS",
    body: `So crew can reach the platform at https://guardian.local instead of an IP address:

Option A — Router/DHCP DNS entry:
  Log into your managed switch or router
  Add a static DNS record: guardian.local → <server-ip>

Option B — Hosts file on each client (quick test):
  Windows: C:\\Windows\\System32\\drivers\\etc\\hosts
  Mac/Linux: /etc/hosts
  Add line: 192.168.x.x   guardian.local

Option C — Pi-hole or local DNS server:
  Add an A record: guardian.local → <server-ip>
  Clients must use the Pi-hole as their DNS server`
  },
  {
    label: "Step 10 — Docker Deployment (Alternative)",
    body: `If you prefer Docker:

# Build the image:
docker build -t guardian-ai:latest .

# Run with auto-restart and env file:
docker run -d \\
  --name guardian-ai \\
  --restart unless-stopped \\
  -p 8080:8080 \\
  --env-file /opt/guardian-ai/.env \\
  guardian-ai:latest

# View logs:
docker logs -f guardian-ai

# Update to new version:
docker pull guardian-ai:latest
docker stop guardian-ai && docker rm guardian-ai
docker run -d ... (repeat run command above)

# Docker Compose (recommended for production):
# See docker-compose.yml in the project root`
  },
  {
    label: "Step 11 — Verify & Monitor",
    body: `After deployment, verify everything is working:

1. Open https://guardian.local in a browser — login page should appear
2. Log in as admin — Dashboard should load with no errors
3. Navigate to Topology → click Refresh — SNMP scan should populate devices
4. Check Settings → Integrations — confirm all credentials are saved
5. Navigate to Maintenance — sample tasks should be visible

Monitor ongoing health:
# View app logs:
sudo journalctl -u guardian-ai -f

# Check system resources:
htop

# Check disk space:
df -h /opt/guardian-ai

# Set up log rotation:
sudo nano /etc/logrotate.d/guardian-ai`
  }
];

const INTEGRATION_SECTIONS = [
  {
    id: "cisco",
    icon: Network,
    title: "Cisco Networks",
    color: "blue",
    steps: [
      {
        label: "Step 1 — Enable SNMP on Cisco IOS/IOS-XE",
        body: `Connect to the switch/router via SSH or console:

! Read-only community string
snmp-server community YOUR_COMMUNITY RO

! Send traps to Wave Guard server
snmp-server host 192.168.1.10 YOUR_COMMUNITY

! Enable interface and entity traps
snmp-server enable traps snmp linkup linkdown
snmp-server enable traps entity

! Verify:
show snmp
show snmp community`
      },
      {
        label: "Step 2 — Enable RESTCONF on IOS-XE",
        body: `! Enable HTTPS server (required for RESTCONF):
ip http secure-server
ip http authentication local

! Enable RESTCONF:
restconf

! Create API user:
username apiadmin privilege 15 secret YOUR_PASSWORD

! Verify:
show restconf state
# Test from browser: https://<switch-ip>/restconf/data/
# Auth: Basic apiadmin:YOUR_PASSWORD`
      },
      {
        label: "Step 3 — Configure Meraki API",
        body: `1. Log into dashboard.meraki.com
2. Go to Organization → Settings
3. Enable Dashboard API access (toggle ON)
4. Go to your profile (top right) → API access → Generate new API key
5. Copy the key — store it in .env as CISCO_MERAKI_API_KEY
6. Find your Organization ID:
   GET https://api.meraki.com/api/v1/organizations
   Headers: X-Cisco-Meraki-API-Key: YOUR_KEY
7. Find your Network ID from the organization response`
      },
      {
        label: "Step 4 — Add to Wave Guard Settings",
        body: `1. Open Wave Guard → Settings → Integrations → Cisco
2. Enter:
   • SNMP Community string
   • SNMP version (v2c or v3)
   • RESTCONF host IP, username, password
   • Meraki API key, Org ID, Network ID
3. Click Test Connection — green tick confirms success
4. Navigate to Topology → Refresh to pull Cisco device data`
      }
    ]
  },
  {
    id: "qsc",
    icon: Music,
    title: "QSC Q-SYS",
    color: "purple",
    steps: [
      {
        label: "Step 1 — Enable External Control in Q-SYS Designer",
        body: `1. Open Q-SYS Designer on your laptop
2. Connect to the Core processor
3. Go to File → Design Properties
4. Enable External Control Protocol (ECP) — tick the checkbox
5. Note the Core's IP address (Status bar → Core IP)
6. Default control port: 1710 (TCP)
7. Save and push the design to the Core`
      },
      {
        label: "Step 2 — Test QRC Connection",
        body: `Test using Telnet or a TCP client (e.g. Packet Sender):

# Connect to Core:
telnet 192.168.1.50 1710

# Send a no-op to verify connection:
{"jsonrpc":"2.0","id":1,"method":"NoOp","params":{}}

# Expected response:
{"jsonrpc":"2.0","id":1,"result":{}}`
      },
      {
        label: "Step 3 — Discover Component Names",
        body: `Components are named in your Q-SYS design. To list all:

{"jsonrpc":"2.0","id":2,"method":"Component.GetComponents","params":{}}

# Response includes all named components, e.g.:
# "Main_Gain", "Zone1_Router", "AmbientMic"

# Get controls for a specific component:
{"jsonrpc":"2.0","id":3,"method":"Component.GetControls",
 "params":{"Name":"Main_Gain"}}`
      },
      {
        label: "Step 4 — Add to Wave Guard Settings",
        body: `1. Go to Settings → Integrations → QSC Q-SYS
2. Enter Core IP address and port (default 1710)
3. Enter username/password if your design uses access levels
4. Click Test — the platform will send a NoOp and confirm response
5. Component names discovered during test are saved for use in Automation rules`
      }
    ]
  },
  {
    id: "crestron",
    icon: Cpu,
    title: "Crestron",
    color: "orange",
    steps: [
      {
        label: "Step 1 — Enable REST API on Crestron (VC-4/4-Series)",
        body: `On a 4-Series or VC-4 processor:

1. Open Crestron Toolbox → connect to processor
2. Go to Device Discovery → right-click processor → Web Interface
3. Log in with admin credentials
4. Navigate to Security → API Settings
5. Enable REST API
6. Note the processor IP address
7. Recommended: create a dedicated API user with limited permissions`
      },
      {
        label: "Step 2 — Find Your Join Numbers",
        body: `Join numbers are defined in your SIMPL Windows or SIMPL+ program:

In SIMPL Windows:
1. Open your program file
2. Look at the Ethernet/IP Connect symbol or XPanel symbol
3. Note the Digital, Analog, and Serial join assignments

In Crestron Studio:
1. Open the project
2. Check the UI components for their assigned join numbers

Document these — you'll need them to map controls in Wave Guard.`
      },
      {
        label: "Step 3 — Test API Connectivity",
        body: `# Test device info endpoint:
curl -k -u admin:password https://192.168.1.100/cws/api/device/info

# Expected response:
{
  "DeviceModel": "CP4",
  "FirmwareVersion": "2.8000.00081",
  "MACAddress": "00:10:7F:xx:xx:xx"
}

# If you get a 401, check credentials
# If connection refused, verify REST API is enabled on the processor`
      },
      {
        label: "Step 4 — Add to Wave Guard Settings",
        body: `1. Go to Settings → Integrations → Crestron
2. Enter processor IP, username, password
3. Map join numbers to Wave Guard control labels:
   • Digital 1 = "AV System Power"
   • Analog 10 = "Master Volume"
   • Serial 1 = "Display Source Select"
4. Click Save & Test Connection
5. Joined controls appear in the Automation page as available actions`
      }
    ]
  },
  {
    id: "lutron",
    icon: Lightbulb,
    title: "Lutron Lighting",
    color: "yellow",
    steps: [
      {
        label: "Step 1 — Enable Integration Protocol on Lutron Processor",
        body: `For RadioRA 3 / Homeworks QSX:
1. Open Lutron Designer software
2. Connect to the main repeater/processor
3. Go to Integration → Enable Integration Protocol
4. For LEAP API: note the processor IP and ensure TLS is enabled
5. For Telnet (legacy): set Telnet port to 23, enable in Integration settings

For Caseta Pro Bridge:
1. Open the Lutron app → Settings → Advanced → Integration
2. Enable the Integration API
3. Note the bridge IP address (shown in app)`
      },
      {
        label: "Step 2 — Obtain LEAP Certificates",
        body: `LEAP uses mutual TLS — you need client certificates:

1. Connect to the Lutron processor via LEAP on port 443
2. Send a certificate signing request to pair your client:

# Using Python lutron-caseta library to pair:
python3 -c "
import asyncio
from pylutron_caseta.smartbridge import Smartbridge
bridge = Smartbridge.create_tls('192.168.1.200')
asyncio.run(bridge.connect())
"
# Follow the pairing instructions — press the physical button on the bridge
# Certificates are saved automatically

3. Copy the generated .crt, .key, and cacert.crt files to /opt/guardian-ai/certs/
4. Update .env: LUTRON_CERT=./certs/lutron.crt, LUTRON_KEY=./certs/lutron.key`
      },
      {
        label: "Step 3 — Discover Zones and Devices",
        body: `Once connected via LEAP, query available zones:

{"CommuniqueType":"ReadRequest","Header":{"Url":"/zone"}}

# Response lists all zones with:
# - Zone ID (e.g. 1, 2, 3...)
# - Zone name (matches your Lutron Designer labels)
# - Current level

# Map zone IDs to your Wave Guard Lighting zones in:
# Settings → Integrations → Lutron → Zone Mapping`
      },
      {
        label: "Step 4 — Configure in Wave Guard",
        body: `1. Go to Settings → Integrations → Lutron
2. Select protocol: LEAP (RadioRA 3/HWQSx) or Telnet (older systems)
3. Enter processor IP
4. For LEAP: upload cert, key, and CA cert files
5. For Telnet: enter username (lutron) and password (integration — factory default)
6. Click Discover Zones — all zones appear in a list
7. Assign each zone to a Wave Guard room/area
8. Zones are now controllable from the Lighting page`
      }
    ]
  },
  {
    id: "dali",
    icon: Zap,
    title: "DALI",
    color: "green",
    steps: [
      {
        label: "Step 1 — Identify Your DALI Gateway",
        body: `DALI buses require an IP gateway. Common manufacturers:
• Helvar DALI Router 910/920 — TCP port 50000 (ASCII protocol)
• Tridonic DALI Gateway — REST API
• Lunatone DALI Gateway — UDP/TCP
• ENTTEC DALI USB/Ethernet — OLA compatible

Find the gateway's IP via your network's DHCP table or use the manufacturer's discovery tool.`
      },
      {
        label: "Step 2 — Configure the DALI Gateway",
        body: `For Helvar:
1. Open Helvar Designer software
2. Scan the network for the router
3. Address all DALI gear (ballasts/drivers) — each gets an address 0–63
4. Create groups (0–15) to organise by zone
5. Create scenes (0–15) for preset light levels
6. Note: groups and scene assignments are stored in the gateway

For Tridonic / generic gateways:
1. Use the gateway's web interface to commission the DALI bus
2. Assign short addresses to each gear
3. Configure groups and scenes via the web UI`
      },
      {
        label: "Step 3 — Test DALI Commands",
        body: `For Helvar TCP (port 50000):
# Open a TCP connection to the gateway
# Send commands in Helvar ASCII format:

>V:2,C:13,G:1@        # Query group 1 level
>V:2,C:16,G:1,L:75@   # Set group 1 to 75%
>V:2,C:11,G:1,B:1@    # Recall block 1 (scene) on group 1

# Test using: nc <gateway-ip> 50000
nc 192.168.1.201 50000
>V:2,C:13,G:1@`
      },
      {
        label: "Step 4 — Add to Wave Guard",
        body: `1. Go to Settings → Integrations → DALI
2. Select gateway type (Helvar / Tridonic / OLA)
3. Enter gateway IP and port
4. Click Discover Groups — DALI groups 0–15 are listed
5. Name each group to match your space (e.g. "Saloon Ceiling", "Bridge Wash")
6. Assign groups to Wave Guard Lighting zones
7. Scenes discovered from the gateway appear as preset options in the Lighting page`
      }
    ]
  },
  {
    id: "dmx",
    icon: Radio,
    title: "DMX / Art-Net",
    color: "pink",
    steps: [
      {
        label: "Step 1 — Choose Your DMX Interface",
        body: `Options for getting DMX onto the IP network:

1. Art-Net Node (recommended) — converts Art-Net UDP → DMX512 wire
   Examples: Enttec ODE MkII, Artistic Licence Net-Lynx, CHAUVET DMXan
   Advantage: no software needed on server, just send UDP packets

2. sACN (E1.31) Node — similar to Art-Net but ANSI standard
   Most modern nodes support both Art-Net and sACN

3. USB-to-DMX with OLA server
   Connect Enttec Open DMX USB to Wave Guard server
   OLA (Open Lighting Architecture) bridges USB → IP API

4. Existing lighting desk with Art-Net output
   If you have an ETC, MA, or similar desk, enable Art-Net output`
      },
      {
        label: "Step 2 — Configure the Art-Net Node",
        body: `On the Art-Net node web interface (browse to node IP):
1. Set the node's IP to a static address on the AV VLAN
2. Assign Art-Net Universe (typically 0 for first DMX universe)
3. Enable Art-Net input (node receives Art-Net from network, outputs DMX wire)
4. Note: Art-Net uses broadcast address 2.x.x.255 OR unicast to node IP

Update .env:
DMX_ARTNET_HOST=<node-ip-or-broadcast>   # e.g. 2.0.0.255
DMX_ARTNET_PORT=6454
DMX_ARTNET_UNIVERSE=0`
      },
      {
        label: "Step 3 — Set Up OLA (if using USB gateway)",
        body: `# On the Wave Guard server:
sudo apt install -y ola

# Start OLA:
sudo olad -l 3

# Open OLA web interface:
# http://localhost:9090

# Add a universe:
# Universes → Add Universe → Universe 0
# Add Output Plugin: "Open DMX USB" (select your device)

# Test via OLA REST API:
curl -X POST http://localhost:9090/dmx \\
  -d "u=0&d=255,0,0,0,128,0,..."   # channel values 0–255`
      },
      {
        label: "Step 4 — Add to Wave Guard",
        body: `1. Go to Settings → Integrations → DMX/Art-Net
2. Select mode: Art-Net Direct / sACN / OLA
3. For Art-Net: enter node IP, port, and universe number
4. For OLA: enter localhost and port 9090
5. Click Patch Channels — map DMX channels to fixture parameters:
   • CH 1 = "House Dimmer Main" (type: dimmer)
   • CH 7-9 = "LED Bar 1 RGB" (type: RGB)
6. Fixtures appear in Lighting page as controllable zones`
      }
    ]
  },
  {
    id: "knx",
    icon: Globe,
    title: "KNX Building Automation",
    color: "red",
    steps: [
      {
        label: "Step 1 — Identify Your KNX IP Interface",
        body: `KNX TP (twisted pair) bus needs an IP interface or router to connect to your network:

• KNX IP Interface — tunnelling only, 1 client at a time
• KNX IP Router — routing between TP and IP, supports multiple clients (recommended)
• Weinzierl 730/760 — popular, reliable IP router
• MDT IP Router SCN-IP100.02 — enterprise grade

Find the device on your network using ETS (Engineering Tool Software) or check your router's DHCP table.`
      },
      {
        label: "Step 2 — Assign Group Addresses in ETS",
        body: `Group Addresses (GAs) are the "channels" of KNX:
1. Open ETS 5/6 on your laptop
2. Connect to the KNX project
3. Note the group addresses for:
   • Lighting on/off (DPT 1.001) — e.g. 1/0/1
   • Dimming value (DPT 5.001 — 0–100%) — e.g. 3/1/5
   • Scene recall (DPT 17.001) — e.g. 5/0/1
   • HVAC setpoint, blind position, etc.
4. Export the group address list as CSV from ETS:
   Overview → Group Addresses → Export

5. Import this CSV in Wave Guard → Settings → KNX → Import GA List`
      },
      {
        label: "Step 3 — Test KNX Communication",
        body: `Using knxtool (Linux):
# Install:
sudo apt install -y knxd

# Connect to IP router:
knxtool on ip:192.168.1.203 1/0/1   # Switch on
knxtool off ip:192.168.1.203 1/0/1  # Switch off

# Or using ETS Diagnostics:
1. ETS → Diagnostics → Group Monitor
2. Send a write telegram to 1/0/1 with value TRUE
3. Verify the light turns on`
      },
      {
        label: "Step 4 — Add to Wave Guard",
        body: `1. Go to Settings → Integrations → KNX
2. Enter IP router/interface host and port (default 3671)
3. Enter the individual address for the Wave Guard client (e.g. 1.1.255)
4. Click Import Group Addresses — upload your ETS CSV export
5. Each GA appears in a list — assign to Wave Guard zones/controls:
   • 1/0/1 → Saloon Lights On/Off
   • 3/1/5 → Saloon Dimmer Level
   • 5/0/1 → Evening Scene
6. Assigned GAs are controllable from Lighting and Automation pages`
      }
    ]
  }
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepBlock({ step, index }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400 mt-0.5">
        {index + 1}
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-sm font-semibold text-white">{step.label}</p>
        <pre className="bg-[#060912] border border-white/8 rounded-xl px-4 py-3 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
          {step.body}
        </pre>
      </div>
    </div>
  );
}

function AccordionSection({ section, accent }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${accent}`}>
            <Icon size={15} />
          </div>
          <span className="text-sm font-semibold text-white">{section.title}</span>
          <span className="text-xs text-slate-500">{(section.steps || []).length} steps</span>
        </div>
        {open ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
      </button>
      {open && (
        <div className="border-t border-white/8 px-5 py-5 space-y-6">
          {(section.steps || []).map((step, i) => <StepBlock key={i} step={step} index={i} />)}
        </div>
      )}
    </div>
  );
}

const COLOR_MAP = {
  blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  green: "text-green-400 bg-green-500/10 border-green-500/20",
  pink: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  red: "text-red-400 bg-red-500/10 border-red-500/20",
  cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  slate: "text-slate-300 bg-white/5 border-white/10",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [tab, setTab] = useState("usage");
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const response = await base44.functions.invoke('generateManualPdf', {});
      const payload = response.data;
      const bytes = payload?.pdfBase64
        ? Uint8Array.from(atob(payload.pdfBase64), c => c.charCodeAt(0))
        : payload;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Wave-Guard-Manual.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: "usage",        label: "Using the Platform" },
    { id: "deploy",       label: "Local Deployment" },
    { id: "integrations", label: "Integration APIs" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <HelpCircle size={20} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Help & Documentation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Step-by-step guides for operation, local deployment, and all integration APIs</p>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 text-sm font-medium transition-all disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          {exporting ? 'Generating PDF…' : 'Export Full Manual (PDF)'}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-cyan-500/8 border border-cyan-500/20 rounded-xl px-4 py-3">
        <Info size={15} className="text-cyan-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-300 leading-relaxed">
          To push this app's source code to a GitHub repository, go to the <strong className="text-white">Base44 Dashboard → Settings → GitHub Sync</strong> and connect your GitHub repo. That feature is managed at the platform level and cannot be triggered from within the app.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3 max-w-4xl">

        {/* Using the Platform */}
        {tab === "usage" && USAGE_SECTIONS.map(s => (
          <AccordionSection key={s.id} section={s} accent={COLOR_MAP[s.color] || COLOR_MAP.slate} />
        ))}

        {/* Local Deployment */}
        {tab === "deploy" && (
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
              <div className="p-2 rounded-lg border text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
                <Server size={15} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Local Server Deployment Guide</p>
                <p className="text-xs text-slate-400">Ubuntu 22.04 LTS · Node.js · Nginx · Docker</p>
              </div>
            </div>
            <div className="px-5 py-5 space-y-6">
              <div className="flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-200">Follow these steps in order. Do not skip steps — each step depends on the previous one being completed correctly.</p>
              </div>
              {DEPLOY_STEPS.map((step, i) => <StepBlock key={i} step={step} index={i} />)}
              <div className="flex items-start gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-200">After completing all 11 steps, Wave Guard is fully operational on your local network with auto-start on boot, HTTPS, and local DNS access.</p>
              </div>
            </div>
          </div>
        )}

        {/* Integration APIs */}
        {tab === "integrations" && (
          <>
            <div className="flex items-start gap-2 p-3 bg-white/4 border border-white/8 rounded-lg">
              <Info size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400">Each integration section provides step-by-step setup instructions. Complete the Local Deployment guide first before configuring integrations.</p>
            </div>
            {INTEGRATION_SECTIONS.map(s => (
              <AccordionSection key={s.id} section={s} accent={COLOR_MAP[s.color] || COLOR_MAP.slate} />
            ))}
          </>
        )}

      </div>
    </div>
  );
}