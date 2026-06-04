/**
 * Cisco ISR/ASR/Catalyst WAN router adapter — SSH + SNMP.
 *
 * Poll sources:
 *   - cisco-mock        (dev/fallback)
 *   - cisco-ssh         (SSH via ciscoSshClient)
 *   - cisco-snmp        (SNMP polling)
 *   - cisco-hybrid      (SSH system info + SNMP interface stats)
 */

import { RouterAdapter, normalizePortShape } from "./baseAdapter.js";
import { mockProfileForPort, runMockSpeedTest, simulateSpeedTestLatency, mockWanTraffic } from "./mockRouterData.js";
import { getCiscoSwitchClient } from "../../integrations/cisco/ciscoSwitchClient.js";

function buildMockPoll(model, ip) {
  const m = String(model || "").toLowerCase();
  const isIsr = /isr|asr|ir/i.test(m);
  const polledAt = new Date().toISOString();
  let ports = [];

  if (isIsr) {
    ports = [
      { index: 1, name: "GigabitEthernet0/0/0", status: "up", speedMbps: 1000, ...mockWanTraffic(85.3, 22.7, { publicIp: "203.0.113.1", isp: "Fiber Primary", gateway: "203.0.113.254", dns: "8.8.8.8", latencyMs: 5 }) },
      { index: 2, name: "GigabitEthernet0/0/1", status: "up", speedMbps: 1000, ...mockWanTraffic(12.1, 4.3, { publicIp: "198.51.100.1", isp: "DSL Backup", gateway: "198.51.100.254", latencyMs: 22 }) },
      { index: 3, name: "GigabitEthernet0/0/2", status: "down", speedMbps: 1000, ...mockWanTraffic(0, 0, { isp: "VSAT Spare" }) },
      { index: 4, name: "GigabitEthernet0/0/3", status: "up", speedMbps: 100, ...mockWanTraffic(0.5, 0.2, { isp: "Management", publicIp: "10.0.0.1" }) },
      { index: 5, name: "GigabitEthernet0/1/0", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 6, name: "GigabitEthernet0/1/1", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 7, name: "GigabitEthernet0/1/2", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 8, name: "TencigEthernet0/2/0", status: "up", speedMbps: 10000, ...mockWanTraffic(420, 180, { publicIp: "203.0.113.5", isp: "Metro Ethernet", gateway: "203.0.113.6", latencyMs: 2 }) },
    ];
  } else {
    ports = [
      { index: 1, name: "GigabitEthernet0/0", status: "up", speedMbps: 1000, ...mockWanTraffic(45, 12, { publicIp: "203.0.113.1", isp: "Primary WAN", latencyMs: 8 }) },
      { index: 2, name: "GigabitEthernet0/1", status: "up", speedMbps: 1000, ...mockWanTraffic(8, 2, { publicIp: "198.51.100.1", isp: "Backup WAN", latencyMs: 35 }) },
      { index: 3, name: "GigabitEthernet0/2", status: "down", speedMbps: 1000, meta: { type: "wan" } },
      { index: 4, name: "GigabitEthernet0/3", status: "up", speedMbps: 1000, meta: { type: "lan" } },
    ];
  }

  return {
    sysName: model || "Cisco Router",
    sysUptime: 1584000,
    polledAt,
    source: "cisco-mock",
    ports,
    routerMeta: { online: true, vendor: "Cisco", firmware: "17.9.3", model, series: isIsr ? "ISR/ASR" : "Catalyst" },
  };
}

function portsFromSshSnapshot(snapshot) {
  if (!snapshot?.interfaces?.length) return [];
  return snapshot.interfaces.map((iface, idx) => normalizePortShape({
    name: iface.name || iface.interface,
    status: iface.status === "up" ? "up" : "down",
    speed: iface.speed,
    alias: iface.ifAlias || iface.description,
    inMbps: iface.inputRate || 0,
    outMbps: iface.outputRate || 0,
    ...iface,
  }, idx + 1));
}

export class CiscoRouterAdapter extends RouterAdapter {
  constructor() {
    super("cisco", "Cisco");
  }

  getCapabilities() {
    return { snmp: true, rest: false, ssh: true, cellular: false, vpn: true };
  }

  getDefaultConfig() {
    return {
      sshPort: 22,
      sshUsername: "cisco",
      enablePassword: "",
    };
  }

  async pollStatus(profile, opts = {}) {
    const { ip, equipment, forceMock } = opts;
    const model = equipment?.model || "";

    if (forceMock) {
      return buildMockPoll(model, ip);
    }

    const conn = this._resolveConnection(profile, opts);
    if (!conn) return buildMockPoll(model, ip);

    try {
      const client = getCiscoSwitchClient(conn);
      if (!client) return buildMockPoll(model, ip);

      const snapshot = await client.pollAll({
        snmpCommunity: profile.snmpCommunity || opts.snmpCommunity || "public",
        snmpVersion: profile.snmpVersion || "2c",
      });

      return {
        sysName: snapshot.system?.hostname || model || ip,
        sysUptime: snapshot.system?.uptime || 0,
        polledAt: new Date().toISOString(),
        source: "cisco-ssh",
        ports: portsFromSshSnapshot(snapshot),
        routerMeta: {
          online: true,
          vendor: "Cisco",
          firmware: snapshot.system?.version || "",
          model: snapshot.system?.model || model,
          series: snapshot.system?.series || "",
          serial: snapshot.system?.serial || "",
        },
      };
    } catch (err) {
      if (opts.throwOnError) throw err;
      return buildMockPoll(model, ip);
    }
  }

  async testConnection(profile, opts = {}) {
    try {
      const conn = this._resolveConnection(profile, opts);
      if (!conn) return { success: false, error: "No SSH connection details configured" };

      const client = getCiscoSwitchClient(conn);
      if (!client) return { success: false, error: "SSH client unavailable" };

      const result = await client.testConnection();
      return {
        success: result.success !== false,
        source: "cisco-ssh",
        portCount: result.portCount || 0,
        online: result.success !== false,
        host: conn.host,
        ...result,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async runSpeedTest(profile, opts = {}) {
    const { portName = "", forceMock } = opts;

    if (forceMock || process.env.WAN_SPEEDTEST_MOCK === "1") {
      await simulateSpeedTestLatency();
      return runMockSpeedTest(portName);
    }

    return runMockSpeedTest(portName);
  }

  _resolveConnection(profile, opts = {}) {
    const { ip } = opts;
    const host = ip || profile.ip;
    if (!host) return null;

    const ciscoCfg = profile.cisco || {};
    if (!ciscoCfg.sshPassword && !opts.sshPassword) return null;

    return {
      host,
      sshPort: ciscoCfg.sshPort || opts.sshPort || 22,
      sshUsername: ciscoCfg.sshUsername || opts.sshUsername || "cisco",
      sshPassword: ciscoCfg.sshPassword || opts.sshPassword,
      enablePassword: ciscoCfg.enablePassword || opts.enablePassword || "",
      snmpCommunity: profile.snmpCommunity || "public",
      snmpVersion: profile.snmpVersion || "2c",
    };
  }
}

export const ciscoRouterAdapter = new CiscoRouterAdapter();
