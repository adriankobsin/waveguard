import { useState } from "react";
import { HelpCircle, Server, Cpu, Lightbulb, Music, Network, Zap, ChevronDown, ChevronRight, Terminal, BookOpen, Globe, Shield, Radio } from "lucide-react";

const SECTIONS = [
  {
    id: "overview",
    icon: BookOpen,
    title: "Platform Overview",
    content: `Guardian AI is an enterprise AV & network management platform built for superyachts, large vessels, and facilities. It provides real-time SNMP monitoring, topology mapping, maintenance scheduling, cable management, lighting control, and AI-assisted diagnostics — all from a single interface.

The platform is designed to run both as a cloud-hosted web app and as a fully autonomous local server deployment with no internet dependency.`
  },
  {
    id: "local-deploy",
    icon: Server,
    title: "Local Server Deployment",
    color: "cyan",
    subsections: [
      {
        title: "System Requirements",
        body: `• OS: Ubuntu 22.04 LTS / Debian 12 / Windows Server 2022
• CPU: 4-core x86_64 (e.g. Intel i5 / Xeon E3)
• RAM: 8 GB minimum, 16 GB recommended
• Storage: 50 GB SSD
• Network: 1 GbE LAN interface
• Node.js 20+ (for build), Docker (optional)
• Static IP on the local network recommended`
      },
      {
        title: "Quick Start (Node.js)",
        body: `# 1. Clone or copy the build onto the server
git clone <repo> /opt/guardian-ai && cd /opt/guardian-ai

# 2. Install dependencies
npm install

# 3. Set environment variables
cp .env.example .env
nano .env   # configure API keys, local IP, SNMP community

# 4. Build the production bundle
npm run build

# 5. Serve the build (example using 'serve')
npm install -g serve
serve -s dist -l 8080

# App is now accessible at http://<server-ip>:8080`
      },
      {
        title: "Docker Deployment",
        body: `# Build image
docker build -t guardian-ai .

# Run container (persistent on reboot)
docker run -d \\
  --name guardian-ai \\
  --restart always \\
  -p 8080:8080 \\
  --env-file .env \\
  guardian-ai

# Access at http://<server-ip>:8080`
      },
      {
        title: "Nginx Reverse Proxy (HTTPS)",
        body: `# /etc/nginx/sites-available/guardian-ai
server {
    listen 80;
    server_name guardian.local;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name guardian.local;
    ssl_certificate     /etc/ssl/certs/guardian.crt;
    ssl_certificate_key /etc/ssl/private/guardian.key;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}`
      },
      {
        title: "Auto-start on Boot (systemd)",
        body: `# /etc/systemd/system/guardian-ai.service
[Unit]
Description=Guardian AI Platform
After=network.target

[Service]
Type=simple
User=guardian
WorkingDirectory=/opt/guardian-ai
ExecStart=/usr/bin/serve -s dist -l 8080
Restart=always

[Install]
WantedBy=multi-user.target

# Enable:
sudo systemctl enable --now guardian-ai`
      }
    ]
  },
  {
    id: "network",
    icon: Network,
    title: "Cisco Network Integration",
    color: "blue",
    subsections: [
      {
        title: "Overview",
        body: `Cisco integration uses SNMP v2c/v3 and the Cisco IOS-XE REST API (RESTCONF/NETCONF). Supports Catalyst, Meraki, and Nexus platforms.`
      },
      {
        title: "SNMP Configuration",
        body: `# On the Cisco switch/router:
snmp-server community <COMMUNITY_STRING> RO
snmp-server host <GUARDIAN_IP> <COMMUNITY_STRING>
snmp-server enable traps

# .env variables:
CISCO_SNMP_COMMUNITY=public
CISCO_SNMP_PORT=161`
      },
      {
        title: "Cisco RESTCONF API",
        body: `# Enable RESTCONF on IOS-XE:
ip http secure-server
restconf

# .env variables:
CISCO_RESTCONF_HOST=192.168.1.1
CISCO_RESTCONF_USER=admin
CISCO_RESTCONF_PASS=<password>

# Example API call:
GET https://{host}/restconf/data/ietf-interfaces:interfaces
Authorization: Basic <base64(user:pass)>
Accept: application/yang-data+json`
      },
      {
        title: "Cisco Meraki",
        body: `# .env variables:
CISCO_MERAKI_API_KEY=<your_meraki_api_key>
CISCO_MERAKI_ORG_ID=<org_id>
CISCO_MERAKI_NETWORK_ID=<network_id>

# Base URL: https://api.meraki.com/api/v1
# Key endpoints:
GET /organizations/{orgId}/devices
GET /networks/{networkId}/devices/statuses
GET /devices/{serial}/switch/ports`
      }
    ]
  },
  {
    id: "qsc",
    icon: Music,
    title: "QSC Q-SYS Integration",
    color: "purple",
    subsections: [
      {
        title: "Q-SYS Control Protocol (QRC)",
        body: `Q-SYS uses a TCP JSON-RPC protocol on port 1710 for real-time control.

# .env variables:
QSYS_HOST=192.168.1.50
QSYS_PORT=1710
QSYS_USER=admin
QSYS_PASS=<password>`
      },
      {
        title: "QRC Command Examples",
        body: `// Get component controls
{"jsonrpc":"2.0","id":1,"method":"Component.GetControls",
 "params":{"Name":"Gain_1"}}

// Set a control value
{"jsonrpc":"2.0","id":2,"method":"Component.Set",
 "params":{"Name":"Gain_1","Controls":[{"Name":"gain","Value":-10}]}}

// Subscribe to changes
{"jsonrpc":"2.0","id":3,"method":"ChangeGroup.AddComponentControl",
 "params":{"Id":"grp1","Component":{"Name":"Gain_1","Controls":[{"Name":"gain"}]}}}`
      },
      {
        title: "Q-SYS REST API",
        body: `# Base URL: http://{QSYS_HOST}/api/v0
# Key endpoints:
GET  /cores/self              — Core status
GET  /components              — All components
POST /components/{name}/controls — Set controls

# .env:
QSYS_API_BASE=http://192.168.1.50/api/v0`
      }
    ]
  },
  {
    id: "crestron",
    icon: Cpu,
    title: "Crestron Control Integration",
    color: "orange",
    subsections: [
      {
        title: "CIP / XPanel Protocol",
        body: `Crestron processors communicate via CIP (Crestron Internet Protocol) on TCP port 41794.

# .env variables:
CRESTRON_HOST=192.168.1.100
CRESTRON_PORT=41794
CRESTRON_IPID=0x03`
      },
      {
        title: "Crestron REST API (VC-4 / NVX)",
        body: `# Base URL: https://{host}/cws/api
# Auth: Basic or token

# .env:
CRESTRON_API_HOST=192.168.1.100
CRESTRON_API_USER=admin
CRESTRON_API_PASS=<password>

# Key endpoints:
GET  /device/info
GET  /device/status
POST /device/control    — Send join values
GET  /program/status    — Running program info`
      },
      {
        title: "Simpl# Join Example",
        body: `// Digital join (e.g. press button)
POST /cws/api/device/control
{ "joins": [{ "type": "digital", "join": 1, "value": true }] }

// Analog join (e.g. set volume)
{ "joins": [{ "type": "analog", "join": 10, "value": 32768 }] }

// Serial join (e.g. send string)
{ "joins": [{ "type": "serial", "join": 1, "value": "PLAY" }] }`
      }
    ]
  },
  {
    id: "lutron",
    icon: Lightbulb,
    title: "Lutron Lighting Integration",
    color: "yellow",
    subsections: [
      {
        title: "Lutron Integration Protocol (LEAP)",
        body: `Lutron RadioRA 3, Caseta Pro, and Homeworks QSX use the LEAP API over TLS WebSocket (port 443).

# .env:
LUTRON_HOST=192.168.1.200
LUTRON_CERT=./certs/lutron.crt
LUTRON_KEY=./certs/lutron.key`
      },
      {
        title: "LEAP API Examples",
        body: `// Discover devices
{"CommuniqueType":"ReadRequest","Header":{"Url":"/device"}}

// Set a light level (0–100)
{"CommuniqueType":"CreateRequest",
 "Header":{"Url":"/zone/1/commandprocessor"},
 "Body":{"Command":{"CommandType":"GoToLevel","Parameter":[{"Type":"Level","Value":75}]}}}`
      },
      {
        title: "Lutron HWQSX Telnet / RS-232",
        body: `# Telnet on port 23 (or RS-232 at 9600 8N1)
# .env:
LUTRON_TELNET_HOST=192.168.1.200
LUTRON_TELNET_PORT=23
LUTRON_TELNET_USER=lutron
LUTRON_TELNET_PASS=integration

# Commands:
?OUTPUT,<zone>,1          # Query level
#OUTPUT,<zone>,1,<level>  # Set level (0.00–100.00)
#DEVICE,<id>,<button>,3   # Press button`
      }
    ]
  },
  {
    id: "dali",
    icon: Zap,
    title: "DALI Lighting Integration",
    color: "green",
    subsections: [
      {
        title: "DALI-2 Overview",
        body: `DALI (Digital Addressable Lighting Interface) is a two-wire bus controlling up to 64 gear addresses per line. Typically interfaced via a DALI gateway with TCP/IP or REST API.

# Common gateways: Helvar, Tridonic, Osram, Lunatone
# .env:
DALI_GATEWAY_HOST=192.168.1.201
DALI_GATEWAY_PORT=9050`
      },
      {
        title: "Helvar DALI Router API",
        body: `# Helvar uses ASCII commands over TCP port 50000
# .env:
HELVAR_HOST=192.168.1.201
HELVAR_PORT=50000

# Command examples:
>V:2,C:13,G:1@  # Query group 1 level
>V:2,C:13,G:1,L:75@  # Set group 1 to 75%
>V:2,C:11,G:1@  # Recall scene 1 on group 1

# Response format:
=V:2,C:13,G:1,L:75@`
      },
      {
        title: "Tridonic / DALI REST Gateway",
        body: `# Base URL: http://{host}/api
GET  /devices            — List DALI devices
GET  /devices/{addr}     — Device status
POST /devices/{addr}/level — Set level { "level": 75 }
POST /groups/{id}/scene  — Recall scene { "scene": 1 }

# .env:
DALI_REST_HOST=192.168.1.201
DALI_REST_TOKEN=<api_token>`
      }
    ]
  },
  {
    id: "dmx",
    icon: Radio,
    title: "DMX512 Integration",
    color: "pink",
    subsections: [
      {
        title: "Art-Net / sACN (DMX over IP)",
        body: `DMX is typically bridged to IP via Art-Net (UDP port 6454) or sACN/E1.31 (UDP port 5568).

# .env:
DMX_ARTNET_HOST=192.168.1.202
DMX_ARTNET_PORT=6454
DMX_ARTNET_UNIVERSE=0
DMX_SACN_UNIVERSE=1`
      },
      {
        title: "Art-Net Protocol",
        body: `// Art-DMX packet (simplified)
// Header: 'Art-Net\0' + OpOutput (0x5000)
// Payload: sequence, physical, universe (LO/HI), length, 512 channel values

// Node.js example:
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
const packet = buildArtDmxPacket(universe, channels); // channels: Uint8Array(512)
socket.send(packet, 6454, '192.168.1.255', () => {});`
      },
      {
        title: "OLA (Open Lighting Architecture)",
        body: `# Install OLA on the gateway server:
sudo apt-get install ola

# OLA REST API (port 9090):
GET  /json/universe_list
GET  /json/universe_info?id=0
POST /dmx — body: { u: 0, d: "255,128,0,..." }

# .env:
OLA_HOST=localhost
OLA_PORT=9090`
      }
    ]
  },
  {
    id: "knx",
    icon: Globe,
    title: "KNX Building Automation",
    color: "red",
    subsections: [
      {
        title: "KNX IP Gateway",
        body: `KNX uses a twisted-pair bus (TP) interfaced via an IP gateway/router using KNXnet/IP (UDP 3671) or via a REST API wrapper.

# .env:
KNX_GATEWAY_HOST=192.168.1.203
KNX_GATEWAY_PORT=3671
KNX_INDIVIDUAL_ADDR=1.1.255`
      },
      {
        title: "KNXnet/IP Tunnelling",
        body: `// Using knx.js library (Node.js)
const knx = require('knx');
const connection = knx.Connection({
  ipAddr: process.env.KNX_GATEWAY_HOST,
  ipPort: 3671,
  handlers: {
    connected: () => {
      // Write to group address
      connection.write('1/0/1', true);          // switch ON
      connection.write('3/1/5', 75, 'DPT5');   // set dimmer to 75%
    },
    event: (evt, src, dest, value) => {
      console.log(evt, src, dest, value);
    }
  }
});`
      },
      {
        title: "KNX REST API (Thinka / MDT)",
        body: `# MDT IP Router REST bridge:
GET  /rest/knx/group/{ga}        — Read group address
PUT  /rest/knx/group/{ga}        — Write value { "value": "1" }
GET  /rest/knx/devices           — List devices

# .env:
KNX_REST_HOST=192.168.1.203
KNX_REST_TOKEN=<token>`
      }
    ]
  },
  {
    id: "security",
    icon: Shield,
    title: "Security & Network Hardening",
    content: `For production local deployments follow these security practices:

• **Firewall rules**: Expose only port 443 (HTTPS) externally. Keep SNMP (161), KNX (3671), Art-Net (6454) on the isolated AV VLAN only.
• **VLANs**: Segregate AV/control network from guest and crew networks.
• **TLS**: Use self-signed or Let's Encrypt certs for the web interface. All API integrations should use HTTPS where supported.
• **Credentials**: Store all API keys and passwords in environment variables — never hardcode in source.
• **Access control**: The platform supports role-based access (Admin / User). Assign admin only to trusted crew.
• **Updates**: Apply OS security patches monthly. Monitor the Guardian AI release notes for firmware-related updates.
• **Backup**: Export configuration, entity data, and .env files to encrypted offsite storage monthly.`
  },
  {
    id: "usage",
    icon: Terminal,
    title: "Using the Platform",
    content: `**Dashboard** — Real-time overview of network health, device status, and active alarms. Widgets are drag-and-drop customisable.

**Topology** — Visual network map built from SNMP data. Drag nodes to reposition, trace signal paths, create groups, and import devices via CSV.

**SNMP** — Poll any SNMP-capable device for port maps, interface stats, CPU/memory usage, and UPS battery status.

**Discovery** — Scan IP subnets to auto-discover devices and add them to the topology.

**Maintenance** — Schedule and track preventative maintenance tasks with recurrence intervals, status tracking (Pending → In Progress → Completed), and a calendar view.

**Cables** — Physical cable register with from/to equipment, cable type, deck location, and CSV bulk import.

**Lighting** — Control Lutron, DALI, DMX, and KNX lighting systems. Set scenes, dim zones, and monitor status.

**Automation** — Create rules that trigger actions (port bounce, alert, power cycle) when metrics exceed thresholds.

**AI Assistant** — Natural-language interface for diagnostics, log analysis, and control commands.

**Reports** — Generate PDF/CSV reports for maintenance history, network health, and cable schedules.

**Settings** — Configure integrations, SNMP communities, credentials, and notification rules.`
  }
];

function Section({ section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  const colorMap = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    pink: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  };
  const accent = colorMap[section.color] || "text-slate-300 bg-white/5 border-white/10";

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
        </div>
        {open ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
      </button>
      {open && (
        <div className="border-t border-white/8 px-5 py-5 space-y-5">
          {section.content && (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {section.content.split(/\*\*(.+?)\*\*/).map((part, i) =>
                i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part
              )}
            </p>
          )}
          {section.subsections?.map((sub, i) => (
            <div key={i} className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{sub.title}</p>
              <pre className="bg-[#060912] border border-white/8 rounded-lg px-4 py-3 text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto leading-relaxed font-mono">
                {sub.body}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [tab, setTab] = useState("usage");

  const usageSections = SECTIONS.filter(s => ["overview", "usage", "security"].includes(s.id));
  const deploySections = SECTIONS.filter(s => s.id === "local-deploy");
  const integrationSections = SECTIONS.filter(s => ["network", "qsc", "crestron", "lutron", "dali", "dmx", "knx"].includes(s.id));

  const tabs = [
    { id: "usage", label: "Using the Platform" },
    { id: "deploy", label: "Local Deployment" },
    { id: "integrations", label: "Integration APIs" },
  ];

  const shown = tab === "usage" ? usageSections : tab === "deploy" ? deploySections : integrationSections;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <HelpCircle size={20} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Help & Documentation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform guides, local deployment, and integration references</p>
        </div>
      </div>

      {/* Tab bar */}
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

      {/* Sections */}
      <div className="space-y-3 max-w-4xl">
        {shown.map(s => <Section key={s.id} section={s} />)}
      </div>
    </div>
  );
}