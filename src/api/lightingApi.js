import { base44, isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  LIGHTING_HOUSE_SETTINGS_KEY,
  LIGHTING_ZONE_STATE_SETTINGS_KEY,
  LIGHTING_LUTRON_CONNECTION_KEY,
  LIGHTING_HOUSE_CHANGED_EVENT,
  LIGHTING_ZONE_STATE_CHANGED_EVENT,
  LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT,
  DEFAULT_LIGHTING_HOUSE,
  DEFAULT_LUTRON_CONNECTION,
  normalizeLightingHouse,
  normalizeZoneState,
  normalizeLutronConnection,
  loadLightingHouseLocal,
  saveLightingHouseLocal,
  loadZoneStateLocal,
  saveZoneStateLocal,
  loadLutronConnectionLocal,
  saveLutronConnectionLocal,
  defaultPortForProtocol,
  setActiveSceneLocal,
} from "@/lib/lighting/lightingSettings";
import { buildMockLutronEngine } from "@/lib/integrations/lutron/lutronAdapter";
import { getDemoLightingHouse } from "@/lib/demo/demoSystemSnapshot";

// ── Lighting house (parsed integration report) ───────────────────────────────

async function loadHouseFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_HOUSE_SETTINGS_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeLightingHouse(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[lightingApi] house load failed:", err);
  }
  return loadLightingHouseLocal() || DEFAULT_LIGHTING_HOUSE;
}

async function persistHouseToSettings(house) {
  const normalized = normalizeLightingHouse(house);
  saveLightingHouseLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_HOUSE_SETTINGS_KEY,
    });
    const payload = { key: LIGHTING_HOUSE_SETTINGS_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch (err) {
    console.warn("[lightingApi] house save failed:", err);
  }
  return normalized;
}

export async function loadLightingHouse() {
  if (isDemoModeActive()) {
    // In demo mode, return whatever the user has imported into the local
    // cache, otherwise fall back to the curated demo house so the page
    // shows full functionality straight away.
    const local = loadLightingHouseLocal();
    if (local && (local.zones?.length || 0) > 0) return local;
    return normalizeLightingHouse(getDemoLightingHouse());
  }
  return loadHouseFromSettings();
}

export async function saveLightingHouse(house) {
  const normalized = normalizeLightingHouse(house);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIGHTING_HOUSE_CHANGED_EVENT, { detail: normalized })
    );
  }
  if (isDemoModeActive()) {
    saveLightingHouseLocal(normalized);
    return normalized;
  }
  return persistHouseToSettings(normalized);
}

export async function clearLightingHouse() {
  const empty = DEFAULT_LIGHTING_HOUSE;
  saveLightingHouseLocal(empty);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIGHTING_HOUSE_CHANGED_EVENT, { detail: empty })
    );
  }
  if (!isDemoModeActive()) {
    try {
      const records = await base44.entities.SystemSettings.filter({
        key: LIGHTING_HOUSE_SETTINGS_KEY,
      });
      if (records.length > 0) {
        await base44.entities.SystemSettings.update(records[0].id, {
          key: LIGHTING_HOUSE_SETTINGS_KEY,
          value: empty,
        });
      }
    } catch (err) {
      console.warn("[lightingApi] house clear failed:", err);
    }
  }
  return empty;
}

// ── Zone live state (commanded levels) ───────────────────────────────────────

async function loadZoneStateFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_ZONE_STATE_SETTINGS_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeZoneState(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[lightingApi] zone-state load failed:", err);
  }
  return loadZoneStateLocal();
}

async function persistZoneStateToSettings(state) {
  const normalized = normalizeZoneState(state);
  saveZoneStateLocal(normalized);
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_ZONE_STATE_SETTINGS_KEY,
    });
    const payload = { key: LIGHTING_ZONE_STATE_SETTINGS_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch (err) {
    console.warn("[lightingApi] zone-state save failed:", err);
  }
  return normalized;
}

export async function loadZoneState() {
  if (isDemoModeActive()) return loadZoneStateLocal();
  return loadZoneStateFromSettings();
}

// ── Lutron processor connection (integration credentials) ────────────────────
//
// The processor will not accept 3rd-party Telnet / LEAP commands until
// integration access is enabled in Lutron Designer and an integration
// username + password are paired with it. We persist those credentials
// alongside the lighting house so the platform can reconnect after restart.
//
// NOTE: the SystemSettings store does not encrypt values. In production this
// should be moved to a secret-management entity; for now the password is
// kept in the same vault as Peplink/SMTP credentials.

async function loadLutronConnectionFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_LUTRON_CONNECTION_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeLutronConnection(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[lightingApi] lutron connection load failed:", err);
  }
  return loadLutronConnectionLocal() || { ...DEFAULT_LUTRON_CONNECTION };
}

async function persistLutronConnectionToSettings(conn) {
  const normalized = normalizeLutronConnection(conn);
  saveLutronConnectionLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_LUTRON_CONNECTION_KEY,
    });
    const payload = { key: LIGHTING_LUTRON_CONNECTION_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch (err) {
    console.warn("[lightingApi] lutron connection save failed:", err);
  }
  return normalized;
}

export async function loadLutronConnection() {
  if (isDemoModeActive()) {
    return loadLutronConnectionLocal() || { ...DEFAULT_LUTRON_CONNECTION };
  }
  return loadLutronConnectionFromSettings();
}

export async function saveLutronConnection(conn) {
  const normalized = normalizeLutronConnection({
    ...conn,
    updatedAt: new Date().toISOString(),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, {
        detail: normalized,
      })
    );
  }
  if (isDemoModeActive()) {
    saveLutronConnectionLocal(normalized);
    return normalized;
  }
  return persistLutronConnectionToSettings(normalized);
}

// ── Lutron control (live test) ───────────────────────────────────────────────
//
// In live mode we route the command through the mock-server (which holds a
// shared mock-Lutron engine and would, in production, proxy to a real LEAP
// processor). In demo mode we bypass the network and operate on a local
// engine instance so changes still feel real to the operator.

let localEngine = null;
function getLocalEngine() {
  if (!localEngine) localEngine = buildMockLutronEngine();
  return localEngine;
}

function mergeZoneState(prev, updates) {
  const next = { ...prev };
  for (const u of updates) {
    if (!u?.href) continue;
    next[u.href] = {
      level: u.level ?? 0,
      on: u.on != null ? u.on : (u.level ?? 0) > 0,
      fade: u.fade ?? 0,
      updatedAt: u.updatedAt || new Date().toISOString(),
    };
  }
  return next;
}

async function broadcastZoneUpdate(updates) {
  const prev = await loadZoneState();
  const next = mergeZoneState(prev, updates);
  await persistZoneStateToSettings(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIGHTING_ZONE_STATE_CHANGED_EVENT, {
        detail: { updates, state: next },
      })
    );
  }
  return next;
}

async function callMockLutron(op, body) {
  if (!isMockServer) return null;
  const base = getMockAppApiBase();
  try {
    const res = await fetch(`${base}/functions/lutronCommand`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
      body: JSON.stringify({ op, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * When live control is enabled, a failed remote call must NOT silently fall
 * back to the local mock engine — the operator needs to know the processor
 * rejected the command. We only fall back when the remote is unreachable
 * (returns null) or when live control is off in the stored connection.
 */
function shouldSurfaceLiveError(remote, liveEnabled) {
  if (!liveEnabled) return false;
  if (!remote) return false; // mock-server unreachable → quiet fallback
  return remote.success === false || remote.mode === "live";
}

/** Set a zone level (0-100). Returns the new commanded state. */
export async function setZoneLevel({ zoneHref, level, fadeSeconds = 0 }) {
  if (!zoneHref) throw new Error("zoneHref required");
  const clamped = Math.max(0, Math.min(100, Number(level) || 0));

  if (isDemoModeActive() || !isMockServer) {
    const result = getLocalEngine().setZoneLevel(zoneHref, clamped, fadeSeconds);
    await broadcastZoneUpdate([result]);
    return result;
  }

  const conn = await loadLutronConnection();
  const liveEnabled = !!(conn?.enabled && conn?.host);

  const remote = await callMockLutron("setZoneLevel", {
    zoneHref,
    level: clamped,
    fadeSeconds,
  });
  if (remote?.success) {
    await broadcastZoneUpdate([remote.zone]);
    return remote.zone;
  }
  if (shouldSurfaceLiveError(remote, liveEnabled)) {
    const msg =
      remote?.error ||
      "Lutron processor rejected the command. Check the connection and integration credentials.";
    throw new Error(msg);
  }
  const fallback = getLocalEngine().setZoneLevel(zoneHref, clamped, fadeSeconds);
  await broadcastZoneUpdate([fallback]);
  return fallback;
}

/**
 * Activate a Lutron Area Scene. Pass `sceneName` + `sceneAreaId` (from the
 * parsed integration report) so the server can issue a real `#AREA,id,6,N`
 * command on a live processor; `sceneZones` is still applied so the
 * commanded levels match what the operator sees on the sliders.
 */
export async function activateScene({
  sceneHref,
  sceneName,
  sceneAreaId,
  sceneZones = [],
}) {
  if (!sceneHref) throw new Error("sceneHref required");
  setActiveSceneLocal(sceneHref);

  if (isDemoModeActive() || !isMockServer) {
    const result = getLocalEngine().activateScene(sceneHref, sceneZones);
    await broadcastZoneUpdate(result.zones);
    return result;
  }

  const conn = await loadLutronConnection();
  const liveEnabled = !!(conn?.enabled && conn?.host);

  const remote = await callMockLutron("activateScene", {
    sceneHref,
    sceneName,
    sceneAreaId,
    sceneZones,
  });
  if (remote?.success) {
    await broadcastZoneUpdate(remote.zones || []);
    return remote;
  }
  if (shouldSurfaceLiveError(remote, liveEnabled)) {
    const msg =
      remote?.error ||
      "Lutron processor rejected the scene command. Check the connection and integration credentials.";
    throw new Error(msg);
  }
  const fallback = getLocalEngine().activateScene(sceneHref, sceneZones);
  await broadcastZoneUpdate(fallback.zones);
  return fallback;
}

/**
 * Press a phantom-keypad button. Pass `deviceHref` and `componentNumber`
 * (from the parsed integration report) so the live client can send a real
 * `#DEVICE,<dev>,<comp>,3/4` press/release pair.
 */
export async function pressKeypadButton({ buttonHref, deviceHref, componentNumber }) {
  if (!buttonHref && !deviceHref) throw new Error("buttonHref required");
  if (isDemoModeActive() || !isMockServer) {
    return getLocalEngine().pressButton(buttonHref || deviceHref);
  }

  const conn = await loadLutronConnection();
  const liveEnabled = !!(conn?.enabled && conn?.host);

  const remote = await callMockLutron("pressButton", {
    buttonHref,
    deviceHref,
    componentNumber,
  });
  if (remote?.success) return remote;
  if (shouldSurfaceLiveError(remote, liveEnabled)) {
    throw new Error(remote?.error || "Lutron processor rejected the button press.");
  }
  return getLocalEngine().pressButton(buttonHref || deviceHref);
}

/** Poll current levels for a list of zone hrefs. */
export async function pollZones({ hrefs = [] } = {}) {
  if (isDemoModeActive() || !isMockServer) {
    return getLocalEngine().pollZones(hrefs);
  }
  const remote = await callMockLutron("pollZones", { hrefs });
  if (remote?.success && Array.isArray(remote.zones)) {
    return remote.zones;
  }
  return getLocalEngine().pollZones(hrefs);
}

/**
 * Test connectivity to the configured Lutron processor.
 *
 * Called with no arguments, the stored connection (host / port / protocol /
 * username / password) is used so the operator can verify the saved
 * credentials. Pass an override object to test draft values from the
 * connection settings modal before saving.
 */
export async function testLutronProcessor(override = {}) {
  const stored = await loadLutronConnection();
  const merged = normalizeLutronConnection({ ...stored, ...override });
  const { host, protocol, username, password } = merged;
  const port = merged.port || defaultPortForProtocol(protocol);
  const target = host ? `${host}:${port}` : "(mock)";
  const api = protocol === "leap" ? "LEAP" : "Telnet";

  if (!host) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      success: true,
      mode: "mock",
      processor: target,
      protocol,
      product: "HomeWorks QSX Processor (mock)",
      firmware: "12.6.40",
      api,
      message:
        "No processor host configured — using local mock engine. " +
        "Save the integration host + credentials to enable live control.",
    };
  }

  if (isDemoModeActive() || !isMockServer) {
    await new Promise((r) => setTimeout(r, 600));
    return {
      success: true,
      mode: "mock-bridge",
      processor: target,
      protocol,
      product: "HomeWorks QSX Processor (mock)",
      firmware: "12.6.40",
      api,
      message: `Mock processor reachable at ${target} as ${username || "(no user)"}.`,
    };
  }

  const remote = await callMockLutron("testProcessor", {
    host,
    port,
    protocol,
    username,
    password,
  });
  if (remote?.success) return { protocol, ...remote };
  // Forward every field the server returned (mode, availablePorts,
  // suggestion, etc.) but pin success/processor/protocol so callers can
  // rely on them. The original server message wins over the local fallback.
  return {
    ...(remote || {}),
    success: false,
    mode: remote?.mode || "live",
    processor: remote?.processor || target,
    protocol: remote?.protocol || protocol,
    api: remote?.api || api,
    message:
      remote?.message ||
      remote?.error ||
      "Unable to reach Lutron processor",
  };
}
