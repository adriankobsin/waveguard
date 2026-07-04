/** Shared device categories across topology edit, inventory, and filters. */
export const DEVICE_CATEGORIES = [
  "Network",
  "Camera",
  "CCTV",
  "AV",
  "Server",
  "Power",
  "Control",
  "Router",
  "Lighting",
  "Comms",
  "Security",
  "Other",
  "Unknown",
];

/** Control bus / protocol types for device edit. */
export const DEVICE_CONTROL_TYPES = [
  "none",
  "IP",
  "IR",
  "ModBUS",
  "Cresnet",
  "Lutron Link",
  "KNX BUS",
  "Crestron-CIP",
  "REST",
  "KNX",
  "GPIO",
  "RS-232",
];

export const DEVICE_STATUSES = ["online", "offline", "warning", "unknown"];

/** Colours for control-path topology view. */
export const CONTROL_TYPE_COLORS = {
  none: "#475569",
  IP: "#06b6d4",
  IR: "#f97316",
  ModBUS: "#22c55e",
  Cresnet: "#a855f7",
  "Lutron Link": "#eab308",
  "KNX BUS": "#f59e0b",
  "Crestron-CIP": "#a855f7",
  REST: "#06b6d4",
  KNX: "#f59e0b",
  GPIO: "#94a3b8",
  "RS-232": "#64748b",
};
