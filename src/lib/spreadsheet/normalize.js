import { DEFAULT_FLOOR_MAP, SHEET_GROUPS } from "./schemas.js";
import { stripVesselEquipmentName } from "./equipmentName.js";
import { extractExtraFieldsFromObject } from "./headerMapping.js";
import {
  extractCableTagFromText,
  normalizeCableTag,
} from "./cableTag.js";

function appendNote(existing, addition) {
  if (!addition) return existing || "";
  if (!existing) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing} | ${addition}`;
}

function mergeExtrasIntoEquipment(eq, rawObj, consumedKeys = []) {
  if (!rawObj) return eq;
  const extras = extractExtraFieldsFromObject(rawObj, new Set(consumedKeys || []));
  const { _extraNotes, ...recognized } = extras;
  const merged = { ...eq };
  for (const [field, val] of Object.entries(recognized)) {
    if (val == null || val === "") continue;
    if (merged[field] == null || merged[field] === "") {
      merged[field] = val;
    }
  }
  if (_extraNotes) {
    merged.notes = appendNote(merged.notes, _extraNotes);
  }
  return merged;
}

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
  if (t.includes("router") || t.includes("gateway") || t.includes("firewall")) return "Router";
  if (t.includes("access point") || t.includes("switch")) return "Network";
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
  const base = baseEquipment({
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
  return mergeExtrasIntoEquipment(base, row.rawObj, row.consumedKeys);
}

export function chassisToEquipment(row, floorMap) {
  const base = baseEquipment({
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
  return mergeExtrasIntoEquipment(base, row.rawObj, row.consumedKeys);
}

export function applianceToEquipment(row) {
  const base = baseEquipment({
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
  return mergeExtrasIntoEquipment(base, row.rawObj, row.consumedKeys);
}

export function genericRowToEquipment(row, floorMap) {
  if (!row?.name) return null;
  const floor = row.floor || "";
  const room = row.room != null && row.room !== "" ? String(row.room) : "";
  const location = row.location || buildLocation(floor, room, floorMap);
  return baseEquipment({
    name: row.name,
    make: row.make || "",
    model: row.model || "",
    category: row.category || mapSystemToCategory(row.category, row.model),
    ip: row.ip || "",
    mac: row.mac || "",
    location,
    floor,
    room,
    systemCategory: row.category || "",
    portLabel: row.portLabel || "",
    poeWatts:
      row.poeWatts != null
        ? typeof row.poeWatts === "number"
          ? row.poeWatts
          : parseFloat(row.poeWatts) || null
        : null,
    serial: row.serial || "",
    firmware: row.firmware || "",
    condition: row.condition || "Good",
    status: row.status || "unknown",
    notes: row.notes || "",
    importSource: { sheet: row.sheet, row: row.row },
  });
}

export function inferRackNameFromPanel(panelName) {
  const name = String(panelName || "").trim();
  if (!name) return "Unassigned";
  const match = name.match(/^(.+?)-(?:PP|pp)\d+/i);
  if (match) return match[1].trim();
  const parts = name.split("-");
  if (parts.length >= 2) return parts.slice(0, -1).join("-");
  return name;
}

export function inferPortCountFromModel(modelOrType = "") {
  const text = String(modelOrType || "");
  const match = text.match(/(\d+)\s*[pP]/);
  if (match) return parseInt(match[1], 10) || 24;
  if (/48/i.test(text)) return 48;
  if (/24/i.test(text)) return 24;
  return 24;
}

export function parseTestedLength(value) {
  const raw = String(value || "").trim();
  if (!raw) return { length: "", test_result: "not_tested" };

  const lower = raw.toLowerCase();
  let test_result = "not_tested";
  if (/\bfail(ed)?\b/.test(lower)) test_result = "fail";
  else if (/\bpass(ed)?\b/.test(lower)) test_result = "pass";
  else if (/\bpending\b/.test(lower)) test_result = "pending";

  const lengthMatch = raw.match(/(\d+(?:\.\d+)?)\s*m?\b/i);
  const length = lengthMatch ? lengthMatch[1] : raw.replace(/\b(pass|fail|passed|failed|pending)\b/gi, "").trim();

  return { length, test_result };
}

export function resolvePatchDeck(row, floorMap) {
  const deck = String(row.deck || "").trim();
  if (deck) {
    const mapped = floorToDeckName(deck, floorMap);
    return mapped || deck;
  }
  const floor = String(row.floor || "").trim();
  if (!floor) return "";
  return floorToDeckName(floor, floorMap) || floor;
}

const PATCH_RAW_CONSUMED = new Set([
  "patch panel",
  "patch_panel",
  "port",
  "cable no.",
  "cable no",
  "cable_no",
  "net",
  "type",
  "system",
  "code",
  "deck",
  "floor",
  "destination",
  "location",
  "end device",
  "end device sw",
  "device",
  "notes",
]);

function resolveCableLabel(row, panel, portNum) {
  const direct = String(row.cableNo || row.cable_no || "").trim();
  if (direct) return normalizeCableTag(direct);

  for (const val of Object.values(row.rawObj || {})) {
    const tag = extractCableTagFromText(val);
    if (tag) return tag;
  }

  for (const key of ["notes", "testedLength", "location", "destination", "endDevice"]) {
    const tag = extractCableTagFromText(row[key]);
    if (tag) return tag;
  }

  // Fallback used by vessel schedules: every panel/port row is importable even
  // when the cable tag column is blank (spare / untagged ports).
  if (panel && portNum) return `${panel}-P${portNum}`;
  return "";
}

function finalizePatchCableFields(base, row, panel, portNum, floorMap) {
  const destination = String(
    row.location || row.destination || row.endDevice || base.location || ""
  ).trim();

  if (!base.location && base.room && !/^\d+$/.test(String(base.room).trim())) {
    base.location = String(base.room).trim();
    base.room = "";
  }
  if (!base.location && destination) base.location = destination;

  if (!base.to_equipment) {
    base.to_equipment = stripVesselEquipmentName(row.endDevice || destination || "");
  }

  if (!base.deck) {
    base.deck = resolvePatchDeck(row, floorMap);
  }

  if (!base.label && panel && portNum) {
    base.label = `${panel}-P${portNum}`;
  }

  return base;
}

export function patchPanelToEquipment(row, floorMap) {
  const panelName = stripVesselEquipmentName(row.patchPanel || "");
  if (!panelName) return null;
  const deck = resolvePatchDeck(row, floorMap);
  return baseEquipment({
    name: panelName,
    model: row.type || "",
    category: mapSystemToCategory(row.system, row.type),
    location: row.location || buildLocation(row.floor || row.deck, row.room, floorMap),
    floor: row.floor || row.deck || "",
    room: row.room != null ? String(row.room) : "",
    systemCategory: row.system || "",
    notes: row.notes || "",
    inventoryOnly: true,
    waveguardClassification: "inventory",
    equipment_subtype: "patch_panel",
    rack_name: inferRackNameFromPanel(panelName),
    port_count: inferPortCountFromModel(row.type),
    deck,
    importSource: { sheet: row.sheet, row: row.row },
  });
}

export function patchToCable(row, floorMap) {
  const panel = stripVesselEquipmentName(row.patchPanel || "");
  const portNum = row.port != null && row.port !== "" ? String(row.port).trim() : "";
  const label = resolveCableLabel(row, panel, portNum);
  const fromEq = panel && portNum ? `${panel} P${portNum}` : "";
  const { length, test_result } = parseTestedLength(row.testedLength);
  const deck = resolvePatchDeck(row, floorMap);
  const destination = String(row.location || row.destination || "").trim();
  const endDevice = stripVesselEquipmentName(row.endDevice || destination || "");
  const base = {
    label,
    type: row.type || "",
    system_category: row.system || "",
    from_equipment: fromEq,
    to_equipment: endDevice,
    length,
    deck,
    room: row.room != null ? String(row.room) : "",
    location: destination || endDevice,
    status: "installed",
    notes: row.notes || "",
    patch_panel: panel || row.patchPanel || "",
    port: portNum,
    end_device_port: row.endDevicePort || "",
    test_result,
    last_tested_at: null,
    schedule_source: "vessel_import",
    importSource: { sheet: row.sheet, row: row.row },
  };
  const consumed = new Set([...(row.consumedKeys || []), ...PATCH_RAW_CONSUMED]);
  const extras = extractExtraFieldsFromObject(row.rawObj, consumed);
  const { _extraNotes, ...recognized } = extras;
  for (const [field, val] of Object.entries(recognized)) {
    if (val == null || val === "") continue;
    if (base[field] == null || base[field] === "") base[field] = val;
  }
  if (_extraNotes) base.notes = appendNote(base.notes, _extraNotes);
  return finalizePatchCableFields(base, row, panel, portNum, floorMap);
}

export function patchEndpointToEquipment(row, floorMap) {
  const name = stripVesselEquipmentName(row.endDevice || "");
  if (!name) return null;
  const base = baseEquipment({
    name,
    model: row.type || "",
    category: mapSystemToCategory(row.system, row.type),
    location: row.location || buildLocation(row.floor, row.room, floorMap),
    floor: row.floor || "",
    room: row.room != null ? String(row.room) : "",
    systemCategory: row.system || "",
    portLabel: row.endDevicePort || "",
    notes: appendNote(row.notes, row.testedLength ? `Length: ${row.testedLength}` : ""),
    importSource: { sheet: row.sheet, row: row.row },
  });
  return mergeExtrasIntoEquipment(base, row.rawObj, row.consumedKeys);
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

function maskToPrefix(mask) {
  const s = String(mask || "").trim();
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 8 && n <= 32 ? n : 24;
  }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return 24;
  const bits = s
    .split(".")
    .map((o) => Number(o))
    .reduce((acc, octet) => {
      let n = octet;
      let count = 0;
      for (let i = 0; i < 8; i++) {
        if (n & 0x80) count++;
        n <<= 1;
      }
      return acc + count;
    }, 0);
  return bits >= 8 && bits <= 32 ? bits : 24;
}

function ipv4ToCidr(ip, mask = "255.255.255.0") {
  const s = String(ip || "").trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return null;
  const parts = s.split(".").map(Number);
  if (parts.some((n) => n < 0 || n > 255)) return null;
  const prefix = maskToPrefix(mask);
  // For /24 vessel schemes (Albatros), keep the familiar .0/24 form.
  if (prefix === 24) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}/${prefix}`;
}

export function vlansToDiscoverySubnets(vlans) {
  const subnets = [];
  const seen = new Set();
  for (const v of vlans || []) {
    const range = v.ipRange || "";
    const match = range.match(/(\d+\.\d+\.\d+\.\d+)\s*[-–]\s*(\d+\.\d+\.\d+\.\d+)/);
    const startIp = match?.[1] || (v.gateway && String(v.gateway).trim()) || "";
    const cidr = ipv4ToCidr(startIp, v.mask);
    if (!cidr || seen.has(cidr)) continue;
    seen.add(cidr);
    subnets.push({
      cidr,
      label: v.vlan || range || cidr,
      gateway: v.gateway || "",
      enabled: true,
      source: "ipScheme",
    });
  }
  return subnets;
}

/** Derive /24 discovery targets from imported IT / management IPs. */
export function equipmentToDiscoverySubnets(equipmentList = []) {
  const subnets = [];
  const seen = new Set();
  for (const eq of equipmentList) {
    const ip = String(eq.ip || "").trim();
    const cidr = ipv4ToCidr(ip);
    if (!cidr || seen.has(cidr)) continue;
    seen.add(cidr);
    const isIt =
      /^(IT|Network)$/i.test(eq.systemCategory || "") ||
      /network|router|switch|server|firewall|wlc|wireless/i.test(
        `${eq.category || ""} ${eq.name || ""} ${eq.model || ""}`
      );
    subnets.push({
      cidr,
      label: isIt
        ? `IT · ${eq.name || cidr}`
        : eq.name
          ? `${eq.name}`
          : cidr,
      enabled: true,
      source: "equipment",
    });
  }
  return subnets;
}

export function mergeDiscoverySubnetLists(...lists) {
  const byCidr = new Map();
  for (const list of lists) {
    for (const entry of list || []) {
      const cidr =
        typeof entry === "string"
          ? entry.trim()
          : String(entry?.cidr || "").trim();
      if (!cidr) continue;
      const prev = byCidr.get(cidr);
      if (!prev) {
        byCidr.set(cidr, {
          cidr,
          label: typeof entry === "object" ? entry.label || cidr : cidr,
          gateway: typeof entry === "object" ? entry.gateway || "" : "",
          enabled: typeof entry === "object" ? entry.enabled !== false : true,
          source: typeof entry === "object" ? entry.source || "import" : "import",
        });
        continue;
      }
      // Prefer IP Scheme labels over equipment-derived ones.
      if (prev.source !== "ipScheme" && entry?.source === "ipScheme") {
        byCidr.set(cidr, {
          ...prev,
          ...entry,
          cidr,
          label: entry.label || prev.label,
        });
      } else if (!prev.label || prev.label === cidr) {
        prev.label = entry?.label || prev.label;
      }
      if (!prev.gateway && entry?.gateway) prev.gateway = entry.gateway;
    }
  }
  return [...byCidr.values()];
}

export function normalizeDiscoveryKnownHosts(hosts = []) {
  const byIp = new Map();
  for (const h of hosts || []) {
    const ip = String(h.ip || "").trim();
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) continue;
    if (ip.split(".").some((o) => Number(o) > 255)) continue;
    if (byIp.has(ip)) continue;
    byIp.set(ip, {
      ip,
      name: String(h.name || ip).trim(),
      vlan: String(h.vlan || "").trim(),
      source: h.source || "import",
    });
  }
  return [...byIp.values()];
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
