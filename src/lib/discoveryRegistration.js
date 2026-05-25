import { base44 } from "@/api/base44Client";
import {
  formatLocationLabel,
  findLocationIds,
  loadSiteLocationsLocal,
  normalizeSiteLocations,
  DEFAULT_SITE_LOCATIONS,
} from "@/lib/siteLocations";
import { upsertEquipment, listEquipment } from "@/api/equipmentApi";

export const EQUIPMENT_CHANGED_EVENT = "waveguard-equipment-changed";

export function notifyEquipmentChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EQUIPMENT_CHANGED_EVENT));
  }
}

function loadDecks() {
  const local = loadSiteLocationsLocal();
  return normalizeSiteLocations(local || DEFAULT_SITE_LOCATIONS).decks;
}

/** Guess deck/room from hostname, vendor, or category. */
export function inferLocationText(device) {
  const blob = `${device.hostname || ""} ${device.vendor || ""} ${device.model || ""}`.toLowerCase();
  if (blob.includes("bridge")) return "Bridge · Bridge Rack";
  if (blob.includes("saloon")) return "Saloon · Saloon AV Rack";
  if (blob.includes("engine")) return "Engine Room · Engine Room";
  if (blob.includes("fore") || blob.includes("bow")) return "Fore Deck · Fore Deck";
  if (blob.includes("aft") || blob.includes("stern")) return "Aft Deck · Aft Deck";
  if (blob.includes("upper")) return "Upper Deck · Upper Deck";
  if (device.category === "Camera") return "Fore Deck · Fore Deck";
  if (device.category === "Router") return "Bridge · Bridge Rack";
  if (device.category === "Network") return "Bridge · Bridge Rack";
  if (device.category === "AV") return "Saloon · Saloon AV Rack";
  if (device.category === "Power") return "Engine Room · Engine Room";
  return "";
}

export function stableEquipmentId(ip) {
  return `eq-${String(ip || "").replace(/\./g, "-")}`;
}

export function discoveryDeviceToEquipment(device, classification, decks = loadDecks()) {
  const ip = device.ip;
  const locationText = device.location || inferLocationText(device);
  const { deckId, roomId } = findLocationIds(decks, locationText);
  const location = formatLocationLabel(decks, deckId, roomId) || locationText || "Unassigned";

  const name =
    device.hostname && device.hostname !== ip && !device.hostname.match(/^\d+\.\d+/)
      ? device.hostname
      : `${device.vendor && device.vendor !== "Unknown" ? device.vendor + " " : ""}${ip}`.trim();

  return {
    id: stableEquipmentId(ip),
    name,
    model: device.model || device.vendor || "Unknown",
    category: device.category || "Unknown",
    ip,
    mac: device.mac || "",
    location,
    deckId,
    roomId,
    serial: device.serial || "",
    condition: "Good",
    notes: device.notes || `Discovered on ${device.subnet || "network scan"}`,
    waveguardClassification: classification,
    monitoringEnabled: classification === "monitored",
    inventoryOnly: classification === "inventory",
    vendor: device.vendor || "",
    openPorts: device.openPorts || [],
    discoveryId: device.id,
    status: "online",
  };
}

/**
 * Match device groups whose name/description/icon align with deck, room, or category.
 */
export function matchMonitoringGroupIds(equipment, groups, decks = loadDecks()) {
  const matched = new Set();
  const cat = (equipment.category || "").toLowerCase();
  const deck = decks.find((d) => d.id === equipment.deckId);
  const deckName = (deck?.name || "").toLowerCase();
  const room = deck?.rooms?.find((r) => r.id === equipment.roomId);
  const roomName = (room?.name || "").toLowerCase();
  const loc = (equipment.location || "").toLowerCase();

  for (const g of groups || []) {
    const hay = `${g.name || ""} ${g.description || ""} ${g.icon || ""}`.toLowerCase();
    let hit = false;

    if (deckName && deckName.length > 2 && hay.includes(deckName)) hit = true;
    if (roomName && roomName.length > 2 && hay.includes(roomName)) hit = true;
    if (loc) {
      for (const part of loc.split("·").map((s) => s.trim()).filter(Boolean)) {
        if (part.length > 2 && hay.includes(part)) hit = true;
      }
    }

    if (cat === "camera" && (hay.includes("cctv") || hay.includes("camera"))) hit = true;
    if (cat === "router" && (hay.includes("router") || hay.includes("network") || hay.includes("wan"))) hit = true;
    if (cat === "network" && hay.includes("network")) hit = true;
    if (cat === "av" && hay.includes("av")) hit = true;
    if (cat === "power" && hay.includes("power")) hit = true;
    if (cat === "server" && hay.includes("server")) hit = true;
    if (cat === "lighting" && hay.includes("light")) hit = true;

    if (hit) matched.add(g.id);
  }

  return [...matched];
}

async function syncDeviceGroups(equipmentId, targetGroupIds, allGroups) {
  const targetSet = new Set(targetGroupIds);

  for (const group of allGroups) {
    const ids = group.device_ids || [];
    const has = ids.includes(equipmentId);
    const shouldHave = targetSet.has(group.id);

    if (shouldHave && !has) {
      await base44.entities.DeviceGroup.update(group.id, {
        device_ids: [...ids, equipmentId],
      });
    } else if (!shouldHave && has) {
      await base44.entities.DeviceGroup.update(group.id, {
        device_ids: ids.filter((id) => id !== equipmentId),
      });
    }
  }
}

/**
 * Register a discovered device as monitored or inventory across Equipment + DeviceGroups.
 */
export async function registerDiscoveredDevice(device, classification) {
  if (!device?.ip) throw new Error("Device has no IP address.");
  if (classification === "unclassified") {
    return { skipped: true };
  }

  const decks = loadDecks();
  const record = discoveryDeviceToEquipment(device, classification, decks);
  const equipment = await upsertEquipment(record);

  let groupsUpdated = [];
  if (classification === "monitored" || classification === "inventory") {
    const groups = await base44.entities.DeviceGroup.list();
    const groupIds = matchMonitoringGroupIds(equipment, groups, decks);
    await syncDeviceGroups(equipment.id, groupIds, groups);
    groupsUpdated = groupIds;
  } else if (classification === "ignored") {
    const groups = await base44.entities.DeviceGroup.list();
    await syncDeviceGroups(equipment.id, [], groups);
  }

  notifyEquipmentChanged();

  return {
    success: true,
    equipment,
    groupsUpdated,
    classification,
  };
}

export async function registerDiscoveredDevices(devices, classification) {
  const results = [];
  for (const device of devices) {
    results.push(await registerDiscoveredDevice(device, classification));
  }
  return results;
}

/** List equipment flagged for inventory or full monitoring. */
export async function listRegisteredEquipment() {
  return listEquipment();
}
