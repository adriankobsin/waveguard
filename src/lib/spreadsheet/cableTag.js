/** Extract and normalize cable tag strings (NET 1545, NET1540, 551 NET 3, etc.). */

const NET_INLINE_RE = /\bNET\s*\d+\b/i;
const RACK_NET_RE = /\b(\d+)\s+NET\s+(\d+)\b/i;

export function normalizeCableTag(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  const rackNet = s.match(RACK_NET_RE);
  if (rackNet) return `${rackNet[1]} NET ${rackNet[2]}`;

  const net = s.match(/\bNET\s*(\d+)\b/i);
  if (net) return `NET ${net[1]}`;

  return s;
}

export function extractCableTagFromText(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  const rackNet = s.match(RACK_NET_RE);
  if (rackNet) return `${rackNet[1]} NET ${rackNet[2]}`;

  const net = s.match(/\bNET\s*(\d+)\b/i);
  if (net) return `NET ${net[1]}`;

  return "";
}

export function rowContainsCableTag(values = []) {
  for (const val of values) {
    if (extractCableTagFromText(val)) return true;
  }
  return false;
}

export function isSyntheticPatchLabel(label, panel, port) {
  if (!label || !panel || port == null || port === "") return false;
  const portStr = String(port).trim();
  return (
    label === `${panel}-P${portStr}` ||
    label === `${panel} P${portStr}` ||
    label === `${panel}-P${portStr}`.toUpperCase()
  );
}
