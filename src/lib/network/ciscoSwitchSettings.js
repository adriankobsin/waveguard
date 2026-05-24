/**
 * Cisco switch connection settings storage.
 *
 * The platform supports multiple Cisco switches per site. Each entry
 * carries SSH credentials, an SNMP community, and a snapshot of the most
 * recent connection test (model, firmware, uptime) so the Cisco Switches
 * page can render without re-polling on navigation.
 *
 * Persistence shape mirrors how Lutron is stored (see
 * `src/lib/lighting/lightingSettings.js`):
 *
 *   SystemSettings key   `network-cisco-switches`  →  { switches: [Switch] }
 *   localStorage mirror  `waveguard:network:cisco-switches`
 *
 * A `network-cisco-switches-changed` window event broadcasts updates so
 * any open page picks up changes immediately (mirrors the
 * `LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT` pattern).
 */

export const NETWORK_CISCO_SWITCHES_KEY = "network-cisco-switches";
export const NETWORK_CISCO_SWITCHES_CHANGED_EVENT =
  "waveguard-network-cisco-switches-changed";
export const NETWORK_CISCO_EVENT_LOG_KEY = "network-cisco-event-log";
export const NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT =
  "waveguard-network-cisco-event-log-changed";

const CISCO_SWITCHES_LOCAL_KEY = "waveguard:network:cisco-switches";
const CISCO_EVENT_LOG_LOCAL_KEY = "waveguard:network:cisco-event-log";

export const NETWORK_CISCO_EVENT_LOG_MAX = 200;

/** How often the Cisco workspace re-polls the active switch while the page is open. */
export const CISCO_LIVE_POLL_INTERVAL_MS = 30_000;

/** Background fleet poll cadence on the mock-server (all enabled switches). */
export const CISCO_BACKGROUND_POLL_INTERVAL_MS = 60_000;

export const DEFAULT_CISCO_SWITCH = {
  id: "",
  enabled: true,
  host: "",
  sshPort: 22,
  sshUsername: "cisco",
  sshPassword: "",
  enablePassword: "",
  snmpPort: 161,
  snmpVersion: "2c",
  snmpCommunity: "public",
  snmpv3User: "",
  snmpv3AuthProto: "SHA",
  snmpv3AuthPass: "",
  snmpv3PrivProto: "AES",
  snmpv3PrivPass: "",
  label: "",
  notes: "",
  equipmentId: null,
  fleetProfileId: null,
  lastConnectedAt: null,
  lastError: null,
  system: null, // populated by the connection test (model/firmware/serial/uptime)
  updatedAt: null,
};

export const DEFAULT_CISCO_SWITCHES = { switches: [] };
export const DEFAULT_CISCO_EVENT_LOG = { events: [] };

function safeLocalStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch (_e) {
    return null;
  }
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `cisco-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCiscoSwitch(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_CISCO_SWITCH };
  const sshPortRaw = Number(value.sshPort);
  const snmpPortRaw = Number(value.snmpPort);
  const sshPort =
    Number.isFinite(sshPortRaw) && sshPortRaw > 0 && sshPortRaw < 65536
      ? Math.floor(sshPortRaw)
      : 22;
  const snmpPort =
    Number.isFinite(snmpPortRaw) && snmpPortRaw > 0 && snmpPortRaw < 65536
      ? Math.floor(snmpPortRaw)
      : 161;
  const snmpVersion = value.snmpVersion === "3" ? "3" : "2c";

  return {
    id: value.id || genId(),
    enabled: value.enabled !== false,
    host: String(value.host || "").trim(),
    sshPort,
    sshUsername:
      typeof value.sshUsername === "string" && value.sshUsername.trim()
        ? value.sshUsername.trim()
        : DEFAULT_CISCO_SWITCH.sshUsername,
    sshPassword: typeof value.sshPassword === "string" ? value.sshPassword : "",
    enablePassword:
      typeof value.enablePassword === "string" ? value.enablePassword : "",
    snmpPort,
    snmpVersion,
    snmpCommunity:
      typeof value.snmpCommunity === "string" && value.snmpCommunity.trim()
        ? value.snmpCommunity.trim()
        : DEFAULT_CISCO_SWITCH.snmpCommunity,
    snmpv3User: typeof value.snmpv3User === "string" ? value.snmpv3User.trim() : "",
    snmpv3AuthProto:
      typeof value.snmpv3AuthProto === "string" && value.snmpv3AuthProto.trim()
        ? value.snmpv3AuthProto
        : "SHA",
    snmpv3AuthPass:
      typeof value.snmpv3AuthPass === "string" ? value.snmpv3AuthPass : "",
    snmpv3PrivProto:
      typeof value.snmpv3PrivProto === "string" && value.snmpv3PrivProto.trim()
        ? value.snmpv3PrivProto
        : "AES",
    snmpv3PrivPass:
      typeof value.snmpv3PrivPass === "string" ? value.snmpv3PrivPass : "",
    label: typeof value.label === "string" ? value.label : "",
    notes: typeof value.notes === "string" ? value.notes : "",
    equipmentId: value.equipmentId || null,
    fleetProfileId: value.fleetProfileId || null,
    lastConnectedAt: value.lastConnectedAt || null,
    lastError: value.lastError || null,
    system: value.system && typeof value.system === "object" ? { ...value.system } : null,
    updatedAt: value.updatedAt || null,
  };
}

export function normalizeCiscoSwitches(value) {
  const arr = Array.isArray(value?.switches)
    ? value.switches
    : Array.isArray(value)
    ? value
    : [];
  const out = [];
  for (const s of arr) {
    const n = normalizeCiscoSwitch(s);
    if (n.host) out.push(n);
  }
  return { switches: out };
}

export function redactCiscoSwitch(value) {
  const c = normalizeCiscoSwitch(value);
  return {
    ...c,
    sshPassword: c.sshPassword ? "••••••••" : "",
    enablePassword: c.enablePassword ? "••••••••" : "",
    snmpv3AuthPass: c.snmpv3AuthPass ? "••••••••" : "",
    snmpv3PrivPass: c.snmpv3PrivPass ? "••••••••" : "",
  };
}

export function loadCiscoSwitchesLocal() {
  const ls = safeLocalStorage();
  if (!ls) return { ...DEFAULT_CISCO_SWITCHES };
  try {
    const raw = ls.getItem(CISCO_SWITCHES_LOCAL_KEY);
    if (!raw) return { ...DEFAULT_CISCO_SWITCHES };
    return normalizeCiscoSwitches(JSON.parse(raw));
  } catch (_e) {
    return { ...DEFAULT_CISCO_SWITCHES };
  }
}

export function saveCiscoSwitchesLocal(payload) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(CISCO_SWITCHES_LOCAL_KEY, JSON.stringify(normalizeCiscoSwitches(payload)));
  } catch (_e) {
    /* quota */
  }
}

export function clearCiscoSwitchesLocal() {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(CISCO_SWITCHES_LOCAL_KEY);
  } catch (_e) {
    /* */
  }
}

// ── Event log ───────────────────────────────────────────────────────────

export function normalizeCiscoEvent(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: value.id || genId(),
    ts: value.ts || new Date().toISOString(),
    switchId: value.switchId || null,
    host: value.host || null,
    kind: String(value.kind || "command"),
    severity: ["info", "warning", "critical"].includes(value.severity)
      ? value.severity
      : "info",
    action: value.action || null,
    result: String(value.result || "success"),
    message: value.message || null,
  };
}

export function normalizeCiscoEventLog(value) {
  const arr = Array.isArray(value?.events)
    ? value.events
    : Array.isArray(value)
    ? value
    : [];
  const out = [];
  for (const e of arr) {
    const n = normalizeCiscoEvent(e);
    if (n) out.push(n);
  }
  return { events: out.slice(-NETWORK_CISCO_EVENT_LOG_MAX) };
}

export function loadCiscoEventLogLocal() {
  const ls = safeLocalStorage();
  if (!ls) return { ...DEFAULT_CISCO_EVENT_LOG };
  try {
    const raw = ls.getItem(CISCO_EVENT_LOG_LOCAL_KEY);
    if (!raw) return { ...DEFAULT_CISCO_EVENT_LOG };
    return normalizeCiscoEventLog(JSON.parse(raw));
  } catch (_e) {
    return { ...DEFAULT_CISCO_EVENT_LOG };
  }
}

export function saveCiscoEventLogLocal(payload) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(CISCO_EVENT_LOG_LOCAL_KEY, JSON.stringify(normalizeCiscoEventLog(payload)));
  } catch (_e) {
    /* quota */
  }
}

/**
 * Validate a host (IPv4 or simple hostname) — used by the modal to keep
 * the user from saving an obviously wrong value.
 */
export function isValidHost(host) {
  if (!host) return false;
  const s = String(host).trim();
  if (!s) return false;
  if (/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(s)) {
    return s.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  // RFC1035-style hostname (very permissive — covers .local mDNS too).
  return /^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(s);
}
