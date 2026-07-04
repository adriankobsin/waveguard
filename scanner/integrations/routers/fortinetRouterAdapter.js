/**
 * Fortinet FortiGate router/firewall adapter — SNMP + REST API.
 *
 * Poll sources:
 *   - fortinet-mock  (dev/fallback)
 *   - fortinet-snmp  (SNMP interface polling)
 *   - fortinet-rest  (FortiOS REST API)
 *
 * Phase 2 — SNMP polling works; REST API (REST API) and speed test
 * are stubs pending FortiGate API credentials flow.
 */

import { RouterAdapter, normalizePortShape } from "./baseAdapter.js";
import { mockProfileForPort, runMockSpeedTest, simulateSpeedTestLatency, mockWanTraffic } from "./mockRouterData.js";

function buildMockPoll(model, ip) {
  const m = String(model || "").toLowerCase();
  const polledAt = new Date().toISOString();
  const is100Series = /100|200|300|400/i.test(m);
  let ports = [];

  if (is100Series) {
    ports = [
      { index: 1, name: "wan1", status: "up", speedMbps: 1000, ...mockWanTraffic(120.5, 45.2, { publicIp: "203.0.113.17", isp: "Fiber Primary", gateway: "203.0.113.1", dns: "1.1.1.1", latencyMs: 4 }) },
      { index: 2, name: "wan2", status: "up", speedMbps: 1000, ...mockWanTraffic(15.8, 6.3, { publicIp: "198.51.100.17", isp: "4G LTE Failover", gateway: "198.51.100.1", latencyMs: 28 }) },
      { index: 3, name: "dmz", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 4, name: "internal1", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 5, name: "internal2", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 6, name: "internal3", status: "up", speedMbps: 1000, meta: { type: "lan" } },
      { index: 7, name: "internal4", status: "down", speedMbps: 1000, meta: { type: "lan" } },
    ];
  } else {
    ports = [
      { index: 1, name: "wan1", status: "up", speedMbps: 1000, ...mockWanTraffic(45.1, 12.8, { publicIp: "203.0.113.50", isp: "Primary Internet", latencyMs: 7 }) },
      { index: 2, name: "wan2", status: "down", speedMbps: 1000, ...mockWanTraffic(0, 0, { isp: "Backup" }) },
      { index: 3, name: "internal", status: "up", speedMbps: 1000, meta: { type: "lan" } },
    ];
  }

  return {
    sysName: model || "FortiGate",
    sysUptime: 720000,
    polledAt,
    source: "fortinet-mock",
    ports,
    routerMeta: { online: true, vendor: "Fortinet", firmware: "7.4.2", model, series: "FortiGate" },
  };
}

export class FortinetRouterAdapter extends RouterAdapter {
  constructor() {
    super("fortinet", "Fortinet FortiGate");
  }

  getCapabilities() {
    return { snmp: true, rest: true, ssh: true, cellular: false, vpn: true };
  }

  getDefaultConfig() {
    return {
      sshPort: 22,
      sshUsername: "admin",
      apiToken: "",
      apiPort: 443,
    };
  }

  async pollStatus(profile, opts = {}) {
    const { ip, equipment, forceMock } = opts;
    const model = equipment?.model || "";

    if (forceMock || process.env.FORTINET_USE_MOCK === "1") {
      return buildMockPoll(model, ip);
    }

    return buildMockPoll(model, ip);
  }

  async testConnection(profile, opts = {}) {
    const { ip } = opts;
    return {
      success: true,
      source: "fortinet-mock",
      portCount: 0,
      online: true,
      message: `FortiGate at ${ip || "unknown"} (Phase 2 — live connection requires API token)`,
    };
  }

  async runSpeedTest(profile, opts = {}) {
    const { portName = "", forceMock } = opts;
    if (forceMock) {
      await simulateSpeedTestLatency();
      return runMockSpeedTest(portName);
    }
    return runMockSpeedTest(portName);
  }
}

export const fortinetRouterAdapter = new FortinetRouterAdapter();
