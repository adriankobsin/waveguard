/**
 * Albatros-style workbooks prefix equipment hostnames with the vessel/site code
 * (e.g. ALBATROS-552-Sw2). WaveGuard stores only the device segment (552-Sw2).
 */

/** Known vessel/site prefixes (case-insensitive), longest first. */
const KNOWN_VESSEL_PREFIXES = ["ALBATROS", "HORIZON"];

/**
 * @param {string} name Raw hostname or end-device label from spreadsheet
 * @returns {string} Display name without leading vessel prefix
 */
export function stripVesselEquipmentName(name) {
  const s = String(name || "").trim();
  if (!s) return s;

  for (const vessel of KNOWN_VESSEL_PREFIXES) {
    const re = new RegExp(`^${vessel}[-_\\s]+`, "i");
    if (re.test(s)) return s.replace(re, "").trim();
  }

  const dash = s.indexOf("-");
  if (dash > 0) {
    const prefix = s.slice(0, dash);
    const rest = s.slice(dash + 1).trim();
    if (
      rest &&
      /^[A-Za-z][A-Za-z0-9_\s]*$/.test(prefix) &&
      !/\d/.test(prefix) &&
      prefix.length >= 5
    ) {
      return rest;
    }
  }

  return s;
}
