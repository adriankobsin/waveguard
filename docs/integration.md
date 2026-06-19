# Integration Guide

How to connect WaveGuard to the systems it manages: Lutron lighting (Telnet + LEAP), KNX, DALI, DMX, Peplink WAN, managed switches (SNMP), and vessel spreadsheets.

---

## 1. Lutron Lighting

WaveGuard supports HomeWorks QSX, RadioRA 3, Athena and Caséta SmartBridge through a single LEAP client and a Telnet fallback.

### 1.1 Choose a protocol

| Protocol | Port | When to use |
|---|---|---|
| **LEAP** | 8081 (cleartext) / 8083 (TLS pairing) | HomeWorks QSX, RA3, Athena, Caséta SmartBridge. Preferred — supports typed CreateRequests (`GoToShadeLevel`, `OpenCloseStop`, …), live subscriptions and pairing. |
| **Telnet** | 23 | Legacy HomeWorks / RadioRA 2 / pre-Athena firmware that lack LEAP. Limited to `#OUTPUT` / `#DEVICE` / `#AREA` commands. |

WaveGuard's connection test (the **key icon** in the Lights and Shades header) probes both ports and recommends LEAP whenever it is available.

### 1.2 Configure the connection

1. **Lights and Shades → key icon** (top-right of the header) opens the **Lutron Processor** modal.
2. Enter the **host**, leave **port** blank to use the protocol default, pick **protocol**, **system type** (HomeWorks QSX / RA3 / Athena / Caséta), and an integration **username / password**.
3. Click **Test connection**. The platform probes the ports and surfaces a precise recommendation if anything is missing.
4. Click **Save**.

For HomeWorks QSX / RA3 over LEAP, the platform initiates a one-time TLS pairing on port 8083. The Lutron processor's pairing button must be pressed within ~30 seconds. The issued certificate is stored under `mock-server/lutron-certs/<host>.{key,cert,ca}` and reused for every subsequent connection.

### 1.3 Import the Integration Report and Load Schedule

1. **Import report** button in the Lights and Shades header.
2. Pick the **Integration Report PDF** exported from Lutron Designer (Reports → Integration Report).
3. Optionally pick the **Load Schedule CSV** (Reports → Load Schedule).
4. Both files are parsed and merged into a single lighting house, persisted under `lighting-house` in SystemSettings with a localStorage mirror.

#### Integration Report parser (`src/lib/lighting/parseLutronIntegrationReport.js`)

- Parses the tabular format with href-linked zone / area / device / scene references.
- Extracts numeric integration IDs from LEAP-style hrefs (`/zone/5384`, `/areascene/4321`, `/device/8423`).
- Groups zones into a `floor → area → zone` hierarchy.
- **Path-aware zone classification.** Many Designer projects strip the leaf zone name down to an index ("1", "2") inside an area named "Curtains" / "Drapery" / "Shades". The classifier accepts an optional `context` string and checks both the leaf name and the area path against a wide vocabulary:

  | Bucket | Keywords |
  |---|---|
  | `shade` | shade, curtain, drape, drapery, sheer, voile, roller, zebra, silhouette, honeycomb, cellular, skylight shade, shadeband, skyband |
  | `blind` | blind, roman, venetian, shutter, panel track |
  | `blackout` | blackout |
  | `light` | pendant, niche, coffer, skylight, cabinet, strip, uplight, wall lamp / light, downlight, spot, chandelier, light |
  | `load` | (default) — anything else |

- On every house load, `normalizeLightingHouse` runs `reclassifyZoneKind` against every stored zone, upgrading legacy `load`-tagged window treatments to the correct shade-family kind **without requiring re-import**.

#### Load Schedule CSV parser (`src/lib/lighting/parseLoadScheduleCsv.js`)

| Column | Description | Example |
|---|---|---|
| Zone Name | Zone identifier | ER1-Pump1 |
| Zone Description | Human-readable label | Pump 1 |
| Load # | Load index | 1 |
| Load Type | Load category | Load, Light, Shade, Blind, Blackout |
| Assigned To | Wiring path | `Floor\Engine Room\LCP-1\Output 1` |
| Total Wattage | Power rating | 400 |

The parser handles area-section headers, BOM stripping, quoted CSV fields, "Unspecified" wattages, and links each row to a zone via `zoneName | areaFullPath`.

### 1.4 Controlling zones

Once a house is loaded:

- **Lights tab** — sliders + on/off toggles for dimmer / switched / light zones.
- **Shades tab** — Open / Close / Stop buttons for shade-family zones.
- **Area Control tab** — per-floor map (clickable pins → inline control popover) or list view.
- **Scenes tab** — Run / Delete saved scenes.

Every zone row carries a pencil icon — clicking it opens the **Edit zone** modal where you can rename the zone or change its `/zone/<n>` integration address. The platform validates the format, rejects address collisions, and migrates live state to the new bucket so the slider doesn't reset.

### 1.5 LEAP command dialect — what we actually send

The live LEAP client (`scanner/integrations/lutron/leapClient.js`) picks the canonical CreateRequest based on the zone's `ControlType`, learned via a `ReadRequest /zone/<n>` probe and cached per-host in `_kindByZone`:

| Probed kind | Command |
|---|---|
| `dimmed` | `GoToDimmedLevel` |
| `switched` | `GoToSwitchedLevel` |
| `shade` (Sivoia QS lift) | `GoToShadeLevel` |
| `tilt` | `GoToTiltLevel` |
| `shadeAndTilt` | `GoToShadeAndTiltLevel`, falling back to `GoToShadeLevel` |
| `openCloseStop` | `Raise` (level ≥ 50) / `Lower` (< 50) / `Stop` |
| Unknown / probe failed | `_kindFromHint(zoneKind)` from the parsed Integration Report — defaulting to `dimmed` for lights and `shade` for window treatments. |

Every typed command falls back to `GoToLevel` (Caséta's generic shape) on a `400 BadRequest`. If even `GoToLevel` is rejected with `not supported for the specified ZoneType` and the hint is shade-family, the client retries as `raiseLowerStop` and pins the cache to `openCloseStop` so subsequent clicks skip the level dance entirely.

A matching client-side fallback in `src/api/lightingApi.js` provides the same recovery even before the mock-server restart picks up server-side changes — the discovered `openCloseStop` hrefs are mirrored to `localStorage` under `waveguard:lighting:ocs-zones`.

### 1.6 Scenes

The Scenes tab (under **Lights and Shades → Scenes**) supports three kinds:

| Kind | Required fields | Sent as |
|---|---|---|
| **Area scene** | `area_id`, scene number (0 = Off, 1–16) | `#AREA,<id>,6,<n>` (Telnet) / `ActivateScene` (LEAP) |
| **LEAP href** | `/area/<id>/scene/<n>` | Direct `CreateRequest` |
| **Phantom keypad button** | `/device/<id>`, component number | `PressAndRelease` on the keypad button |

Scenes are persisted under `lighting-custom-scenes` in SystemSettings with a localStorage mirror.

### 1.7 Event log and diagnoses

- Every command (success or failure) is appended to a 200-entry ring buffer (`lighting-event-log` in SystemSettings).
- The Area Control tab shows the buffer in its **Recent activity** sidebar.
- The lighting diagnoses generator (`src/lib/lighting/lightingDiagnoses.js`) reads the buffer and produces three diagnoses surfaced on the Diagnoses page and in the sidebar badge:
  - `lighting-processor-offline` (critical) — configured processor not responding.
  - `lighting-zone-rejected-<href>` (warning) — single zone command rejected.
  - `lighting-zone-unreachable-<href>` (critical) — three or more consecutive failures on the same zone within five minutes.

---

## 2. KNX (KNXnet/IP)

| Setting | Value |
|---|---|
| Protocol | KNXnet/IP tunnelling |
| Port | UDP 3671 |
| Multicast | 224.0.23.12 (search request) |
| Live client | `scanner/integrations/knx/knxClient.js` |

### Configure

1. **Settings → Lighting → KNX** (or switch the lighting system type to "KNX" in the connection modal).
2. Enter the gateway host. Port defaults to 3671.
3. Click **Test connection**. A failure usually means UDP 3671 is blocked or the gateway is not powered; the platform suggests verifying multicast on the subnet.

KNX zones use **group addresses** instead of `/zone/<n>` hrefs. The mock engine seeds 12 group addresses for offline demos.

---

## 3. DALI (DALI-IP Bridge)

| Setting | Value |
|---|---|
| Protocol | DALI over TCP |
| Port | TCP 5582 |
| Live client | `scanner/integrations/dali/daliClient.js` |

### Configure

1. Switch the lighting system type to "DALI" in the connection modal.
2. Enter the bridge host. Port defaults to 5582.
3. Click **Test connection**. Failures point at "verify the DALI IP bridge is powered and reachable".

DALI zones use **short addresses (0-63)**. The mock engine seeds 16 ballasts.

---

## 4. DMX (Art-Net / sACN)

| Protocol | Port | Notes |
|---|---|---|
| Art-Net | UDP 6454 | Default DMX-over-IP protocol |
| sACN | UDP 5568 | Multicast — verify routing |

Live client: `scanner/integrations/dmx/dmxClient.js`. The mock engine seeds 24 channels in Art-Net universe 0.

---

## 5. Peplink WAN

`scanner/integrations/peplinkPoll.js` polls Peplink routers (Balance / MAX / B-One) every 30 seconds via the public InControl API and surfaces WAN link health on the Dashboard and in the Diagnoses page (`wan-link-down`, `wan-link-degraded`).

### Configure

1. **Settings → Integrations → Peplink** (or **Network Discovery** for the credentials vault).
2. Add the Peplink API key, organisation ID and group ID.
3. The poller registers automatically on next mock-server start.

WAN speed tests run on demand from the Dashboard's WAN widget (`scanner/integrations/wanSpeedTest.js`) — they execute on the mock server, not the browser.

---

## 6. Managed Switches (SNMP)

| MIB | What we read |
|---|---|
| IF-MIB | Per-interface status, speed, name, last change |
| Bridge-MIB | FDB (link-partner MAC ↔ port mapping) |
| Q-Bridge-MIB | VLAN membership |
| Power-over-Ethernet MIB | PoE port power / class |
| Entity-MIB | Chassis / module / port hierarchy |

### Configure

1. **Settings → Discovery** → set the default SNMP community string (v2c) or USM credentials (v3).
2. Add each switch to **Equipment** with a `snmp_community` override if it differs from the default.
3. **Core Network** page renders the live port grid for every managed switch in inventory.

The full SNMP topology scan only runs on **Refresh** in the Topology page or **Refresh ports** in the Core Network page — never on navigation.

---

## 6b. Cisco Catalyst 1300 / CBS350 (SSH + SNMP)

The **Cisco Switches** workspace lives inside **Core Network** (`/snmp?tab=cisco`). It integrates Catalyst 1300 (C1300-48FP-4G is the reference SKU) and CBS350-family switches over SSH and SNMP. Initial focus is read-only — the modal collects credentials, the orchestrator pulls every datapoint the UI needs.

### What we read

| Section | SSH command | SNMP MIB |
|---|---|---|
| System info (model, serial, firmware, uptime, PoE budget) | `show version`, `show system` | sysName / sysDescr / sysUpTime |
| Interfaces (status, speed, duplex, VLAN, alias, PoE) | `show interfaces status`, `show interfaces description`, `show power inline` | IF-MIB + POWER-ETHERNET-MIB |
| Connected devices (MAC table + LLDP/CDP) | `show mac address-table dynamic`, `show lldp neighbors detail`, `show cdp neighbors detail` | BRIDGE-MIB `dot1dTpFdbTable` + LLDP-MIB `lldpRemTable` |
| Live counter updates | — | IF-MIB `ifHCInOctets` / `ifHCOutOctets` |

### Configure

1. **Core Network → Cisco Switches** tab → **Add switch**.
2. Enter the **switch IP**, **SSH user** (default `cisco`), and **SSH password**. Click **Connect to switch**.
3. The platform probes TCP/22 and TCP/161 (SSH and SNMP only — Telnet port 23 is not probed), attempts an SSH login, and runs `show version` to confirm the model. On success, the modal turns green and shows model/firmware/serial.
4. Save — the switch appears in the left rail. The Overview / Interfaces / Connected devices / Activity tabs render immediately and refresh every ~30 s while the workspace is open.
5. The same switch is also auto-registered into the **Core Network** fleet with `integrationVendor: "cisco"` and `pollMethod: "cisco_ssh"`, so it shows up in the port grid alongside any existing SNMP devices.

The legacy route `/cisco-switches` redirects to `/snmp?tab=cisco`.

Advanced settings cover non-default SSH ports, enable-password, SNMP v2c community override, and SNMPv3 USM (user, auth proto/pass, priv proto/pass).

### Prerequisites on the switch

- SSH enabled (Security → TCP/UDP Services → Enable SSH server).
- A user with privilege 15 (Administration → User Accounts → Access level 15).
- SNMP v2c read-only community (Administration → SNMP → Communities). Optional but recommended — it powers continuous counter polling without re-running SSH commands every second.
- LLDP enabled (Administration → Discovery → LLDP → Enable). Not strictly required; CDP is the fallback.

### Architecture

```
React UI (CiscoSwitchesPage, CiscoConnectionModal, Core Network fleet)
   │
   ├─ src/api/ciscoApi.js
   │     │
   │     ├─ POST /functions/ciscoCommand   ──┐
   │     └─ GET  /functions/ciscoEvents (SSE)│
   │                                         ▼
   │                       mock-server/server.js
   │                                  │
   │                                  ▼
   │            scanner/integrations/cisco/ciscoSwitchClient.js   (per-host singleton)
   │                ├─ ciscoSshClient.js  (ssh2 + show parsers)
   │                └─ ciscoSnmpPoller.js (BRIDGE/LLDP/POE walks)
   │                          │
   │                          ▼
   │                Cisco C1300 (ports 22 + 161)
   │
   └─ src/lib/integrations/cisco/ciscoAdapter.js
         normalises SSH+SNMP into the existing `port[]` shape
         used by the Core Network fleet — same UI for free.
```

### Dashboard widgets

| Widget | Data source |
|---|---|
| `lutron_lights` | `SystemDataContext` — Lutron connection probe + lighting house zone state (lights on / total) |
| `cisco_switches` | `SystemDataContext` — Cisco switch list + per-host SSH probe results |

Both widgets link to their respective management pages. Add them from **Settings → Dashboard widgets** if your layout predates this release.

### Falling back gracefully

- If `ssh2` isn't installed in the scanner package, the SSH client returns a clear error message and the page falls back to a mock C1300-48FP-4G snapshot so the page still renders during development.
- If SSH succeeds but SNMP times out, the snapshot keeps the SSH-derived data and the LLDP/MAC tables — counters just aren't continuously refreshed.
- Demo mode short-circuits the live path entirely and returns a curated `C1300-48FP-4G` with realistic interfaces, MAC entries, and LLDP/CDP neighbours.

---

## 7. Vessel Spreadsheet Import

Albatros-style multi-sheet `.xlsx` workbooks can be imported through **Equipment → Import spreadsheet**:

| Sheet | What gets imported |
|---|---|
| Device List | Equipment rows with IP / model / location / serial |
| Patch Panels | Patch panels with port counts |
| Switch sheets | Managed switches with port configurations |
| Appliances | Non-network appliances |
| IP Scheme | IP addressing plan (informational) |
| Racks | Rack layouts with RU assignments |

The parser normalises columns, strips credential columns, and either merges into or replaces existing data per the import dialog.

---

## 8. Diagnoses pipeline

Every subsystem emits diagnoses into the central generator (`src/lib/systemData/generateDiagnoses.js`):

| Source | Findings |
|---|---|
| **Network** | port-down, high latency, missing equipment |
| **SNMP** | port count drift, fault hints, FDB anomalies |
| **WAN** | `wan-link-down`, `wan-link-degraded` |
| **Lighting** | `lighting-processor-offline`, `lighting-zone-rejected-<href>`, `lighting-zone-unreachable-<href>` |
| **Cisco** | `cisco-switch-offline-<host>`, `cisco-switch-auth-failed-<host>`, `cisco-port-flapping-<host>-<ifIndex>` |

`src/contexts/SystemDataContext.jsx` periodically probes the Lutron processor and each saved Cisco switch (60 s cadence each) and re-generates the matching diagnoses on every `LIGHTING_EVENT_LOG_CHANGED_EVENT`, `LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT`, `NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT`, or `NETWORK_CISCO_SWITCHES_CHANGED_EVENT` dispatch.

---

## 9. Troubleshooting

| Symptom | Most likely cause | Fix |
|---|---|---|
| Shade buttons appear but the curtain doesn't move; event log shows "GoToLevel not supported for the specified ZoneType" | Curtain is an OpenCloseStop motor; the LEAP probe didn't pin it down | Already handled automatically — the client retries as `raiseLowerStop` and caches the discovery. If it still fails, check the **Diagnoses** page for `lighting-zone-unreachable-<href>` and verify the address in the Edit modal. |
| Slider flickers visually while dragging | (Fixed) the busy state was toggling opacity 8×/sec | Refresh the browser. The new `SmoothLevelSlider` debounces busy with a 350 ms transition. |
| Shades tab appears empty even after import | Curtains are named just by index inside an area Designer called something other than the standard window-treatment vocabulary | Reload the page — `normalizeLightingHouse` re-classifies on every load. If still empty, share an example zone path so the classifier vocabulary can be extended. |
| Renaming a zone leaves stale events under the old address | Per-zone state migration didn't run | The Edit modal handles this — but if you used the API directly, the `OCS_DISCOVERED_KEY` `localStorage` cache and the `lighting-zone-state` settings entry both need the old href removed. |
| Lutron LEAP pairing hangs | Designer didn't enable Integration Access for the user, or you missed the 30s window after pressing the pairing button | Re-enable Integration Access in Designer, re-transfer the project, then restart the WaveGuard pairing flow. |
| KNX gateway not responding | UDP 3671 blocked or multicast missing from the subnet | Verify the firewall and switch-level IGMP snooping settings. |
| `POST /api/functions/lutronCommand` returns 500 | Mock server can't reach the live processor at all | Check the mock-server terminal — the error message is logged in full, including the LEAP `ExceptionResponse` body. |
| Cisco connection modal says "SSH login failed: All configured authentication methods failed" | Wrong username or password, OR the user lacks SSH access | Verify on the switch CLI: `show running-config | include username` — the user must have `password` and `privilege 15`. Reset the password via the console port if forgotten. |
| Cisco Overview shows the model but Interfaces is empty | SSH succeeded but the firmware version is older / newer than the SMB-OS regex covers | Open the mock-server terminal and look for the raw `show interfaces status` output. Send a snippet so the parser regex can be widened. |
| Connected Devices tab is empty | LLDP / CDP not enabled on the switch; or the operator hasn't polled yet | Enable LLDP under Administration → Discovery → LLDP. CDP is auto-enabled by default; if it was disabled, re-enable it under Discovery → CDP. |
| `ssh2 is not installed` error from the Cisco modal | The `scanner/node_modules` hasn't been rebuilt since `ssh2` was added | Run `npm install` at the project root (postinstall installs `scanner/`) or `npm install` inside `scanner/` |
| Switch logs `%AAA-W-REJECT` for telnet | A client probed port 23 | WaveGuard no longer probes Telnet during Cisco port discovery — only SSH (22) and SNMP (161) |

---

## 10. HVAC Integration (Modbus TCP)

| Setting | Value |
|---|---|
| Protocol | Modbus TCP (RTU encapsulation) |
| Default port | TCP 502 |
| Unit ID | 1–247 (default 1) |
| Live client | `scanner/integrations/modbus/modbusClient.js` |
| Mock engine | `src/lib/integrations/modbus/modbusAdapter.js` |

### Configure

1. **Settings → Integrations → Modbus TCP (HVAC)**.
2. Enter the **host** (Modbus gateway/controller IP) and optional **unit ID**.
3. Click **Test connection** — the probe sends a `Read Holding Registers` (FC 03) to confirm the protocol handshake.
4. Save — the integration is registered for the dashboard and diagnoses pipeline.

### Addressing

Modbus register addresses are mapped as follows:

| Prefix | What it does | Example |
|---|---|---|
| `reg:<addr>` | Write a single holding register (FC 06) with 0–65535 scaled from 0–100% | `reg:0` → register 0 |
| `coil:<addr>` | Write a single coil (FC 05) | `coil:0` → coil 0 |
| `hvac_temp:<zone>` | Write a temperature setpoint (register × 10 = °C) | `hvac_temp:0` → register 0×2 = 20.0°C |
| `hvac_mode:<zone>` | Write HVAC mode (0=off, 1=heat, 2=cool, 3=auto) | `hvac_mode:0` → register 1 |

### Typical HVAC register map (example)

| Register | Function | Format |
|---|---|---|
| 0 | Zone 1 setpoint | °C × 10 (e.g. 220 = 22.0°C) |
| 1 | Zone 1 mode | 0=off, 1=heat, 2=cool, 3=auto |
| 2 | Zone 2 setpoint | °C × 10 |
| 3 | Zone 2 mode | 0–3 |
| ... | ... | ... |

---

## 11. HVAC Integration (Coolmaster Net)

| Setting | Value |
|---|---|
| Protocol | Coolmaster Net (Mitsubishi VRF/heat pump) |
| Default port | TCP 10102 |
| Live client | `scanner/integrations/coolmaster/coolmasterClient.js` |
| Mock engine | `src/lib/integrations/coolmaster/coolmasterAdapter.js` |

### Configure

1. **Settings → Integrations → Coolmaster Net (HVAC)**.
2. Enter the **host** (Coolmaster controller IP) and optional **unit ID**.
3. Click **Test connection** — the probe sends a `#0,0,0,\r\n` query and expects a `#` response.
4. Save.

### Protocol format

Commands follow the Coolmaster ASCII protocol:

| Command | Format | Example |
|---|---|---|
| Query unit | `#<id>,<unit>,0,\r\n` | `#0,0,0,\r\n` |
| Set temperature | `#<id>,<unit>,1,<temp>\r\n` | `#0,0,1,22\r\n` |
| Set mode | `#<id>,<unit>,2,<mode>\r\n` | `#0,0,2,1\r\n` (1=cool, 2=heat) |
| Set fan speed | `#<id>,<unit>,3,<speed>\r\n` | `#0,0,3,4\r\n` (4=auto) |
| Set power | `#<id>,<unit>,4,<on>\r\n` | `#0,0,4,1\r\n` |

---

## 12. HVAC Integration (RS485 Serial Bridge)

| Setting | Value |
|---|---|
| Protocol | TCP-to-RS485 bridge (USR-N510 and similar) |
| Default port | TCP 4001 |
| Live client | `scanner/integrations/rs485/rs485Client.js` |
| Mock engine | `src/lib/integrations/rs485/rs485Adapter.js` |

### Configure

1. **Settings → Integrations → RS485 Serial Bridge (HVAC)**.
2. Enter the **bridge IP** and **TCP port**.
3. Optionally set **baud rate** (default 9600) and **encoding** (ascii or hex).
4. Click **Test connection** — the probe checks common ports (4001–4005, 8899, 2000, 2001).
5. Save.

### Usage

The RS485 bridge forwards raw ASCII or hex commands from WaveGuard to any serial HVAC device connected to the bridge. Configure the serial parameters (baud, data bits, parity, stop bits) in the bridge's web interface to match your HVAC bus.

---

## 13. KNX HVAC (KNX DPT extension)

The existing KNX integration (`scanner/integrations/knx/knxClient.js`) has been extended with HVAC-specific DPT writers:

| DPT | Method | Description |
|---|---|---|
| 9.001 | `writeHvacTemperature(groupAddr, tempC)` | 2-byte IEEE float temperature (-273–+670760°C) |
| 5.001 | `writeHvacSetpoint(groupAddr, tempC)` | 1-byte 0–100% → scaled to 0–40°C range |
| 20.102 | `writeHvacMode(groupAddr, mode)` | HVAC mode (auto/comfort/standby/night/frost) |
| 1.001 | `writeHvacOnOff(groupAddr, on)` | Binary on/off control |

The mock engine (`src/lib/integrations/knx/knxAdapter.js`) seeds 4 HVAC zones with temperature, setpoint, mode, and on/off group addresses.

HVAC group addresses for KNX follow a conventional structure:

| Function | Main group | Middle | Sub |
|---|---|---|---|
| Temperature feedback | 2 | zone | 0 |
| Setpoint write | 3 | zone | 0 |
| HVAC mode | 4 | zone | 0 |
| On/Off | 5 | zone | 0 |
| Humidity feedback | 6 | zone | 0 |

---

## 14. Troubleshooting — HVAC

| Symptom | Most likely cause | Fix |
|---|---|---|
| Modbus probe fails | Unit ID mismatch or register out of range | Verify the unit ID on the Modbus controller. Try reading register 0 with unit ID 1. |
| Modbus "Illegal Data Address" | The controller doesn't support the probed register | Some controllers require specific function code access. Try adjusting register address. |
| Coolmaster probe times out | Wrong IP or port, or controller not powered | Default port is 10102. Verify the Coolmaster's web interface is accessible. |
| RS485 bridge connects but no data | Baud rate or serial params don't match the HVAC device | Check the HVAC device manual for correct serial settings. Common: 9600 8N1. |
