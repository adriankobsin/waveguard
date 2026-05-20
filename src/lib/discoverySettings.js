export const DISCOVERY_SETTINGS_KEY = "discovery";
export const DISCOVERY_CHANGED_EVENT = "waveguard-discovery-changed";

export const DEFAULT_DISCOVERY_SETTINGS = {
  subnets: [],
  scanType: "ping",
  autoDetectLocalSubnets: true,
  snmpEnabled: true,
  snmpCommunity: "public",
  snmpVersion: "2c",
  maxConcurrent: 64,
  timeoutMs: 1500,
  agentUrl: "",
};

/** Coerce subnet list entries to CIDR strings (spreadsheet import may store { cidr, label }). */
export function normalizeSubnetEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") {
    const s = entry.trim();
    return s || null;
  }
  if (typeof entry === "object" && entry.cidr) {
    const s = String(entry.cidr).trim();
    return s || null;
  }
  return null;
}

export function normalizeSubnetList(subnets) {
  if (!Array.isArray(subnets)) return [];
  return [...new Set(subnets.map(normalizeSubnetEntry).filter(Boolean))];
}

export function normalizeDiscoverySettings(raw) {
  const base = { ...DEFAULT_DISCOVERY_SETTINGS, ...raw };
  return {
    ...base,
    subnets: normalizeSubnetList(base.subnets),
    scanType: ["ping", "arp", "full"].includes(base.scanType) ? base.scanType : "ping",
    maxConcurrent: Math.min(128, Math.max(8, Number(base.maxConcurrent) || 64)),
    timeoutMs: Math.min(5000, Math.max(500, Number(base.timeoutMs) || 1500)),
  };
}

export function loadDiscoverySettingsLocal() {
  try {
    const raw = localStorage.getItem(DISCOVERY_SETTINGS_KEY);
    if (!raw) return null;
    return normalizeDiscoverySettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDiscoverySettingsLocal(data) {
  const normalized = normalizeDiscoverySettings(data);
  localStorage.setItem(DISCOVERY_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(DISCOVERY_CHANGED_EVENT, { detail: normalized }));
  return normalized;
}
