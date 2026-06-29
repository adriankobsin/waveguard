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

/**
 * Compact Lutron demo house used by the Lighting page when in demo mode and
 * by the import flow as a built-in showcase. Each href mirrors what a real
 * LEAP processor would expose so the same `lightingApi.setZoneLevel` /
 * `activateScene` calls flow through identically.
 */
export function getDemoLightingHouse() {
  const areas = [
    { href: "/area/100", id: "100", floor: "Main Deck", name: "Saloon", fullPath: "Main Deck\\Saloon" },
    { href: "/area/101", id: "101", floor: "Main Deck", name: "Dining", fullPath: "Main Deck\\Dining" },
    { href: "/area/102", id: "102", floor: "Main Deck", name: "Galley", fullPath: "Main Deck\\Galley" },
    { href: "/area/200", id: "200", floor: "Upper Deck", name: "Sky Lounge", fullPath: "Upper Deck\\Sky Lounge" },
    { href: "/area/201", id: "201", floor: "Upper Deck", name: "Sun Deck", fullPath: "Upper Deck\\Sun Deck" },
    { href: "/area/300", id: "300", floor: "Lower Deck", name: "Owner Cabin", fullPath: "Lower Deck\\Owner Cabin" },
    { href: "/area/301", id: "301", floor: "Lower Deck", name: "Guest Cabin", fullPath: "Lower Deck\\Guest Cabin" },
  ];

  const zone = (id, areaId, name, kind = "light") => {
    const area = areas.find((a) => a.id === areaId);
    return {
      href: `/zone/${id}`,
      id: String(id),
      area_id: areaId,
      fullPath: `${area.fullPath}\\${name}`,
      floor: area.floor,
      area: area.name,
      areaFullPath: area.fullPath,
      name,
      kind,
    };
  };

  const scene = (id, areaId, name) => {
    const area = areas.find((a) => a.id === areaId);
    return {
      href: `/areascene/${id}`,
      id: String(id),
      area_id: areaId,
      fullPath: `${area.fullPath}\\${name}`,
      floor: area.floor,
      area: area.name,
      areaFullPath: area.fullPath,
      name,
    };
  };

  const zones = [
    zone(1001, "100", "DOWNLIGHTS"),
    zone(1002, "100", "PENDANT"),
    zone(1003, "100", "WALL LIGHTS"),
    zone(1004, "100", "BLACKOUT BLIND", "blackout"),
    zone(1101, "101", "DOWNLIGHTS"),
    zone(1102, "101", "DINING PENDANT"),
    zone(1103, "101", "ROMAN BLIND", "blind"),
    zone(1201, "102", "DOWNLIGHTS"),
    zone(1202, "102", "CABINET LIGHTS"),
    zone(2001, "200", "DOWNLIGHTS"),
    zone(2002, "200", "PENDANT"),
    zone(2003, "200", "BLACKOUT BLIND", "blackout"),
    zone(2101, "201", "WALL LIGHTS"),
    zone(2102, "201", "STRIP LIGHT"),
    zone(3001, "300", "DOWNLIGHTS"),
    zone(3002, "300", "BED LHS"),
    zone(3003, "300", "BED RHS"),
    zone(3004, "300", "BLACKOUT BLIND", "blackout"),
    zone(3101, "301", "DOWNLIGHTS"),
    zone(3102, "301", "ROMAN BLIND", "blind"),
  ];

  const scenes = [];
  for (const a of areas) {
    ["Off Scene", "Scene 001", "Scene 002", "Scene 003", "Scene 004"].forEach((name, i) => {
      scenes.push(scene(parseInt(a.id, 10) * 10 + i, a.id, name));
    });
  }

  const devices = [
    {
      href: "/device/9001",
      id: "9001",
      model: "2 Column (2B-2B)",
      fullPath: "Main Deck\\Saloon\\Entrance\\Device 1",
      floor: "Main Deck",
      area: "Saloon",
      location: "Entrance · Device 1",
      buttons: [
        { kind: "button", index: 1, href: "/button/9011", componentName: "WELCOME" },
        { kind: "button", index: 2, href: "/button/9012", componentName: "AMBIENCE" },
        { kind: "button", index: 4, href: "/button/9013", componentName: "BRIGHT" },
        { kind: "button", index: 5, href: "/button/9014", componentName: "ALL OFF" },
      ],
      leds: [
        { kind: "led", index: 1, href: "/led/9111", componentName: null },
        { kind: "led", index: 2, href: "/led/9112", componentName: null },
      ],
    },
    {
      href: "/device/9002",
      id: "9002",
      model: "Phantom Keypad",
      fullPath: "Main Deck\\AV Rack\\Panel 1\\Light Control\\Device 1",
      floor: "Main Deck",
      area: "AV Rack",
      location: "Panel 1 · Light Control · Device 1",
      buttons: [
        { kind: "button", index: 1, href: "/button/9021", componentName: "ALL LIGHTS FULL" },
        { kind: "button", index: 2, href: "/button/9022", componentName: "ALL LIGHTS MED" },
        { kind: "button", index: 3, href: "/button/9023", componentName: "ALL LIGHTS OFF" },
      ],
      leds: [],
    },
  ];

  return {
    house: {
      fileName: "Demo Vessel — Lutron HomeWorks QSX (demo)",
      processorId: null,
      parsedAt: new Date().toISOString(),
      counts: {
        areas: areas.length,
        zones: zones.length,
        scenes: scenes.length,
        devices: devices.length,
        buttons: devices.reduce((s, d) => s + d.buttons.length, 0),
        leds: devices.reduce((s, d) => s + d.leds.length, 0),
        hvacZones: 0,
        shadeGroups: 0,
      },
    },
    areas,
    zones,
    scenes,
    devices,
    hvacZones: [],
    shadeGroups: [],
  };
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
