import { expandCidr, detectLocalSubnets, getScanInterfaceLabel, isValidCidr, normalizeCidr } from "./subnets.js";
import { pingHost } from "./ping.js";
import { probePorts, reverseHostname, COMMON_PORTS } from "./ports.js";
import { readArpTable } from "./arp.js";
import { snmpProbe } from "./snmp.js";
import { pollSwitchPorts, testSwitchInterface, buildPollAllResponse, isSnmpWalkAvailable } from "./snmpPortMap.js";
import { lookupVendor, guessCategory } from "./enrich.js";
import { buildTopologyConnections, mapDevicesToTopology } from "./topology.js";

export { detectLocalSubnets, getScanInterfaceLabel, buildTopologyConnections, mapDevicesToTopology };
export { lookupVendor, guessCategory };
export { pollSwitchPorts, testSwitchInterface, buildPollAllResponse, isSnmpWalkAvailable };

// Router adapter library
export { getRouterAdapter, detectRouterVendor, routerRegistry, getAllRouterVendors } from "./integrations/routers/index.js";
export { peplinkRouterAdapter } from "./integrations/routers/peplinkRouter.js";
export { ciscoRouterAdapter } from "./integrations/routers/ciscoRouterAdapter.js";
export { fortinetRouterAdapter } from "./integrations/routers/fortinetRouterAdapter.js";
export { genericRouterAdapter } from "./integrations/routers/genericRouterAdapter.js";

const DEFAULT_OPTIONS = {
  subnets: ["192.168.10.0/24"],
  scanType: "ping",
  target: null,
  maxConcurrent: 64,
  timeoutMs: 1500,
  snmpEnabled: false,
  snmpCommunity: "public",
  snmpVersion: "2c",
};

async function runPool(items, concurrency, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function probeHost(ip, subnet, scanType, opts, arpMap, knownName = "") {
  const timeoutMs = opts.timeoutMs;
  let alive = false;
  let responseTimeMs = null;
  let openPorts = [];
  let hostname = "";
  let mac = arpMap?.get(ip) || "";
  let vendor = lookupVendor(mac);
  let model = "";

  if (scanType === "full") {
    const ping = await pingHost(ip, timeoutMs);
    if (ping.alive) {
      alive = true;
      responseTimeMs = ping.ms;
    }
    openPorts = await probePorts(ip, COMMON_PORTS, Math.min(timeoutMs, 800));
    if (!alive && openPorts.length > 0) alive = true;
    if (alive) {
      hostname = await reverseHostname(ip);
      if (!mac) {
        const arp = await readArpTable();
        mac = arp.get(ip) || mac;
        vendor = lookupVendor(mac);
      }
    }
  } else if (scanType === "arp") {
    if (mac) {
      alive = true;
      const ping = await pingHost(ip, Math.min(timeoutMs, 500));
      responseTimeMs = ping.ms;
    } else {
      const ping = await pingHost(ip, timeoutMs);
      alive = ping.alive;
      responseTimeMs = ping.ms;
    }
    vendor = lookupVendor(mac || (arpMap?.get(ip) || ""));
    if (alive) hostname = await reverseHostname(ip);
  } else {
    const ping = await pingHost(ip, timeoutMs);
    alive = ping.alive;
    responseTimeMs = ping.ms;
    if (alive) hostname = await reverseHostname(ip);
  }

  if (!alive) return null;

  if (opts.snmpEnabled && (openPorts.includes(161) || scanType !== "full")) {
    const snmp = await snmpProbe(ip, {
      community: opts.snmpCommunity,
      version: opts.snmpVersion,
      timeoutMs: opts.timeoutMs,
    });
    if (snmp) {
      if (snmp.sysName) hostname = snmp.sysName;
      if (snmp.vendor && snmp.vendor !== "Unknown") vendor = snmp.vendor;
      if (snmp.model) model = snmp.model;
      if (!openPorts.includes(161)) openPorts = [...openPorts, 161].sort((a, b) => a - b);
    }
  }

  if (!hostname && knownName) hostname = knownName;
  const category = guessCategory(hostname, vendor, openPorts);
  return {
    id: `disc-${subnet.replace(/\//g, "-")}-${ip.replace(/\./g, "-")}`,
    ip,
    hostname: hostname || ip,
    mac: mac || "",
    vendor,
    model,
    category,
    openPorts,
    responseTimeMs: responseTimeMs ?? 0,
    status: "discovered",
    classification: "unclassified",
    firstSeen: new Date().toISOString(),
    subnet,
  };
}

/**
 * Run network discovery scan.
 */
export async function scan(userOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...userOptions };
  const start = Date.now();
  const scanSubnets = [...new Set((opts.subnets || []).map(normalizeCidr).filter(Boolean))];
  if (scanSubnets.length === 0) {
    throw new Error("No valid subnets configured (use CIDR e.g. 192.168.1.0/24)");
  }

  if (opts.target) {
    const subnet = scanSubnets[0];
    const arpMap = opts.scanType === "arp" ? await readArpTable() : new Map();
    const device = await probeHost(opts.target, subnet, opts.scanType || "ping", opts, arpMap);
    const devices = device ? [device] : [];
    return {
      success: true,
      scanInterface: getScanInterfaceLabel(),
      subnets: scanSubnets,
      scanType: opts.scanType,
      target: opts.target,
      totalFound: devices.length,
      durationMs: Date.now() - start,
      devices,
      scannedAt: new Date().toISOString(),
    };
  }

  let arpMap = new Map();
  if (opts.scanType === "arp") {
    arpMap = await readArpTable();
  }

  const tasks = [];
  const queued = new Set();
  const subnetForIp = (ip) => {
    const prefix = String(ip || "").split(".").slice(0, 3).join(".");
    return (
      scanSubnets.find((s) => s.startsWith(`${prefix}.`)) ||
      (prefix ? `${prefix}.0/24` : scanSubnets[0])
    );
  };

  // Priority-probe known IT hosts from the vessel spreadsheet (gateways, switches, APs…).
  for (const host of opts.knownHosts || []) {
    const ip = typeof host === "string" ? host : host?.ip;
    if (!ip || queued.has(ip)) continue;
    queued.add(ip);
    tasks.push({ ip, subnet: subnetForIp(ip), knownName: host?.name || "" });
  }

  if (opts.scanType === "arp" && arpMap.size > 0) {
    for (const subnet of scanSubnets) {
      const subnetPrefix = subnet.split("/")[0].split(".").slice(0, 3).join(".");
      for (const [ip] of arpMap) {
        if (ip.startsWith(subnetPrefix) && !queued.has(ip)) {
          queued.add(ip);
          tasks.push({ ip, subnet });
        }
      }
    }
  } else {
    for (const subnet of scanSubnets) {
      for (const ip of expandCidr(subnet, 512)) {
        if (queued.has(ip)) continue;
        queued.add(ip);
        tasks.push({ ip, subnet });
      }
    }
  }

  const found = await runPool(tasks, opts.maxConcurrent, ({ ip, subnet, knownName }) =>
    probeHost(ip, subnet, opts.scanType, opts, arpMap, knownName || "")
  );

  const seen = new Set();
  const devices = found.filter((d) => {
    if (!d || seen.has(d.ip)) return false;
    seen.add(d.ip);
    return true;
  });

  return {
    success: true,
    scanInterface: getScanInterfaceLabel(),
    subnets: scanSubnets,
    scanType: opts.scanType,
    totalFound: devices.length,
    durationMs: Date.now() - start,
    devices,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Topology scan: discovery + connection graph.
 */
export async function scanTopology(userOptions = {}) {
  const discovery = await scan(userOptions);
  const topologyDevices = mapDevicesToTopology(discovery.devices);
  const connections = buildTopologyConnections(topologyDevices);
  const online = topologyDevices.filter((d) => d.status === "online").length;
  const offline = topologyDevices.filter((d) => d.status === "offline").length;
  const warning = topologyDevices.filter((d) => d.status === "warning").length;

  return {
    success: true,
    scanned_at: discovery.scannedAt,
    scanInterface: discovery.scanInterface,
    subnets: discovery.subnets,
    devices: topologyDevices,
    connections,
    stats: {
      online,
      offline,
      warning,
      active_connections: connections.length,
    },
    durationMs: discovery.durationMs,
  };
}

export const SCANNER_BUILD = "2025-05-fullscan-2";

export function getHealth() {
  return {
    ok: true,
    version: "1.0.0",
    build: SCANNER_BUILD,
    platform: process.platform,
    scanInterface: getScanInterfaceLabel(),
    localSubnets: detectLocalSubnets(),
  };
}
