/**
 * Router device catalog — consolidated device specs for all supported WAN routers.
 * Each entry describes the router's port layout, form factor, and default login.
 */

const ROUTER_DEFAULT_WEB_LOGIN = {
  username: "admin",
  password: "",
  loginUrlPath: "/",
  notes: "Default admin credentials — change on first boot.",
};

export const ROUTER_VENDOR_LABELS = {
  peplink: "Peplink",
  cisco: "Cisco",
  fortinet: "Fortinet FortiGate",
  snmp: "Generic SNMP Router",
};

export const ROUTER_DEVICES = {
  // ── Peplink ──────────────────────────────────────────────────
  "balance-2500-ec": {
    sku: "BPL-2500-EC",
    name: "Balance 2500 EC",
    series: "Balance 2500 EC",
    vendor: "peplink",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "1U rack",
    routerThroughputGbps: 30,
    speedFusionVpnGbps: 10,
    layout: "wan-router",
    aliases: [
      "BPL-2500-EC", "BPL2500EC", "BALANCE 2500 EC", "BALANCE2500EC",
      "PEPLINK BALANCE 2500 EC", "BALANCE 2500", "2500 EC", "2500-EC",
    ],
    portSlots: [
      { index: 1, name: "WAN1", role: "wan", isUplink: true },
      { index: 2, name: "WAN2", role: "wan", isUplink: true },
      { index: 3, name: "WAN3", role: "wan", isUplink: true },
      { index: 4, name: "WAN4", role: "wan", isUplink: true },
      { index: 5, name: "WAN5", role: "wan", isUplink: true },
      { index: 6, name: "WAN6", role: "wan", isUplink: true },
      { index: 7, name: "WAN7", role: "wan", isUplink: true },
      { index: 8, name: "WAN8", role: "wan", isUplink: true },
      { index: 9, name: "LAN1", role: "lan" },
      { index: 10, name: "LAN2", role: "lan" },
      { index: 11, name: "LAN3", role: "lan" },
      { index: 12, name: "LAN4", role: "lan" },
      { index: 13, name: "LAN5", role: "lan" },
      { index: 14, name: "LAN6", role: "lan" },
      { index: 15, name: "LAN7", role: "lan" },
      { index: 16, name: "LAN8", role: "lan" },
      { index: 17, name: "SFP+1", role: "uplink", isUplink: true },
      { index: 18, name: "SFP+2", role: "uplink", isUplink: true },
    ],
    webLogin: { ...ROUTER_DEFAULT_WEB_LOGIN },
  },
  "max-br1-pro": {
    sku: "MAX-BR1-PRO-5G",
    name: "MAX BR1 Pro 5G",
    series: "MAX BR1 Pro",
    vendor: "peplink",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "Desktop",
    layout: "cellular-router",
    aliases: [
      "MAX BR1 PRO", "MAX BR1 PRO 5G", "MAX-BR1-PRO", "MAXBR1PRO",
      "BR1 PRO", "BR1 PRO 5G", "PEPLINK MAX BR1",
    ],
    portSlots: [
      { index: 1, name: "WAN", role: "wan", isUplink: true },
      { index: 2, name: "Cellular", role: "cellular" },
      { index: 3, name: "LAN", role: "lan" },
      { index: 4, name: "LAN2", role: "lan" },
    ],
    webLogin: { ...ROUTER_DEFAULT_WEB_LOGIN },
  },
  "max-br2-pro": {
    sku: "MAX-BR2-PRO-5G",
    name: "MAX BR2 Pro 5G",
    series: "MAX BR2 Pro",
    vendor: "peplink",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "Desktop",
    layout: "dual-wan-cellular",
    aliases: [
      "MAX BR2 PRO", "MAX BR2 PRO 5G", "MAX-BR2-PRO", "MAXBR2PRO",
      "BR2 PRO", "BR2 PRO 5G", "PEPLINK MAX BR2",
    ],
    portSlots: [
      { index: 1, name: "WAN1", role: "wan", isUplink: true },
      { index: 2, name: "WAN2", role: "wan", isUplink: true },
      { index: 3, name: "Cellular", role: "cellular" },
      { index: 4, name: "LAN", role: "lan" },
      { index: 5, name: "LAN2", role: "lan" },
    ],
    webLogin: { ...ROUTER_DEFAULT_WEB_LOGIN },
  },

  // ── Cisco WAN Routers ────────────────────────────────────────
  "cisco-isr-1100": {
    sku: "ISR-1100",
    name: "Cisco ISR 1100",
    series: "ISR 1100 Series",
    vendor: "cisco",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "Desktop",
    layout: "wan-router",
    aliases: ["ISR1100", "ISR 1100", "CISCO ISR 1100", "C1111"],
    portSlots: [
      { index: 1, name: "GigabitEthernet0/0/0", role: "wan", isUplink: true },
      { index: 2, name: "GigabitEthernet0/0/1", role: "wan", isUplink: true },
      { index: 3, name: "GigabitEthernet0/0/2", role: "wan", isUplink: true },
      { index: 4, name: "GigabitEthernet0/1/0", role: "lan" },
      { index: 5, name: "GigabitEthernet0/1/1", role: "lan" },
      { index: 6, name: "GigabitEthernet0/1/2", role: "lan" },
      { index: 7, name: "GigabitEthernet0/1/3", role: "lan" },
    ],
    webLogin: { username: "cisco", password: "cisco", loginUrlPath: "/" },
  },
  "cisco-isr-4300": {
    sku: "ISR-4321",
    name: "Cisco ISR 4321",
    series: "ISR 4300 Series",
    vendor: "cisco",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "1U rack",
    layout: "wan-router",
    aliases: ["ISR4321", "ISR 4321", "CISCO ISR 4321", "4321"],
    portSlots: [
      { index: 1, name: "GigabitEthernet0/0/0", role: "wan", isUplink: true },
      { index: 2, name: "GigabitEthernet0/0/1", role: "wan", isUplink: true },
      { index: 3, name: "GigabitEthernet0/0/2", role: "wan", isUplink: true },
      { index: 4, name: "GigabitEthernet0/1/0", role: "lan" },
      { index: 5, name: "GigabitEthernet0/1/1", role: "lan" },
      { index: 6, name: "GigabitEthernet0/1/2", role: "lan" },
      { index: 7, name: "GigabitEthernet0/1/3", role: "lan" },
    ],
    webLogin: { username: "cisco", password: "cisco", loginUrlPath: "/" },
  },
  "cisco-asr-1000": {
    sku: "ASR-1001",
    name: "Cisco ASR 1001",
    series: "ASR 1000 Series",
    vendor: "cisco",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "1U rack",
    layout: "wan-router",
    aliases: ["ASR1001", "ASR 1001", "CISCO ASR 1001", "ASR-1001"],
    portSlots: [
      { index: 1, name: "GigabitEthernet0/0/0", role: "wan", isUplink: true },
      { index: 2, name: "GigabitEthernet0/0/1", role: "wan", isUplink: true },
      { index: 3, name: "TenGigEthernet0/1/0", role: "wan", isUplink: true },
      { index: 4, name: "TenGigEthernet0/1/1", role: "wan", isUplink: true },
      { index: 5, name: "GigabitEthernet0/2/0", role: "lan" },
      { index: 6, name: "GigabitEthernet0/2/1", role: "lan" },
      { index: 7, name: "GigabitEthernet0/2/2", role: "lan" },
      { index: 8, name: "GigabitEthernet0/2/3", role: "lan" },
    ],
    webLogin: { username: "cisco", password: "cisco", loginUrlPath: "/" },
  },
  "cisco-catalyst-8200": {
    sku: "C8200-1N-4T",
    name: "Cisco Catalyst 8200",
    series: "Catalyst 8200 Series",
    vendor: "cisco",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "1U rack",
    layout: "wan-router",
    aliases: ["C8200", "C8200-1N-4T", "CATALYST 8200", "CISCO CATALYST 8200"],
    portSlots: [
      { index: 1, name: "GigabitEthernet0/0/0", role: "wan", isUplink: true },
      { index: 2, name: "GigabitEthernet0/0/1", role: "wan", isUplink: true },
      { index: 3, name: "GigabitEthernet0/0/2", role: "wan", isUplink: true },
      { index: 4, name: "GigabitEthernet0/0/3", role: "wan", isUplink: true },
      { index: 5, name: "TenGigEthernet0/1/0", role: "uplink", isUplink: true },
      { index: 6, name: "TenGigEthernet0/1/1", role: "uplink", isUplink: true },
      { index: 7, name: "GigabitEthernet0/2/0", role: "lan" },
      { index: 8, name: "GigabitEthernet0/2/1", role: "lan" },
    ],
    webLogin: { username: "cisco", password: "cisco", loginUrlPath: "/" },
  },

  // ── Fortinet FortiGate ───────────────────────────────────────
  "fortigate-100f": {
    sku: "FG-100F",
    name: "FortiGate 100F",
    series: "FortiGate 100F Series",
    vendor: "fortinet",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "1U rack",
    layout: "wan-router",
    aliases: ["FG-100F", "FG100F", "FORTIGATE 100F", "FORTINET FG-100F"],
    portSlots: [
      { index: 1, name: "wan1", role: "wan", isUplink: true },
      { index: 2, name: "wan2", role: "wan", isUplink: true },
      { index: 3, name: "dmz", role: "lan" },
      { index: 4, name: "internal1", role: "lan" },
      { index: 5, name: "internal2", role: "lan" },
      { index: 6, name: "internal3", role: "lan" },
      { index: 7, name: "internal4", role: "lan" },
      { index: 8, name: "internal5", role: "lan" },
      { index: 9, name: "internal6", role: "lan" },
      { index: 10, name: "internal7", role: "lan" },
      { index: 11, name: "internal8", role: "lan" },
    ],
    webLogin: { username: "admin", password: "", loginUrlPath: "/" },
  },
  "fortigate-60f": {
    sku: "FG-60F",
    name: "FortiGate 60F",
    series: "FortiGate 60F Series",
    vendor: "fortinet",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "Desktop",
    layout: "wan-router",
    aliases: ["FG-60F", "FG60F", "FORTIGATE 60F", "FORTINET FG-60F"],
    portSlots: [
      { index: 1, name: "wan1", role: "wan", isUplink: true },
      { index: 2, name: "wan2", role: "wan", isUplink: true },
      { index: 3, name: "internal1", role: "lan" },
      { index: 4, name: "internal2", role: "lan" },
      { index: 5, name: "internal3", role: "lan" },
      { index: 6, name: "internal4", role: "lan" },
    ],
    webLogin: { username: "admin", password: "", loginUrlPath: "/" },
  },
};

function normKey(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchRouterDevice(equipment) {
  if (!equipment) return null;
  const blob = `${equipment.vendor || ""} ${equipment.make || ""} ${equipment.model || ""} ${equipment.name || ""}`;
  const key = normKey(blob);

  for (const entry of Object.values(ROUTER_DEVICES)) {
    if (entry.aliases.some((a) => key.includes(normKey(a)) || normKey(a).includes(key))) {
      return entry;
    }
    if (key.includes(normKey(entry.sku)) || key.includes(normKey(entry.name))) {
      return entry;
    }
  }

  const ulc = blob.toUpperCase();
  for (const entry of Object.values(ROUTER_DEVICES)) {
    if (entry.vendor === "peplink" && /PEPLINK.*BALANCE.*2500/.test(ulc)) return entry;
    if (entry.vendor === "peplink" && /PEPLINK.*BR1/.test(ulc)) return entry;
    if (entry.vendor === "peplink" && /PEPLINK.*BR2/.test(ulc)) return entry;
    if (entry.vendor === "cisco" && /CISCO.*ISR.*1100/.test(ulc)) return ROUTER_DEVICES["cisco-isr-1100"];
    if (entry.vendor === "cisco" && /CISCO.*ISR.*4300/.test(ulc)) return ROUTER_DEVICES["cisco-isr-4300"];
    if (entry.vendor === "cisco" && /CISCO.*ASR.*1000/.test(ulc)) return ROUTER_DEVICES["cisco-asr-1000"];
    if (entry.vendor === "cisco" && /CISCO.*CATALYST.*8200/.test(ulc)) return ROUTER_DEVICES["cisco-catalyst-8200"];
    if (entry.vendor === "fortinet" && /FORTINET.*100F/.test(ulc)) return ROUTER_DEVICES["fortigate-100f"];
    if (entry.vendor === "fortinet" && /FORTINET.*60F/.test(ulc)) return ROUTER_DEVICES["fortigate-60f"];
  }

  return null;
}

export function routerCatalogToChassisSpec(entry, displayModel) {
  if (!entry) return null;
  const slots = entry.portSlots || [];
  return {
    model: displayModel || entry.name,
    series: entry.series,
    vendor: entry.vendor,
    sku: entry.sku,
    copperPorts: slots.filter((s) => s.role === "lan").length,
    uplinkPorts: slots.filter((s) => s.isUplink || s.role === "wan" || s.role === "cellular").length,
    portCount: slots.length,
    poe: false,
    layout: entry.layout,
    portSlots: slots,
    label: `${entry.series} · ${entry.formFactor || "router"} · ${slots.length} interfaces`,
    routerMeta: {
      routerThroughputGbps: entry.routerThroughputGbps,
      speedFusionVpnGbps: entry.speedFusionVpnGbps,
    },
  };
}

export function getRouterDefaultLogin(entry) {
  return entry?.webLogin || ROUTER_DEFAULT_WEB_LOGIN;
}
