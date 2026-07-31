import { execFileSync } from "node:child_process";
import { RouterAdapter, normalizePortShape, ERROR_CODES } from "./baseAdapter.js";
import { mockProfileForPort, runMockSpeedTest, simulateSpeedTestLatency, mockWanTraffic } from "./mockRouterData.js";
import { fetchJson, fetchWithTimeout, authHeader, cookieHeader } from "./transport.js";

const INCONTROL_BASE = process.env.PEPLINK_INCONTROL_URL || "https://api.ic.peplink.com";
const DEFAULT_TIMEOUT = 8000;

function buildMockPoll(model, ip) {
  const m = String(model || "").toLowerCase();
  const polledAt = new Date().toISOString();
  let ports = [];

  if (/br2/.test(m)) {
    ports = [
      { index: 1, name: "WAN1", status: "up", speedMbps: 1000, ...mockWanTraffic(24.3, 12.1, { publicIp: "203.0.113.10", vpnUp: true, isp: "Starlink Maritime", gateway: "203.0.113.1", dns: "1.1.1.1", latencyMs: 22 }) },
      { index: 2, name: "WAN2", status: "down", speedMbps: 1000, ...mockWanTraffic(0, 0, { publicIp: null, isp: "4G LTE Backup" }) },
      { index: 3, name: "Cellular", status: "up", speedMbps: 150, inMbps: 8.4, outMbps: 2.1, meta: { type: "cellular", signalDbm: -72, carrier: "LTE", isp: "Maritime LTE", publicIp: "100.64.12.88" } },
      { index: 4, name: "LAN", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 5, name: "LAN2", status: "up", speedMbps: 1000, meta: { type: "lan" } },
    ];
  } else if (/br1/.test(m)) {
    ports = [
      { index: 1, name: "WAN", status: "up", speedMbps: 1000, ...mockWanTraffic(18.6, 9.2, { publicIp: "198.51.100.5", isp: "VSAT Primary", gateway: "198.51.100.1", latencyMs: 540 }) },
      { index: 2, name: "Cellular", status: "up", speedMbps: 120, inMbps: 11.2, outMbps: 3.4, meta: { type: "cellular", signalDbm: -68, carrier: "5G", isp: "5G Backup", publicIp: "100.64.8.44" } },
      { index: 3, name: "LAN", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 4, name: "LAN2", status: "up", speedMbps: 1000, meta: { type: "lan" } },
    ];
  } else {
    ports = [
      { index: 1, name: "WAN1", status: "up", speedMbps: 1000, ...mockWanTraffic(42.8, 16.5, { publicIp: "203.0.113.1", isp: "Starlink", gateway: "203.0.113.254", dns: "8.8.8.8", latencyMs: 19, vpnUp: true }) },
      { index: 2, name: "WAN2", status: "up", speedMbps: 1000, ...mockWanTraffic(6.2, 1.8, { publicIp: "203.0.113.2", isp: "Shore 4G", gateway: "203.0.113.2", latencyMs: 38 }) },
      { index: 3, name: "WAN3", status: "down", speedMbps: 1000, ...mockWanTraffic(0, 0, { isp: "VSAT spare" }) },
      { index: 4, name: "WAN4", status: "disabled", speedMbps: 0, meta: { type: "wan" } },
      { index: 5, name: "LAN", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 6, name: "LAN2", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 7, name: "SFP+", status: "up", speedMbps: 10000, meta: { type: "uplink" } },
    ];
  }

  return {
    sysName: model || "Peplink",
    sysUptime: 864000,
    polledAt,
    source: "peplink-mock",
    ports,
    routerMeta: { online: true, vendor: "Peplink", firmware: "8.5.0", model, serial: null, mac: null, hostname: null },
    deviceInfo: { serial: null, mac: null, model, hostname: null },
  };
}

async function getIncontrolToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const data = await fetchJson(`${INCONTROL_BASE}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    timeout: 10000,
  });
  return data.access_token;
}

function normalizePeplinkResponse(wanData, firmwareData, systemData) {
  const ports = [];
  let idx = 1;
  const conns = wanData?.response || {};
  const order = conns.order || Object.keys(conns).filter((k) => k !== "order").sort((a, b) => Number(a) - Number(b));

  const macMap = new Map();
  if (systemData?.response?.macInfo) {
    for (const m of systemData.response.macInfo) {
      if (m.connId != null) macMap.set(Number(m.connId), m.mac);
      else macMap.set(m.name?.toLowerCase(), m.mac);
    }
  }

  for (const connId of order) {
    const conn = conns[connId];
    if (!conn) continue;
    const name = conn.name || `WAN ${connId}`;
    const isCellular = conn.type === "cellular" || conn.type === "modem" || conn.virtualType === "cellular" || conn.virtualType === "modem";
    const portType = isCellular ? "cellular" : "wan";
    const signalDbm = extractSignalDbm(conn);
    const mac = macMap.get(Number(connId)) || null;
    const cellularInfo = isCellular ? extractCellularInfo(conn) : undefined;
    ports.push({
      index: idx++,
      name,
      status: conn.enable !== false && conn.statusLed === "green" ? "up" : conn.enable === false ? "disabled" : "down",
      speedMbps: conn.type === "cellular" ? 150 : 1000,
      ifAlias: conn.message || "",
      mac,
      meta: {
        type: portType,
        publicIp: conn.ip || null,
        gateway: conn.gateway || null,
        dns: Array.isArray(conn.dns) ? conn.dns.join(", ") : conn.dns || null,
        isp: conn.carrier?.carrierName || extractCarrier(conn) || conn.name || "WAN",
        signalDbm,
        carrier: isCellular ? (conn.cellular?.network || conn.modem?.carrier?.carrierName || null) : null,
        imei: cellularInfo?.imei,
        iccid: cellularInfo?.iccid,
        imsi: cellularInfo?.imsi,
        eid: cellularInfo?.eid,
        cellModule: cellularInfo?.module,
        latencyMs: null,
        vpnUp: null,
        connId,
        uptime: conn.uptime || null,
      },
    });
  }

  const lanMac = macMap.get("lan") || null;
  ports.push({
    index: idx++,
    name: "LAN",
    status: "up",
    speedMbps: 1000,
    mac: lanMac,
    meta: { type: "lan", mac: lanMac },
  });

  let firmware = null;
  if (firmwareData?.response) {
    const fw = firmwareData.response;
    const fwOrder = fw.order || [];
    for (const id of fwOrder) {
      if (fw[id]?.inUse) {
        firmware = fw[id].version;
        break;
      }
    }
    if (!firmware) {
      const first = fwOrder[0];
      if (first && fw[first]) firmware = fw[first].version;
    }
  }

  const dev = systemData?.response?.device || {};
  const serial = dev.serialNumber || null;
  const model = dev.model || dev.productCode || null;
  const hostname = dev.host || dev.name || null;

  return {
    ports,
    routerMeta: {
      online: ports.some((p) => p.status === "up"),
      firmware,
      vendor: "Peplink",
      serial,
      mac: lanMac,
      model,
      hostname,
    },
    deviceInfo: { serial, mac: lanMac, model, hostname },
  };
}

function extractCellularInfo(conn) {
  const cell = conn.cellular || conn.modem;
  if (!cell) return null;
  const speedfusion = cell.speedfusionConnect5gLte;
  return {
    imei: cell.imei || null,
    iccid: speedfusion?.iccid || cell.iccid || null,
    imsi: speedfusion?.imsi || cell.imsi || null,
    eid: cell.eid || null,
    module: cell.manufacturer && cell.model ? `${cell.manufacturer} ${cell.model}` : null,
  };
}

function extractSignalDbm(conn) {
  if (conn.signal?.strength != null) return conn.signal.strength;
  if (conn.cellular?.signalLevel != null) return -100 + conn.cellular.signalLevel * 20;
  if (conn.modem?.signalLevel != null) return -100 + conn.modem.signalLevel * 20;
  const bands = conn.cellular?.rat || conn.cellular?.band || conn.modem?.band || [];
  for (const b of bands) {
    if (b.rssi != null) return b.rssi;
    if (b.rsrp != null) return b.rsrp;
    if (b.strength != null) return b.strength;
  }
  return null;
}

function extractCarrier(conn) {
  const cell = conn.cellular;
  if (cell?.carrier?.carrierName) return cell.carrier.carrierName;
  if (cell?.network) return cell.network;
  if (conn.modem?.carrier?.carrierName) return conn.modem.carrier.carrierName;
  if (conn.modem?.manufacturer) return conn.modem.manufacturer;
  return null;
}

async function sessionLogin(ip, username, password) {
  const res = await fetchWithTimeout(`https://${ip}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    timeout: DEFAULT_TIMEOUT,
  });
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error(`Login failed (${res.status}) — check credentials`), { _code: ERROR_CODES.ACCESS_DENIED });
  }
  if (!res.ok) {
    throw new Error(`Login failed (${res.status})`);
  }
  const body = await res.json();
  if (body.stat === "fail") {
    throw Object.assign(new Error(`Login failed: ${body.message || "invalid credentials"}`), { _code: ERROR_CODES.ACCESS_DENIED });
  }
  const cookies = res.headers.getSetCookie?.() || [];
  const bauth = cookies.find((c) => c.startsWith("bauth=") || c.startsWith("PHPSESSID="));
  if (!bauth) {
    throw new Error(`Peplink login succeeded but no session cookie received. Admin access may be restricted by source IP.`);
  }
  return bauth.split(";")[0];
}

async function getLocalToken(ip, clientId, clientSecret) {
  const data = await fetchJson(`https://${ip}/api/auth.token.grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, scope: "api" }),
    timeout: DEFAULT_TIMEOUT,
  });
  if (!data.response?.accessToken) {
    throw new Error("No access token in Peplink response");
  }
  return data.response.accessToken;
}

function probeDeviceConnectivity(ip) {
  return fetchWithTimeout(`https://${ip}/api/status.wan.connection`, {
    method: "GET",
    timeout: 5000,
  }).then((res) => ({ reachable: true, status: res.status })).catch((err) => {
    const msg = err?.message || "";
    if (msg.includes("econnrefused") || msg.includes("connection refused")) return { reachable: false, reason: "connection_refused" };
    if (msg.includes("timeout") || msg.includes("abort")) return { reachable: false, reason: "timeout" };
    if (msg.includes("enotfound") || msg.includes("eaddrinfo")) return { reachable: false, reason: "unreachable" };
    return { reachable: false, reason: "unknown", error: msg };
  });
}

function resolveSessionCreds(profile) {
  const u = profile.browserLogin?.username || "admin";
  const p = profile.browserLogin?.password;
  return p ? { username: u, password: p } : null;
}

async function pollLocalDevice(ip, profile) {
  const sessionCreds = resolveSessionCreds(profile);
  const tokenCreds = profile.peplink?.localClientId && profile.peplink?.localClientSecret
    ? { clientId: profile.peplink.localClientId, clientSecret: profile.peplink.localClientSecret }
    : null;

  if (!sessionCreds && !tokenCreds) {
    throw new Error("No Peplink credentials configured. Provide browser login credentials or API client ID/secret.");
  }

  let authCookie = null;
  let authToken = null;

  if (tokenCreds) {
    try {
      authToken = await getLocalToken(ip, tokenCreds.clientId, tokenCreds.clientSecret);
    } catch (err) {
      if (!sessionCreds) throw err;
    }
  }

  if (!authToken && sessionCreds) {
    try {
      authCookie = await sessionLogin(ip, sessionCreds.username, sessionCreds.password);
    } catch (err) {
      if (tokenCreds) throw err;
      throw err;
    }
  }

  const base = `https://${ip}`;
  const authSuffix = authCookie ? "" : `?accessToken=${encodeURIComponent(authToken)}`;
  const reqHeaders = authCookie ? cookieHeader(authCookie) : {};

  const [wanResult, fwResult, sysResult] = await Promise.all([
    fetchJson(`${base}/api/status.wan.connection${authSuffix}`, { headers: reqHeaders, timeout: DEFAULT_TIMEOUT }),
    fetchJson(`${base}/api/info.firmware${authSuffix}`, { headers: reqHeaders, timeout: DEFAULT_TIMEOUT }).catch(() => null),
    fetchJson(`${base}/api/status.system.info${authSuffix}`, { headers: reqHeaders, timeout: DEFAULT_TIMEOUT }).catch(() => null),
  ]);

  const gateway = extractActiveGateway(wanResult);
  const [publicIp, gatewayPingMs] = await Promise.all([
    fetchPublicIp().catch(() => null),
    gateway ? pingLatency(gateway) : Promise.resolve(null),
  ]);

  const normalized = normalizePeplinkResponse(wanResult, fwResult, sysResult);

  for (const port of normalized.ports) {
    if (port.meta?.type === "wan" && port.status === "up") {
      if (publicIp) port.meta.publicIp = publicIp;
      if (gatewayPingMs != null) port.meta.latencyMs = gatewayPingMs;
    }
  }

  return {
    ...normalized,
    polledAt: new Date().toISOString(),
    source: "peplink-local",
    peplinkMeta: normalized.routerMeta,
    publicIp,
    gatewayLatencyMs: gatewayPingMs,
  };
}

function fetchPublicIp() {
  return fetchWithTimeout("https://api.ipify.org?format=json", { timeout: 5000 })
    .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then((d) => d.ip || null)
    .catch(() => null);
}

function extractActiveGateway(wanData) {
  const conns = wanData?.response || {};
  const order = conns.order || Object.keys(conns).filter((k) => k !== "order");
  for (const connId of order) {
    const conn = conns[connId];
    if (conn?.statusLed === "green" && conn?.gateway) return conn.gateway;
  }
  return null;
}

function pingLatency(host) {
  try {
    const out = execFileSync("ping", ["-c", "2", "-W", "2", host], { timeout: 5000, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = out.match(/min\/avg\/max\/(?:mdev|stddev)\s*=\s*[\d.]+\/([\d.]+)/);
    if (m) return Promise.resolve(Math.round(parseFloat(m[1])));
    const avg = out.match(/round-trip\s*(?:min\s+)?(?:avg\s+)?(?:max\s+)?\s*=\s*[\d.]+\/([\d.]+)/);
    if (avg) return Promise.resolve(Math.round(parseFloat(avg[1])));
  } catch { /* */ }
  return Promise.resolve(null);
}

async function pollIncontrolDevice(profile, globalCreds) {
  const pep = profile.peplink || {};
  const orgId = pep.incontrolOrgId || globalCreds?.incontrolOrgId;
  const deviceId = pep.deviceId;
  if (!orgId || !deviceId) {
    throw new Error("InControl org ID and device ID required");
  }
  const clientId = globalCreds?.incontrolClientId;
  const clientSecret = globalCreds?.incontrolClientSecret;
  if (!clientId || !clientSecret) {
    throw new Error("InControl API credentials not configured");
  }
  const token = await getIncontrolToken(clientId, clientSecret);
  const data = await fetchJson(`${INCONTROL_BASE}/rest/o/${orgId}/d/${deviceId}?has_status=true`, {
    headers: authHeader(token),
    timeout: 15000,
  });
  const normalized = normalizeIncontrolStatus(data);
  return {
    ...normalized,
    polledAt: new Date().toISOString(),
    source: "peplink-incontrol",
  };
}

function normalizeIncontrolStatus(data) {
  if (!data) return { ports: [], routerMeta: {} };
  const status = data.status || data;
  const ports = [];
  let idx = 1;
  if (Array.isArray(status.interfaces)) {
    for (const iface of status.interfaces) {
      ports.push(normalizePortShape(iface, idx++));
    }
  }
  if (status.wan) {
    const wans = Array.isArray(status.wan) ? status.wan : [status.wan];
    for (const w of wans) {
      ports.push(normalizePortShape({ ...w, type: "wan" }, idx++));
    }
  }
  return {
    ports,
    routerMeta: {
      online: status.online !== false && status.status !== "offline",
      firmware: status.firmware_version || status.fw,
      deviceId: data.id || data.device_id,
      vendor: "Peplink",
    },
  };
}

async function pollLocalSpeedTest(ip, profile, wanIndex) {
  const sessionCreds = resolveSessionCreds(profile);
  const tokenCreds = profile.peplink?.localClientId && profile.peplink?.localClientSecret
    ? { clientId: profile.peplink.localClientId, clientSecret: profile.peplink.localClientSecret }
    : null;

  if (!sessionCreds && !tokenCreds) {
    throw new Error("On-device API credentials required for speed test");
  }

  let authCookie = null;
  let authToken = null;

  if (tokenCreds) {
    try {
      authToken = await getLocalToken(ip, tokenCreds.clientId, tokenCreds.clientSecret);
    } catch (err) {
      if (!sessionCreds) throw err;
    }
  }

  if (!authToken && sessionCreds) {
    try {
      authCookie = await sessionLogin(ip, sessionCreds.username, sessionCreds.password);
    } catch (err) {
      if (tokenCreds) throw err;
      throw err;
    }
  }

  const base = `https://${ip}`;
  const authSuffix = authCookie ? "" : `?accessToken=${encodeURIComponent(authToken)}`;
  const reqHeaders = authCookie ? cookieHeader(authCookie) : {};

  const res = await fetchWithTimeout(`${base}/api/cmd.speedtest${authSuffix}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...reqHeaders },
    body: JSON.stringify({ wan: wanIndex }),
    timeout: 30000,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Speed test failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json();
  if (data.stat === "fail") {
    throw new Error(`Speed test failed: ${data.message || "unknown error"}`);
  }
  const result = data.response || data;
  return {
    success: true,
    downloadMbps: Number(result.download || result.down || 0),
    uploadMbps: Number(result.upload || result.up || 0),
    latencyMs: Number(result.latency || result.ping || 0) || null,
    jitterMs: Number(result.jitter) || null,
    server: result.server || "Peplink speed test",
    source: "peplink-local",
    testedAt: new Date().toISOString(),
  };
}

export class PeplinkRouterAdapter extends RouterAdapter {
  constructor() {
    super("peplink", "Peplink");
  }

  getCapabilities() {
    return { snmp: true, rest: true, ssh: false, cellular: true, vpn: true };
  }

  getDefaultConfig() {
    return {
      mode: "auto",
      incontrolOrgId: "",
      deviceId: "",
      localClientId: "",
      localClientSecret: "",
      localClientSecretConfigured: false,
    };
  }

  async probeConnectivity(ip) {
    return probeDeviceConnectivity(ip);
  }

  async pollStatus(profile, opts = {}) {
    return this.withRetry(async (attempt) => {
      const { ip, equipment, forceMock, globalRouterCreds } = opts;
      const model = equipment?.model || "";
      const pep = profile.peplink || {};
      const mode = pep.mode || "auto";

      if (forceMock || process.env.PEPLINK_USE_MOCK === "1") {
        return buildMockPoll(model, ip);
      }

      if (attempt === 0 && mode !== "incontrol") {
        const probe = await probeDeviceConnectivity(ip);
        if (!probe.reachable && mode === "local") {
          throw Object.assign(new Error(`Device at ${ip} is not reachable: ${probe.reason}`), { _code: ERROR_CODES.DEVICE_OFFLINE });
        }
        if (!probe.reachable) {
          return buildMockPoll(model, ip);
        }
      }

      const tryLocal = mode === "local" || mode === "auto";
      const tryIncontrol = mode === "incontrol" || mode === "auto";

      if (tryLocal && ip) {
        const hasSessionCreds = !!resolveSessionCreds(profile);
        const hasTokenCreds = !!(pep.localClientId && pep.localClientSecret);
        if (hasSessionCreds || hasTokenCreds) {
          try {
            return await pollLocalDevice(ip, profile);
          } catch (err) {
            const classified = this.classifyError(err);
            if (classified === ERROR_CODES.ACCESS_DENIED) {
              if (mode === "local") throw err;
              return buildMockPoll(model, ip);
            }
            if (mode === "local") throw err;
          }
        }
      }

      if (tryIncontrol && pep.deviceId) {
        return await pollIncontrolDevice(profile, globalRouterCreds);
      }

      return buildMockPoll(model, ip);
    }, { retries: 1 });
  }

  async testConnection(profile, opts = {}) {
    try {
      const probe = await probeDeviceConnectivity(opts.ip);
      if (!probe.reachable && !opts.forceMock) {
        return {
          success: false,
          reachable: false,
          reason: probe.reason,
          error: `Device at ${opts.ip} not reachable (${probe.reason}). Check network connectivity and admin access control settings.`,
          hint: probe.reason === "timeout" ? "Firewall or admin access list may be blocking this IP." : undefined,
        };
      }
      const result = await this.pollStatus(profile, opts);
      return {
        success: true,
        source: result.source,
        portCount: result.ports?.length || 0,
        online: result.routerMeta?.online !== false,
        reachable: true,
      };
    } catch (err) {
      const classified = this.classifyError(err);
      return {
        success: false,
        error: err.message,
        code: classified,
        hint: classified === ERROR_CODES.ACCESS_DENIED
          ? "Verify credentials. If using browser login, ensure the admin password is correct and this IP is allowed in Admin Access settings."
          : classified === ERROR_CODES.DEVICE_OFFLINE
            ? "Device is not responding on the network. Verify IP address and connectivity."
            : undefined,
      };
    }
  }

  async runSpeedTest(profile, opts = {}) {
    const { ip, equipment, wanIndex = 1, portName = "", forceMock } = opts;

    if (forceMock || process.env.PEPLINK_USE_MOCK === "1" || process.env.WAN_SPEEDTEST_MOCK === "1") {
      await simulateSpeedTestLatency();
      return runMockSpeedTest(portName);
    }

    if (ip) {
      const hasSessionCreds = !!resolveSessionCreds(profile);
      const hasTokenCreds = !!(profile.peplink?.localClientId && profile.peplink?.localClientSecret);
      if (hasSessionCreds || hasTokenCreds) {
        try {
          return await pollLocalSpeedTest(ip, profile, wanIndex);
        } catch (err) {
          if (profile.peplink?.mode === "local") throw err;
        }
      }
    }

    await simulateSpeedTestLatency();
    const mock = buildMockPoll(equipment?.model, ip);
    const port = mock.ports?.find((p) => p.index === wanIndex) || mock.ports?.[0];
    return runMockSpeedTest(port?.name || portName);
  }
}

export const peplinkRouterAdapter = new PeplinkRouterAdapter();
