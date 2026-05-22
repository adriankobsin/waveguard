/**
 * Read-only demo dataset used when Platform mode is "demo".
 *
 * Provides sample equipment, SNMP profiles, and WAN management settings so the
 * full platform UI can be showcased without touching real persisted data.
 * Live mode never reads from this module.
 */

import { buildMockPeplinkPoll } from "@/lib/integrations/peplink/peplinkAdapter";

function nowIso(offsetMin = 0) {
  return new Date(Date.now() + offsetMin * 60000).toISOString();
}

function enrichTelemetry(status, defaultWatts, tempC) {
  return {
    powerW: defaultWatts,
    tempC: tempC ?? (status === "warning" ? 48 : 36),
    lanStatus: status === "online" ? "up" : status === "offline" ? "down" : "degraded",
    lastSeen: nowIso(),
  };
}

/** Curated demo equipment — includes WAN routers, switches, AV, lighting, power. */
export function getDemoEquipment() {
  const items = [
    {
      id: "demo-router-wan",
      name: "Router-WAN",
      make: "Peplink",
      model: "Balance 2500 EC",
      category: "Network",
      ip: "10.0.0.1",
      location: "Bridge Rack",
      serial: "PPL-B2500-001",
      condition: "Excellent",
      notes: "Primary WAN router — Starlink + 4G failover",
      status: "online",
      defaultWatts: 65,
      controlType: "REST",
      telemetry: enrichTelemetry("online", 65, 38),
    },
    {
      id: "demo-router-backup",
      name: "Router-Backup",
      make: "FortiGate",
      model: "FortiGate 60F",
      category: "Network",
      ip: "10.0.0.5",
      location: "Engine Room",
      serial: "FG60F-DEMO",
      condition: "Good",
      notes: "Secondary firewall / VPN gateway",
      status: "online",
      defaultWatts: 35,
      controlType: "REST",
      telemetry: enrichTelemetry("online", 35, 41),
    },
    {
      id: "demo-sw-bridge",
      name: "SW-Bridge",
      make: "Cisco",
      model: "Cisco CBS350-24P",
      category: "Network",
      ip: "192.168.10.2",
      location: "Bridge Rack",
      serial: "FOC2241X0AB",
      condition: "Excellent",
      status: "online",
      defaultWatts: 45,
      telemetry: enrichTelemetry("online", 45, 36),
    },
    {
      id: "demo-sw-cctv",
      name: "SW-CCTV",
      make: "Cisco",
      model: "Cisco CBS350-8P",
      category: "Network",
      ip: "192.168.10.3",
      location: "Bridge Rack",
      serial: "FOC2241X0AC",
      condition: "Good",
      status: "online",
      defaultWatts: 28,
      telemetry: enrichTelemetry("online", 28, 37),
    },
    {
      id: "demo-ap-bridge",
      name: "AP-Bridge",
      make: "Ubiquiti",
      model: "Ubiquiti U6 Pro",
      category: "Network",
      ip: "192.168.10.50",
      location: "Bridge Ceiling",
      serial: "U6PRO-001",
      condition: "Excellent",
      status: "online",
      defaultWatts: 12,
      telemetry: enrichTelemetry("online", 12, 32),
    },
    {
      id: "demo-cam-bow",
      name: "Cam-Bow-01",
      make: "Dahua",
      model: "Dahua IPC-HFW2831T",
      category: "Camera",
      ip: "192.168.20.10",
      location: "Bow - External",
      serial: "DAHUA-001",
      condition: "Fair",
      status: "warning",
      defaultWatts: 8,
      telemetry: enrichTelemetry("warning", 8, 52),
    },
    {
      id: "demo-cam-stern",
      name: "Cam-Stern-01",
      make: "Dahua",
      model: "Dahua IPC-HFW2831T",
      category: "Camera",
      ip: "192.168.20.11",
      location: "Stern - External",
      serial: "DAHUA-002",
      condition: "Excellent",
      status: "online",
      defaultWatts: 8,
      telemetry: enrichTelemetry("online", 8, 38),
    },
    {
      id: "demo-ups-main",
      name: "UPS-Main",
      make: "APC",
      model: "APC SRT 3000",
      category: "Power",
      ip: "192.168.10.100",
      location: "Engine Room",
      serial: "APC-SRT-001",
      condition: "Good",
      status: "online",
      defaultWatts: 25,
      telemetry: { ...enrichTelemetry("online", 25, 31), batteryPct: 92 },
    },
    {
      id: "demo-qsys-core",
      name: "Q-SYS-Core",
      make: "QSC",
      model: "QSC Core 110f",
      category: "AV",
      ip: "192.168.30.2",
      location: "AV Rack",
      serial: "QSC-001",
      condition: "Excellent",
      status: "online",
      defaultWatts: 85,
      controlType: "REST",
      avRole: "dsp",
      telemetry: enrichTelemetry("online", 85, 42),
    },
    {
      id: "demo-tv-saloon",
      name: "TV-Saloon-01",
      make: "Samsung",
      model: "Samsung QLED 75\"",
      category: "AV",
      ip: "192.168.30.10",
      location: "Saloon Wall",
      serial: "SAM-001",
      condition: "Good",
      status: "online",
      defaultWatts: 180,
      avRole: "display",
      telemetry: enrichTelemetry("online", 180, 40),
    },
    {
      id: "demo-lighting",
      name: "Lighting-Controller",
      make: "Lutron",
      model: "Lutron QS",
      category: "Lighting",
      ip: "192.168.40.2",
      location: "AV Rack",
      serial: "LUT-001",
      condition: "Good",
      status: "online",
      defaultWatts: 35,
      controlType: "KNX",
      telemetry: enrichTelemetry("online", 35, 34),
    },
    {
      id: "demo-starlink",
      name: "Starlink",
      make: "SpaceX",
      model: "Starlink Standard",
      category: "Network",
      ip: "10.0.0.2",
      location: "Upper Deck",
      serial: "SLINK-001",
      condition: "Good",
      status: "online",
      defaultWatts: 60,
      telemetry: enrichTelemetry("online", 60, 35),
    },
  ];
  return items.map((it) => ({
    ...it,
    created_date: nowIso(-Math.floor(Math.random() * 90 * 24 * 60)),
    updated_date: nowIso(),
  }));
}

/** Build demo SNMP fleet profiles (Peplink WAN + FortiGate) with mock polls. */
export function getDemoSnmpSwitches() {
  const wanPoll = buildMockPeplinkPoll("Balance 2500 EC", "10.0.0.1");
  const polledAt = nowIso();

  const peplinkProfile = {
    id: "demo-snmp-router-wan",
    equipmentId: "demo-router-wan",
    enabled: true,
    portCount: wanPoll.ports.length,
    deviceRole: "wan_router",
    integrationVendor: "peplink",
    pollMethod: "peplink_hybrid",
    snmpCommunity: "public",
    snmpVersion: "2c",
    location: "Bridge Rack",
    tags: ["wan", "demo"],
    lastPollAt: polledAt,
    lastPollError: null,
    lastPoll: {
      sysName: "Router-WAN",
      polledAt,
      source: "peplink-mock",
      ports: wanPoll.ports,
      peplinkMeta: wanPoll.peplinkMeta,
    },
  };

  const fortinetPoll = {
    ports: [
      {
        index: 1,
        name: "WAN1",
        ifAlias: "Shore fiber",
        status: "up",
        inMbps: 145,
        outMbps: 38,
        speedMbps: 1000,
        meta: {
          type: "wan",
          publicIp: "203.0.113.18",
          gateway: "203.0.113.17",
          dns: "1.1.1.1, 8.8.8.8",
          isp: "MarinaNet Fiber",
          carrier: null,
        },
      },
      {
        index: 2,
        name: "WAN2",
        ifAlias: "LTE backup",
        status: "up",
        inMbps: 12,
        outMbps: 4,
        speedMbps: 150,
        meta: {
          type: "cellular",
          publicIp: "100.64.12.5",
          gateway: "100.64.12.1",
          dns: "8.8.8.8",
          isp: "Vodafone Maritime",
          carrier: "Vodafone",
          signalDbm: -78,
        },
      },
      {
        index: 3,
        name: "LAN1",
        status: "up",
        inMbps: 320,
        outMbps: 180,
        speedMbps: 1000,
        meta: { type: "lan" },
      },
    ],
  };

  const fortinetProfile = {
    id: "demo-snmp-router-backup",
    equipmentId: "demo-router-backup",
    enabled: true,
    portCount: fortinetPoll.ports.length,
    deviceRole: "firewall",
    integrationVendor: "fortinet",
    pollMethod: "snmp",
    snmpCommunity: "public",
    snmpVersion: "2c",
    location: "Engine Room",
    tags: ["wan", "demo"],
    lastPollAt: polledAt,
    lastPollError: null,
    lastPoll: {
      sysName: "Router-Backup",
      polledAt,
      source: "snmp",
      ports: fortinetPoll.ports,
    },
  };

  const bridgeSwitchPoll = {
    ports: Array.from({ length: 24 }, (_, i) => ({
      index: i + 1,
      name: `Gi1/0/${i + 1}`,
      status: i < 18 ? "up" : "down",
      inMbps: i < 18 ? Math.round(Math.random() * 80) : 0,
      outMbps: i < 18 ? Math.round(Math.random() * 40) : 0,
      speedMbps: 1000,
      meta: { type: "lan" },
    })),
  };

  const bridgeSwitchProfile = {
    id: "demo-snmp-sw-bridge",
    equipmentId: "demo-sw-bridge",
    enabled: true,
    portCount: 24,
    deviceRole: "switch",
    integrationVendor: "cisco",
    pollMethod: "snmp",
    snmpCommunity: "public",
    snmpVersion: "2c",
    location: "Bridge Rack",
    tags: ["switch", "demo"],
    lastPollAt: polledAt,
    lastPollError: null,
    lastPoll: {
      sysName: "SW-Bridge",
      polledAt,
      source: "snmp",
      ports: bridgeSwitchPoll.ports,
    },
  };

  return {
    profiles: [peplinkProfile, fortinetProfile, bridgeSwitchProfile],
    global: {
      autoPollEnabled: true,
      autoPollIntervalSec: 300,
      defaultPortView: "panel",
      showInactivePorts: true,
    },
  };
}

/** Demo WAN management: two routers assigned, ISP details filled in. */
export function getDemoWanManagement() {
  return {
    defaultDashboardLink: "demo-snmp-router-wan:1",
    assignedRouterEquipmentIds: ["demo-router-wan", "demo-router-backup"],
    linkOverrides: {
      "demo-snmp-router-wan:1": {
        label: "Starlink primary",
        isp: "Starlink Maritime",
        providerAccount: "STAR-MAR-00482",
        providerContact: "Starlink Maritime Support",
        providerPhone: "+1 800 555 0188",
        providerEmail: "marine-support@starlink.com",
        priority: "primary",
        enabled: true,
        notes: "Primary uplink — service plan: Mobile Priority 1TB",
        publicIpOverride: "",
        gatewayOverride: "",
        dnsOverride: "",
        contractDownMbps: 250,
        contractUpMbps: 25,
      },
      "demo-snmp-router-wan:2": {
        label: "4G failover",
        isp: "Vodafone Maritime",
        providerAccount: "VF-M2M-90213",
        providerContact: "Vodafone Maritime NOC",
        providerPhone: "+44 20 7946 0000",
        providerEmail: "maritime-noc@vodafone.com",
        priority: "cellular",
        enabled: true,
        notes: "LTE/5G failover SIM. APN: maritime.vodafone.com",
        publicIpOverride: "",
        gatewayOverride: "",
        dnsOverride: "",
        contractDownMbps: 100,
        contractUpMbps: 20,
      },
      "demo-snmp-router-backup:1": {
        label: "Shore fiber",
        isp: "MarinaNet Fiber",
        providerAccount: "MN-FIBER-00219",
        providerContact: "MarinaNet Operations",
        providerPhone: "+33 4 9376 1200",
        providerEmail: "ops@marinanet.fr",
        priority: "backup",
        enabled: true,
        notes: "Available at home marina only. 200/40 Mbps symmetrical.",
        publicIpOverride: "",
        gatewayOverride: "",
        dnsOverride: "",
        contractDownMbps: 200,
        contractUpMbps: 200,
      },
      "demo-snmp-router-backup:2": {
        label: "LTE backup",
        isp: "Vodafone Maritime",
        providerAccount: "VF-M2M-90214",
        providerContact: "Vodafone Maritime NOC",
        providerPhone: "+44 20 7946 0000",
        providerEmail: "maritime-noc@vodafone.com",
        priority: "spare",
        enabled: true,
        notes: "Backup SIM in FortiGate failover slot",
        publicIpOverride: "",
        gatewayOverride: "",
        dnsOverride: "",
        contractDownMbps: 100,
        contractUpMbps: 20,
      },
    },
    manualLinks: [],
  };
}

/** Sample maintenance tasks for demo. */
export function getDemoTasks() {
  return [
    {
      id: "demo-task-1",
      title: "Quarterly UPS battery test",
      equipmentId: "demo-ups-main",
      dueDate: nowIso(-2 * 24 * 60),
      status: "overdue",
      assignee: "Chief Engineer",
    },
    {
      id: "demo-task-2",
      title: "Starlink dish firmware check",
      equipmentId: "demo-router-wan",
      dueDate: nowIso(7 * 24 * 60),
      status: "scheduled",
      assignee: "ETO",
    },
  ];
}

export function getDemoLogs() {
  return [];
}

export function getDemoRules() {
  return [];
}

/** Build the full demo sources payload used by SystemDataContext. */
export function buildDemoSystemSources() {
  return {
    equipment: getDemoEquipment(),
    tasks: getDemoTasks(),
    logs: getDemoLogs(),
    rules: getDemoRules(),
    snmpSwitches: getDemoSnmpSwitches(),
    wanManagement: getDemoWanManagement(),
  };
}
