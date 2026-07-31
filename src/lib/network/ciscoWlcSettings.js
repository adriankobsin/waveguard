/**
 * Catalyst 9800 WLC connection settings.
 *
 * SystemSettings key `network-cisco-wlc` → { controllers: [Controller] }
 */

export const NETWORK_CISCO_WLC_KEY = "network-cisco-wlc";
export const NETWORK_CISCO_WLC_CHANGED_EVENT = "waveguard-network-cisco-wlc-changed";

const WLC_LOCAL_KEY = "waveguard:network:cisco-wlc";

export const CISCO_WLC_LIVE_POLL_INTERVAL_MS = 60_000;

export const DEFAULT_CISCO_WLC_CONTROLLER = {
  id: "",
  enabled: true,
  host: "",
  httpsPort: 443,
  username: "admin",
  password: "",
  allowInsecure: true,
  label: "",
  notes: "",
  equipmentId: null,
  lastConnectedAt: null,
  lastError: null,
  lastSnapshot: null,
  controller: null,
  updatedAt: null,
};

export const DEFAULT_CISCO_WLC_CONTROLLERS = { controllers: [] };

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
  return `wlc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isValidHost(host) {
  if (!host || typeof host !== "string") return false;
  const s = host.trim();
  if (!s) return false;
  if (/^[\d.]+$/.test(s)) {
    const parts = s.split(".");
    return parts.length === 4 && parts.every((p) => {
      const n = Number(p);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(s) || /^[a-zA-Z0-9]$/.test(s);
}

export function normalizeCiscoWlcController(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_CISCO_WLC_CONTROLLER };
  const portRaw = Number(value.httpsPort ?? value.port);
  const httpsPort =
    Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? Math.floor(portRaw) : 443;

  return {
    id: value.id || genId(),
    enabled: value.enabled !== false,
    host: String(value.host || "").trim(),
    httpsPort,
    username: String(value.username || value.sshUsername || "admin").trim() || "admin",
    password: value.password || value.sshPassword || "",
    allowInsecure: value.allowInsecure !== false,
    label: value.label || "",
    notes: value.notes || "",
    equipmentId: value.equipmentId || null,
    lastConnectedAt: value.lastConnectedAt || null,
    lastError: value.lastError || null,
    lastSnapshot: value.lastSnapshot || null,
    controller: value.controller || null,
    updatedAt: value.updatedAt || null,
  };
}

export function normalizeCiscoWlcControllers(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_CISCO_WLC_CONTROLLERS };
  const list = Array.isArray(value.controllers) ? value.controllers : [];
  return {
    controllers: list.map((c) => normalizeCiscoWlcController(c)),
  };
}

export function loadCiscoWlcLocal() {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(WLC_LOCAL_KEY);
    if (!raw) return null;
    return normalizeCiscoWlcControllers(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveCiscoWlcLocal(payload) {
  const normalized = normalizeCiscoWlcControllers(payload);
  const ls = safeLocalStorage();
  if (ls) {
    try {
      ls.setItem(WLC_LOCAL_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }
  return normalized;
}
