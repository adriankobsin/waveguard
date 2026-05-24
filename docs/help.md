# Help

End-user guide for the WaveGuard platform. For developer / integration documentation, see [`docs/integration.md`](integration.md) and [`docs/diagnostics.md`](diagnostics.md).

---

## Logging in and choosing a mode

The first time you open WaveGuard you'll be asked to pick between **Live** and **Demo** mode.

- **Live** uses the real LAN scanner, lighting processor and Base44 backend (or local mock server).
- **Demo** loads a curated yacht — Lutron house, equipment, scenes, dashboard widgets — so you can explore every page without any hardware.

You can switch modes any time from **Settings → Platform mode**.

---

## Sidebar overview

| Item | What you'll find |
|---|---|
| **Dashboard** | Customisable widgets — device health, alerts, WAN status, **Lutron lights**, **Cisco switches**, network tiles |
| **Topology** | Equipment table + deck plans / racks / AV signal flows / control paths |
| **Core Network** | Live SNMP port map, WAN management, and **Cisco Switches** (SSH + SNMP) — see below |
| **Discovery** | Subnet scans (ping / ARP / full / SNMP) and auto-classification |
| **Diagnoses** | All open findings across every subsystem with severity and acknowledgement |
| **Maintenance** | Scheduled tasks with priority, status and due-date alerts |
| **Equipment** | Equipment database — import vessel spreadsheets here |
| **Cables** | Physical-cable register |
| **Documents** | Technical document library with search |
| **AI Assistant** | Chat with the platform's LLM for troubleshooting / lookup |
| **Lights and Shades** | The lighting platform — see below |
| **Automation** | Rule engine for event-triggered and scheduled actions |
| **Reports** | Generated PDF reports |
| **Help** | This guide |
| **Settings** | Discovery, SNMP, lighting connections, users and roles |

The number next to **Diagnoses** is the live count of unresolved findings.

---

## Dashboard widgets

Open **Dashboard** for the at-a-glance view. Click **Edit** (or go to **Settings → Dashboard widgets**) to add, remove, or rearrange tiles.

| Widget | What it shows |
|---|---|
| **Lutron lights** | Whether the Lutron processor is connected, plus how many light loads are on vs total |
| **Cisco switches** | How many Cisco switches are online, with a per-switch list |
| **Network** | Equipment health and SNMP fleet summary |
| **WAN / internet** | Live WAN throughput, ISP details, and on-demand speed test |

New installs include **Lutron lights** and **Cisco switches** in the default layout. If your dashboard was customised earlier, add them manually from the widget picker.

---

## Lights and Shades — step by step

### A. Importing a Lutron Integration Report

1. Click **Lights and Shades** in the sidebar.
2. Click **Import report** in the page header.
3. Pick the Integration Report PDF exported from Lutron Designer. Optionally also pick the Load Schedule CSV.
4. Confirm. The platform parses areas, zones, scenes and keypads and shows summary tiles.

You only need to do this once per project — re-imports overwrite.

### B. Connecting to the processor

1. Click the **key icon** in the Lights and Shades header.
2. Enter host, protocol (LEAP recommended), system type, and integration username / password.
3. Click **Test connection**.
4. Click **Save**.

For HomeWorks QSX / RA3 you'll be guided through the one-time TLS pairing flow.

### C. Controlling lights and shades

The page has four tabs:

| Tab | Use |
|---|---|
| **Lights** | Floor → Area tree filtered to lights. Each zone shows a slider + on/off toggle. Drag floors by the **⋮⋮ grip** on the left to reorder — your order is saved. |
| **Shades** | Same tree filtered to shades, blinds, blackouts, curtains and drapes. Each zone shows **Open / Close / Stop** buttons. Floor order is independent of the Lights tab. |
| **Area Control** | Per-floor map or list view. Click a pin to open an inline control card. The "Recent activity" event log is in the left rail. |
| **Scenes** | Run saved Lutron scenes with one click. |

**Floor order.** Floors start collapsed — click a floor row to expand it. Use the grip handle (⋮⋮) to drag and reorder floors. Lights and Shades each remember their own order.

**Smooth dimming.** Sliders use a smooth-drag throttle — drag freely; commands are sent ~8/sec with a final commit on release. The visual will not flicker during a drag.

### D. Editing a zone (rename / re-address)

Click the **pencil icon** on any zone row (Lights tab, Shades tab, Area Control list, or the popover on the map).

The Edit zone modal lets you change:

- **Name** — free-text label.
- **Integration address** — `/zone/<n>` or just `<n>`. The platform canonicalises and validates the address and prevents collisions with other zones.

Changing the address effectively re-points this UI row at a different physical load on the processor. Per-zone state migrates with you (the slider position doesn't reset) and the event log records the rename.

### E. Adding a scene

1. **Lights and Shades → Scenes** tab.
2. Click **Add scene**.
3. Pick a kind:
   - **Area scene** — area ID + scene number (0 for the area's Off scene, 1-16 for designer-saved scenes).
   - **LEAP href** — paste a `/area/<id>/scene/<n>` reference.
   - **Phantom keypad button** — pick a phantom keypad device ID and button number.
4. Save. The scene appears in the grid with a Run button.

Scenes persist across sessions and reloads.

### F. Watching what's happening

The Area Control tab carries the **Recent activity** sidebar — every command, fallback, rejection and pairing event is logged with a timestamp.

For long-lived alerts, open the **Diagnoses** page. Lighting-specific diagnoses include:

- **Processor offline** — the configured Lutron processor stopped responding.
- **Zone rejected** — a single zone command was rejected by the processor.
- **Zone unreachable** — three or more consecutive failures on the same zone within five minutes.

Each can be acknowledged so the sidebar badge stops counting it. Acknowledgements survive reload.

---

## Cisco Switches — step by step

Cisco Catalyst 1300 (and CBS350-family) switches live under **Core Network → Cisco Switches**. Use this tab when you want rich CLI data (interfaces, MAC table, LLDP/CDP) on top of standard SNMP fleet polling.

### A. Connecting to a switch

1. Open **Core Network** in the sidebar.
2. Select the **Cisco Switches** tab.
3. Click **Add switch** (top-right).
3. Enter the **Host / IP** of the switch.
4. Expand **Advanced settings** and fill in:
   - SSH username + password (and an optional `enable` password if your account is not already privilege‑15).
   - SSH port (default `22`).
   - SNMP community for v2c (default `public`) **or** SNMPv3 user, auth/priv protocols and passphrases.
   - SNMP port (default `161`).
5. Click **Test connection**. The chip turns green ("Switch OK") when SSH and SNMP both respond, and the model / firmware are echoed back.
6. Click **Save**. The switch appears in the left rail **and** is auto-registered into **Core Network → Switches** with `integrationVendor: cisco` and `pollMethod: cisco_ssh`.

### B. Browsing data

The workspace has four tabs:

- **Overview** — model, serial, firmware, uptime, PoE budget, plus KPI tiles (online ports, PoE used, error counters).
- **Interfaces** — every port with status, speed, duplex, VLAN, description and PoE wattage. Search and filter by status/VLAN.
- **Connected devices** — per-port MAC table joined to LLDP/CDP neighbor data, cross-referenced against the Equipment database.
- **Activity** — the rolling event log: every command, port flap, connection test and SSE event.

### C. Editing or removing a switch

- Hover the switch in the left rail and click the pencil icon to re-open the credentials modal.
- Click the trash icon to remove it (this also removes it from Core Network).

### D. Diagnoses and alerts

Cisco-specific findings appear on the **Diagnoses** page:

- **Switch offline** — the configured switch stopped responding to SSH **and** SNMP probes.
- **Authentication failed** — credentials were rejected on the last connection test or poll.
- **Port flapping** — the same port toggled up/down three or more times in five minutes.

Each can be acknowledged like any other diagnosis.

---

## Common workflows

### Adding a new switch to the platform

1. **Equipment → Add equipment** (or import via spreadsheet).
2. Enter IP, model, SNMP community string.
3. **Core Network** picks it up on the next refresh.

### Running a single-IP scan

In **Topology**, hover a device row and click **Scan**. Results are written to the Equipment record immediately. The session cache keeps the topology view alive when you navigate elsewhere and back.

### Importing a vessel spreadsheet

**Equipment → Import spreadsheet** accepts multi-sheet `.xlsx` workbooks (Albatros-style or similar). Pick the file, choose Merge or Replace per sheet, and confirm. Credential columns are stripped before anything is persisted.

### Acknowledging a diagnosis

**Diagnoses** page → click the diagnosis card → **Acknowledge**. Add an optional note. The card moves to the "Acknowledged" section and the sidebar badge counter decrements.

### Switching to Demo mode

**Settings → Platform mode → Demo**. The page reloads with the curated yacht. You can switch back to Live mode at any time without losing your Live-mode data.

---

## Troubleshooting from the UI

| Symptom | Where to look |
|---|---|
| Lights and Shades sidebar entry shows no zones | Open the page → **Import report** (or check **Settings → Platform mode** if you expected Demo data). |
| Shade Open / Close doesn't move the curtain | Check the **Recent activity** sidebar on Area Control. If you see "Processor opened … (OpenCloseStop)" after a brief error burst, the fallback engaged correctly. If errors persist, open the Diagnoses page. |
| Slider visually jumps back | Probably an SSE echo from another control surface (wall keypad, second browser). The platform stays in sync intentionally. |
| Sidebar Diagnoses badge keeps growing | A subsystem is generating new findings — open the Diagnoses page to triage. |
| WAN widget shows "degraded" | The Peplink poller saw a SIM failover or packet-loss spike — see the per-WAN drill-down. |
| Cisco modal says `ssh2 is not installed` | Scanner dependencies missing — run `npm install` at the project root |
| Switch logs `%AAA-W-REJECT` telnet lines | WaveGuard uses SSH only; Telnet is no longer probed during connection tests |
| Cisco KPI tiles stay at 0/0 | Wait ~30 s for the next poll or click **Refresh** in the switch workspace |

If anything in the Lights and Shades pages feels wrong, the **Recent activity** sidebar is the fastest way to see what the platform actually sent to the processor.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Enter` (in any modal) | Submit the form |
| `Esc` | Close the active modal |
| Click outside a modal | Close the modal |

The lighting Edit modal also accepts a bare numeric integration address — typing `5714` is auto-prefixed to `/zone/5714` before saving.

---

## Where things live (for support)

- **Lighting house** — `lighting-house` in SystemSettings, mirrored in `localStorage` (`waveguard:lighting:house`).
- **Per-zone live state** — `lighting-zone-state` / `waveguard:lighting:zone-state`.
- **Custom scenes** — `lighting-custom-scenes` / `waveguard:lighting:custom-scenes`.
- **Event log** — `lighting-event-log` / `waveguard:lighting:event-log`.
- **OpenCloseStop discoveries** — `waveguard:lighting:ocs-zones` (localStorage only).
- **Lighting floor order** — stored inside the lighting house as `floorOrder.lights` / `floorOrder.shades`.
- **Cisco switches** — `network-cisco-switches` / `waveguard:network:cisco-switches`.
- **Cisco event log** — `network-cisco-event-log`.
- **TLS pairing certificates** — `mock-server/lutron-certs/<host>.{key,cert,ca}`.

Clearing the relevant `localStorage` key forces a clean state for that subsystem on next reload.
