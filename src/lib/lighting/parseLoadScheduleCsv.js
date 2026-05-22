const AREA_HEADER_RE = /^[,\s]*([\w\s\-]+)\\(.+)$/;
const COL_HEADER_RE = /Zone\s+Name/i;
const UNSPECIFIED_RE = /^unspecified$/i;

const BOM = "\uFEFF";

function stripBom(text) {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

function parseWattage(raw) {
  if (UNSPECIFIED_RE.test(raw)) return null;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractFloorArea(areaFullPath) {
  const sep = areaFullPath.indexOf("\\");
  if (sep === -1) return { floor: areaFullPath, area: areaFullPath };
  return {
    floor: areaFullPath.slice(0, sep).trim(),
    area: areaFullPath.slice(sep + 1).trim(),
  };
}

function extractAssignmentParts(assignedTo) {
  if (!assignedTo) return { panel: "", module: "", output: "" };
  const parts = assignedTo.split("\\");
  const panel = parts.length >= 2 ? parts[parts.length - 2].trim() : "";
  const output = parts.length >= 1 ? parts[parts.length - 1].trim() : "";
  const module = parts.length >= 3 ? parts[parts.length - 3].trim() : panel;
  return { panel, module, output };
}

function parseCsvRow(line) {
  const cols = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

/**
 * Parse a Lutron Designer Load Schedule CSV.
 *
 * Format:
 *   - Header rows (project info, blank lines)
 *   - Area sections: `Floor\Area Name` (may have leading comma)
 *   - Column header: Zone Name, Zone Description, Load #, Load Type, Assigned To, Total Wattage
 *   - Data rows: simple or quoted CSV
 */
export function parseLoadScheduleCsv(text) {
  const cleaned = stripBom(String(text));
  const lines = cleaned.split(/\r?\n/);
  const entries = [];
  let currentAreaFullPath = null;

  for (let raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      currentAreaFullPath = null;
      continue;
    }

    // Check for area header: "Floor\Area Name" (possibly with leading comma)
    const areaMatch = trimmed.match(AREA_HEADER_RE);
    if (areaMatch) {
      const full = areaMatch[1] + "\\" + areaMatch[2];
      currentAreaFullPath = full.replace(/[\u200E\u200F]/g, "").trim();
      continue;
    }

    // Skip column header
    if (COL_HEADER_RE.test(trimmed.replace(/^[,"\s]+/, ""))) {
      continue;
    }

    if (!currentAreaFullPath) continue;
    if (trimmed.startsWith('"Total')) continue;
    if (trimmed.includes("Lutron Electronics") || trimmed.includes("www.lutron.com")) continue;

    const cols = parseCsvRow(trimmed);
    if (cols.length < 6) continue;

    const zoneName = cols[0];
    const zoneDescription = cols[1];
    const loadNumberRaw = cols[2];
    const loadType = cols[3];
    const assignedTo = cols[4].replace(/[\u200E\u200F]/g, "").trim();
    const wattageRaw = cols[5];

    if (!zoneName || !loadType) continue;

    const loadNumber = parseInt(loadNumberRaw, 10);
    const wattage = parseWattage(wattageRaw);
    const { floor, area } = extractFloorArea(currentAreaFullPath);
    const { panel, module, output } = extractAssignmentParts(assignedTo);

    entries.push({
      zoneName,
      areaFullPath: currentAreaFullPath,
      floor,
      area,
      loadNumber: Number.isFinite(loadNumber) ? loadNumber : null,
      loadType,
      wattage,
      assignedTo,
      panel,
      module,
      output,
    });
  }

  return entries;
}
