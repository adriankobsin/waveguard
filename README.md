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
| **AI Assistant** | LLM-powered chat for AV/IT troubleshooting, document search, and system queries |
| **Diagnostics** | System health checks, port scanning, and equipment diagnostics |
| **Documents** | Technical document management and search |
| **Reports** | Generated reports with PDF download |
| **User Management** | Role-based access control with invite system |

## Tech Stack

- **Framework:** React 18 + Vite 6
- **UI:** Tailwind CSS 3, Radix UI primitives, Framer Motion
- **Charts:** Recharts
- **Data:** TanStack React Query, SheetJS (`xlsx`), jsPDF, html2canvas
- **Network scanner:** Node.js (`scanner/`) — ping, ARP, port probe, optional SNMP
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
                                    └────────────────────────────┘
```

On `localhost`, API calls route to the mock server unless `VITE_BASE44_APP_BASE_URL` is set. In production (Base44 deploy), the live backend is used.

## Project structure

```
src/
├── api/                    # SDK client, equipment API, vessel import API
├── components/
│   ├── ui/                 # Radix UI primitives
│   ├── dashboard/
│   ├── discovery/          # Network discovery UI
│   ├── topology/           # Network list, deck map, racks, signal flows
│   ├── inventory/          # Vessel spreadsheet import modal
│   ├── shared/             # Bulk action bar, bulk edit modal
│   ├── snmp/
│   └── automation/
├── hooks/                  # useBulkSelection, useRackLayout, etc.
├── lib/
│   ├── spreadsheet/        # Vessel .xlsx parse, normalize, commit
│   ├── topology/           # Sync, persist, session cache
│   ├── discoveryApi.js
│   └── discoveryRegistration.js
└── pages/
scanner/                    # LAN discovery (ping, ARP, ports, SNMP, topology graph)
mock-server/                # Express mock API + entity store
base44/functions/           # Serverless function entry points (production)
```

## Development notes

- **Equipment** is the source of truth for device metadata (name, IP, notes, location). Topology scans merge into this store on refresh; edits and per-device scans write back immediately.
- **Session cache** (`src/lib/topology/topologySessionCache.js`) keeps the topology view when switching sidebar routes — no rescan on return.
- Mock server data is in-memory; restart clears unless you rely on imported equipment persisted during the session.

## License

Proprietary — Wave-AVI Ltd.
