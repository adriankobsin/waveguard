/**
 * Lighting settings / Lutron house storage.
 *
 * The platform stores a single normalized Lutron "house" (the result of
 * parsing a Lutron Integration Report) under the `lighting-house` settings
 * key plus a localStorage cache for offline / demo use. Per-zone live state
 * (level / on) is kept separately under `lighting-zone-state` so that we can
 * persist the most recent commanded value without rewriting the whole house.
 */

export const LIGHTING_HOUSE_SETTINGS_KEY = "lighting-house";
export const LIGHTING_ZONE_STATE_SETTINGS_KEY = "lighting-zone-state";
export const LIGHTING_LUTRON_CONNECTION_KEY = "lighting-lutron-connection";
export const LIGHTING_CONNECTION_KEY = "lighting-connection";

export const LIGHTING_HOUSE_CHANGED_EVENT = "waveguard-lighting-house-changed";
export const LIGHTING_ZONE_STATE_CHANGED_EVENT = "waveguard-lighting-zone-state-changed";
export const LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT =
  "waveguard-lighting-lutron-connection-changed";
export const LIGHTING_CONNECTION_CHANGED_EVENT =
  "waveguard-lighting-connection-changed";

const HOUSE_LOCAL_KEY = "waveguard:lighting:house";
const ZONE_STATE_LOCAL_KEY = "waveguard:lighting:zone-state";
const ACTIVE_SCENE_LOCAL_KEY = "waveguard:lighting:active-scene";
const LUTRON_CONNECTION_LOCAL_KEY = "waveguard:lighting:lutron-connection";
const LIGHTING_CONNECTION_LOCAL_KEY = "waveguard:lighting:connection";

export const DEFAULT_LIGHTING_HOUSE = {
  house: null,
  areas: [],
  zones: [],
  scenes: [],
  devices: [],
  hvacZones: [],
  shadeGroups: [],
};

const DEFAULT_ZONE_STATE = {};

/**
 * Lutron processor connection.
 *
 * The processor will only allow 3rd-party control when integration access
 * has been enabled in Lutron Designer. The credentials below correspond to
 * what Designer exposes under "Integration" / "Telnet support":
 *
 *   - HomeWorks QSX / RadioRA 3 → Telnet on port 23, username + password
 *     defined in Designer (default `lutron` / `integration`).
 *   - HomeWorks Athena and newer firmware → LEAP API on port 8081 over TLS;
 *     the same integration username/password is accepted in addition to
 *     certificate pairing.
 *
 * `enabled` flips the platform between the local mock engine and live LEAP /
 * Telnet calls. We keep credentials in the SystemSettings entity plus a
 * localStorage cache for offline/demo use, mirroring how the lighting house
 * itself is persisted.
 */
export const LUTRON_PROTOCOLS = ["telnet", "leap"];
export const KNX_PROTOCOLS = ["knx-ip", "knx-tunnelling"];
export const DALI_PROTOCOLS = ["dali-usb", "dali-ip"];
export const DMX_PROTOCOLS = ["art-net", "sacn", "enttec-usb"];

export const LIGHTING_SYSTEM_TYPES = ["lutron", "knx", "dali", "dmx"];

export const SYSTEM_TYPE_PROTOCOLS = {
  lutron: LUTRON_PROTOCOLS,
  knx: KNX_PROTOCOLS,
  dali: DALI_PROTOCOLS,
  dmx: DMX_PROTOCOLS,
};

export const SYSTEM_TYPE_DEFAULT_PORTS = {
  lutron: { telnet: 23, leap: 8081 },
  knx: { "knx-ip": 3671, "knx-tunnelling": 3671 },
  dali: { "dali-usb": 0, "dali-ip": 5582 },
  dmx: { "art-net": 6454, "sacn": 5568, "enttec-usb": 0 },
};

export const SYSTEM_TYPE_DEFAULT_CREDENTIALS = {
  lutron: { username: "lutron", password: "integration" },
  knx: { username: "", password: "" },
  dali: { username: "", password: "" },
  dmx: { username: "", password: "" },
};

export const DEFAULT_LIGHTING_CONNECTION = {
  systemType: "lutron",
  enabled: false,
  host: "",
  port: 23,
  protocol: "telnet",
  username: "lutron",
  password: "integration",
  tlsVerify: true,
  updatedAt: null,
};

export function defaultPortForProtocol(protocol, systemType = "lutron") {
  const ports = SYSTEM_TYPE_DEFAULT_PORTS[systemType] || SYSTEM_TYPE_DEFAULT_PORTS.lutron;
  return ports[protocol] || 23;
}

export function normalizeLightingConnection(value) {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_LIGHTING_CONNECTION };
  }
  const systemType = LIGHTING_SYSTEM_TYPES.includes(value.systemType)
    ? value.systemType
    : DEFAULT_LIGHTING_CONNECTION.systemType;
  const protocols = SYSTEM_TYPE_PROTOCOLS[systemType] || LUTRON_PROTOCOLS;
  const protocol = protocols.includes(value.protocol)
    ? value.protocol
    : protocols[0];
  const rawPort = Number(value.port);
  const port =
    Number.isFinite(rawPort) && rawPort > 0
      ? Math.min(65535, Math.floor(rawPort))
      : defaultPortForProtocol(protocol, systemType);
  const defaults = SYSTEM_TYPE_DEFAULT_CREDENTIALS[systemType] || SYSTEM_TYPE_DEFAULT_CREDENTIALS.lutron;
  return {
    systemType,
    enabled: !!value.enabled,
    host: String(value.host || "").trim(),
    port,
    protocol,
    username:
      typeof value.username === "string" && value.username.trim()
        ? value.username.trim()
        : defaults.username,
    password:
      typeof value.password === "string"
        ? value.password
        : defaults.password,
    tlsVerify: value.tlsVerify !== false,
    updatedAt: value.updatedAt || null,
  };
}

function safeLocalStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch (_e) {
    return null;
  }
}

export function normalizeLightingHouse(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_LIGHTING_HOUSE };
  return {
    house: value.house || null,
    areas: Array.isArray(value.areas) ? value.areas : [],
    zones: Array.isArray(value.zones) ? value.zones : [],
    scenes: Array.isArray(value.scenes) ? value.scenes : [],
    devices: Array.isArray(value.devices) ? value.devices : [],
    hvacZones: Array.isArray(value.hvacZones) ? value.hvacZones : [],
    shadeGroups: Array.isArray(value.shadeGroups) ? value.shadeGroups : [],
  };
}

export function loadLightingHouseLocal() {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(HOUSE_LOCAL_KEY);
    if (!raw) return null;
    return normalizeLightingHouse(JSON.parse(raw));
  } catch (_e) {
    return null;
  }
}

export function saveLightingHouseLocal(house) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(HOUSE_LOCAL_KEY, JSON.stringify(normalizeLightingHouse(house)));
  } catch (_e) {
    /* quota */
  }
}

export function clearLightingHouseLocal() {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(HOUSE_LOCAL_KEY);
  } catch (_e) {
    /* */
  }
}

export function normalizeZoneState(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_ZONE_STATE };
  const out = {};
  for (const [href, state] of Object.entries(value)) {
    if (!state || typeof state !== "object") continue;
    const level = Math.max(0, Math.min(100, Number(state.level) || 0));
    out[href] = {
      level,
      on: state.on != null ? Boolean(state.on) : level > 0,
      fade: state.fade != null ? Number(state.fade) || 0 : 0,
      updatedAt: state.updatedAt || null,
    };
  }
  return out;
}

export function loadZoneStateLocal() {
  const ls = safeLocalStorage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(ZONE_STATE_LOCAL_KEY);
    if (!raw) return {};
    return normalizeZoneState(JSON.parse(raw));
  } catch (_e) {
    return {};
  }
}

export function saveZoneStateLocal(state) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(ZONE_STATE_LOCAL_KEY, JSON.stringify(normalizeZoneState(state)));
  } catch (_e) {
    /* */
  }
}

export function getActiveSceneLocal() {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    return ls.getItem(ACTIVE_SCENE_LOCAL_KEY) || null;
  } catch (_e) {
    return null;
  }
}

export function setActiveSceneLocal(href) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    if (href) ls.setItem(ACTIVE_SCENE_LOCAL_KEY, href);
    else ls.removeItem(ACTIVE_SCENE_LOCAL_KEY);
  } catch (_e) {
    /* */
  }
}

/** @deprecated Use normalizeLightingConnection instead. */
export const DEFAULT_LUTRON_CONNECTION = DEFAULT_LIGHTING_CONNECTION;

/** @deprecated Use normalizeLightingConnection instead. */
export function normalizeLutronConnection(value) {
  return normalizeLightingConnection(value);
}

/** @deprecated Use defaultPortForProtocol with systemType instead. */
export function defaultPortForProtocolLegacy(protocol) {
  return defaultPortForProtocol(protocol, "lutron");
}

export function loadLutronConnectionLocal() {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(LUTRON_CONNECTION_LOCAL_KEY);
    if (!raw) return null;
    return normalizeLutronConnection(JSON.parse(raw));
  } catch (_e) {
    return null;
  }
}

export function saveLutronConnectionLocal(conn) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(
      LUTRON_CONNECTION_LOCAL_KEY,
      JSON.stringify(normalizeLutronConnection(conn))
    );
  } catch (_e) {
    /* quota */
  }
}

export function clearLutronConnectionLocal() {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(LUTRON_CONNECTION_LOCAL_KEY);
  } catch (_e) {
    /* */
  }
}

export function loadLightingConnectionLocal() {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(LIGHTING_CONNECTION_LOCAL_KEY);
    if (!raw) return null;
    return normalizeLightingConnection(JSON.parse(raw));
  } catch (_e) {
    return null;
  }
}

export function saveLightingConnectionLocal(conn) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(
      LIGHTING_CONNECTION_LOCAL_KEY,
      JSON.stringify(normalizeLightingConnection(conn))
    );
  } catch (_e) {
    /* quota */
  }
}

export function clearLightingConnectionLocal() {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(LIGHTING_CONNECTION_LOCAL_KEY);
  } catch (_e) {
    /* */
  }
}

/** Strip the password from a connection record for safe logging / display. */
export function redactLutronConnection(conn) {
  const c = normalizeLutronConnection(conn);
  return { ...c, password: c.password ? "••••••••" : "" };
}

/** Strip the password from a connection record for safe logging / display. */
export function redactLightingConnection(conn) {
  const c = normalizeLightingConnection(conn);
  return { ...c, password: c.password ? "••••••••" : "" };
}

const SHADE_KINDS = new Set(["shade", "blind", "blackout"]);
const SHADE_NAME_KEYWORDS = ["shade", "blind", "blackout", "venetian", "roman", "curtain"];

/** Returns true if the zone is a shade/blind/curtain based on kind or name. */
export function isShadeZone(zone) {
  if (!zone) return false;
  if (SHADE_KINDS.has(zone.kind)) return true;
  const name = (zone.name || "").toLowerCase();
  return SHADE_NAME_KEYWORDS.some((kw) => name.includes(kw));
}

/** Group zones for the UI: floors → areas → zones. */
export function buildLightingHierarchy(house) {
  const normalized = normalizeLightingHouse(house);
  const floors = new Map();
  const ensureFloor = (floor) => {
    if (!floors.has(floor)) {
      floors.set(floor, { id: floor, name: floor, areas: new Map() });
    }
    return floors.get(floor);
  };
  for (const area of normalized.areas) {
    const floor = ensureFloor(area.floor || "Unassigned");
    floor.areas.set(area.fullPath || area.id, {
      ...area,
      zones: [],
      scenes: [],
    });
  }
  // Fall back to floor-from-zone when an area is missing.
  for (const z of normalized.zones) {
    let floor = floors.get(z.floor || "Unassigned");
    if (!floor) floor = ensureFloor(z.floor || "Unassigned");
    let area = floor.areas.get(z.areaFullPath);
    if (!area) {
      area = {
        id: z.area_id || z.areaFullPath || "unknown",
        href: "",
        fullPath: z.areaFullPath || "",
        floor: z.floor || "Unassigned",
        name: z.area || "Area",
        zones: [],
        scenes: [],
      };
      floor.areas.set(z.areaFullPath || area.id, area);
    }
    area.zones.push(z);
  }
  for (const s of normalized.scenes) {
    let floor = floors.get(s.floor || "Unassigned");
    if (!floor) floor = ensureFloor(s.floor || "Unassigned");
    let area = floor.areas.get(s.areaFullPath);
    if (!area) continue;
    area.scenes.push(s);
  }
  return [...floors.values()].map((f) => ({
    ...f,
    areas: [...f.areas.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
