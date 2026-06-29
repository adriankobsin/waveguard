/**
 * Header → equipment-field synonym mapping for generic spreadsheet imports.
 *
 * Used when an uploaded workbook does not follow the Albatros template — we
 * scan every sheet's header row and map columns onto the equipment schema by
 * matching against these synonyms. Unrecognized columns are preserved verbatim
 * so no data is dropped on import.
 */

import { normalizeHeader } from "./schemas.js";

/**
 * Each field maps to an ordered list of synonyms. Synonyms are normalized
 * (lower-cased, single-spaced) and matched against the normalized header.
 * Longer / more specific synonyms should come first so they win over
 * shorter generic ones (e.g. "management ip" before "ip").
 */
export const FIELD_SYNONYMS = {
  name: [
    "equipment name",
    "device name",
    "asset name",
    "hostname",
    "host name",
    "host",
    "end device",
    "device",
    "equipment",
    "asset",
    "name",
  ],
  make: [
    "manufacturer",
    "vendor",
    "make",
    "brand",
  ],
  model: [
    "model number",
    "model no.",
    "model no",
    "model name",
    "model",
    "sku",
    "part number",
    "part no",
  ],
  category: [
    "category",
    "device type",
    "equipment type",
    "asset type",
    "system",
    "type",
  ],
  ip: [
    "management ip",
    "mgmt ip",
    "ip address",
    "ipv4",
    "ip",
  ],
  mac: [
    "base mac address",
    "mac address",
    "mac addr",
    "hardware address",
    "mac",
  ],
  serial: [
    "serial number",
    "serial #",
    "serial no",
    "serial no.",
    "s/n",
    "sn",
    "serial",
  ],
  firmware: [
    "firmware version",
    "fw version",
    "firmware",
    "fw",
    "software version",
  ],
  location: [
    "rack location",
    "physical location",
    "location",
    "site",
    "placement",
  ],
  floor: [
    "deck",
    "floor",
    "level",
  ],
  room: [
    "room number",
    "room no",
    "room",
    "zone",
    "compartment",
    "cabin",
  ],
  portLabel: [
    "end device port",
    "port label",
    "port number",
    "port no",
    "port",
  ],
  poeWatts: [
    "poe total (w)",
    "poe (w)",
    "poe watts",
    "poe w",
    "poe",
  ],
  condition: [
    "condition",
    "state",
    "health",
  ],
  status: [
    "status",
    "online",
    "active",
  ],
  notes: [
    "notes",
    "comments",
    "description",
    "remarks",
    "memo",
  ],
};

/** Headers that should never be imported as equipment fields. */
export const EXCLUDED_HEADERS = new Set([
  "username",
  "user name",
  "password",
  "passwd",
  "pwd",
]);

/**
 * Resolve a normalized header to an equipment field. Returns null if it
 * doesn't match any synonym (caller may still preserve it as a free-form note).
 */
export function mapHeaderToField(normalizedHeader) {
  if (!normalizedHeader) return null;
  if (EXCLUDED_HEADERS.has(normalizedHeader)) return null;

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      if (normalizedHeader === syn) return field;
    }
  }
  // Loose contains-match as a fallback (e.g. "Equipment IP Address" → ip).
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      if (syn.length >= 3 && normalizedHeader.includes(syn)) return field;
    }
  }
  return null;
}

/**
 * Score a candidate header row by how many cells map to known equipment
 * fields. Used to pick the best header row when the layout is unknown.
 *
 * @returns {{ score: number, fieldByCol: Object<number,string>, headers: string[] }}
 */
export function scoreHeaderRow(rawRow) {
  const headers = (rawRow || []).map((c) => (c == null ? "" : String(c).trim()));
  const fieldByCol = {};
  let score = 0;
  let hasName = false;
  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeHeader(headers[i]);
    const field = mapHeaderToField(norm);
    if (!field) continue;
    if (fieldByCol[i]) continue;
    fieldByCol[i] = field;
    score += 1;
    if (field === "name") hasName = true;
  }
  return { score, fieldByCol, headers, hasName };
}

/**
 * Find the most likely header row in a sheet. We need at least a "name"
 * column and one additional recognized field, otherwise we can't safely
 * build equipment rows.
 *
 * @returns {{ index: number, fieldByCol: Object<number,string>, headers: string[] } | null}
 */
export function detectGenericHeaderRow(rows, { scanRows = 25 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const limit = Math.min(rows.length, scanRows);
  let best = null;
  for (let r = 0; r < limit; r++) {
    const result = scoreHeaderRow(rows[r]);
    if (!result.hasName) continue;
    if (result.score < 2) continue;
    if (!best || result.score > best.score) {
      best = { index: r, ...result };
    }
  }
  return best;
}

const NUMERIC_FIELDS = new Set(["poeWatts"]);

function cellValue(v) {
  if (v == null) return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return String(v).trim();
}

/**
 * Extract a single equipment row using a header → field mapping.
 * Unrecognized columns are appended to `notes` as `header: value` pairs so the
 * import round-trips every visible cell.
 */
export function rowToGenericEquipment(row, headerInfo, sheetName, rowIndex) {
  if (!row || !headerInfo) return null;
  const { headers, fieldByCol } = headerInfo;
  const data = {};
  const extras = [];

  for (let i = 0; i < headers.length; i++) {
    const val = cellValue(row[i]);
    if (!val) continue;
    const field = fieldByCol[i];
    if (field) {
      if (NUMERIC_FIELDS.has(field)) {
        const n = parseFloat(val);
        if (!Number.isNaN(n)) data[field] = n;
      } else if (data[field] == null || data[field] === "") {
        data[field] = val;
      }
    } else {
      const label = headers[i];
      if (!label) continue;
      const norm = normalizeHeader(label);
      if (EXCLUDED_HEADERS.has(norm)) continue;
      extras.push(`${label}: ${val}`);
    }
  }

  if (!data.name) return null;

  const notesParts = [];
  if (data.notes) notesParts.push(data.notes);
  if (extras.length) notesParts.push(extras.join(" | "));
  if (notesParts.length) data.notes = notesParts.join(" | ");

  return {
    sheet: sheetName,
    row: rowIndex,
    kind: "generic-equipment",
    ...data,
  };
}

/**
 * For known-template rows, merge any cells whose headers were not consumed by
 * the template parser. Useful when a Device List has extra columns like
 * "IP Address" or "Manufacturer" — we don't want that data dropped.
 *
 * @param {Object} consumedKeys Lowercase header keys already used.
 * @returns {Object} fields keyed by equipment field (subset)
 */
export function extractExtraFieldsFromObject(obj, consumedKeys = new Set()) {
  const out = {};
  const extras = [];
  for (const [rawKey, val] of Object.entries(obj || {})) {
    if (!val) continue;
    const key = normalizeHeader(rawKey);
    if (!key) continue;
    if (consumedKeys.has(key)) continue;
    if (EXCLUDED_HEADERS.has(key)) continue;
    const field = mapHeaderToField(key);
    if (field) {
      if (NUMERIC_FIELDS.has(field)) {
        const n = parseFloat(val);
        if (!Number.isNaN(n)) out[field] = n;
      } else if (out[field] == null || out[field] === "") {
        out[field] = String(val).trim();
      }
    } else {
      extras.push(`${rawKey}: ${val}`);
    }
  }
  if (extras.length) out._extraNotes = extras.join(" | ");
  return out;
}
