import { execFile } from "child_process";
import { promisify } from "util";
import { snmpProbe } from "./snmp.js";
import { buildMockPollResult } from "./snmpMockData.js";

const execFileAsync = promisify(execFile);

const OID = {
  ifNumber: "1.3.6.1.2.1.1.5.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  ifDescr: "1.3.6.1.2.1.2.2.1.2",
  ifAlias: "1.3.6.1.2.1.31.1.1.1.18",
  ifOperStatus: "1.3.6.1.2.1.2.2.1.8",
  ifSpeed: "1.3.6.1.2.1.2.2.1.5",
  ifInOctets: "1.3.6.1.2.1.2.2.1.10",
  ifOutOctets: "1.3.6.1.2.1.2.2.1.16",
  ifHCInOctets: "1.3.6.1.2.1.31.1.1.1.6",
  ifHCOutOctets: "1.3.6.1.2.1.31.1.1.1.10",
};

export async function isSnmpWalkAvailable() {
  return execFileAsync("snmpwalk", ["-h"], { timeout: 3000, windowsHide: true })
    .then(() => true)
    .catch(() => false);
}

function extractSnmpValue(line) {
  const idx = line.indexOf("STRING:");
  if (idx >= 0) return line.slice(idx + 8).trim().replace(/^"|"$/g, "");
  const parts = line.split("=", 2);
  let v = parts[1]?.trim() || "";
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v;
}

function parseSnmpWalk(stdout) {
  const map = new Map();
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const oidMatch = line.match(/^(\S+)\s+=\s+(\S+):/);
    if (!oidMatch) continue;
    const fullOid = oidMatch[1];
    const valType = oidMatch[2];
    const baseParts = fullOid.split(".");
    const index = Number(baseParts[baseParts.length - 1]);
    const baseOid = baseParts.slice(0, -1).join(".");
    if (!map.has(baseOid)) map.set(baseOid, new Map());
    let value;
    if (valType === "Counter32" || valType === "Counter64" || valType === "INTEGER" || valType === "Gauge32") {
      const num = line.match(/=\s+\w+:\s+(\d+)/);
      value = num ? Number(num[1]) : 0;
    } else {
      value = extractSnmpValue(line);
    }
    map.get(baseOid).set(index, value);
  }
  return map;
}

async function snmpWalk(ip, oid, options) {
  const community = options.community || "public";
  const version = options.version === "3" ? "3" : "2c";
  const timeoutSec = Math.ceil((options.timeoutMs || 3000) / 1000);
  const args =
    version === "2c"
      ? ["-v2c", "-c", community, "-t", String(timeoutSec), "-r", "0", "-Os", ip, oid]
      : ["-v3", "-c", community, "-t", String(timeoutSec), "-r", "0", "-Os", ip, oid];
  const { stdout } = await execFileAsync("snmpwalk", args, {
    timeout: (timeoutSec + 2) * 1000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  return parseSnmpWalk(stdout.toString());
}

function normMac(mac) {
  if (!mac) return "";
  const hex = String(mac).toUpperCase().replace(/[^0-9A-F]/g, "");
  if (hex.length !== 12) return String(mac);
  return hex.match(/.{2}/g).join(":");
}

function resolveConnectedDevice(mac, equipmentByMac, ifAlias) {
  const key = normMac(mac);
  if (key && equipmentByMac.has(key)) {
    const eq = equipmentByMac.get(key);
    return { name: eq.name, id: eq.id };
  }
  if (ifAlias && !/^(port|gi|fa|te)\b/i.test(ifAlias)) {
    return { name: ifAlias, id: null };
  }
  return { name: null, id: null };
}

function operStatusToUi(status) {
  const n = Number(status);
  if (n === 1) return "up";
  if (n === 2) return "down";
  if (n === 6) return "disabled";
  return "unknown";
}

function computeMbps(prevIn, prevOut, curIn, curOut, intervalSec) {
  if (intervalSec <= 0 || prevIn == null) return { inMbps: 0, outMbps: 0 };
  const inDelta = Math.max(0, curIn - prevIn);
  const outDelta = Math.max(0, curOut - prevOut);
  return {
    inMbps: (inDelta * 8) / intervalSec / 1e6,
    outMbps: (outDelta * 8) / intervalSec / 1e6,
  };
}

function buildPortsFromWalk(walkMaps, equipmentByMac, prevCounters, intervalSec) {
  const descr = walkMaps.get(OID.ifDescr) || new Map();
  const alias = walkMaps.get(OID.ifAlias) || new Map();
  const oper = walkMaps.get(OID.ifOperStatus) || new Map();
  const speed = walkMaps.get(OID.ifSpeed) || new Map();
  const inOct = walkMaps.get(OID.ifHCInOctets) || walkMaps.get(OID.ifInOctets) || new Map();
  const outOct = walkMaps.get(OID.ifHCOutOctets) || walkMaps.get(OID.ifOutOctets) || new Map();

  const indices = [...new Set([...descr.keys(), ...oper.keys()])]
    .filter((i) => i > 0)
    .sort((a, b) => a - b);

  const ports = [];
  for (const index of indices) {
    const name = String(descr.get(index) || `if${index}`);
    if (/^(lo|vlan|null|stack)/i.test(name)) continue;

    const ifAlias = String(alias.get(index) || "");
    const status = operStatusToUi(oper.get(index));
    const speedBps = Number(speed.get(index)) || 0;
    const speedMbps = speedBps >= 1e9 ? speedBps / 1e6 : speedBps / 1e6;
    const curIn = Number(inOct.get(index)) || 0;
    const curOut = Number(outOct.get(index)) || 0;
    const prev = prevCounters?.[index];
    const { inMbps, outMbps } = computeMbps(
      prev?.inOctets,
      prev?.outOctets,
      curIn,
      curOut,
      intervalSec
    );

    const macGuess = ifAlias.match(/([0-9A-Fa-f:]{17})/)?.[1];
    const conn = resolveConnectedDevice(macGuess, equipmentByMac, ifAlias);

    ports.push({
      index,
      name,
      ifAlias,
      status,
      speedMbps: Math.round(speedMbps) || (speedBps >= 1e9 ? 1000 : 100),
      speed: Math.round(speedMbps) || 100,
      mtu: 1500,
      inMbps: Math.round(inMbps * 10) / 10,
      outMbps: Math.round(outMbps * 10) / 10,
      poeWatts: null,
      poeStatus: null,
      vlan: null,
      macAddr: macGuess || null,
      connectedDevice: conn.name,
      connectedEquipmentId: conn.id,
      inOctets: curIn,
      outOctets: curOut,
    });
  }
  return ports;
}

/**
 * Poll switch interfaces via SNMP (or mock).
 */
export async function pollSwitchPorts(ip, options = {}) {
  const {
    name = ip,
    community = "public",
    version = "2c",
    timeoutMs = 3000,
    portCount = null,
    equipmentList = [],
    counterSnapshot = null,
    lastPollAt = null,
    forceMock = false,
  } = options;

  const equipmentByMac = new Map();
  for (const eq of equipmentList) {
    const m = normMac(eq.mac);
    if (m) equipmentByMac.set(m, eq);
  }

  const walkOk = !forceMock && (await isSnmpWalkAvailable());
  if (!walkOk) {
    const mock = buildMockPollResult(ip, name, portCount || 12);
    return { ...mock, source: "mock" };
  }

  try {
    const sys = await snmpProbe(ip, { community, version, timeoutMs });
    const walkMaps = new Map();
    const oidList = [
      OID.ifDescr,
      OID.ifAlias,
      OID.ifOperStatus,
      OID.ifSpeed,
      OID.ifHCInOctets,
      OID.ifHCOutOctets,
      OID.ifInOctets,
      OID.ifOutOctets,
    ];
    const walks = await Promise.all(
      oidList.map((oid) =>
        snmpWalk(ip, oid, { community, version, timeoutMs }).catch(() => new Map())
      )
    );
    for (const m of walks) {
      for (const [k, v] of m) {
        if (!walkMaps.has(k)) walkMaps.set(k, new Map());
        const merged = walkMaps.get(k);
        for (const [idx, val] of v) merged.set(idx, val);
      }
    }

    const intervalSec = lastPollAt
      ? Math.max(1, (Date.now() - new Date(lastPollAt).getTime()) / 1000)
      : 0;
    let ports = buildPortsFromWalk(walkMaps, equipmentByMac, counterSnapshot, intervalSec);

    if (portCount && ports.length > portCount) ports = ports.slice(0, portCount);

    const counterSnapshotOut = {};
    for (const p of ports) {
      counterSnapshotOut[p.index] = { inOctets: p.inOctets, outOctets: p.outOctets };
    }

    return {
      success: true,
      ip,
      name: sys?.sysName || name,
      sysName: sys?.sysName || name,
      sysUptime: null,
      ports,
      counterSnapshot: counterSnapshotOut,
      polledAt: new Date().toISOString(),
      source: "snmp",
    };
  } catch (err) {
    const mock = buildMockPollResult(ip, name, portCount || 12);
    return { ...mock, source: "mock", error: err.message };
  }
}

/** Re-poll a single interface (or mock). */
export async function testSwitchInterface(ip, ifIndex, options = {}) {
  const full = await pollSwitchPorts(ip, options);
  const port = full.ports.find((p) => p.index === Number(ifIndex));
  if (!port) {
    return { success: false, message: `Interface ${ifIndex} not found` };
  }
  return {
    success: true,
    port: { ...port, status: port.status },
    polledAt: new Date().toISOString(),
    source: full.source,
  };
}

/** Build aggregate poll response for multiple switches. */
export function buildPollAllResponse(results) {
  const switches = results.map((r) => ({
    ip: r.ip,
    name: r.name,
    totalPorts: r.ports?.length || 0,
    portsUp: r.ports?.filter((p) => p.status === "up").length || 0,
    portsDown: r.ports?.filter((p) => p.status === "down").length || 0,
    ports: (r.ports || []).map((p) => ({
      port: p.index,
      ifAlias: p.ifAlias,
      ifOperStatus: p.status,
      ifSpeed: p.speedMbps,
      connectedDevice: p.connectedDevice,
      macAddr: p.macAddr,
      vlan: p.vlan,
      poeWatts: p.poeWatts,
    })),
    polledAt: r.polledAt,
    source: r.source,
  }));

  const connectionMap = [];
  for (const sw of switches) {
    for (const port of sw.ports || []) {
      if (port.connectedDevice || port.macAddr) {
        connectionMap.push({
          switchName: sw.name,
          switchIp: sw.ip,
          port: port.port,
          portAlias: port.ifAlias,
          connectedDevice: port.connectedDevice,
          macAddr: port.macAddr,
          status: port.ifOperStatus,
          speed: port.ifSpeed,
          vlan: port.vlan,
          poeWatts: port.poeWatts,
        });
      }
    }
  }

  return {
    success: true,
    switches,
    connectionMap,
    totalConnections: connectionMap.length,
    disconnectedPorts: connectionMap.filter((c) => c.status === "down").length,
    polledAt: new Date().toISOString(),
  };
}
