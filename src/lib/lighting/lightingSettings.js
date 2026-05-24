/**
 * Lighting settings / Lutron house storage.
 *
 * The platform stores a single normalized Lutron "house" (the result of
 * parsing a Lutron Integration Report) under the `lighting-house` settings
 * key plus a localStorage cache for offline / demo use. Per-zone live state
 * (level / on) is kept separately under `lighting-zone-state` so that we can
 * persist the most recent commanded value without rewriting the whole house.
 */

import { classifyZoneKind } from "./parseLutronIntegrationReport.js";

export const LIGHTING_HOUSE_SETTINGS_KEY = "lighting-house";
export const LIGHTING_ZONE_STATE_SETTINGS_KEY = "lighting-zone-state";
export const LIGHTING_LUTRON_CONNECTION_KEY = "lighting-lutron-connection";
export const LIGHTING_CONNECTION_KEY = "lighting-connection";
export const LIGHTING_CUSTOM_SCENES_KEY = "lighting-custom-scenes";
export const LIGHTING_EVENT_LOG_KEY = "lighting-event-log";

export const LIGHTING_HOUSE_CHANGED_EVENT = "waveguard-lighting-house-changed";
export const LIGHTING_ZONE_STATE_CHANGED_EVENT = "waveguard-lighting-zone-state-changed";
export const LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT =
  "waveguard-lighting-lutron-connection-changed";
export const LIGHTING_CONNECTION_CHANGED_EVENT =
  "waveguard-lighting-connection-changed";
export const LIGHTING_CUSTOM_SCENES_CHANGED_EVENT =
  "waveguard-lighting-custom-scenes-changed";
export const LIGHTING_EVENT_LOG_CHANGED_EVENT =
  "waveguard-lighting-event-log-changed";

const HOUSE_LOCAL_KEY = "waveguard:lighting:house";
const ZONE_STATE_LOCAL_KEY = "waveguard:lighting:zone-state";
const ACTIVE_SCENE_LOCAL_KEY = "waveguard:lighting:active-scene";
const LUTRON_CONNECTION_LOCAL_KEY = "waveguard:lighting:lutron-connection";
const LIGHTING_CONNECTION_LOCAL_KEY = "waveguard:lighting:connection";
const CUSTOM_SCENES_LOCAL_KEY = "waveguard:lighting:custom-scenes";
const EVENT_LOG_LOCAL_KEY = "waveguard:lighting:event-log";

// Maximum number of recent commands kept on the ring buffer.
export const LIGHTING_EVENT_LOG_MAX = 200;

// User-authored scene shapes — each kind needs a different integration
// address shape, so the helpers below normalise + validate accordingly.
export const CUSTOM_SCENE_KINDS = ["area_scene", "leap_href", "phantom_button"];
export const DEFAULT_CUSTOM_SCENES = { scenes: [] };
export const DEFAULT_LIGHTING_EVENT_LOG = { events: [] };

export const DEFAULT_LIGHTING_HOUSE = {
  house: null,
  areas: [],
  zones: [],
  scenes: [],
  devices: [],
  hvacZones: [],
  shadeGroups: [],
  loadSchedule: [],
  /** Per-tab floor display order (`lights` / `shades` keys → floor id arrays). */
  floorOrder: { lights: [], shades: [] },
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
export const LUTRON_PROTOCOLS = ["leap", "telnet"];
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
  port: 8081,
  protocol: "leap",
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

/**
 * Re-run the path-aware classifier against an existing zone record so
 * that a previously-parsed zone whose leaf name is just an index ("1")
 * but whose area path mentions "Curtains" / "Drapery" / "Shades" gets
 * upgraded from the legacy `kind: "load"` to the correct shade-family
 * kind. Returns the zone unchanged when the classifier can't improve
 * on what's already there.
 */
function reclassifyZoneKind(zone) {
  if (!zone || typeof zone !== "object") return zone;
  const parts = String(zone.fullPath || "")
    .split("\\")
    .map((s) => s.trim())
    .filter(Boolean);
  const context = parts.slice(1).join(" ") || zone.area || "";
  const detected = classifyZoneKind(zone.name || "", context);
  // Only override `load` (the parser's "no-op" classification). If the
  // zone is already classified as a specific light/shade/blind we trust
  // that — it was either the original parser or the live LEAP probe.
  if (!zone.kind || zone.kind === "load") {
    return { ...zone, kind: detected };
  }
  return zone;
}

export function normalizeLightingHouse(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_LIGHTING_HOUSE };
  return {
    house: value.house || null,
    areas: Array.isArray(value.areas) ? value.areas : [],
    zones: Array.isArray(value.zones)
      ? value.zones.map(reclassifyZoneKind)
      : [],
    scenes: Array.isArray(value.scenes) ? value.scenes : [],
    devices: Array.isArray(value.devices) ? value.devices : [],
    hvacZones: Array.isArray(value.hvacZones) ? value.hvacZones : [],
    shadeGroups: Array.isArray(value.shadeGroups) ? value.shadeGroups : [],
    loadSchedule: Array.isArray(value.loadSchedule) ? value.loadSchedule.map(normalizeLoadScheduleEntry) : [],
    floorOrder: normalizeFloorOrder(value.floorOrder),
  };
}

export function normalizeFloorOrder(value) {
  if (!value || typeof value !== "object") {
    return { lights: [], shades: [] };
  }
  return {
    lights: Array.isArray(value.lights)
      ? value.lights.map(String).filter(Boolean)
      : [],
    shades: Array.isArray(value.shades)
      ? value.shades.map(String).filter(Boolean)
      : [],
  };
}

/** Apply a saved floor-id order to a hierarchy; unknown floors append at the end. */
export function applyFloorOrder(hierarchy, orderIds) {
  if (!Array.isArray(hierarchy)) return [];
  if (!Array.isArray(orderIds) || orderIds.length === 0) return hierarchy;
  const byId = new Map(hierarchy.map((f) => [f.id, f]));
  const ordered = [];
  for (const id of orderIds) {
    const floor = byId.get(id);
    if (floor) {
      ordered.push(floor);
      byId.delete(id);
    }
  }
  ordered.push(...byId.values());
  return ordered;
}

/** Reorder one tab's floor list after a drag-and-drop move. */
export function reorderFloorOrder(current, tabKey, sourceIndex, destIndex, hierarchy) {
  const order = normalizeFloorOrder(current);
  const tab = tabKey === "shades" ? "shades" : "lights";
  const validIds = (hierarchy || []).map((f) => f.id);
  const validSet = new Set(validIds);

  let ids = order[tab].filter((id) => validSet.has(id));
  for (const id of validIds) {
    if (!ids.includes(id)) ids.push(id);
  }

  const [moved] = ids.splice(sourceIndex, 1);
  if (moved == null) return order;
  ids.splice(destIndex, 0, moved);

  return { ...order, [tab]: ids };
}

export function normalizeLoadScheduleEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    zoneName: String(entry.zoneName || ""),
    areaFullPath: String(entry.areaFullPath || ""),
    floor: String(entry.floor || ""),
    area: String(entry.area || ""),
    loadNumber: Number.isFinite(entry.loadNumber) ? entry.loadNumber : null,
    loadType: String(entry.loadType || ""),
    wattage: Number.isFinite(entry.wattage) ? entry.wattage : null,
    assignedTo: String(entry.assignedTo || ""),
    panel: String(entry.panel || ""),
    module: String(entry.module || ""),
    output: String(entry.output || ""),
  };
}

/** Build a zone href lookup from the house zones for cross-referencing load schedule entries. */
export function buildZoneLookup(house) {
  const byNameArea = new Map();
  for (const z of house.zones || []) {
    const key = `${z.name}|${z.areaFullPath}`;
    byNameArea.set(key, z);
  }
  return { byNameArea };
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

// ── User-authored scenes (Scenes page) ────────────────────────────────

/**
 * Normalise a single scene record. We accept any combination of fields
 * because the same shape is shared by the three "scene kinds":
 *   - area_scene     → areaId + sceneN
 *   - leap_href      → href (typically /area/<id>/scene/<n>)
 *   - phantom_button → deviceHref + componentNumber
 *
 * Any unrecognised kind defaults to "leap_href".
 */
export function normalizeCustomScene(value) {
  if (!value || typeof value !== "object") return null;
  const kind = CUSTOM_SCENE_KINDS.includes(value.kind) ? value.kind : "leap_href";
  const name = String(value.name || "").trim();
  if (!name) return null;
  const out = {
    id:
      value.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    name,
    kind,
    createdAt: value.createdAt || new Date().toISOString(),
    lastRunAt: value.lastRunAt || null,
    lastResult: value.lastResult || null,
  };
  if (kind === "area_scene") {
    out.areaId = String(value.areaId || "").trim();
    const sceneN = Number(value.sceneN);
    out.sceneN = Number.isFinite(sceneN) ? sceneN : null;
  } else if (kind === "phantom_button") {
    out.deviceHref = String(value.deviceHref || "").trim();
    const comp = Number(value.componentNumber);
    out.componentNumber = Number.isFinite(comp) ? comp : null;
  } else {
    out.href = String(value.href || "").trim();
  }
  return out;
}

export function normalizeCustomScenes(value) {
  const arr = Array.isArray(value?.scenes)
    ? value.scenes
    : Array.isArray(value)
    ? value
    : [];
  const out = [];
  for (const s of arr) {
    const n = normalizeCustomScene(s);
    if (n) out.push(n);
  }
  return { scenes: out };
}

export function loadCustomScenesLocal() {
  const ls = safeLocalStorage();
  if (!ls) return { ...DEFAULT_CUSTOM_SCENES };
  try {
    const raw = ls.getItem(CUSTOM_SCENES_LOCAL_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_SCENES };
    return normalizeCustomScenes(JSON.parse(raw));
  } catch (_e) {
    return { ...DEFAULT_CUSTOM_SCENES };
  }
}

export function saveCustomScenesLocal(payload) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(CUSTOM_SCENES_LOCAL_KEY, JSON.stringify(normalizeCustomScenes(payload)));
  } catch (_e) {
    /* quota */
  }
}

// ── Lighting event log (Recent activity / event log) ──────────────────

export function normalizeLightingEvent(value) {
  if (!value || typeof value !== "object") return null;
  const ts = value.ts || new Date().toISOString();
  return {
    id:
      value.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`),
    ts,
    kind: String(value.kind || "command"),
    severity: ["info", "warning", "critical"].includes(value.severity)
      ? value.severity
      : "info",
    zoneHref: value.zoneHref || null,
    zoneName: value.zoneName || null,
    action: value.action || null,
    level: value.level != null ? Number(value.level) : null,
    result: String(value.result || "success"),
    message: value.message || null,
  };
}

export function normalizeLightingEventLog(value) {
  const arr = Array.isArray(value?.events)
    ? value.events
    : Array.isArray(value)
    ? value
    : [];
  const out = [];
  for (const e of arr) {
    const n = normalizeLightingEvent(e);
    if (n) out.push(n);
  }
  // Cap to ring-buffer length, keeping the most recent entries.
  return { events: out.slice(-LIGHTING_EVENT_LOG_MAX) };
}

export function loadLightingEventLogLocal() {
  const ls = safeLocalStorage();
  if (!ls) return { ...DEFAULT_LIGHTING_EVENT_LOG };
  try {
    const raw = ls.getItem(EVENT_LOG_LOCAL_KEY);
    if (!raw) return { ...DEFAULT_LIGHTING_EVENT_LOG };
    return normalizeLightingEventLog(JSON.parse(raw));
  } catch (_e) {
    return { ...DEFAULT_LIGHTING_EVENT_LOG };
  }
}

export function saveLightingEventLogLocal(payload) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(EVENT_LOG_LOCAL_KEY, JSON.stringify(normalizeLightingEventLog(payload)));
  } catch (_e) {
    /* quota */
  }
}

const SHADE_KINDS = new Set([
  // From the Integration Report parser (zone-name heuristics).
  "shade",
  "blind",
  "blackout",
  // From the live LEAP probe (Lutron ControlType).
  "openCloseStop",
  "shadeAndTilt",
  "tilt",
]);
// Substring keywords that flag a zone as a window-treatment even when the
// parser couldn't pin down a specific kind (kind: "load"). This catches
// houses parsed before classifyZoneKind learned about drape/sheer/voile/etc.
// without having to re-import the Integration Report.
const SHADE_NAME_KEYWORDS = [
  "shade",
  "blind",
  "blackout",
  "venetian",
  "roman",
  "curtain",
  "drape",
  "drapery",
  "sheer",
  "voile",
  "roller",
  "zebra",
  "silhouette",
  "honeycomb",
  "cellular",
  "shutter",
];

/**
 * Returns true if the zone is a shade/blind/curtain. We check (in order):
 *   1. The parser-assigned kind (covers freshly-imported houses).
 *   2. The zone's leaf name (covers obvious cases like "ROLLER 1").
 *   3. The area name and the full hierarchy path (covers zones named
 *      just "1", "2", … inside an area like `…\Curtains\1` where the
 *      meaningful classifier sits in the parent area).
 *
 * Checking the area/path is essential because many Lutron Designer
 * projects keep zone leaves as bare indices and put the descriptive
 * word ("Curtains", "Drapery", "Shades") on the area.
 */
export function isShadeZone(zone) {
  if (!zone) return false;
  if (SHADE_KINDS.has(zone.kind)) return true;
  const haystacks = [
    zone.name,
    zone.area,
    zone.areaFullPath,
    zone.fullPath,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return haystacks.some((s) =>
    SHADE_NAME_KEYWORDS.some((kw) => s.includes(kw))
  );
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
