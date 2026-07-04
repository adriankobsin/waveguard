/**
 * Peplink API normalization — InControl 2 + on-device REST.
 * Produces ports compatible with normalizeSnmpPort / mergeNetworkPollResult.
 */

const PEPLINK_USE_MOCK =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_PEPLINK_USE_MOCK === "true";

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Mock WAN/cellular status for dev (Balance / BR1 / BR2). */
export function buildMockPeplinkPoll(model, ip) {
  const m = String(model || "").toLowerCase();
  const polledAt = new Date().toISOString();
  let ports = [];

  const wanTraffic = (down, up, meta = {}) => ({
    inMbps: down,
    outMbps: up,
    meta: {
      type: "wan",
      ...meta,
    },
  });

  if (/br2/.test(m)) {
    ports = [
      { index: 1, name: "WAN1", status: "up", speedMbps: 1000, ...wanTraffic(24.3, 12.1, { publicIp: "203.0.113.10", vpnUp: true, isp: "Starlink Maritime", gateway: "203.0.113.1", dns: "1.1.1.1", latencyMs: 22 }) },
      { index: 2, name: "WAN2", status: "down", speedMbps: 1000, ...wanTraffic(0, 0, { publicIp: null, isp: "4G LTE Backup" }) },
      { index: 3, name: "Cellular", status: "up", speedMbps: 150, inMbps: 8.4, outMbps: 2.1, meta: { type: "cellular", signalDbm: -72, carrier: "LTE", isp: "Maritime LTE", publicIp: "100.64.12.88" } },
      { index: 4, name: "LAN", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 5, name: "LAN2", status: "up", speedMbps: 1000, meta: { type: "lan" } },
    ];
  } else if (/br1/.test(m)) {
    ports = [
      { index: 1, name: "WAN", status: "up", speedMbps: 1000, ...wanTraffic(18.6, 9.2, { publicIp: "198.51.100.5", isp: "VSAT Primary", gateway: "198.51.100.1", latencyMs: 540 }) },
      { index: 2, name: "Cellular", status: "up", speedMbps: 120, inMbps: 11.2, outMbps: 3.4, meta: { type: "cellular", signalDbm: -68, carrier: "5G", isp: "5G Backup", publicIp: "100.64.8.44" } },
      { index: 3, name: "LAN", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 4, name: "LAN2", status: "up", speedMbps: 1000, meta: { type: "lan" } },
    ];
  } else {
    ports = [
      { index: 1, name: "WAN1", status: "up", speedMbps: 1000, ...wanTraffic(42.8, 16.5, { publicIp: "203.0.113.1", isp: "Starlink", gateway: "203.0.113.254", dns: "8.8.8.8", latencyMs: 19, vpnUp: true }) },
      { index: 2, name: "WAN2", status: "up", speedMbps: 1000, ...wanTraffic(6.2, 1.8, { publicIp: "203.0.113.2", isp: "Shore 4G", gateway: "203.0.113.2", latencyMs: 38 }) },
      { index: 3, name: "WAN3", status: "down", speedMbps: 1000, ...wanTraffic(0, 0, { isp: "VSAT spare" }) },
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
    peplinkMeta: { online: true, firmware: "8.5.0", gps: null },
  };
}

function mapPeplinkInterface(iface, index) {
  const name = iface.name || iface.interface || iface.port || `Port ${index}`;
  const status =
    iface.status === "connected" || iface.status === "up" || iface.enable
      ? "up"
      : iface.status === "disconnected" || iface.status === "down"
        ? "down"
        : "unknown";
  return {
    index: Number(iface.index ?? index) || index,
    name,
    ifAlias: iface.alias || "",
    status,
    speedMbps: Number(iface.speed || iface.downstream || 0) || (status === "up" ? 1000 : 0),
    meta: {
      type: iface.type || guessPortType(name),
      publicIp: iface.ip || iface.public_ip || iface.publicIp || null,
      gateway: iface.gateway || iface.default_gateway || null,
      dns: iface.dns || (Array.isArray(iface.dns_servers) ? iface.dns_servers.join(", ") : iface.dns_servers) || null,
      isp: iface.isp || iface.provider || iface.carrier || null,
      signalDbm: iface.signal ?? iface.signal_strength ?? null,
      carrier: iface.carrier || iface.technology || null,
      vpnUp: iface.vpn_active ?? null,
      latencyMs: iface.latency ?? iface.latency_ms ?? null,
    },
  };
}

function guessPortType(name) {
  const n = normName(name);
  if (/cell|lte|5g|modem/.test(n)) return "cellular";
  if (/wan/.test(n)) return "wan";
  if (/lan/.test(n)) return "lan";
  if (/sfp|uplink/.test(n)) return "uplink";
  return "other";
}

/** Normalize local device API status.json style payload. */
export function normalizeLocalPeplinkStatus(data) {
  if (!data) return { ports: [], peplinkMeta: {} };
  const ports = [];
  let idx = 1;
  const wanList = data.wan || data.interfaces?.wan || data.status?.wan || [];
  const list = Array.isArray(wanList) ? wanList : Object.entries(wanList).map(([k, v]) => ({ name: k, ...v }));
  for (const w of list) {
    ports.push(mapPeplinkInterface(typeof w === "object" ? w : { name: String(w) }, idx++));
  }
  const cell = data.cellular || data.status?.cellular;
  if (cell) {
    ports.push(
      mapPeplinkInterface(
        { name: "Cellular", type: "cellular", ...cell, status: cell.connected ? "up" : "down" },
        idx++
      )
    );
  }
  const lanList = data.lan || data.interfaces?.lan || [];
  const lans = Array.isArray(lanList) ? lanList : Object.entries(lanList || {}).map(([k, v]) => ({ name: k, ...v }));
  for (const l of lans) {
    ports.push(mapPeplinkInterface(typeof l === "object" ? l : { name: String(l) }, idx++));
  }
  return {
    ports,
    peplinkMeta: {
      online: data.online !== false,
      firmware: data.firmware || data.version || null,
      name: data.name || data.hostname,
    },
  };
}

/** Normalize InControl device status (simplified). */
export function normalizeIncontrolDeviceStatus(data) {
  if (!data) return { ports: [], peplinkMeta: {} };
  const status = data.status || data;
  const ports = [];
  let idx = 1;
  if (Array.isArray(status.interfaces)) {
    for (const iface of status.interfaces) {
      ports.push(mapPeplinkInterface(iface, idx++));
    }
  }
  if (status.wan) {
    const wans = Array.isArray(status.wan) ? status.wan : [status.wan];
    for (const w of wans) {
      ports.push(mapPeplinkInterface({ ...w, type: "wan" }, idx++));
    }
  }
  return {
    ports,
    peplinkMeta: {
      online: status.online !== false && status.status !== "offline",
      firmware: status.firmware_version || status.fw,
      deviceId: data.id || data.device_id,
    },
  };
}

/**
 * Merge SNMP poll with Peplink REST enrichment.
 * @param {object} snmpPoll - result from pollSwitchPorts
 * @param {object} peplinkPoll - result from fetchPeplinkStatus
 */
export function mergePeplinkIntoPoll(snmpPoll, peplinkPoll) {
  const snmpPorts = snmpPoll?.ports || [];
  const pepPorts = peplinkPoll?.ports || [];

  if (!pepPorts.length) {
    return {
      ...snmpPoll,
      peplinkMeta: peplinkPoll?.peplinkMeta,
      deviceInfo: peplinkPoll?.deviceInfo,
      source: snmpPoll?.source || "snmp",
    };
  }

  if (!snmpPorts.length) {
    return {
      ...snmpPoll,
      ...peplinkPoll,
      ports: pepPorts,
      deviceInfo: peplinkPoll?.deviceInfo,
      source: peplinkPoll?.source || "peplink",
    };
  }

  const byNorm = new Map(pepPorts.map((p) => [normName(p.name), p]));
  const merged = snmpPorts.map((sp) => {
    const key = normName(sp.name || sp.ifAlias);
    const pep = byNorm.get(key) || [...byNorm.values()].find((p) => p.index === sp.index);
    if (!pep) return sp;
    return {
      ...sp,
      status: sp.status === "unknown" ? pep.status : sp.status,
      meta: { ...(sp.meta || {}), ...(pep.meta || {}) },
      ifAlias: sp.ifAlias || pep.ifAlias,
    };
  });

  for (const pep of pepPorts) {
    if (!merged.find((m) => normName(m.name) === normName(pep.name))) {
      merged.push(pep);
    }
  }

  return {
    ...snmpPoll,
    ports: merged.sort((a, b) => a.index - b.index),
    peplinkMeta: peplinkPoll?.peplinkMeta,
    deviceInfo: peplinkPoll?.deviceInfo,
    source: "peplink_hybrid",
  };
}

export function shouldUsePeplinkMock(forceMock) {
  return forceMock || PEPLINK_USE_MOCK;
}
