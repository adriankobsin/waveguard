# Wave-AVI Guardian AI (WaveGuard)

Local-first monitoring, documentation, troubleshooting, and AI-assisted support for luxury yacht and high-end residential AV / IT systems.

WaveGuard runs entirely on the host network — discovery, lighting control, SNMP polling and the full UI work without internet access. It connects to a [Base44](https://base44.app) backend when one is configured, otherwise it talks to the bundled Node mock server.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Lights and Shades](#lights-and-shades)
- [Network & SNMP](#network--snmp)
- [Vessel Spreadsheet Import](#vessel-spreadsheet-import)
- [Diagnoses](#diagnoses)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Development Notes](#development-notes)
- [License](#license)

---

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Real-time status overview with customisable widgets — device health, alerts, network stats |
| **Topology** | Filterable equipment list with per-device scan/edit, path tracing, groups, CSV import. Full SNMP scan only on **Refresh** |
| **Topology — Deck / Rack / AV / Control** | Deck floor plans, rack elevation designer, AV signal flow, control-path diagrams |
| **Core Network (SNMP)** | Live switch port status, connected device detection, cable fault hints, VLAN / PoE / speed display |
| **Discovery** | Subnet scans (ping / ARP / full / SNMP), auto-classify discovered devices, register to inventory |
| **Diagnoses** | Aggregated diagnostic findings from every subsystem — network, SNMP, WAN, lighting (processor offline, zone rejected, zone unreachable). Severity-coded with acknowledgement |
| **Maintenance** | Scheduled task management with priority levels, status tracking, due-date alerts |
| **Equipment** | Equipment database with grid / list views, vessel spreadsheet import (Albatros-style multi-sheet `.xlsx`), bulk edit / delete |
| **Cables** | Full lifecycle tracking of physical cables — bulk select, bulk edit / delete, CSV / Excel import |
| **Documents** | Technical document management and search |
| **AI Assistant** | LLM-powered chat for AV / IT troubleshooting, document search, and system queries |
| **Lights and Shades** | Multi-system lighting platform (Lutron, KNX, DALI, DMX) — per-zone control, shades / curtains, scenes, area control with floor map, persistent event log |
| **Automation** | Rule engine for event-triggered and scheduled actions with execution logs |
| **Reports** | Generated reports with PDF download, lighting integration report parser, load schedule CSV import |
| **Help** | In-app product manual |
| **Settings** | Discovery defaults, SNMP credentials, lighting connection, user / role management |

The Diagnoses badge in the sidebar shows a live count of unresolved findings across every subsystem.

---

## Tech Stack

- **Framework:** React 18 + Vite 6
- **UI:** Tailwind CSS 3, Radix UI primitives, Framer Motion, Lucide icons
- **Data:** TanStack React Query, SheetJS (`xlsx`), jsPDF, html2canvas, PDF.js
- **Network scanner:** Node.js — ping, ARP, port probe, SNMPv2c
- **Lighting integrations:** Lutron Telnet + LEAP, KNXnet/IP, DALI-IP, DMX Art-Net / sACN
- **Backend:** Base44 platform (production) or local Node mock server (development)

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- (Optional) A Lutron / KNX / DALI / DMX processor on the LAN for live control. Without one, the bundled mock engines drive the UI.

### Install

```bash
git clone https://github.com/adriankobsin/waveguard.git
cd waveguard
npm install
cd mock-server && npm install && cd ..
```

### Run locally (recommended)

Starts the mock API + scanner (port **3002**) and Vite (port **5173**) together:

```bash
npm run dev:all
```

Open <http://localhost:5173>. The first run prompts you to choose **Live** or **Demo** mode. Demo mode loads a curated yacht with Lutron zones, scenes and keypads so the platform looks populated without any LAN access.

Or run in two terminals:

```bash
# Terminal 1 — mock API + live LAN scanner
npm run mock

# Terminal 2 — frontend
npm run dev
```

### Mock vs live network scanning

The mock server runs **live** scans on the host machine by default (ping / ARP / SNMP against your LAN). For a fully offline / demo session:

```powershell
# PowerShell
$env:WAVEGUARD_USE_MOCK_SCAN="true"; npm run mock
```

```bash
# bash
WAVEGUARD_USE_MOCK_SCAN=true npm run mock
```

### Connect to a real Base44 backend

Create `.env.local`:

```env
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

Then `npm run dev`. The app connects straight to the live Base44 backend — no mock server needed.

---

## Lights and Shades

WaveGuard's `Lights and Shades` module supports four lighting system types through a common adapter interface:

| System | Protocol(s) | Live Client | Mock Engine |
|---|---|---|---|
| **Lutron** | Telnet (port 23), LEAP (port 8081, TLS pairing 8083) | Telnet TCP + LEAP TLS (typed CreateRequests, subscription stream, certificate pairing) | Full in-memory zone / scene / button state |
| **KNX** | KNXnet/IP tunnelling (UDP 3671) | UDP KNX client | In-memory group-address state |
| **DALI** | DALI-IP bridge (TCP 5582) | TCP DALI client | In-memory ballast state |
| **DMX** | Art-Net (UDP 6454), sACN (UDP 5568) | UDP Art-Net / sACN client | In-memory channel state |

### Page layout

The Lights and Shades page has four tabs:

| Tab | Purpose |
|---|---|
| **Lights** | Floor → Area → Zone tree, filtered to dimmer / switched / light zones. Per-zone slider + on/off toggle. Edit pencil renames or re-addresses the zone. |
| **Shades** | Same tree filtered to shade / blind / blackout / curtain zones. Open / Close / Stop buttons instead of sliders. |
| **Area Control** | Floor switcher with a map view (clickable zone pins → inline control popover) and a list view. The "Recent activity" event log lives in the left rail. |
| **Scenes** | User-authored Lutron scenes — Area Scene (`area_id` + scene number), LEAP href, or Phantom Keypad Button. Run / Delete actions. Scenes persist across sessions. |

Sidebar entry: **Lights and Shades** (label renamed from the old "Lighting").

### Importing data

1. Click **Import report** in the Lights and Shades header.
2. Pick the **Integration Report PDF** exported from Lutron Designer (zones, areas, scenes, keypads).
3. Optionally pick the **Load Schedule CSV** (panel assignments, load types, wattages).
4. Both files are parsed and merged into a single lighting house, persisted under `lighting-house` in SystemSettings with a localStorage mirror.

The platform's path-aware classifier recognises a wide vocabulary of window treatments — **shade, blind, blackout, curtain, drape, drapery, sheer, voile, roller, zebra, silhouette, honeycomb, cellular, shutter, roman, venetian, panel track** — even when the leaf zone name is just a number (`…\Curtains\1`). The next house load re-classifies legacy `load`-tagged zones automatically, so you don't have to re-import.

### Editing zones

Every zone row carries a pencil icon (Lights / Shades tabs, Area Control list, Area Control map popover). Clicking it opens **Edit zone** with two fields:

- **Name** — free-text label.
- **Integration address** — accepts `/zone/<n>` or a bare `<n>`. The platform canonicalises and validates the format and refuses an address that already belongs to another zone.

Saving re-points every command and event for that row at the new address, migrates the per-zone live state to the new bucket so the slider doesn't reset, and logs an `edit` event to the lighting event log.

### Lutron LEAP nuances handled for you

- **Smooth slider** — `SmoothLevelSlider` throttles commands to ~8/sec with a leading + trailing edge debounce and a final commit on pointer release. The visual never flickers during a drag (350 ms debounce on the busy indicator).
- **Type-aware commands** — the LEAP client probes `/zone/<n>` for `ControlType` and picks `GoToDimmedLevel`, `GoToShadeLevel`, `GoToTiltLevel`, `GoToShadeAndTiltLevel`, `GoToSwitchedLevel`, or `OpenCloseStop Raise/Lower/Stop` accordingly, with Caséta `GoToLevel` as a last-ditch fallback.
- **OpenCloseStop fallback** — when the processor rejects a level command with `not supported for the specified ZoneType` on a shade-family hint, both the client API and the LEAP client transparently retry as `raiseLowerStop`, then remember the discovery (in `localStorage` + the LEAP client's `_kindByZone` cache) so future clicks skip straight to Raise / Lower.
- **Subscriptions** — incoming `zoneLevel` events stream into the UI over Server-Sent Events; the slider keeps local state during an active drag so processor echoes don't fight the user.

### Scenes

The Scenes tab supports three kinds:

| Kind | Required fields | What gets sent |
|---|---|---|
| **Area scene** | `area_id`, scene number 1-16 (or 0 for Off) | `#AREA,<id>,6,<n>` on Telnet / `ActivateScene` on LEAP |
| **LEAP href** | `/area/<id>/scene/<n>` | Direct CreateRequest |
| **Phantom keypad button** | `/device/<id>`, component number | `PressAndRelease` on the keypad button |

### Event log and diagnoses

Every command (success or failure) is appended to a ring buffer (`lighting-event-log` in SystemSettings) and surfaced in the Area Control "Recent activity" panel. The event log feeds three lighting-specific diagnoses:

- `lighting-processor-offline` (critical) — configured processor not responding.
- `lighting-zone-rejected-<href>` (warning) — single zone command rejected.
- `lighting-zone-unreachable-<href>` (critical) — three or more consecutive failures on the same zone within five minutes.

These show on the Diagnoses page and add to the sidebar badge count.

### Live processor connection

Configure the processor under the **key icon** in the Lights and Shades header, or via **Settings → Lighting**. Connection testing probes the relevant ports and provides specific recommendations (e.g. "switch from Telnet to LEAP", "verify multicast on the KNX subnet").

For Lutron HomeWorks QSX / RA3 the platform handles the full TLS pairing flow (port 8083), stores the issued certificate under `mock-server/lutron-certs/`, and reuses it for every subsequent connection.

---

## Network & SNMP

| Action | What runs |
|---|---|
| Open **Topology** | Loads equipment from inventory (cached for the session while you navigate). **No SNMP scan.** |
| **Refresh** | Full `snmpTopologyScan` across configured subnets |
| **Scan** on a device row or detail panel | Single-IP `networkScan` only; results saved to Equipment |
| **Edit device** | Saved permanently to Equipment (survives refresh and navigation) |
| Inventory / spreadsheet import | Merges equipment into topology without rescanning |

Configure default subnets and SNMP credentials under **Settings → Discovery**.

The **Core Network (SNMP)** page renders a live port map for every managed switch in inventory — port up/down, speed, VLAN, PoE power, link partner MAC + IP. The grid is built from periodic IF-MIB polls and a Bridge-MIB FDB pull; cable-fault hints come from comparing planned cables in the Cable Register to the live connected-port reality.

---

## Vessel Spreadsheet Import

**Equipment → Import spreadsheet** accepts multi-sheet `.xlsx` workbooks (e.g. Albatros vessel network spreadsheets):

- Device List, Patch Panels, switch sheets, appliances, IP Scheme, racks
- Merge or replace existing equipment and cables
- Credentials columns are stripped at parse time before anything is persisted

---

## Diagnoses

The Diagnoses page aggregates findings from every subsystem and exposes:

- Severity-graded list (critical / warning / info)
- Per-finding acknowledgement with timestamp and operator
- Filtering by source (lighting, SNMP, network, WAN…)
- Live updates via the lighting / WAN / processor event listeners — no reload required

See [`docs/diagnostics.md`](docs/diagnostics.md) for the per-system probe matrix and recommendations.

---

## Architecture

### Front-end ↔ back-end routing

```
┌──────────────────┐     ┌──────────────────────┐
│   React Frontend │────▶│  Base44 SDK Client   │
│   (Vite + Tailwind) │  │  @base44/sdk         │
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
                                    │    ├─ lutron/leapClient    │
                                    │    ├─ knx/knxClient        │
                                    │    ├─ dali/daliClient      │
                                    │    ├─ dmx/dmxClient        │
                                    │    ├─ peplinkPoll          │
                                    │    └─ wanSpeedTest         │
                                    └────────────────────────────┘
```

On `localhost`, API calls route to the mock server unless `VITE_BASE44_APP_BASE_URL` is set. In production (Base44 deploy), the live backend is used directly.

### Lighting flow

```
┌──────────────────────┐
│  React Lighting UI   │
│  (zone controls,     │
│   shade Open/Close,  │
│   scenes, event log) │
└──────────┬───────────┘
           │
┌──────────▼───────────┐     ┌────────────────────────────┐
│  lightingApi.js      │────▶│ Client-side OpenCloseStop  │
│  (HTTP + SSE)        │     │ fallback + ocs-zones cache │
└──────────┬───────────┘     └────────────────────────────┘
           │ HTTP /api/lutronCommand + /api/lutronEvents (SSE)
┌──────────▼───────────┐
│  Mock Server         │
│  (server.js)         │
│  ┌─ Lutron engine    │
│  ├─ KNX engine       │
│  ├─ DALI engine      │
│  └─ DMX engine       │
│  ┌─ Lutron client ──►│  TCP Telnet / TLS LEAP
│  ├─ KNX client ────► │  UDP KNXnet/IP
│  ├─ DALI client ───► │  TCP DALI-IP
│  └─ DMX client ───►  │  UDP Art-Net / sACN
└──────────────────────┘
```

Each system type follows the `lightingSystemTemplate.js` interface. Adapters are registered in `lightingRegistry.js` and can run in **mock mode** (in-memory engine for offline / demo) or **live mode** (connects to a real controller via its native protocol).

---

## Project Structure

```
src/
├── api/                    # SDK client, equipment API, vessel import API, lighting API
├── components/
│   ├── ui/                 # Radix UI primitives
│   ├── dashboard/
│   ├── discovery/          # Network discovery UI
│   ├── topology/           # Network list, deck map, racks, signal flows
│   ├── inventory/          # Vessel spreadsheet import modal
│   ├── lighting/           # Zone controls, edit modal, smooth slider, event log,
│   │                       # scenes panel, system status, schedule table, ...
│   ├── shared/             # Bulk action bar, bulk edit modal
│   ├── snmp/
│   └── automation/
├── contexts/               # PlatformMode, SystemData (incl. lighting diagnoses)
├── hooks/                  # useBulkSelection, useRackLayout, ...
├── lib/
│   ├── integrations/       # Lighting system adapters (lutron, knx, dali, dmx),
│   │                       # lighting registry, system template, peplink adapter
│   ├── lighting/           # Settings + storage, integration report parser,
│   │                       # load schedule CSV parser, PDF text extractor,
│   │                       # hierarchy builder, event log, diagnoses
│   ├── spreadsheet/        # Vessel .xlsx parse, normalize, commit
│   ├── topology/           # Sync, persist, session cache
│   ├── discoveryApi.js
│   └── discoveryRegistration.js
└── pages/                  # LightingPage, ScenesPage, settings, dashboard, ...

scanner/                    # LAN discovery (ping, ARP, ports, SNMP, topology graph)
scanner/integrations/
├── lutron/lutronClient.js  # Live Lutron Telnet client
├── lutron/leapClient.js    # Live Lutron LEAP client (TLS, typed CreateRequests,
│                           # ControlType probe, OpenCloseStop fallback)
├── knx/knxClient.js
├── dali/daliClient.js
├── dmx/dmxClient.js
├── peplinkPoll.js
└── wanSpeedTest.js

mock-server/                # Express mock API + entity store + lighting mock engines
base44/functions/           # Serverless function entry points (production)
docs/                       # Markdown docs (reports, diagnostics)
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (proxies `/api` to mock server) |
| `npm run mock` | Start mock API + LAN scanner on port 3002 |
| `npm run dev:all` | Start mock server and Vite together with coloured concurrent output |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run typecheck` | TypeScript check (uses `jsconfig.json`) |

---

## Development Notes

- **Equipment** is the source of truth for device metadata (name, IP, notes, location). Topology scans merge into this store on refresh; edits and per-device scans write back immediately.
- **Session cache** (`src/lib/topology/topologySessionCache.js`) keeps the topology view when switching sidebar routes — no rescan on return.
- **Lighting house** (parsed integration report + load schedule) lives under the `lighting-house` SystemSettings key, mirrored in `localStorage` (`waveguard:lighting:house`). It is auto-re-classified on every load, so the latest classifier improvements apply to legacy data without re-import.
- **Per-zone live state** is kept separately under `lighting-zone-state`; the edit modal migrates state between buckets when an address changes so the slider doesn't reset.
- **OpenCloseStop discovery cache** (`waveguard:lighting:ocs-zones` in `localStorage`) lets the client API skip the level → Raise/Lower retry storm for known motorised blinds and curtains.
- **Lighting event log** is a 200-entry ring buffer (`lighting-event-log`) feeding the Area Control "Recent activity" panel and the lighting diagnoses generator.
- **Mock server** entity data is in-memory; restart clears anything not persisted through the Base44-style API surface.
- **TLS pairing certificates** for Lutron HomeWorks QSX / RA3 are stored under `mock-server/lutron-certs/<host>.{key,cert,ca}`. They survive mock-server restarts but are git-ignored.

---

## License

Proprietary — © Wave-AVI Ltd. All rights reserved.
