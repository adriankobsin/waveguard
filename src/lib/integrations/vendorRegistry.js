/**
 * Vendor integration registry — capabilities and router adapter info.
 *
 * Supported router vendors:
 *   peplink   — Phase 1: SNMP + REST (InControl2 + on-device)
 *   cisco     — Phase 1: SNMP + SSH
 *   fortinet  — Phase 1: SNMP + REST (FortiOS API)
 *   snmp      — Phase 1: SNMP-only (generic)
 *
 * Phase 2 (coming soon):
 *   mikrotik, juniper, huawei, draytek, kerio, unifi
 */

export const VENDOR_IDS = [
  "snmp", "cisco", "peplink", "fortinet",
  "mikrotik", "juniper", "huawei", "draytek",
  "kerio", "unifi",
  "modbus", "coolmaster", "rs485", "yachtica",
];

export const VENDOR_REGISTRY = {
  snmp: {
    id: "snmp",
    label: "SNMP (generic)",
    phase: 1,
    isRouterVendor: true,
    pollMethods: ["snmp"],
    capabilities: { snmp: true, rest: false, ssh: false, cellular: false, vpn: false },
    docsUrl: null,
  },
  cisco: {
    id: "cisco",
    label: "Cisco",
    phase: 1,
    isRouterVendor: true,
    pollMethods: ["snmp", "cisco_ssh"],
    capabilities: { snmp: true, rest: false, ssh: true, cellular: false, vpn: true },
    docsUrl: "https://www.cisco.com/c/en/us/support/index.html",
  },
  peplink: {
    id: "peplink",
    label: "Peplink",
    phase: 1,
    isRouterVendor: true,
    pollMethods: ["snmp", "peplink_hybrid"],
    capabilities: { snmp: true, rest: true, ssh: false, cellular: true, vpn: true },
    docsUrl: "https://www.peplink.com/support/",
  },
  fortinet: {
    id: "fortinet",
    label: "Fortinet FortiGate",
    phase: 1,
    isRouterVendor: true,
    pollMethods: ["snmp", "fortinet_rest"],
    capabilities: { snmp: true, rest: true, ssh: true, cellular: false, vpn: true },
    docsUrl: "https://docs.fortinet.com/",
  },
  mikrotik: {
    id: "mikrotik",
    label: "MikroTik RouterOS",
    phase: 2,
    isRouterVendor: true,
    pollMethods: ["snmp"],
    capabilities: { snmp: true, rest: true, ssh: true, cellular: false, vpn: true },
    docsUrl: "https://wiki.mikrotik.com/",
    comingSoon: true,
  },
  juniper: {
    id: "juniper",
    label: "Juniper Junos",
    phase: 2,
    isRouterVendor: true,
    pollMethods: ["snmp"],
    capabilities: { snmp: true, rest: false, ssh: true, cellular: false, vpn: true },
    docsUrl: "https://www.juniper.net/documentation/",
    comingSoon: true,
  },
  huawei: {
    id: "huawei",
    label: "Huawei",
    phase: 2,
    isRouterVendor: true,
    pollMethods: ["snmp"],
    capabilities: { snmp: true, rest: false, ssh: true, cellular: true, vpn: true },
    docsUrl: "https://support.huawei.com/",
    comingSoon: true,
  },
  draytek: {
    id: "draytek",
    label: "DrayTek",
    phase: 2,
    isRouterVendor: true,
    pollMethods: [],
    capabilities: { snmp: true, rest: true, ssh: false, cellular: true, vpn: true },
    docsUrl: "https://www.draytek.com/support/",
    comingSoon: true,
  },
  kerio: {
    id: "kerio",
    label: "Kerio Control",
    phase: 2,
    isRouterVendor: true,
    pollMethods: [],
    capabilities: { snmp: false, rest: true, ssh: false, cellular: false, vpn: true },
    docsUrl: "https://manuals.kerio.com/",
    comingSoon: true,
  },
  unifi: {
    id: "unifi",
    label: "UniFi (Ubiquiti)",
    phase: 1,
    isRouterVendor: false,
    pollMethods: ["unifi_api"],
    capabilities: { snmp: false, rest: true, ssh: false, cellular: false, vpn: false },
    docsUrl: "https://help.ui.com/",
  },
  modbus: {
    id: "modbus",
    label: "Modbus TCP (HVAC)",
    phase: 1,
    pollMethods: ["modbus_tcp"],
    capabilities: { modbus: true, hvac: true },
    docsUrl: null,
  },
  coolmaster: {
    id: "coolmaster",
    label: "Coolmaster Net (HVAC)",
    phase: 1,
    pollMethods: ["coolmaster_tcp"],
    capabilities: { hvac: true, mitsubishi: true },
    docsUrl: null,
  },
  rs485: {
    id: "rs485",
    label: "RS485 Serial Bridge (HVAC)",
    phase: 1,
    pollMethods: ["rs485_tcp"],
    capabilities: { hvac: true, serial: true },
    docsUrl: null,
  },
  yachtica: {
    id: "yachtica",
    label: "Yachtica Lighting (TCP)",
    phase: 1,
    pollMethods: ["yachtica_tcp"],
    capabilities: { lighting: true, dimmer: true, relay: true, keypad: true, scene: true },
    docsUrl: null,
  },
};

export function getVendorInfo(vendorId) {
  return VENDOR_REGISTRY[vendorId] || VENDOR_REGISTRY.snmp;
}

export function isVendorPollEnabled(vendorId) {
  const v = getVendorInfo(vendorId);
  return !v.comingSoon && (v.pollMethods?.length > 0);
}

export function isRouterVendor(vendorId) {
  const v = getVendorInfo(vendorId);
  return v.isRouterVendor === true;
}

export function getActiveRouterVendors() {
  return Object.values(VENDOR_REGISTRY).filter((v) => v.phase === 1 && v.isRouterVendor);
}

export const DEVICE_ROLE_LABELS = {
  switch: "Switch",
  router: "Router",
  firewall: "Firewall",
  wan_router: "WAN Router",
};

export const POLL_METHOD_LABELS = {
  snmp: "SNMP",
  cisco_ssh: "Cisco SSH",
  peplink_hybrid: "Peplink Hybrid",
  fortinet_rest: "FortiGate REST API",
};
