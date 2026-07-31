/** Per-sheet-type column schemas matching Albatros-style vessel workbooks. */

export const SHEET_GROUPS = {
  deviceList: "deviceList",
  patchPanels: "patchPanels",
  switchPorts: "switchPorts",
  appliance: "appliance",
  ipScheme: "ipScheme",
  rack: "rack",
  generic: "generic",
  skip: "skip",
};

/** Phase 1 importable groups (default enabled in UI). */
export const PHASE1_GROUPS = [
  SHEET_GROUPS.deviceList,
  SHEET_GROUPS.patchPanels,
  SHEET_GROUPS.switchPorts,
  SHEET_GROUPS.appliance,
  SHEET_GROUPS.generic,
];

/** Groups imported with patch panel schedule uploads (panels + rack placement + auto-detected sheets). */
export const PATCH_PANEL_IMPORT_GROUPS = [
  SHEET_GROUPS.patchPanels,
  SHEET_GROUPS.rack,
  SHEET_GROUPS.generic,
];

/** Phase 2 groups. */
export const PHASE2_GROUPS = [SHEET_GROUPS.ipScheme, SHEET_GROUPS.rack];

export const CREDENTIAL_HEADERS = new Set([
  "username",
  "password",
  "user name",
  "passwd",
]);

/** Albatros floor codes → display deck names. */
export const DEFAULT_FLOOR_MAP = {
  BD: "Boat Deck",
  LD: "Lower Deck",
  MD: "Main Deck",
  OD: "Owner Deck",
  SD: "Sun Deck",
  TD: "Tank Deck",
};

export const DEVICE_LIST_HEADERS = [
  "floor",
  "room",
  "location",
  "system",
  "type",
  "end device",
  "end device port",
  "poe (w)",
  "mac",
  "serial #",
  "serial",
  "ip",
  "ip address",
  "management ip",
  "notes",
];

export const PATCH_PANEL_HEADERS = [
  "patch panel",
  "port",
  "cable no.",
  "cable no",
  "net",
  "cable number",
  "cable #",
  "type",
  "system",
  "code",
  "deck",
  "floor",
  "room",
  "location",
  "destination",
  "end device",
  "end device sw",
  "device",
  "end device port/i",
  "end device port/int",
  "end device port",
  "tested\\length",
  "tested/length",
  "notes",
];

export const SWITCH_HEADERS = [
  "hostname",
  "mac address",
  "firmware",
  "location",
  "model no",
  "model no.",
  "poe total (w)",
  "serial number",
  "management ip",
  "notes",
];

export const APPLIANCE_HEADERS = [
  "hostname",
  "mac address",
  "base mac address",
  "location",
  "firmware",
  "firmware version",
  "model no",
  "model no (controller)",
  "management ip",
  "serial number",
  "notes",
];

export const SWITCH_SHEET_PATTERNS = [
  /core\s*sw/i,
  /\bsw\d/i,
  /\bsw\s*\d/i,
];

export const APPLIANCE_SHEETS = new Set([
  "wan router",
  "firewall",
  "wlan",
  "pbx",
]);

export function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\\/g, "/");
}

export function isCredentialHeader(h) {
  return CREDENTIAL_HEADERS.has(normalizeHeader(h));
}
