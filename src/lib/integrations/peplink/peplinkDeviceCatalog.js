/**
 * Peplink device catalog — specs from Peplink datasheets (Balance 2500 EC, MAX BR1/BR2 Pro).
 * @see https://www.peplink.com/products/enterprise-routers/balance-2500-ec/
 * @see https://www.peplink.com/products/mobile-routers/max-br1-pro-5g/
 * @see https://www.peplink.com/products/mobile-routers/max-br2-pro/
 */

/** Factory / typical first-login (user sets password on first boot). */
export const PEPLINK_DEFAULT_WEB_LOGIN = {
  username: "admin",
  password: "",
  loginUrlPath: "/",
  notes: "Peplink default: username admin, blank password until first login wizard completes.",
};

export const PEPLINK_DEVICES = {
  "balance-2500-ec": {
    sku: "BPL-2500-EC",
    name: "Balance 2500 EC",
    series: "Balance 2500 EC",
    vendor: "Peplink",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "1U rack",
    routerThroughputGbps: 30,
    speedFusionVpnGbps: 10,
    defaultWanPorts: 8,
    defaultLanPorts: 8,
    defaultSfpPlus: 4,
    layout: "wan-router",
    aliases: [
      "BPL-2500-EC",
      "BPL2500EC",
      "BALANCE 2500 EC",
      "BALANCE2500EC",
      "PEPLINK BALANCE 2500 EC",
      "BALANCE 2500",
      "2500 EC",
      "2500-EC",
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
    webLogin: { ...PEPLINK_DEFAULT_WEB_LOGIN },
  },
  "max-br1-pro": {
    sku: "MAX-BR1-PRO-5G",
    name: "MAX BR1 Pro 5G",
    series: "MAX BR1 Pro",
    vendor: "Peplink",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "Desktop",
    layout: "cellular-router",
    aliases: [
      "MAX BR1 PRO",
      "MAX BR1 PRO 5G",
      "MAX-BR1-PRO",
      "MAXBR1PRO",
      "BR1 PRO",
      "BR1 PRO 5G",
      "PEPLINK MAX BR1",
    ],
    portSlots: [
      { index: 1, name: "WAN", role: "wan", isUplink: true },
      { index: 2, name: "Cellular", role: "cellular" },
      { index: 3, name: "LAN", role: "lan" },
      { index: 4, name: "LAN2", role: "lan" },
    ],
    webLogin: { ...PEPLINK_DEFAULT_WEB_LOGIN },
  },
  "max-br2-pro": {
    sku: "MAX-BR2-PRO-5G",
    name: "MAX BR2 Pro 5G",
    series: "MAX BR2 Pro",
    vendor: "Peplink",
    category: "Network",
    deviceRole: "wan_router",
    formFactor: "Desktop",
    layout: "dual-wan-cellular",
    aliases: [
      "MAX BR2 PRO",
      "MAX BR2 PRO 5G",
      "MAX-BR2-PRO",
      "MAXBR2PRO",
      "BR2 PRO",
      "BR2 PRO 5G",
      "PEPLINK MAX BR2",
    ],
    portSlots: [
      { index: 1, name: "WAN1", role: "wan", isUplink: true },
      { index: 2, name: "WAN2", role: "wan", isUplink: true },
      { index: 3, name: "Cellular", role: "cellular" },
      { index: 4, name: "LAN", role: "lan" },
      { index: 5, name: "LAN2", role: "lan" },
    ],
    webLogin: { ...PEPLINK_DEFAULT_WEB_LOGIN },
  },
};

function normKey(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Match equipment name/model/make to a Peplink catalog entry. */
export function matchPeplinkDevice(equipment) {
  if (!equipment) return null;
  const blob = `${equipment.vendor || ""} ${equipment.make || ""} ${equipment.model || ""} ${equipment.name || ""}`;
  const key = normKey(blob);

  for (const entry of Object.values(PEPLINK_DEVICES)) {
    if (entry.aliases.some((a) => key.includes(normKey(a)) || normKey(a).includes(key))) {
      return entry;
    }
    if (key.includes(normKey(entry.sku)) || key.includes(normKey(entry.name))) {
      return entry;
    }
  }

  if (/PEPLINK/i.test(blob) && /BALANCE/i.test(blob) && /2500/i.test(blob)) {
    return PEPLINK_DEVICES["balance-2500-ec"];
  }
  if (/PEPLINK/i.test(blob) && /BR1/i.test(blob)) {
    return PEPLINK_DEVICES["max-br1-pro"];
  }
  if (/PEPLINK/i.test(blob) && /BR2/i.test(blob)) {
    return PEPLINK_DEVICES["max-br2-pro"];
  }
  if (/BALANCE/i.test(blob) && /2500/i.test(blob)) {
    return PEPLINK_DEVICES["balance-2500-ec"];
  }

  return null;
}

export function peplinkCatalogToChassisSpec(entry, displayModel) {
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
    peplinkMeta: {
      routerThroughputGbps: entry.routerThroughputGbps,
      speedFusionVpnGbps: entry.speedFusionVpnGbps,
    },
  };
}

export function getPeplinkDefaultLogin(entry) {
  return entry?.webLogin || PEPLINK_DEFAULT_WEB_LOGIN;
}
