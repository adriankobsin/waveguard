import { fetchWithTimeout } from "./transport.js";

export const ROUTER_POLL_SOURCES = {
  mock: "mock",
  snmp: "snmp",
  local: "local",
  cloud: "cloud",
  hybrid: "hybrid",
};

export const ERROR_CODES = {
  AUTH_FAILED: "auth_failed",
  DEVICE_OFFLINE: "device_offline",
  CONNECTION_REFUSED: "connection_refused",
  ACCESS_DENIED: "access_denied",
  TIMEOUT: "timeout",
  NOT_FOUND: "not_found",
  UNKNOWN: "unknown",
};

const RETRY_DELAYS = [1000, 2000, 4000, 8000];

export class RouterAdapter {
  constructor(vendorId, label) {
    this.vendorId = vendorId;
    this.label = label;
    this._health = { ok: true, lastCheck: null, lastError: null };
  }

  pollStatus(_profile, _opts) {
    throw new Error(`${this.vendorId} adapter must implement pollStatus()`);
  }

  testConnection(_profile, _opts) {
    throw new Error(`${this.vendorId} adapter must implement testConnection()`);
  }

  runSpeedTest(_profile, _opts) {
    throw new Error(`${this.vendorId} adapter must implement runSpeedTest()`);
  }

  getCapabilities() {
    return { snmp: true, rest: false, ssh: false, cellular: false, vpn: false };
  }

  getDefaultConfig() {
    return {};
  }

  getHealth() {
    return { ...this._health };
  }

  async withRetry(fn, opts = {}) {
    const { retries = 2, onRetry } = opts;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fn(attempt);
        this._health = { ok: true, lastCheck: new Date().toISOString(), lastError: null };
        return result;
      } catch (err) {
        lastErr = err;
        if (!this.isRetryable(err) || attempt >= retries) break;
        if (onRetry) onRetry(err, attempt);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1]));
      }
    }
    this._health = { ok: false, lastCheck: new Date().toISOString(), lastError: lastErr?.message };
    throw lastErr;
  }

  isRetryable(err) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("timeout") || msg.includes("econnrefused") || msg.includes("econnreset") || msg.includes("eaddrinfo") || msg.includes("fetch failed") || msg.includes("socket hang up") || msg.includes("network")) {
      return true;
    }
    if (err?.type === "system" || err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT" || err?.code === "ECONNRESET" || err?.code === "ENOTFOUND") {
      return true;
    }
    return false;
  }

  classifyError(err) {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("invalid credentials") || msg.includes("login failed") || msg.includes("access denied")) {
      return ERROR_CODES.ACCESS_DENIED;
    }
    if (msg.includes("connection refused") || msg.includes("econnrefused")) {
      return ERROR_CODES.CONNECTION_REFUSED;
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return ERROR_CODES.TIMEOUT;
    }
    if (msg.includes("offline") || msg.includes("no route") || msg.includes("enotfound") || msg.includes("unreachable")) {
      return ERROR_CODES.DEVICE_OFFLINE;
    }
    return ERROR_CODES.UNKNOWN;
  }
}

export function normalizePortShape(raw, index) {
  const name = raw.name || raw.interface || raw.port || `Port ${index}`;
  const status =
    raw.status === "connected" || raw.status === "up" || raw.enable === true
      ? "up"
      : raw.status === "disconnected" || raw.status === "down"
        ? "down"
        : raw.status === "disabled"
          ? "disabled"
          : "unknown";
  return {
    index: Number(raw.index ?? index) || index,
    name,
    ifAlias: raw.alias || raw.ifAlias || "",
    status,
    speedMbps: Number(raw.speed || raw.speedMbps || raw.downstream || 0) || (status === "up" ? 1000 : 0),
    inMbps: Number(raw.inMbps || raw.in || raw.rx || 0) || 0,
    outMbps: Number(raw.outMbps || raw.out || raw.tx || 0) || 0,
    meta: {
      type: raw.type || raw.portRole || guessPortType(name),
      publicIp: raw.ip || raw.publicIp || raw.public_ip || null,
      gateway: raw.gateway || raw.default_gateway || null,
      dns: raw.dns || null,
      isp: raw.isp || raw.provider || raw.carrier || null,
      signalDbm: raw.signal ?? raw.signal_strength ?? raw.signalDbm ?? null,
      carrier: raw.carrier || raw.technology || null,
      vpnUp: raw.vpn_active ?? raw.vpnUp ?? null,
      latencyMs: raw.latency ?? raw.latency_ms ?? raw.latencyMs ?? null,
    },
  };
}

function guessPortType(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/cell|lte|5g|modem/.test(n)) return "cellular";
  if (/wan/.test(n)) return "wan";
  if (/lan/.test(n)) return "lan";
  if (/sfp|uplink|10g/.test(n)) return "uplink";
  return "other";
}
