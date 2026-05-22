# Wave-AVI Guardian AI (WaveGuard)

Local-first monitoring, documentation, troubleshooting, and AI-assisted support for luxury yacht and high-end residential AV/IT systems.

## Features

| Module | Description |
|---|---|
| **Dashboard** | Real-time status overview with customizable widgets — device health, alerts, network stats |
| **Network Discovery** | Scan subnets (ping/ARP/full/SNMP), auto-classify discovered devices, register to inventory |
| **Topology — Network** | Filterable equipment list with per-device scan/edit, path tracing, groups, CSV import; full SNMP scan only on **Refresh** |
| **Topology — Deck / Rack / AV / Control** | Deck floor plans, rack elevation designer, AV signal flow, control-path diagrams |
| **Cable Register** | Full lifecycle tracking of physical cables — bulk select, bulk edit/delete, CSV/Excel import |
| **SNMP Port Map** | Live switch port status, connected device detection, cable fault identification |
| **Inventory** | Equipment database with grid/list views, **vessel spreadsheet import** (Albatros-style multi-sheet `.xlsx`), bulk edit/delete |
| **Maintenance** | Scheduled task management with priority levels, status tracking, and due-date alerts |
| **Automation** | Rule engine for event-triggered and scheduled actions with execution logs |
| **Lighting Control** | Multi-system lighting management — Lutron (integration report + load schedule CSV), KNX, DALI, DMX. Area-based load monitoring, per-zone sliders, scene activation, shade/blind open/close/stop, load schedule table, offline mock engine |
| **AI Assistant** | LLM-powered chat for AV/IT troubleshooting, document search, and system queries |
| **Diagnostics** | System health checks, port scanning, equipment diagnostics, lighting processor connection testing (Telnet/LEAP/KNX/DALI/DMX port probing) |
| **Documents** | Technical document management and search |
| **Reports** | Generated reports with PDF download, lighting integration report parser, load schedule CSV import |
| **User Management** | Role-based access control with invite system |

## Tech Stack

- **Framework:** React 18 + Vite 6
- **UI:** Tailwind CSS 3, Radix UI primitives, Framer Motion
- **Charts:** Recharts
- **Data:** TanStack React Query, SheetJS (`xlsx`), jsPDF, html2canvas
- **Network scanner:** Node.js (`scanner/`) — ping, ARP, port probe, optional SNMP
- **Lighting integrations:** Lutron Telnet/LEAP, KNXnet/IP, DALI-IP, DMX Art-Net/sACN (mock engines + live clients)
- **Backend:** Base44 platform (production) or local mock server (development)

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install

```bash
git clone <repo-url>
cd WaveGuard
npm install
cd mock-server && npm install && cd ..
```

### Run locally (recommended)

Starts the mock API/scanner (port **3002**) and Vite (port **5173**) together:

```bash
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173). Login with `admin@waveguard.test` / `password123`.

Or run in two terminals:

```bash
# Terminal 1 — mock API + live LAN scanner
npm run mock

# Terminal 2 — frontend
npm run dev
```

### Mock vs live network scanning

By default the mock server runs **live** scans on the host machine (ping/ARP/SNMP against your LAN). For demo mode without LAN access:

```bash
# PowerShell
$env:WAVEGUARD_USE_MOCK_SCAN="true"; npm run mock
```

### Run with real Base44 backend

Create `.env.local`:

```env
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

Then `npm run dev`. The app connects to your live Base44 backend — no mock server needed.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (proxies `/api` to mock server) |
| `npm run mock` | Start mock API + scanner on port 3002 |
| `npm run dev:all` | Start mock server and Vite together |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run typecheck` | TypeScript check |
| `npm run preview` | Preview production build |

## Topology & scanning behaviour

| Action | What runs |
|---|---|
| Open **Topology → Network** | Loads equipment from inventory (cached in session while you navigate the app). **No SNMP scan.** |
| **Refresh** | Full `snmpTopologyScan` across configured subnets |
| **Scan** on a device row or detail panel | Single-IP `networkScan` only; results saved to Equipment |
| **Edit device** | Saved permanently to Equipment (survives refresh and navigation) |
| Inventory / spreadsheet import | Merges equipment into topology without rescanning |

Configure default subnets and SNMP options under **Settings → Discovery**.

## Lighting Control

WaveGuard supports four lighting system types through a common adapter interface:

| System | Protocol | Live Client | Mock Engine |
|---|---|---|---|
| **Lutron** | Telnet (port 23), LEAP (port 8081) | TCP telnet client | In-memory zone/scene/button state |
| **KNX** | KNXnet/IP tunnelling (UDP 3671) | UDP KNX client | In-memory group address state |
| **DALI** | DALI-IP bridge (TCP 5582) | TCP DALI client | In-memory ballast state |
| **DMX** | Art-Net (UDP 6454), sACN (UDP 5568) | UDP Art-Net/sACN client | In-memory channel state |

### Importing data

1. **Open Lighting → Import report**
2. Pick the **Integration Report PDF** exported from Lutron Designer (zones, areas, scenes, keypads)
3. Optionally pick the **Load Schedule CSV** (panel assignments, load types, wattages)
4. Both files are parsed and merged into a single lighting house

The load schedule CSV uses area sections with columns: Zone Name, Zone Description, Load #, Load Type, Assigned To, Total Wattage. The `Assigned To` column contains hierarchical paths (`Floor\Panel\Module\Output`) that link integration report zones to physical wiring.

### Browsing loads

- **Loads by Area** tab — hierarchical floor/area view with per-zone sliders, shade Open/Close/Stop buttons, and scene activation
- **Area Control** tab — per-floor zone map or list view with scenes sidebar
- **Lighting Map** tab — whole-house topology with zone-level controls
- **Schedule** button (visible after CSV import) — collapsible table with search/filter, panel grouping, load type icons, and wattage display

### Shade / blind zones

Zones identified as shade, blind, or blackout (by `kind` field or name keywords) show Open/Close/Stop buttons instead of light sliders. Supported keywords: shade, blind, blackout, venetian, roman, curtain.

### Live processor connection

Configure the processor address and credentials under **Settings → Lighting** or via the **key icon** in the Lighting page header. When enabled, the app routes commands through the live protocol instead of the local mock engine. Connection testing probes ports and provides setup recommendations.

### Architecture

```
┌──────────────────────┐
│  React Lighting UI   │
│  (zone controls,     │
│   scene activation,  │
│   schedule table)    │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  lightingApi.js      │
│  (generic HTTP API)  │
└──────────┬───────────┘
           │ HTTP /api
┌──────────▼───────────┐
│  Mock Server         │
│  (server.js)         │
│                      │
│  ┌─ Lutron engine    │
│  ├─ KNX engine       │
│  ├─ DALI engine      │
│  └─ DMX engine       │
│                      │
│  ┌─ Lutron client ──►│  TCP telnet
│  ├─ KNX client ────► │  UDP KNXnet/IP
│  ├─ DALI client ───► │  TCP DALI-IP
│  └─ DMX client ───►  │  UDP Art-Net/sACN
└──────────────────────┘
```

Each system type follows the `lightingSystemTemplate.js` interface. Adapters are registered in `lightingRegistry.js` and can run in **mock mode** (in-memory engine for offline/demo) or **live mode** (connects to a real controller via its native protocol).

## Vessel spreadsheet import

**Inventory → Import spreadsheet** accepts multi-sheet `.xlsx` workbooks (e.g. Albatros vessel network spreadsheets):

- Device List, Patch Panels, switch sheets, appliances, IP Scheme, racks
- Merge or replace existing equipment and cables
- Credentials columns are stripped at parse time

## Architecture

```
┌──────────────────┐     ┌──────────────────────┐
│   React Frontend │────▶│  Base44 SDK Client   │
│   (Vite + Tailwind)    │  @base44/sdk         │
└──────────────────┘     └──────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │    HTTP (dev: Vite proxy /api) │
                    └───────────────┬───────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            │                                               │
┌───────────┴────────────┐          ┌───────────────────────┴────┐
│  Base44 Backend        │          │  Local Mock Server         │
│  (production)          │          │  mock-server/server.js     │
│                        │          │  Port 3002                 │
└────────────────────────┘          │         │                  │
                                    │         ▼                  │
                                    │  scanner/ (ping/arp/snmp)  │
                                    │  scanner/integrations/     │
                                    │    ├─ lutron/lutronClient  │
                                    │    ├─ knx/knxClient        │
                                    │    ├─ dali/daliClient      │
                                    │    └─ dmx/dmxClient        │
                                    └────────────────────────────┘
```

On `localhost`, API calls route to the mock server unless `VITE_BASE44_APP_BASE_URL` is set. In production (Base44 deploy), the live backend is used.

## Project structure

```
src/
├── api/                    # SDK client, equipment API, vessel import API, lighting API
├── components/
│   ├── ui/                 # Radix UI primitives
│   ├── dashboard/
│   ├── discovery/          # Network discovery UI
│   ├── topology/           # Network list, deck map, racks, signal flows, lighting map tab
│   ├── inventory/          # Vessel spreadsheet import modal
│   ├── lighting/           # Lighting zone controls, import modal, connection modal,
│   │                       # scene panel, system status, load schedule table
│   ├── shared/             # Bulk action bar, bulk edit modal
│   ├── snmp/
│   └── automation/
├── hooks/                  # useBulkSelection, useRackLayout, etc.
├── lib/
│   ├── integrations/       # Lighting system adapters (lutron, knx, dali, dmx),
│   │                       # lighting registry, system template, peplink adapter
│   ├── lighting/           # Settings, integration report parser, load schedule CSV
│   │                       # parser, PDF text extractor, lighting hierarchy builder
│   ├── spreadsheet/        # Vessel .xlsx parse, normalize, commit
│   ├── topology/           # Sync, persist, session cache
│   ├── discoveryApi.js
│   └── discoveryRegistration.js
└── pages/                  # LightingPage, settings, dashboard, etc.
scanner/                    # LAN discovery (ping, ARP, ports, SNMP, topology graph)
scanner/integrations/
├── lutron/lutronClient.js  # Live Lutron Telnet client
├── knx/knxClient.js        # Live KNXnet/IP client
├── dali/daliClient.js      # Live DALI-IP bridge client
├── dmx/dmxClient.js        # Live DMX Art-Net/sACN client
├── peplinkPoll.js
└── wanSpeedTest.js
mock-server/                # Express mock API + entity store + lighting mock engines
base44/functions/           # Serverless function entry points (production)
```

## Development notes

- **Equipment** is the source of truth for device metadata (name, IP, notes, location). Topology scans merge into this store on refresh; edits and per-device scans write back immediately.
- **Session cache** (`src/lib/topology/topologySessionCache.js`) keeps the topology view when switching sidebar routes — no rescan on return.
- **Lighting**: The lighting house (parsed integration report + load schedule) is persisted under the `lighting-house` settings key with a localStorage cache. Per-zone live state is kept separately under `lighting-zone-state`.
- **Mock server** data is in-memory; restart clears unless you rely on imported equipment persisted during the session.

## License

Proprietary — Wave-AVI Ltd.
