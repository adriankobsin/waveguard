/**
 * Generic SNMP WAN router adapter — works with any SNMP-capable router.
 *
 * Poll sources:
 *   - generic-mock  (dev/fallback)
 *   - snmp          (live SNMP polling)
 *
 * This is the fallback adapter when no vendor-specific adapter matches.
 * It uses standard SNMP MIB-II interfaces and the router's sysDescr to
 * determine port layout.
 */

import { RouterAdapter, normalizePortShape } from "./baseAdapter.js";
import { mockProfileForPort, runMockSpeedTest, simulateSpeedTestLatency, mockWanTraffic } from "./mockRouterData.js";
import { snmpProbe } from "../../snmp.js";
import { pollSwitchPorts, testSwitchInterface } from "../../snmpPortMap.js";

const ROUTER_OIDS = {
  sysName: "1.3.6.1.2.1.1.5.0",
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysUptime: "1.3.6.1.2.1.1.3.0",
  ifNumber: "1.3.6.1.2.1.2.1.0",
};

function buildMockPoll(model, ip) {
  const m = String(model || "").toLowerCase();
  const polledAt = new Date().toISOString();
  const wanCount = /enterprise|carrier|tier/i.test(m) ? 4 : 2;
  const lanCount = /enterprise|carrier|tier/i.test(m) ? 8 : 4;

  const ports = [];
  for (let i = 1; i <= wanCount; i++) {
    const up = i <= 2;
    ports.push({
      index: i,
      name: `WAN${i}`,
      status: up ? "up" : "down",
      speedMbps: up ? 1000 : 0,
      ...mockWanTraffic(
        up ? Math.round(Math.random() * 80 * 10) / 10 : 0,
        up ? Math.round(Math.random() * 30 * 10) / 10 : 0,
        { publicIp: up ? `203.0.113.${i}` : null, isp: up ? `ISP WAN${i}` : null, latencyMs: up ? Math.round(10 + Math.random() * 20) : null }
      ),
    });
  }
  for (let i = 0; i < lanCount; i++) {
    const idx = wanCount + i + 1;
    ports.push({
      index: idx,
      name: `LAN${i + 1}`,
      status: i < 4 ? "up" : "down",
      speedMbps: i < 4 ? 1000 : 0,
      meta: { type: "lan" },
    });
  }

  return {
    sysName: model || "Generic Router",
    sysUptime: 360000,
    polledAt,
    source: "generic-mock",
    ports,
    routerMeta: { online: true, vendor: "Unknown", firmware: "", model },
  };
}

function sysDescrToVendor(sysDescr) {
  if (!sysDescr) return "Unknown";
  const s = sysDescr.toLowerCase();
  if (s.includes("cisco")) return "Cisco";
  if (s.includes("peplink")) return "Peplink";
  if (s.includes("fortinet") || s.includes("fortigate")) return "Fortinet";
  if (s.includes("mikrotik")) return "MikroTik";
  if (s.includes("ubiquiti") || s.includes("unifi") || s.includes("edgeos")) return "Ubiquiti";
  if (s.includes("juniper") || s.includes("junos")) return "Juniper";
  if (s.includes("huawei")) return "Huawei";
  if (s.includes("zyxel")) return "Zyxel";
  if (s.includes("draytek")) return "DrayTek";
  return "Unknown";
}

export class GenericRouterAdapter extends RouterAdapter {
  constructor() {
    super("snmp", "Generic SNMP Router");
  }

  getCapabilities() {
    return { snmp: true, rest: false, ssh: false, cellular: false, vpn: false };
  }

  getDefaultConfig() {
    return {};
  }

  async pollStatus(profile, opts = {}) {
    const { ip, equipment, forceMock } = opts;
    const model = equipment?.model || "";

    if (forceMock || !ip) {
      return buildMockPoll(model, ip);
    }

    try {
      const snmp = await snmpProbe(ip, {
        community: opts.snmpCommunity || profile.snmpCommunity || "public",
        version: opts.snmpVersion || profile.snmpVersion || "2c",
        timeoutMs: opts.timeoutMs || 5000,
      });

      const portPoll = await pollSwitchPorts(ip, {
        community: opts.snmpCommunity || profile.snmpCommunity || "public",
        version: opts.snmpVersion || profile.snmpVersion || "2c",
        timeoutMs: opts.timeoutMs || 5000,
        portCount: opts.portCount || 0,
      });

      const ports = (portPoll.ports || []).map((p, idx) =>
        normalizePortShape({
          ...p,
          name: p.name || p.ifDescr || p.ifAlias || `Interface ${idx + 1}`,
          status: p.status === "up" ? "up" : p.status === "down" ? "down" : "unknown",
          speed: p.speedMbps || p.speed || 0,
        }, idx + 1)
      );

      const vendor = snmp?.vendor || sysDescrToVendor(snmp?.sysDescr) || "Unknown";

      return {
        sysName: snmp?.sysName || portPoll.sysName || model || ip,
        sysUptime: portPoll.sysUptime || 0,
        polledAt: new Date().toISOString(),
        source: "snmp",
        ports,
        routerMeta: {
          online: ports.some((p) => p.status === "up"),
          vendor,
          model: snmp?.model || model,
          sysDescr: snmp?.sysDescr || "",
        },
      };
    } catch (err) {
      if (opts.throwOnError) throw err;
      return buildMockPoll(model, ip);
    }
  }

  async testConnection(profile, opts = {}) {
    try {
      const snmp = await snmpProbe(opts.ip, {
        community: opts.snmpCommunity || profile.snmpCommunity || "public",
        version: opts.snmpVersion || profile.snmpVersion || "2c",
        timeoutMs: opts.timeoutMs || 3000,
      });
      return {
        success: !!snmp,
        source: "snmp",
        portCount: 0,
        online: !!snmp,
        vendor: snmp?.vendor || "Unknown",
        model: snmp?.model || "",
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async runSpeedTest(profile, opts = {}) {
    const { portName = "", forceMock } = opts;
    if (forceMock) {
      await simulateSpeedTestLatency();
    }
    return runMockSpeedTest(portName);
  }
}

export const genericRouterAdapter = new GenericRouterAdapter();
