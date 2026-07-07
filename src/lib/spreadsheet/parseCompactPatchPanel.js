/**
 * Parse patch panel sheets with no header row and/or empty spacer columns
 * (common in exported schedules: panel | port | [blank] | NET 1545 | [blank] | CAT6A | ...).
 */

import {
  extractCableTagFromText,
  rowContainsCableTag,
} from "./cableTag.js";

const PATCH_PANEL_RE = /-PP\d|PP\d/i;
const PORT_RE = /^\d+$/;
const CABLE_TYPE_RE = /^CAT\d/i;
const DECK_CODE_RE = /^(LD|TD|MD|BD|OD|SD)$/i;

export function compactRowCells(row) {
  return (row || []).map((c) => (c == null ? "" : String(c).trim())).filter((c) => c !== "");
}

export function looksLikePatchDataRow(row) {
  const cells = compactRowCells(row);
  if (cells.length < 3) return false;
  if (!PATCH_PANEL_RE.test(cells[0])) return false;
  if (!PORT_RE.test(cells[1])) return false;
  return rowContainsCableTag(cells.slice(2));
}

export function isPatchPanelHeaderRow(row) {
  const joined = (row || [])
    .map((c) => String(c ?? "").trim().toLowerCase())
    .join("|");
  return joined.includes("patch panel") && (joined.includes("port") || joined.includes("cable"));
}

function classifyTrailingCell(value, state) {
  const c = String(value || "").trim();
  if (!c) return;

  const cableTag = extractCableTagFromText(c);
  if (!state.cableNo && cableTag) {
    state.cableNo = cableTag;
    return;
  }
  if (!state.type && CABLE_TYPE_RE.test(c)) {
    state.type = c;
    return;
  }
  if (!state.deck && DECK_CODE_RE.test(c)) {
    state.deck = c.toUpperCase();
    return;
  }
  if (!state.destination) {
    state.destination = c;
    return;
  }
  state.notes = state.notes ? `${state.notes} | ${c}` : c;
}

export function compactCellsToPatchRow(cells, sheetName, rowIndex) {
  if (!cells?.length || !PATCH_PANEL_RE.test(cells[0]) || !PORT_RE.test(cells[1])) return null;

  const state = { cableNo: "", type: "", deck: "", destination: "", notes: "" };
  for (let i = 2; i < cells.length; i++) {
    classifyTrailingCell(cells[i], state);
  }

  if (!state.cableNo) return null;

  const patchPanel = cells[0];
  const port = cells[1];
  const apNote = [state.notes, state.destination].find((s) => s && /^AP\s/i.test(s)) || "";
  const locationText =
    [state.destination, state.notes].find((s) => s && s !== apNote && !/^AP\s/i.test(s)) || "";

  return {
    sheet: sheetName,
    row: rowIndex,
    patchPanel,
    port,
    cableNo: state.cableNo,
    type: state.type,
    system: "",
    deck: state.deck,
    floor: state.deck,
    room: "",
    location: locationText,
    endDevice: apNote || locationText,
    endDevicePort: "",
    testedLength: "",
    notes: "",
    rawObj: {
      patch_panel: patchPanel,
      port,
      cable_no: state.cableNo,
      type: state.type,
      deck: state.deck,
      destination: state.destination,
      notes: state.notes,
    },
    consumedKeys: [
      "patch panel",
      "patch_panel",
      "port",
      "cable no.",
      "cable no",
      "cable_no",
      "net",
      "type",
      "system",
      "code",
      "deck",
      "floor",
      "destination",
      "location",
      "end device",
      "notes",
    ],
    kind: "patch",
  };
}

export function parseCompactPatchRows(sheetName, rows) {
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;
    if (isPatchPanelHeaderRow(row)) continue;
    if (!looksLikePatchDataRow(row)) continue;
    const parsed = compactCellsToPatchRow(compactRowCells(row), sheetName, i + 1);
    if (parsed) items.push(parsed);
  }
  return items;
}

/** Fixed column layout shown in import preview for compact/headerless sheets. */
export const COMPACT_PATCH_COLUMNS = [
  { sourceColumn: "Column A", platformField: "patch_panel", importTarget: "Patch panel ID" },
  { sourceColumn: "Column B", platformField: "port", importTarget: "Port number" },
  { sourceColumn: "Column C+", platformField: "label", importTarget: "Cable tag (NET ####)" },
  { sourceColumn: "Next", platformField: "type", importTarget: "Cable type (CAT6A, etc.)" },
  { sourceColumn: "Next", platformField: "deck", importTarget: "Deck code (LD, TD, …)" },
  { sourceColumn: "Next", platformField: "location + to_equipment", importTarget: "Destination / end device" },
  { sourceColumn: "Last", platformField: "notes", importTarget: "Notes (e.g. AP reference)" },
];
