import { SHEET_GROUPS, PATCH_PANEL_HEADERS } from "../spreadsheet/schemas.js";
import { COMPACT_PATCH_COLUMNS } from "../spreadsheet/parseCompactPatchPanel.js";

/** Human-readable labels for patch panel spreadsheet columns → platform fields. */
export const PATCH_COLUMN_TARGETS = {
  "patch panel": { field: "patch_panel", target: "Panel name + equipment record" },
  port: { field: "port", target: "Port number" },
  "cable no.": { field: "label", target: "Cable label / tag" },
  "cable no": { field: "label", target: "Cable label / tag" },
  type: { field: "type", target: "Cable type" },
  system: { field: "system_category", target: "System category" },
  "deck": { field: "deck", target: "Deck" },
  floor: { field: "deck", target: "Deck (via floor code)" },
  room: { field: "room", target: "Room" },
  location: { field: "location", target: "Location" },
  "end device": { field: "to_equipment", target: "Connected device" },
  "end device port/int": { field: "end_device_port", target: "Device port" },
  "end device port": { field: "end_device_port", target: "Device port" },
  "tested/length": { field: "length + test_result", target: "Cable length & test result" },
  "tested\\length": { field: "length + test_result", target: "Cable length & test result" },
  notes: { field: "notes", target: "Notes" },
};

const KNOWN_PATCH_HEADERS = new Set([
  ...PATCH_PANEL_HEADERS,
  ...Object.keys(PATCH_COLUMN_TARGETS),
]);

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\\/g, "/");
}

/**
 * Scan parsed workbook and enable every sheet type that contains importable data.
 */
export function detectEnabledGroupsFromWorkbook(parsed) {
  const groups = new Set([
    SHEET_GROUPS.patchPanels,
    SHEET_GROUPS.rack,
    SHEET_GROUPS.generic,
  ]);
  for (const sheet of parsed?.sheets || []) {
    if (sheet.skipped || sheet.sheetType === SHEET_GROUPS.skip) continue;
    if ((sheet.rowCount ?? 0) > 0 || sheet.rows?.length || sheet.placements?.length) {
      groups.add(sheet.sheetType);
    }
  }
  return [...groups];
}

function sheetHeaders(sheet) {
  if (Array.isArray(sheet.headers) && sheet.headers.length) {
    return sheet.headers.map((h) => String(h || "").trim()).filter(Boolean);
  }
  if (sheet.rows?.[0]) {
    const first = sheet.rows[0];
    if (first.rawObj) return Object.keys(first.rawObj);
    return Object.keys(first).filter((k) => !["sheet", "row", "kind", "rawObj", "consumedKeys"].includes(k));
  }
  return [];
}

/**
 * Build column mapping + sample rows for import preview UI.
 */
export function buildPatchImportPreview(parsed, payload) {
  const sheets = (parsed?.sheets || []).filter((s) => !s.skipped && s.sheetType !== SHEET_GROUPS.skip);
  const patchSheets = sheets.filter((s) => s.sheetType === SHEET_GROUPS.patchPanels);

  const columnMaps = [];
  for (const sheet of patchSheets) {
    if (sheet.compact) {
      for (const col of COMPACT_PATCH_COLUMNS) {
        columnMaps.push({
          sheet: sheet.sheetName,
          sourceColumn: col.sourceColumn,
          normalized: col.sourceColumn.toLowerCase(),
          platformField: col.platformField,
          importTarget: col.importTarget,
          recognized: true,
        });
      }
      continue;
    }
    const headers = sheetHeaders(sheet);
    for (const rawHeader of headers) {
      const norm = normalizeHeader(rawHeader);
      const mapping = PATCH_COLUMN_TARGETS[norm];
      columnMaps.push({
        sheet: sheet.sheetName,
        sourceColumn: rawHeader,
        normalized: norm,
        platformField: mapping?.field || "(stored in notes)",
        importTarget: mapping?.target || "Extra column → notes",
        recognized: Boolean(mapping) || KNOWN_PATCH_HEADERS.has(norm),
      });
    }
  }

  const sampleRows = (payload?.cables || []).slice(0, 15).map((c) => ({
    label: c.label,
    patch_panel: c.patch_panel,
    port: c.port,
    type: c.type,
    system_category: c.system_category,
    to_equipment: c.to_equipment,
    end_device_port: c.end_device_port,
    length: c.length,
    test_result: c.test_result,
    deck: c.deck,
    room: c.room,
    location: c.location,
    notes: c.notes,
  }));

  return {
    sheets: sheets.map((s) => ({
      name: s.sheetName,
      type: s.sheetType,
      rowCount: s.rowCount ?? s.rows?.length ?? 0,
      compact: Boolean(s.compact),
      headers: s.compact ? COMPACT_PATCH_COLUMNS.map((c) => c.sourceColumn) : sheetHeaders(s),
    })),
    columnMaps,
    sampleRows,
    stats: payload?.stats || {},
    hasRackLayout: Boolean(payload?.rackLayout),
    warnings: payload?.warnings || [],
  };
}
