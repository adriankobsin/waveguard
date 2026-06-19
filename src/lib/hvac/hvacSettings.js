export const HVAC_HOUSE_SETTINGS_KEY = "hvac-house";
export const HVAC_ZONE_STATE_SETTINGS_KEY = "hvac-zone-state";
export const HVAC_CONNECTION_KEY = "hvac-connection";

export const HVAC_HOUSE_CHANGED_EVENT = "hvac-house-changed";
export const HVAC_ZONE_STATE_CHANGED_EVENT = "hvac-zone-state-changed";
export const HVAC_CONNECTION_CHANGED_EVENT = "hvac-connection-changed";

export const SYSTEM_TYPE_LABELS = {
  modbus: "Modbus TCP",
  coolmaster: "Coolmaster Net",
  rs485: "RS485 Bridge",
  knx: "KNX",
};

export const ZONE_KIND_LABELS = {
  temperature: "Temperature",
  setpoint: "Setpoint",
  mode: "HVAC Mode",
  onoff: "On/Off",
  fan: "Fan Speed",
  humidity: "Humidity",
};

export const HVAC_MODE_LABELS = {
  off: "Off",
  heat: "Heat",
  cool: "Cool",
  auto: "Auto",
  fanOnly: "Fan Only",
  emergency: "Emergency",
  comfort: "Comfort",
  standby: "Standby",
  night: "Night",
  frost: "Frost",
  dry: "Dry",
};

export const DEFAULT_HVAC_HOUSE = {
  zones: [],
  equipment: [],
  decks: [],
  version: 2,
};

export const DEFAULT_HVAC_CONNECTION = {
  enabled: false,
  host: "",
  port: "",
  systemType: "modbus",
  unitId: 1,
  baud: 9600,
  encoding: "ascii",
};

export function normalizeHvacHouse(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HVAC_HOUSE };
  return {
    zones: Array.isArray(raw.zones) ? raw.zones.map(normalizeHvacZone) : [],
    equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
    decks: Array.isArray(raw.decks) ? raw.decks : [],
    version: raw.version || 2,
  };
}

export function normalizeHvacZone(z) {
  if (!z) return null;
  return {
    id: z.id || `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: z.name || "Unnamed Zone",
    href: z.href || "",
    systemType: z.systemType || "modbus",
    deck: z.deck || "Main",
    area: z.area || "General",
    kind: z.kind || "temperature",
    unitId: z.unitId != null ? z.unitId : 0,
    register: z.register != null ? z.register : 0,
    groupAddr: z.groupAddr || "",
    equipmentId: z.equipmentId || "",
  };
}

export function normalizeHvacZoneState(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = {
      temperature: v?.temperature ?? null,
      setpoint: v?.setpoint ?? null,
      mode: v?.mode || "off",
      fanSpeed: v?.fanSpeed || "auto",
      on: v?.on ?? false,
      humidity: v?.humidity ?? null,
      updatedAt: v?.updatedAt || null,
    };
  }
  return out;
}

function lsKey(suffix) {
  return `waveguard:${suffix}`;
}

export function loadHvacHouseLocal() {
  try {
    const raw = localStorage.getItem(lsKey(HVAC_HOUSE_SETTINGS_KEY));
    return raw ? normalizeHvacHouse(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function saveHvacHouseLocal(house) {
  try { localStorage.setItem(lsKey(HVAC_HOUSE_SETTINGS_KEY), JSON.stringify(normalizeHvacHouse(house))); } catch { }
}

export function loadHvacZoneStateLocal() {
  try {
    const raw = localStorage.getItem(lsKey(HVAC_ZONE_STATE_SETTINGS_KEY));
    return raw ? normalizeHvacZoneState(JSON.parse(raw)) : {};
  } catch { return {}; }
}

export function saveHvacZoneStateLocal(state) {
  try { localStorage.setItem(lsKey(HVAC_ZONE_STATE_SETTINGS_KEY), JSON.stringify(normalizeHvacZoneState(state))); } catch { }
}

export function loadHvacConnectionLocal() {
  try {
    const raw = localStorage.getItem(lsKey(HVAC_CONNECTION_KEY));
    return raw ? { ...DEFAULT_HVAC_CONNECTION, ...JSON.parse(raw) } : null;
  } catch { return null; }
}

export function saveHvacConnectionLocal(conn) {
  try { localStorage.setItem(lsKey(HVAC_CONNECTION_KEY), JSON.stringify(conn)); } catch { }
}

export function buildHvacDeckHierarchy(house) {
  if (!house?.zones?.length) return [];
  const deckMap = {};
  for (const zone of house.zones) {
    const deckName = zone.deck || "Main";
    const areaName = zone.area || "General";
    if (!deckMap[deckName]) deckMap[deckName] = { name: deckName, areas: {} };
    if (!deckMap[deckName].areas[areaName]) deckMap[deckName].areas[areaName] = { name: areaName, zones: [] };
    deckMap[deckName].areas[areaName].zones.push(zone);
  }
  return Object.values(deckMap).map((deck) => ({
    id: deck.name.toLowerCase().replace(/\s+/g, "-"),
    name: deck.name,
    areas: Object.values(deck.areas).map((area) => ({
      id: area.name.toLowerCase().replace(/\s+/g, "-"),
      name: area.name,
      zones: area.zones,
    })),
  }));
}
