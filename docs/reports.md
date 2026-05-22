# Reports

WaveGuard generates reports from system data, lighting integration imports, and vessel spreadsheet uploads.

## Lighting Reports

### Integration Report (PDF)

The **Lutron Integration Report** is a PDF exported from Lutron Designer (HomeWorks QSX, Athena, RadioRA 3). It contains:

- **Areas** — hierarchical zones grouped by floor and room
- **Zones/Loads** — individual lighting loads, shade/blind zones, with integration IDs, kind, and area assignment
- **Scenes** — area-level scenes with scene numbers (0 = Off)
- **Devices/Keypads** — physical keypads with button and LED component references

**Import flow:**

1. Open **Lighting → Import report**
2. Select the integration report PDF (or paste its text content)
3. The parser extracts areas, zones, scenes, devices, and their hierarchy
4. Summary tiles show counts for areas, loads, scenes, and keypads
5. Confirm to save — the house is persisted under the `lighting-house` settings key

**Parser:** `src/lib/lighting/parseLutronIntegrationReport.js`
- Parses the tabular format with href-linked zone/area/device references
- Extracts numeric integration IDs from LEAP-style hrefs (`/zone/5384`)
- Groups zones into hierarchical floors → areas → zones

### Load Schedule (CSV)

The **Load Schedule CSV** is exported from Lutron Designer and maps physical wiring (panel, module, output) to each zone.

**Format:**

| Column | Description | Example |
|---|---|---|
| Zone Name | Zone identifier | ER1-Pump1 |
| Zone Description | Human-readable label | Pump 1 |
| Load # | Load index | 1 |
| Load Type | Load category | Load, Light, Shade, Blind, Blackout |
| Assigned To | Wiring path | `Floor\Engine Room\LCP-1\Output 1` |
| Total Wattage | Power rating | 400 |

**Import flow:**

1. In the **Import report** dialog, pick a Load Schedule CSV alongside the integration report
2. Both files are parsed independently and merged into one lighting house
3. After import, the **Schedule** button appears in the stats bar (Loads by Area tab)
4. The schedule table shows wiring details with search/filter, panel grouping, and kind icons

**Parser:** `src/lib/lighting/parseLoadScheduleCsv.js`
- Handles area sections (`Floor\Area Name` headers)
- Strips BOM (byte order mark) and unicode control characters
- Supports quoted CSV fields
- Extracts panel/module/output from the `Assigned To` hierarchical path
- Parses wattage (handles "Unspecified" for motors)

**Cross-referencing:** The helper `buildZoneLookup()` (in `lightingSettings.js`) creates a composite key of `zoneName|areaFullPath` to link load schedule entries to integration report zones.

## Wiring Reports

### Vessel Spreadsheet Import

Multi-sheet `.xlsx` workbooks (e.g. Albatros-style) can be imported via **Inventory → Import spreadsheet**. The following sheets are recognized:

- **Device List** — equipment with IP, model, location, serial
- **Patch Panels** — patch panels with port counts
- **Switch sheets** — managed switches with port configurations
- **Appliances** — non-network appliances
- **IP Scheme** — IP addressing plan
- **Racks** — rack layouts with RU assignments

The parser normalises columns, strips credentials, and either merges or replaces existing data.

### Cable Register

The Cable Register tracks physical cables with:

- Cable type (Cat6, Cat6A, Cat7, Fibre OM3, HDMI, SDI, DMX, Power IEC)
- Source and destination equipment
- Length, deck, status (installed, planned, spare)
- Bulk select, edit, delete
- CSV/Excel import/export

## Generated Reports

WaveGuard generates PDF reports from:

- **Platform Manual** — system overview PDF (accessible from the Help page)
- **SNMP Port Map** — live switch port status summaries
- **Topology scans** — equipment inventory and connection data

All generated reports use jsPDF with the platform's dark theme styling.
