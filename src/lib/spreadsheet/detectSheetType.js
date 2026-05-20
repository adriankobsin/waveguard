import {
  SHEET_GROUPS,
  SWITCH_SHEET_PATTERNS,
  APPLIANCE_SHEETS,
} from "./schemas.js";

export function detectSheetType(sheetName) {
  const name = String(sheetName || "").trim();
  const lower = name.toLowerCase();

  if (lower === "search" || lower === "data") return SHEET_GROUPS.skip;
  if (lower === "device list") return SHEET_GROUPS.deviceList;
  if (lower === "patch panels") return SHEET_GROUPS.patchPanels;
  if (lower === "ip scheme") return SHEET_GROUPS.ipScheme;
  if (APPLIANCE_SHEETS.has(lower)) return SHEET_GROUPS.appliance;
  if (lower.includes("rack")) return SHEET_GROUPS.rack;

  if (SWITCH_SHEET_PATTERNS.some((re) => re.test(name))) {
    return SHEET_GROUPS.switchPorts;
  }

  return SHEET_GROUPS.skip;
}

export function headerRowForType(sheetType) {
  switch (sheetType) {
    case SHEET_GROUPS.patchPanels:
    case SHEET_GROUPS.switchPorts:
    case SHEET_GROUPS.appliance:
      return 3;
    case SHEET_GROUPS.rack:
      return 2;
    default:
      return 1;
  }
}
