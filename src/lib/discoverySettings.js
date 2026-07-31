export const DISCOVERY_SETTINGS_KEY = "discovery";
export const DISCOVERY_CHANGED_EVENT = "waveguard-discovery-changed";

export const DEFAULT_DISCOVERY_SETTINGS = {
  subnets: [],
  /** Optional map of CIDR → human label (from IP Scheme VLANs). */
  subnetLabels: {},
  /** Known IT hosts from spreadsheet (gateways, switches, APs, etc.). */
  knownHosts: [],
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

export function buildSubnetLabels(subnets, existingLabels = {}) {
  const labels = { ...(existingLabels && typeof existingLabels === "object" ? existingLabels : {}) };
  for (const entry of subnets || []) {
    if (typeof entry === "object" && entry?.cidr) {
      const cidr = String(entry.cidr).trim();
      const label = String(entry.label || "").trim();
      if (cidr && label) labels[cidr] = label;
    }
  }
  // Drop labels for CIDRs that are no longer configured
  return labels;
}

export function normalizeKnownHosts(hosts = []) {
  const byIp = new Map();
  for (const h of hosts || []) {
    const ip = String(h?.ip || "").trim();
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) continue;
    if (ip.split(".").some((o) => Number(o) > 255)) continue;
    if (byIp.has(ip)) continue;
    byIp.set(ip, {
      ip,
      name: String(h.name || ip).trim(),
      vlan: String(h.vlan || "").trim(),
      source: h.source || "import",
    });
  }
  return [...byIp.values()];
}

/**
 * Merge spreadsheet discovery targets into current discovery settings.
 * Preserves VLAN labels and known IT hosts for scans/tests.
 */
export function mergeDiscoveryImport(current, discoverySubnets = [], knownHosts = []) {
  const base = normalizeDiscoverySettings(current || DEFAULT_DISCOVERY_SETTINGS);
  const incomingCidrs = normalizeSubnetList(discoverySubnets);
  const subnetLabels = buildSubnetLabels(discoverySubnets, base.subnetLabels);
  return normalizeDiscoverySettings({
    ...base,
    subnets: [...new Set([...(base.subnets || []), ...incomingCidrs])],
    subnetLabels,
    knownHosts: normalizeKnownHosts([...(base.knownHosts || []), ...knownHosts]),
  });
}

export function normalizeDiscoverySettings(raw) {
  const base = { ...DEFAULT_DISCOVERY_SETTINGS, ...raw };
  const subnets = normalizeSubnetList(base.subnets);
  const subnetLabels = buildSubnetLabels(
    Array.isArray(raw?.subnets) ? raw.subnets : [],
    base.subnetLabels
  );
  // Keep only labels for configured subnets
  const prunedLabels = {};
  for (const cidr of subnets) {
    if (subnetLabels[cidr]) prunedLabels[cidr] = subnetLabels[cidr];
  }
  return {
    ...base,
    subnets,
    subnetLabels: prunedLabels,
    knownHosts: normalizeKnownHosts(base.knownHosts),
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
