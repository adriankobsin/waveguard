/**
 * Chassis layouts for WAN routers, cellular routers, and Peplink models.
 */

import {
  matchRouterDevice,
  routerCatalogToChassisSpec,
  ROUTER_DEVICES,
} from "../integrations/routers/routerDeviceCatalog.js";
import {
  matchPeplinkDevice,
  peplinkCatalogToChassisSpec,
} from "../integrations/peplink/peplinkDeviceCatalog.js";

const LAYOUT_LABELS = {
  "wan-router": "Multi-WAN router",
  "cellular-router": "Cellular router",
  "dual-wan-cellular": "Dual WAN + cellular",
};

function normalizeModelKey(model) {
  return String(model || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function buildNetworkSpec(model, partial) {
  const slots = partial.portSlots || [];
  const portCount = slots.length;
  return {
    model: model.trim(),
    series: partial.series,
    vendor: partial.vendor,
    copperPorts: slots.filter((s) => !s.isUplink && s.role !== "cellular").length,
    uplinkPorts: slots.filter((s) => s.isUplink || s.role === "wan" || s.role === "cellular").length,
    portCount,
    poe: false,
    layout: partial.layout,
    portSlots: slots,
    label: `${partial.series} · ${LAYOUT_LABELS[partial.layout] || partial.layout}`,
  };
}

/** Resolve model string from equipment (name often has full Peplink SKU). */
export function resolveEquipmentModelString(equipment) {
  if (!equipment) return "";
  const model = String(equipment.model || "").trim();
  const name = String(equipment.name || "").trim();
  const make = String(equipment.make || equipment.vendor || "").trim();
  if (model && model.length > 3 && !/^\d{1,4}$/.test(model)) return model;
  const pep = matchPeplinkDevice(equipment);
  if (pep) return pep.name;
  if (/peplink|balance|max\s*br/i.test(name)) return name;
  return model || name || make;
}

/** Parse router model strings (model or full equipment) into a chassis spec. */
export function parseNetworkDeviceModel(modelOrEquipment) {
  const equipment =
    modelOrEquipment && typeof modelOrEquipment === "object" ? modelOrEquipment : null;
  const raw = equipment
    ? resolveEquipmentModelString(equipment)
    : String(modelOrEquipment || "").trim();
  if (!raw) return null;

  // Try router catalog first (Peplink, Cisco ISR/ASR, FortiGate, etc.)
  const routerEntry = equipment ? matchRouterDevice(equipment) : matchRouterDevice({ model: raw, name: raw });
  if (routerEntry) {
    return routerCatalogToChassisSpec(routerEntry, raw);
  }

  // Fall back to Peplink-only catalog
  const pepEntry = equipment ? matchPeplinkDevice(equipment) : matchPeplinkDevice({ model: raw, name: raw });
  if (pepEntry) {
    return peplinkCatalogToChassisSpec(pepEntry, raw);
  }

  const key = normalizeModelKey(raw);
  if (/PEPLINK|BALANCE\s*2500|BPL2500/i.test(key)) {
    const e = matchPeplinkDevice({ name: "Balance 2500 EC", model: raw });
    if (e) return peplinkCatalogToChassisSpec(e, raw);
  }
  if (/MAX\s*BR1|BR1PRO/i.test(key)) {
    const e = matchPeplinkDevice({ name: "MAX BR1 Pro", model: raw });
    if (e) return peplinkCatalogToChassisSpec(e, raw);
  }
  if (/MAX\s*BR2|BR2PRO/i.test(key)) {
    const e = matchPeplinkDevice({ name: "MAX BR2 Pro", model: raw });
    if (e) return peplinkCatalogToChassisSpec(e, raw);
  }

  // Generic router layout
  if (/\b(router|firewall|fortigate|asa|ftd|udm|dream\s*machine)\b/i.test(key)) {
    return buildNetworkSpec(raw, {
      series: "Network appliance",
      vendor: "Unknown",
      layout: "wan-router",
      portSlots: [
        { index: 1, name: "WAN1", role: "wan", isUplink: true },
        { index: 2, name: "WAN2", role: "wan", isUplink: true },
        { index: 3, name: "LAN", role: "lan" },
        { index: 4, name: "LAN2", role: "lan" },
      ],
    });
  }

  return null;
}

export function deployNetworkPortsOnChassis(polledPorts, chassis) {
  if (!chassis?.portSlots?.length) return polledPorts || [];

  const byIndex = new Map((polledPorts || []).map((p) => [Number(p.index), p]));
  const byName = new Map(
    (polledPorts || []).map((p) => [
      String(p.name || p.ifAlias || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""),
      p,
    ])
  );

  const slots = chassis.portSlots.map((slot) => {
    const existing =
      byIndex.get(slot.index) ||
      byName.get(String(slot.name).toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (existing) {
      return {
        ...existing,
        index: slot.index,
        name: existing.name || slot.name,
        slotEmpty: false,
        isUplink: slot.isUplink || slot.role === "wan",
        portRole: slot.role,
      };
    }
    return {
      index: slot.index,
      name: slot.name,
      ifAlias: "",
      status: "unknown",
      speedMbps: slot.role === "wan" || slot.role === "cellular" ? 1000 : 1000,
      speed: 1000,
      mtu: 1500,
      inMbps: 0,
      outMbps: 0,
      poeWatts: null,
      vlan: null,
      macAddr: null,
      connectedDevice: null,
      slotEmpty: true,
      isUplink: !!slot.isUplink,
      portRole: slot.role,
    };
  });

  for (const p of polledPorts || []) {
    if (!slots.find((s) => s.index === p.index)) {
      slots.push({ ...p, slotEmpty: false });
    }
  }

  return slots.sort((a, b) => a.index - b.index);
}

export { LAYOUT_LABELS as NETWORK_LAYOUT_LABELS };
