import { DEFAULT_FLOOR_MAP, SHEET_GROUPS } from "./schemas.js";
import { stripVesselEquipmentName } from "./equipmentName.js";

const SYSTEM_TO_CATEGORY = {
  IT: "Network",
  ANT: "Network",
  AV: "AV",
  SEC: "Camera",
  CCTV: "Camera",
  TEL: "Network",
  HVAC: "Other",
  LUT: "Lighting",
};

export function floorToDeckName(floor, floorMap = DEFAULT_FLOOR_MAP) {
  const code = String(floor || "").trim().toUpperCase();
  if (!code) return "";
  return floorMap[code] || code;
}

export function buildLocation(floor, room, floorMap) {
  const deck = floorToDeckName(floor, floorMap);
  const roomStr = room != null && room !== "" ? String(room).trim() : "";
  if (deck && roomStr) return `${deck} · Room ${roomStr}`;
  if (deck) return deck;
  if (roomStr) return `Room ${roomStr}`;
  return "";
}

export function mapSystemToCategory(system, type) {
  const sys = String(system || "").trim().toUpperCase();
  const t = String(type || "").toLowerCase();
  if (SYSTEM_TO_CATEGORY[sys]) return SYSTEM_TO_CATEGORY[sys];
  if (t.includes("camera") || t.includes("cctv")) return "Camera";
  if (t.includes("access point") || t.includes("switch") || t.includes("router") || t.includes("firewall")) return "Network";
  if (t.includes("display") || t.includes("matrix") || t.includes("encoder") || t.includes("dsp")) return "AV";
  if (t.includes("ups") || t.includes("pdu") || t.includes("power")) return "Power";
  if (t.includes("light")) return "Lighting";
  if (t.includes("server") || t.includes("nas") || t.includes("pbx")) return "Server";
  return "Other";
}

function baseEquipment(fields) {
  const name = fields.name != null ? stripVesselEquipmentName(fields.name) : "";
  return {
    name,
    model: "",
    category: "Other",
    ip: "",
    mac: "",
    location: "",
    floor: "",
    room: "",
    systemCategory: "",
    portLabel: "",
    poeWatts: null,
    serial: "",
    firmware: "",
    notes: "",
    condition: "Good",
    status: "unknown",
    inventoryOnly: true,
    waveguardClassification: "inventory",
    importSource: null,
    ...fields,
    name,
  };
}

export function endpointToEquipment(row, floorMap) {
  return baseEquipment({
    name: row.endDevice,
    model: row.type || "",
    category: mapSystemToCategory(row.system, row.type),
    mac: row.mac || "",
    location: buildLocation(row.floor, row.room, floorMap),
    floor: row.floor || "",
    room: row.room != null ? String(row.room) : "",
    systemCategory: row.system || "",
    portLabel: row.endDevicePort || "",
    poeWatts: row.poeW ? parseFloat(row.poeW) || null : null,
    serial: row.serial || "",
    notes: row.notes || "",
    importSource: { sheet: row.sheet, row: row.row },
  });
}

export function chassisToEquipment(row, floorMap) {
  return baseEquipment({
    name: row.hostname,
    model: row.model || "",
    category: "Network",
    ip: row.managementIp || "",
    mac: row.mac || "",
    location: row.location || buildLocation("", "", floorMap),
    serial: row.serial || "",
    firmware: row.firmware || "",
    notes: row.notes || "",
    systemCategory: "IT",
    importSource: { sheet: row.sheet, row: row.row },
  });
}

export function applianceToEquipment(row) {
  return baseEquipment({
    name: row.hostname,
    model: row.model || "",
    category: mapSystemToCategory("", row.model),
    ip: row.managementIp || "",
    mac: row.mac || "",
    location: row.location || "",
    serial: row.serial || "",
    firmware: row.firmware || "",
    notes: row.notes || "",
    systemCategory: "IT",
    importSource: { sheet: row.sheet, row: row.row },
  });
}

export function patchToCable(row, floorMap) {
  const panel = stripVesselEquipmentName(row.patchPanel || "");
  const endDevice = stripVesselEquipmentName(row.endDevice || "");
  const label = row.cableNo || `${panel || row.patchPanel}-P${row.port}`;
  const fromEq = panel ? `${panel} P${row.port}` : row.patchPanel ? `${row.patchPanel} P${row.port}` : "";
  const notes = [row.notes, row.testedLength].filter(Boolean).join("; ");
  return {
    label,
    type: row.type || "",
    system_category: row.system || "",
    from_equipment: fromEq,
    to_equipment: endDevice,
    length: "",
    deck: floorToDeckName(row.floor, floorMap) || row.floor || "",
    status: "installed",
    notes,
    importSource: { sheet: row.sheet, row: row.row },
  };
}

export function switchPortToCable(row) {
  const switchName = stripVesselEquipmentName(row.switchHostname || "");
  const toEq = stripVesselEquipmentName(row.endDevice || row.patchPanel || "");
  if (!toEq) return null;
  const fromEq = `${switchName} ${row.interface}`.trim();
  return {
    label: `${switchName}-${row.interface}`,
    type: "Patch",
    system_category: "Network",
    from_equipment: fromEq,
    to_equipment: toEq,
    length: "",
    deck: "",
    status: "installed",
    notes: row.vlan ? `VLAN ${row.vlan}` : (row.notes || ""),
    importSource: { sheet: row.sheet, row: row.row },
  };
}

export function collectSiteLocations(equipmentList, floorMap) {
  const deckMap = new Map();
  for (const eq of equipmentList) {
    const floor = eq.floor;
    const room = eq.room;
    if (!floor) continue;
    const deckName = floorToDeckName(floor, floorMap);
    if (!deckMap.has(deckName)) {
      deckMap.set(deckName, new Set());
    }
    if (room) deckMap.get(deckName).add(String(room));
  }
  const decks = [];
  for (const [name, rooms] of deckMap) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    decks.push({
      id: `deck-import-${slug}`,
      name,
      rooms: [...rooms].map((r) => ({
        id: `room-import-${slug}-${r}`,
        name: `Room ${r}`,
      })),
    });
  }
  return { decks };
}

export function vlansToDiscoverySubnets(vlans) {
  const subnets = [];
  const seen = new Set();
  for (const v of vlans || []) {
    const range = v.ipRange || "";
    const match = range.match(/(\d+\.\d+\.\d+\.\d+)\s*[-–]\s*(\d+\.\d+\.\d+\.\d+)/);
    if (match) {
      const base = match[1].split(".").slice(0, 3).join(".");
      const cidr = `${base}.0/24`;
      if (seen.has(cidr)) continue;
      seen.add(cidr);
      subnets.push({
        cidr,
        label: v.vlan || range,
        enabled: true,
      });
    }
  }
  return subnets;
}

export function racksToLayout(sheets) {
  const racks = [];
  const placements = {};
  for (const s of sheets) {
    if (s.sheetType !== SHEET_GROUPS.rack || !s.placements?.length) continue;
    const rackId = `rack-${s.sheetName.replace(/\s+/g, "-").toLowerCase()}`;
    racks.push({ id: rackId, name: s.sheetName, units: 42 });
    for (const p of s.placements) {
      if (!p.equipment) continue;
      placements[`${rackId}-${p.uPosition}`] = {
        rackId,
        u: parseInt(p.uPosition, 10) || 0,
        label: stripVesselEquipmentName(p.equipment),
      };
    }
  }
  if (!racks.length) return null;
  return {
    name: "Imported vessel racks",
    is_default: false,
    racks,
    placements,
  };
}
