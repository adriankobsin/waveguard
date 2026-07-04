import { isDemoModeActive } from "@/lib/platformMode";
import { isMockServer, base44 } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import {
  HVAC_HOUSE_SETTINGS_KEY,
  HVAC_ZONE_STATE_SETTINGS_KEY,
  HVAC_HOUSE_CHANGED_EVENT,
  HVAC_ZONE_STATE_CHANGED_EVENT,
  DEFAULT_HVAC_HOUSE,
  normalizeHvacHouse,
  normalizeHvacZoneState,
  loadHvacHouseLocal,
  saveHvacHouseLocal,
  loadHvacZoneStateLocal,
  saveHvacZoneStateLocal,
} from "@/lib/hvac/hvacSettings";
import { buildMockModbusEngine } from "@/lib/integrations/modbus/modbusAdapter";
import { buildMockCoolmasterEngine } from "@/lib/integrations/coolmaster/coolmasterAdapter";
import { buildMockRs485Engine } from "@/lib/integrations/rs485/rs485Adapter";
import { buildMockKnxEngine } from "@/lib/integrations/knx/knxAdapter";

let localEngines = {};

function getEngine(systemType) {
  if (!localEngines[systemType]) {
    switch (systemType) {
      case "modbus": localEngines[systemType] = buildMockModbusEngine(); break;
      case "coolmaster": localEngines[systemType] = buildMockCoolmasterEngine(); break;
      case "rs485": localEngines[systemType] = buildMockRs485Engine(); break;
      case "knx": localEngines[systemType] = buildMockKnxEngine(); break;
      default: localEngines[systemType] = buildMockModbusEngine(); break;
    }
  }
  return localEngines[systemType];
}

export async function loadHvacHouse() {
  if (isDemoModeActive()) {
    const local = loadHvacHouseLocal();
    if (local?.zones?.length) return local;
    return normalizeHvacHouse(getDemoHvacHouse());
  }
  try {
    const records = await base44.entities.SystemSettings.filter({ key: HVAC_HOUSE_SETTINGS_KEY });
    if (records.length > 0 && records[0].value != null) {
      return normalizeHvacHouse(parseSettingsValue(records[0].value));
    }
  } catch { }
  return loadHvacHouseLocal() || DEFAULT_HVAC_HOUSE;
}

export async function saveHvacHouse(house) {
  const normalized = normalizeHvacHouse(house);
  saveHvacHouseLocal(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HVAC_HOUSE_CHANGED_EVENT, { detail: normalized }));
  }
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({ key: HVAC_HOUSE_SETTINGS_KEY });
    const payload = { key: HVAC_HOUSE_SETTINGS_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch (err) {
    console.warn("[hvacApi] house save failed:", err);
  }
  return normalized;
}

export async function loadHvacZoneState() {
  if (isDemoModeActive()) return loadHvacZoneStateLocal() || {};
  try {
    const records = await base44.entities.SystemSettings.filter({ key: HVAC_ZONE_STATE_SETTINGS_KEY });
    if (records.length > 0 && records[0].value != null) {
      return normalizeHvacZoneState(parseSettingsValue(records[0].value));
    }
  } catch { }
  return loadHvacZoneStateLocal() || {};
}

export async function saveHvacZoneState(state) {
  const normalized = normalizeHvacZoneState(state);
  saveHvacZoneStateLocal(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HVAC_ZONE_STATE_CHANGED_EVENT, { detail: normalized }));
  }
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({ key: HVAC_ZONE_STATE_SETTINGS_KEY });
    const payload = { key: HVAC_ZONE_STATE_SETTINGS_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch { }
  return normalized;
}

export async function setHvacZoneLevel({ zoneId, level, zone }) {
  const systemType = zone?.systemType || "modbus";
  const clamped = Math.max(0, Math.min(100, Number(level) || 0));
  const engine = getEngine(systemType);
  const result = engine.setOutput(zoneId, clamped);
  const prev = await loadHvacZoneState();
  const next = { ...prev, [zoneId]: { ...prev[zoneId], level: clamped, on: clamped > 0, updatedAt: new Date().toISOString() } };
  await saveHvacZoneState(next);
  return result;
}

export async function pollHvacZones({ zoneIds } = {}) {
  if (!isMockServer || isDemoModeActive()) {
    const results = [];
    for (const engineKey of Object.keys(localEngines)) {
      const engine = localEngines[engineKey];
      const zones = engine.pollZones([]);
      for (const z of zones) {
        if (z.id && !results.find((r) => r.id === z.id)) results.push(z);
      }
    }
    return results;
  }
  const base = getMockAppApiBase();
  try {
    const res = await fetch(`${base}/functions/hvacPoll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
      body: JSON.stringify({ zoneIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.zones) return data.zones;
  } catch { }
  return [];
}

function getDemoHvacHouse() {
  const zones = [];
  const decks = [
    { id: "main", name: "Main Deck", areas: [{ id: "salon", name: "Salon" }, { id: "galley", name: "Galley" }] },
    { id: "lower", name: "Lower Deck", areas: [{ id: "cabins", name: "Cabins" }, { id: "engine", name: "Engine Room" }] },
    { id: "bridge", name: "Bridge Deck", areas: [{ id: "wheelhouse", name: "Wheelhouse" }] },
  ];

  let zoneIdx = 0;
  const systemTypes = ["modbus", "coolmaster", "knx"];
  for (const deck of decks) {
    for (const area of deck.areas) {
      const st = systemTypes[zoneIdx % systemTypes.length];
      const zoneBase = `zone-${zoneIdx}`;

      if (st === "modbus") {
        zones.push({ id: `${zoneBase}-temp`, name: `${area.name} Temp`, href: `hvac_temp:${zoneIdx}`, systemType: "modbus", deck: deck.name, area: area.name, kind: "temperature", unitId: 1, register: zoneIdx * 2 });
        zones.push({ id: `${zoneBase}-setpoint`, name: `${area.name} Setpoint`, href: `hvac_temp:${zoneIdx}`, systemType: "modbus", deck: deck.name, area: area.name, kind: "setpoint", unitId: 1, register: zoneIdx * 2 });
        zones.push({ id: `${zoneBase}-mode`, name: `${area.name} Mode`, href: `hvac_mode:${zoneIdx}`, systemType: "modbus", deck: deck.name, area: area.name, kind: "mode", unitId: 1, register: zoneIdx * 2 + 1 });
      } else if (st === "coolmaster") {
        zones.push({ id: `${zoneBase}-unit`, name: `${area.name} HVAC`, href: `temp:${zoneIdx}`, systemType: "coolmaster", deck: deck.name, area: area.name, kind: "temperature", unitId: zoneIdx });
        zones.push({ id: `${zoneBase}-power`, name: `${area.name} Power`, href: `power:${zoneIdx}`, systemType: "coolmaster", deck: deck.name, area: area.name, kind: "onoff", unitId: zoneIdx });
      } else {
        zones.push({ id: `${zoneBase}-knx-temp`, name: `${area.name} Temp`, href: `/group/2/${zoneIdx}/0`, systemType: "knx", deck: deck.name, area: area.name, kind: "temperature" });
        zones.push({ id: `${zoneBase}-knx-mode`, name: `${area.name} Mode`, href: `/group/4/${zoneIdx}/0`, systemType: "knx", deck: deck.name, area: area.name, kind: "mode" });
      }
      zoneIdx++;
    }
  }

  const equipment = [
    { id: "modbus-gw-1", name: "Modbus Gateway", model: "MB-GW-01", systemType: "modbus", host: "192.168.1.100", port: 502, unitId: 1, status: "online" },
    { id: "coolmaster-1", name: "Coolmaster Controller", model: "CM-3", systemType: "coolmaster", host: "192.168.1.110", port: 10102, unitId: 0, status: "online" },
    { id: "knx-gw-1", name: "KNX IP Gateway", model: "KNX-IP-01", systemType: "knx", host: "192.168.1.120", port: 3671, unitId: 0, status: "online" },
  ];

  return { zones, equipment, decks, version: 2 };
}

export function getDemoHvacZoneState() {
  const state = {};
  const demo = getDemoHvacHouse();
  for (const z of demo.zones) {
    state[z.id] = {
      temperature: 21 + Math.random() * 4,
      setpoint: 22,
      mode: ["auto", "cool", "heat"][Math.floor(Math.random() * 3)],
      fanSpeed: "auto",
      on: true,
      humidity: 45 + Math.floor(Math.random() * 20),
      updatedAt: new Date().toISOString(),
    };
  }
  return state;
}

const REST_API_BASE = "/api/hvac";

async function hvacRestFetch(path, options = {}) {
  const url = `${REST_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let msg;
    try {
      const body = await res.json();
      msg = body.error || body.message || res.statusText;
    } catch {
      msg = res.statusText;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchAllZones() {
  if (isDemoModeActive()) {
    const { getDemoHVACZones } = await import("@/lib/demo/demoHVACData");
    return getDemoHVACZones();
  }
  return hvacRestFetch("/zones");
}

export async function fetchZone(zoneId) {
  if (isDemoModeActive()) {
    const { getDemoHVACZones } = await import("@/lib/demo/demoHVACData");
    const zones = getDemoHVACZones();
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    return zone;
  }
  return hvacRestFetch(`/zones/${encodeURIComponent(zoneId)}`);
}

export async function setZonePower(zoneId, power) {
  return hvacRestFetch(`/zones/${encodeURIComponent(zoneId)}/power`, {
    method: "POST",
    body: JSON.stringify({ power }),
  });
}

export async function setZoneSetpoint(zoneId, temperature) {
  if (temperature < 16 || temperature > 30) {
    throw new Error("Setpoint must be between 16°C and 30°C");
  }
  return hvacRestFetch(`/zones/${encodeURIComponent(zoneId)}/setpoint`, {
    method: "POST",
    body: JSON.stringify({ temperature }),
  });
}

export async function setZoneMode(zoneId, mode) {
  const valid = ["off", "cool", "heat", "auto", "dry", "fan_only"];
  if (!valid.includes(mode)) {
    throw new Error(`Invalid mode "${mode}". Must be one of: ${valid.join(", ")}`);
  }
  return hvacRestFetch(`/zones/${encodeURIComponent(zoneId)}/mode`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export async function setZoneFanSpeed(zoneId, fanSpeed) {
  const valid = ["auto", "low", "medium", "high"];
  if (!valid.includes(fanSpeed)) {
    throw new Error(`Invalid fan speed "${fanSpeed}". Must be one of: ${valid.join(", ")}`);
  }
  return hvacRestFetch(`/zones/${encodeURIComponent(zoneId)}/fan`, {
    method: "POST",
    body: JSON.stringify({ fanSpeed }),
  });
}

export async function fetchZoneDiagnostics(zoneId) {
  return hvacRestFetch(`/zones/${encodeURIComponent(zoneId)}/diagnostics`);
}

export async function fetchSystemStatus() {
  return hvacRestFetch("/system/status");
}
