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
| **Dashboard** | Customisable widgets — device health, alerts, WAN status, dashboard tiles |
| **Topology** | Equipment table + deck plans / racks / AV signal flows / control paths |
| **Core Network** | Live SNMP port map for every managed switch |
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
| **Lights** | Floor → Area tree filtered to lights. Each zone shows a slider + on/off toggle. |
| **Shades** | Same tree filtered to shades, blinds, blackouts, curtains and drapes. Each zone shows **Open / Close / Stop** buttons. |
| **Area Control** | Per-floor map or list view. Click a pin to open an inline control card. The "Recent activity" event log is in the left rail. |
| **Scenes** | Run saved Lutron scenes with one click. |

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
- **TLS pairing certificates** — `mock-server/lutron-certs/<host>.{key,cert,ca}`.

Clearing the relevant `localStorage` key forces a clean state for that subsystem on next reload.
