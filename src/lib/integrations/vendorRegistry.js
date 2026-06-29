/**
 * Vendor integration registry — capabilities and Phase 2 stubs.
 */

export const VENDOR_IDS = ["snmp", "cisco", "peplink", "fortinet", "kerio", "unifi", "modbus", "coolmaster", "rs485"];

export const VENDOR_REGISTRY = {
  snmp: {
    id: "snmp",
    label: "SNMP (generic)",
    phase: 1,
    pollMethods: ["snmp"],
    capabilities: { snmp: true, rest: false, cellular: false, vpn: false },
    docsUrl: null,
  },
  cisco: {
    id: "cisco",
    label: "Cisco",
    phase: 1,
    pollMethods: ["snmp", "cisco_ssh"],
    capabilities: { snmp: true, rest: false, ssh: true, cellular: false, vpn: false },
    docsUrl: "https://www.cisco.com/c/en/us/support/index.html",
  },
  peplink: {
    id: "peplink",
    label: "Peplink",
    phase: 1,
    pollMethods: ["snmp", "peplink_hybrid"],
    capabilities: { snmp: true, rest: true, cellular: true, vpn: true },
    docsUrl: "https://www.peplink.com/support/",
  },
  fortinet: {
    id: "fortinet",
    label: "Fortinet FortiGate",
    phase: 2,
    pollMethods: ["snmp"],
    capabilities: { snmp: true, rest: true, cellular: false, vpn: true },
    docsUrl: "https://docs.fortinet.com/",
    comingSoon: true,
  },
  kerio: {
    id: "kerio",
    label: "Kerio Control",
    phase: 2,
    pollMethods: [],
    capabilities: { snmp: false, rest: true, cellular: false, vpn: true },
    docsUrl: "https://manuals.kerio.com/",
    comingSoon: true,
  },
  unifi: {
    id: "unifi",
    label: "UniFi (Ubiquiti)",
    phase: 1,
    pollMethods: ["unifi_api"],
    capabilities: { snmp: false, rest: true, cellular: false, vpn: false },
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
};

export function getVendorInfo(vendorId) {
  return VENDOR_REGISTRY[vendorId] || VENDOR_REGISTRY.snmp;
}

export function isVendorPollEnabled(vendorId) {
  const v = getVendorInfo(vendorId);
  return !v.comingSoon && (v.pollMethods?.length > 0);
}

export const DEVICE_ROLE_LABELS = {
  switch: "Switch",
  router: "Router",
  firewall: "Firewall",
  wan_router: "WAN router",
};
