import { base44, isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  LIGHTING_HOUSE_SETTINGS_KEY,
  LIGHTING_ZONE_STATE_SETTINGS_KEY,
  LIGHTING_LUTRON_CONNECTION_KEY,
  LIGHTING_CONNECTION_KEY,
  LIGHTING_CUSTOM_SCENES_KEY,
  LIGHTING_HOUSE_CHANGED_EVENT,
  LIGHTING_ZONE_STATE_CHANGED_EVENT,
  LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT,
  LIGHTING_CONNECTION_CHANGED_EVENT,
  LIGHTING_CUSTOM_SCENES_CHANGED_EVENT,
  DEFAULT_LIGHTING_HOUSE,
  DEFAULT_LUTRON_CONNECTION,
  DEFAULT_LIGHTING_CONNECTION,
  DEFAULT_CUSTOM_SCENES,
  normalizeLightingHouse,
  normalizeZoneState,
  normalizeLutronConnection,
  normalizeLightingConnection,
  normalizeCustomScene,
  normalizeCustomScenes,
  loadLightingHouseLocal,
  saveLightingHouseLocal,
  loadZoneStateLocal,
  saveZoneStateLocal,
  loadLutronConnectionLocal,
  saveLutronConnectionLocal,
  loadLightingConnectionLocal,
  saveLightingConnectionLocal,
  loadCustomScenesLocal,
  saveCustomScenesLocal,
  defaultPortForProtocol,
  setActiveSceneLocal,
} from "@/lib/lighting/lightingSettings";
import { buildMockLutronEngine } from "@/lib/integrations/lutron/lutronAdapter";
import { getDemoLightingHouse } from "@/lib/demo/demoSystemSnapshot";
import { recordLightingEvent } from "@/lib/lighting/lightingEventLog";

// Best-effort fire-and-forget logger. We intentionally don't await
// recordLightingEvent inside command handlers because (a) it has its own
// persistence retry and (b) we never want a slider drag to stall on a
// SystemSettings round-trip.
function logEvent(payload) {
  try {
    recordLightingEvent(payload);
  } catch (err) {
    console.warn("[lightingApi] event log failed (ignored):", err);
  }
}

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

/**
 * Validate that an integration address looks like a Lutron `/zone/<digits>`
 * href. Accepts a bare numeric id (we normalise to `/zone/<id>`) or a
 * fully-qualified href. Returns the canonical href on success or null if
 * the input is malformed.
 */
function normalizeZoneHref(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return `/zone/${s}`;
  const m = /^\/zone\/(\d+)$/i.exec(s);
  return m ? `/zone/${m[1]}` : null;
}

/**
 * Rename a lighting zone and/or move it to a different integration
 * address (Lutron href). Persists the change to the lighting-house
 * SystemSettings record, dispatches a `LIGHTING_HOUSE_CHANGED_EVENT`
 * so every consumer (LightingPage, Diagnoses, Event log filters, …)
 * picks the update up live, and migrates any per-zone state stored
 * under the old href so the new row keeps its commanded level / on
 * indicator without an extra processor round-trip.
 *
 * Throws when the new href is malformed or already belongs to another
 * zone. Returns the updated zone.
 */
export async function updateLightingZone({ originalHref, name, href }) {
  if (!originalHref) throw new Error("originalHref required");
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("Zone name cannot be empty");

  const normalizedHref = normalizeZoneHref(href || originalHref);
  if (!normalizedHref) {
    throw new Error(
      "Integration address must look like /zone/<number> (e.g. /zone/5714) or just the numeric id."
    );
  }

  const house = await loadLightingHouse();
  const idx = (house.zones || []).findIndex((z) => z.href === originalHref);
  if (idx < 0) throw new Error(`Zone ${originalHref} not found in lighting house`);

  const target = house.zones[idx];
  const hrefChanged = normalizedHref !== originalHref;
  if (hrefChanged) {
    const clash = house.zones.find(
      (z, i) => i !== idx && z.href === normalizedHref
    );
    if (clash) {
      throw new Error(
        `Integration address ${normalizedHref} already belongs to "${clash.name}". Pick a different address or edit that zone first.`
      );
    }
  }

  const updatedZone = {
    ...target,
    name: cleanName,
    href: normalizedHref,
    id: normalizedHref.replace(/^.*\//, ""),
  };
  const nextZones = [...house.zones];
  nextZones[idx] = updatedZone;

  // Mirror the rename / re-address into the load-schedule entries that
  // reference this zone by zoneName + areaFullPath. We only touch the
  // zoneName field — the schedule's own loadNumber/panel/module/output
  // come from the original parsed report and stay accurate.
  const nextSchedule = (house.loadSchedule || []).map((row) => {
    if (
      row.zoneName === target.name &&
      row.areaFullPath === target.areaFullPath
    ) {
      return { ...row, zoneName: cleanName };
    }
    return row;
  });

  const nextHouse = {
    ...house,
    zones: nextZones,
    loadSchedule: nextSchedule,
  };

  await saveLightingHouse(nextHouse);

  // Migrate the per-zone live state (level / on / kind / updatedAt)
  // from the old href bucket to the new one so the slider doesn't snap
  // back to zero after the user closes the modal.
  if (hrefChanged) {
    try {
      const currentState = await loadZoneState();
      if (currentState && currentState[originalHref]) {
        const next = { ...currentState };
        next[normalizedHref] = next[originalHref];
        delete next[originalHref];
        await persistZoneStateToSettings(next);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(LIGHTING_ZONE_STATE_CHANGED_EVENT, {
              detail: next,
            })
          );
        }
      }
    } catch (err) {
      console.warn("[lightingApi] zone state migration failed:", err);
    }

    // Also forget any cached OpenCloseStop discovery against the old
    // href so the new address gets re-discovered cleanly.
    try {
      if (ocsDiscoveredZones.has(originalHref)) {
        ocsDiscoveredZones.delete(originalHref);
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            OCS_DISCOVERED_KEY,
            JSON.stringify([...ocsDiscoveredZones])
          );
        }
      }
    } catch {
      /* ignore */
    }
  }

  logEvent({
    kind: "zone",
    severity: "info",
    zoneHref: normalizedHref,
    action: "edit",
    result: "success",
    message: hrefChanged
      ? `Renamed "${target.name}" → "${cleanName}" and moved address ${originalHref} → ${normalizedHref}`
      : `Renamed "${target.name}" → "${cleanName}"`,
  });

  return updatedZone;
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

// ── Lighting processor connection (generic, multi-system) ──────────────
// Operates identically to the Lutron-specific section below but supports
// any systemType (lutron, knx, dali, dmx) stored under the generic key.

async function loadLightingConnectionFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_CONNECTION_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeLightingConnection(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[lightingApi] lighting connection load failed:", err);
  }
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_LUTRON_CONNECTION_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      const lutronConn = normalizeLutronConnection(parseSettingsValue(records[0].value));
      return { ...lutronConn, systemType: "lutron" };
    }
  } catch (_) {}
  // Neither key found on the backend — likely the mock-server was restarted
  // and lost its in-memory systemSettings. Rehydrate from localStorage so
  // the live command path keeps working without forcing the operator to
  // re-open the connection modal.
  const localGeneric = loadLightingConnectionLocal();
  if (localGeneric && localGeneric.enabled && localGeneric.host) {
    persistLightingConnectionToSettings(localGeneric).catch((err) =>
      console.warn("[lightingApi] lighting connection rehydrate failed:", err)
    );
    return normalizeLightingConnection(localGeneric);
  }
  const localLutron = loadLutronConnectionLocal();
  if (localLutron && localLutron.enabled && localLutron.host) {
    persistLutronConnectionToSettings(localLutron).catch((err) =>
      console.warn("[lightingApi] lutron connection rehydrate failed:", err)
    );
    return { ...normalizeLutronConnection(localLutron), systemType: "lutron" };
  }
  return loadLightingConnectionLocal() || { ...DEFAULT_LIGHTING_CONNECTION };
}

async function persistLightingConnectionToSettings(conn) {
  const normalized = normalizeLightingConnection(conn);
  saveLightingConnectionLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_CONNECTION_KEY,
    });
    const payload = { key: LIGHTING_CONNECTION_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch (err) {
    console.warn("[lightingApi] lighting connection save failed:", err);
  }
  return normalized;
}

export async function loadLightingConnection() {
  if (isDemoModeActive()) {
  return loadLightingConnectionLocal() || loadLutronConnectionLocal() || { ...DEFAULT_LIGHTING_CONNECTION };
  }
  return loadLightingConnectionFromSettings();
}

export async function saveLightingConnection(conn) {
  const normalized = normalizeLightingConnection({
    ...conn,
    updatedAt: new Date().toISOString(),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIGHTING_CONNECTION_CHANGED_EVENT, {
        detail: normalized,
      })
    );
  }
  if (isDemoModeActive()) {
    saveLightingConnectionLocal(normalized);
    return normalized;
  }
  return persistLightingConnectionToSettings(normalized);
}

// ── Lutron processor connection (integration credentials) ────────────────────

async function loadLutronConnectionFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_LUTRON_CONNECTION_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeLutronConnection(parseSettingsValue(records[0].value));
    }
    // No record on the backend (e.g. mock-server restarted and lost its
    // in-memory state). If we still have the connection cached locally,
    // re-push it so subsequent `lutronCommand` calls can resolve it as a
    // live processor instead of silently dropping into the generic mock
    // engine — which is what causes sliders to snap back.
    const local = loadLutronConnectionLocal();
    if (local && local.enabled && local.host) {
      persistLutronConnectionToSettings(local).catch((err) =>
        console.warn("[lightingApi] lutron connection rehydrate failed:", err)
      );
      return normalizeLutronConnection(local);
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
    // Server returned an error — preserve the error info so the caller can
    // distinguish "server is down" from "server rejected the command".
    return { success: false, mode: "live", error: data?.error || `HTTP ${res.status}`, _httpError: true };
  } catch {
    /* network error — mock server unreachable */
    return null;
  }
}

async function callMockLighting(op, body, systemType) {
  return callMockLutron(op, { ...body, systemType });
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

// Shade-family kind hints we may receive from the UI. Used by
// `setZoneLevel` to decide whether a "GoToLevel not supported for the
// specified ZoneType" rejection should trigger a `raiseLowerStop`
// retry. The list matches the hints accepted by the LEAP client's
// `_kindFromHint` so we never double-classify here.
const SHADE_FAMILY_HINTS = new Set([
  "shade",
  "blind",
  "blackout",
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
  "roman",
  "venetian",
  "openCloseStop",
  "openclosestop",
  "openclose",
  "shadeAndTilt",
  "shadeandtilt",
  "tilt",
]);

function isShadeFamilyHint(zoneKind) {
  if (!zoneKind) return false;
  return SHADE_FAMILY_HINTS.has(String(zoneKind));
}

function isZoneTypeMismatchError(err = "") {
  const s = String(err || "");
  if (!s) return false;
  return (
    /not supported.*zonetype/i.test(s) ||
    /BadRequest/i.test(s) ||
    /400\s*BadRequest/i.test(s)
  );
}

// In-process memo of zones the processor revealed as OpenCloseStop the
// first time we got the ZoneType-mismatch rejection. Persisted to
// `localStorage` so the discovery survives a browser reload — the next
// click on the same zone routes straight to `raiseLowerStop` without
// the one-off retry storm.
const OCS_DISCOVERED_KEY = "waveguard:lighting:ocs-zones";
function loadOcsDiscoveredZones() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return new Set();
    const raw = window.localStorage.getItem(OCS_DISCOVERED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
const ocsDiscoveredZones = loadOcsDiscoveredZones();
function rememberOcsZone(zoneHref) {
  ocsDiscoveredZones.add(zoneHref);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        OCS_DISCOVERED_KEY,
        JSON.stringify([...ocsDiscoveredZones])
      );
    }
  } catch {
    /* quota */
  }
}

/**
 * Set a zone level (0-100). Returns the new commanded state.
 *
 * `zoneKind` is the kind we parsed from the Integration Report
 * ("shade", "blind", "blackout", "switched", "dimmed", ...). The LEAP
 * client uses it to pick the correct CreateRequest shape on HomeWorks QSX
 * (a shade rejected as a dimmer is a silent no-op on most firmwares), so
 * always pass it from the UI when we know it.
 */
export async function setZoneLevel({ zoneHref, level, fadeSeconds = 0, zoneKind = null }) {
  if (!zoneHref) throw new Error("zoneHref required");
  const clamped = Math.max(0, Math.min(100, Number(level) || 0));

  if (isDemoModeActive() || !isMockServer) {
    const result = getLocalEngine().setZoneLevel(zoneHref, clamped, fadeSeconds);
    await broadcastZoneUpdate([result]);
    logEvent({
      kind: "zone",
      severity: "info",
      zoneHref,
      action: "setLevel",
      level: clamped,
      result: "success",
      message: `Mock engine set ${zoneHref} to ${clamped}%`,
    });
    return result;
  }

  const conn = await loadLutronConnection();
  const liveEnabled = !!(conn?.enabled && conn?.host);
  const shadeFamily = isShadeFamilyHint(zoneKind);

  // Zones we previously learned are OpenCloseStop skip the GoToLevel
  // round-trip entirely. The processor would reject every level-based
  // command on these blinds/curtains and force us into the retry path
  // anyway — translating Open/Close → Raise/Lower up front is both
  // faster and keeps the event log clean.
  if (shadeFamily && ocsDiscoveredZones.has(zoneHref)) {
    return _setShadeViaRaiseLower(zoneHref, clamped, zoneKind);
  }

  const remote = await callMockLutron("setZoneLevel", {
    zoneHref,
    zoneKind,
    level: clamped,
    fadeSeconds,
  });
  if (remote?.success) {
    await broadcastZoneUpdate([remote.zone]);
    logEvent({
      kind: "zone",
      severity: "info",
      zoneHref,
      action: "setLevel",
      level: clamped,
      result: "success",
      message: `${remote.mode === "live" ? "Processor" : "Mock"} set ${zoneHref} to ${clamped}%`,
    });
    return remote.zone;
  }

  // Client-side OpenCloseStop fallback. When the processor rejects a
  // level command on a shade-family zone with a "GoToLevel not
  // supported for the specified ZoneType" exception (or any 400
  // BadRequest), the zone is almost certainly an OpenCloseStop blind /
  // curtain motor and the Lutron LEAP `_probeZoneKind` couldn't pin it
  // down. Retry the same gesture as `raiseLowerStop` (raise for
  // level ≥50, lower otherwise) so the user's Open / Close button
  // wires through anyway, then remember the discovery so subsequent
  // clicks skip the level dance entirely.
  if (
    shadeFamily &&
    remote?.success === false &&
    isZoneTypeMismatchError(remote?.error)
  ) {
    try {
      const result = await _setShadeViaRaiseLower(zoneHref, clamped, zoneKind);
      rememberOcsZone(zoneHref);
      return result;
    } catch (raiseErr) {
      // Both level command and raiseLowerStop failed — surface the
      // original (more descriptive) error to the operator.
      const msg =
        remote?.error ||
        raiseErr?.message ||
        "Lutron processor rejected the command.";
      logEvent({
        kind: "zone",
        severity: "warning",
        zoneHref,
        action: "setLevel",
        level: clamped,
        result: "failed",
        message: `${msg} · Raise/Lower fallback also failed: ${raiseErr?.message || "unknown"}`,
      });
      throw new Error(msg);
    }
  }

  if (shouldSurfaceLiveError(remote, liveEnabled)) {
    const msg =
      remote?.error ||
      "Lutron processor rejected the command. Check the connection and integration credentials.";
    logEvent({
      kind: "zone",
      severity: "warning",
      zoneHref,
      action: "setLevel",
      level: clamped,
      result: "failed",
      message: msg,
    });
    throw new Error(msg);
  }
  const fallback = getLocalEngine().setZoneLevel(zoneHref, clamped, fadeSeconds);
  await broadcastZoneUpdate([fallback]);
  logEvent({
    kind: "zone",
    severity: "info",
    zoneHref,
    action: "setLevel",
    level: clamped,
    result: "fallback",
    message: "Processor unreachable — applied to local mock engine instead.",
  });
  return fallback;
}

/**
 * Implementation detail of `setZoneLevel`: translate a 0-100 target
 * level into the matching `raiseLowerStop` command for an OpenCloseStop
 * blind/curtain and feed the resulting state back through
 * `broadcastZoneUpdate` so the UI converges. Used both as the recovery
 * path after a ZoneType-mismatch rejection and as the cached fast path
 * for zones we previously discovered to be OpenCloseStop.
 */
async function _setShadeViaRaiseLower(zoneHref, clamped, zoneKind) {
  const action = clamped >= 50 ? "raise" : "lower";
  const remote = await callMockLutron("raiseLowerStop", {
    zoneHref,
    zoneKind: zoneKind || "openCloseStop",
    action,
  });
  if (remote?.success) {
    const next = {
      href: zoneHref,
      level: clamped,
      on: clamped > 0,
      kind: "openCloseStop",
      updatedAt: new Date().toISOString(),
    };
    await broadcastZoneUpdate([next]);
    logEvent({
      kind: "zone",
      severity: "info",
      zoneHref,
      action: "setLevel",
      level: clamped,
      result: "success",
      message: `Processor ${action === "raise" ? "opened" : "closed"} ${zoneHref} (OpenCloseStop)`,
    });
    return next;
  }
  const errMsg =
    remote?.error || `Processor rejected ${action} on ${zoneHref}`;
  throw new Error(errMsg);
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
    logEvent({
      kind: "scene",
      severity: "info",
      action: "activateScene",
      result: "success",
      message: `Mock engine activated scene ${sceneName || sceneHref}`,
    });
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
    logEvent({
      kind: "scene",
      severity: "info",
      action: "activateScene",
      result: "success",
      message: `${remote.mode === "live" ? "Processor" : "Mock"} activated scene ${sceneName || sceneHref}`,
    });
    return remote;
  }
  if (shouldSurfaceLiveError(remote, liveEnabled)) {
    const msg =
      remote?.error ||
      "Lutron processor rejected the scene command. Check the connection and integration credentials.";
    logEvent({
      kind: "scene",
      severity: "warning",
      action: "activateScene",
      result: "failed",
      message: `${sceneName || sceneHref}: ${msg}`,
    });
    throw new Error(msg);
  }
  const fallback = getLocalEngine().activateScene(sceneHref, sceneZones);
  await broadcastZoneUpdate(fallback.zones);
  logEvent({
    kind: "scene",
    severity: "info",
    action: "activateScene",
    result: "fallback",
    message: `Processor unreachable — scene ${sceneName || sceneHref} applied to mock engine.`,
  });
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
 * Open a live event stream from the Lutron processor.
 *
 * The mock-server forwards every `zoneLevel` event the LEAP / Telnet client
 * observes (initial snapshot on connect, then every wall-keypad press,
 * timeclock scene, app command, or our own GoToLevel) as Server-Sent Events.
 *
 * Returns an object `{ close() }` for the caller to tear down the stream
 * (typically on component unmount). The connection auto-reconnects via the
 * native EventSource backoff, plus we manually re-open on processor-side
 * errors (e.g. credentials changed) with a 5-second delay so a flapping
 * processor doesn't hammer the server.
 *
 * `onUpdate` is called with `{ type, ...payload }` where:
 *   - `type: "snapshot"` → payload has `{ processor, protocol, zones: [...] }`.
 *   - `type: "zoneLevel"` → payload has `{ href, integrationId, level, on, kind, updatedAt }`.
 *   - `type: "error"` → payload has `{ message }` (informational; the stream
 *     will retry automatically).
 */
export function subscribeLutronEvents(onUpdate) {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return { close: () => {} };
  }
  if (isDemoModeActive() || !isMockServer) {
    // Demo mode has no real processor to stream from. The local mock engine
    // doesn't push events, so just no-op the subscription.
    return { close: () => {} };
  }

  let source = null;
  let retryTimer = null;
  let closed = false;
  const base = getMockAppApiBase();
  // EventSource doesn't allow custom headers; the mock server treats this
  // endpoint as unauthenticated (it's local-only) so the auth header is
  // unnecessary. If we ever proxy to a remote endpoint we'd need to mint a
  // short-lived token in the URL.
  const url = `${base}/functions/lutronEvents`;

  const safeEmit = (payload) => {
    try {
      onUpdate?.(payload);
    } catch (err) {
      console.warn("[lightingApi] subscribeLutronEvents handler threw:", err);
    }
  };

  const connect = () => {
    if (closed) return;
    try {
      source = new EventSource(url);
    } catch (err) {
      safeEmit({ type: "error", message: err.message });
      scheduleRetry();
      return;
    }
    source.addEventListener("snapshot", (e) => {
      try {
        const payload = JSON.parse(e.data || "{}");
        safeEmit({ type: "snapshot", ...payload });
      } catch (err) {
        console.warn("[lightingApi] bad snapshot payload:", err);
      }
    });
    source.addEventListener("zoneLevel", (e) => {
      try {
        const payload = JSON.parse(e.data || "{}");
        safeEmit({ type: "zoneLevel", ...payload });
      } catch (err) {
        console.warn("[lightingApi] bad zoneLevel payload:", err);
      }
    });
    source.addEventListener("error", (e) => {
      // Two distinct flavours of "error" land here:
      //   1) An app-level `error` event the server emitted with a JSON body
      //      describing why it gave up (no certs, connect failed, etc.).
      //   2) A transport error (EventSource fires the generic "error" with
      //      no `data`). EventSource will auto-reconnect on its own; we just
      //      surface the message for debugging.
      const message =
        typeof e?.data === "string" && e.data
          ? (() => {
              try {
                return JSON.parse(e.data).message || e.data;
              } catch {
                return e.data;
              }
            })()
          : "Live event stream lost connection — retrying…";
      safeEmit({ type: "error", message });
      // If the server explicitly closed the stream (readyState CLOSED),
      // schedule a manual retry; otherwise EventSource handles it.
      if (source?.readyState === EventSource.CLOSED) {
        try { source.close(); } catch { /* */ }
        source = null;
        scheduleRetry();
      }
    });
  };

  const scheduleRetry = () => {
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, 5000);
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (source) {
        try { source.close(); } catch { /* */ }
        source = null;
      }
    },
  };
}

/**
 * Stop a moving shade/blind. Sends the raiseLowerStop command to halt
 * the shade at its current position. `zoneKind` is forwarded so the LEAP
 * client can seed its kind cache without an extra ReadRequest probe.
 */
export async function stopShade({ zoneHref, zoneKind = "shade" } = {}) {
  if (!zoneHref) throw new Error("zoneHref required");
  if (isDemoModeActive() || !isMockServer) {
    const r = getLocalEngine().raiseLower(zoneHref, "stop");
    logEvent({ kind: "zone", zoneHref, action: "stop", result: "success", message: "Mock engine stopped shade" });
    return r;
  }

  const remote = await callMockLutron("raiseLowerStop", {
    zoneHref,
    zoneKind,
    action: "stop",
  });
  if (remote?.success) {
    logEvent({ kind: "zone", zoneHref, action: "stop", result: "success", message: "Processor stopped shade" });
    return remote;
  }
  if (remote && remote.success === false) {
    logEvent({
      kind: "zone",
      severity: "warning",
      zoneHref,
      action: "stop",
      result: "failed",
      message: remote.error || "Processor rejected stop command",
    });
  }
  return getLocalEngine().raiseLower(zoneHref, "stop");
}

/**
 * Continuous-direction shade/blind commands — start raising, lowering, or
 * stop. Exposed as a separate function so the UI can implement press-and-
 * hold style controls.
 */
export async function raiseLowerShade({ zoneHref, action = "stop", zoneKind = "shade" } = {}) {
  if (!zoneHref) throw new Error("zoneHref required");
  if (!["raise", "lower", "stop"].includes(action)) {
    throw new Error(`raiseLowerShade: invalid action "${action}"`);
  }
  if (isDemoModeActive() || !isMockServer) {
    const r = getLocalEngine().raiseLower(zoneHref, action);
    logEvent({ kind: "zone", zoneHref, action, result: "success", message: `Mock engine ${action} shade` });
    return r;
  }

  const remote = await callMockLutron("raiseLowerStop", {
    zoneHref,
    zoneKind,
    action,
  });
  if (remote?.success) {
    logEvent({ kind: "zone", zoneHref, action, result: "success", message: `Processor ${action} shade` });
    return remote;
  }
  if (remote && remote.success === false) {
    logEvent({
      kind: "zone",
      severity: "warning",
      zoneHref,
      action,
      result: "failed",
      message: remote.error || `Processor rejected ${action}`,
    });
  }
  return getLocalEngine().raiseLower(zoneHref, action);
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
  return testLightingProcessor(override, "lutron");
}

/**
 * Test connectivity to any lighting processor. Pass `override.systemType` or
 * it defaults to `"lutron"` for backward compatibility.
 */
export async function testLightingProcessor(override = {}, systemType) {
  const stored = await loadLightingConnection();
  const effectiveType = systemType || override.systemType || stored.systemType || "lutron";
  const merged = normalizeLightingConnection({ ...stored, ...override, systemType: effectiveType });
  const { host, protocol, username, password } = merged;
  const port = merged.port || defaultPortForProtocol(protocol, effectiveType);
  const target = host ? `${host}:${port}` : "(mock)";
  const api = protocol === "leap" ? "LEAP" : protocol === "knx-ip" ? "KNX IP" : protocol === "art-net" ? "Art-Net" : protocol === "sacn" ? "sACN" : protocol === "dali-ip" ? "DALI IP" : (protocol || "").toUpperCase().replace(/-/g, " ");

  if (!host) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      success: true,
      mode: "mock",
      processor: target,
      protocol,
      product: `${effectiveType.toUpperCase()} Mock Engine`,
      firmware: "1.0.0",
      api,
      message:
        `No ${effectiveType.toUpperCase()} processor host configured — using local mock engine. ` +
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
      product: `${effectiveType.toUpperCase()} Processor (mock)`,
      firmware: "1.0.0",
      api,
      message: `Mock processor reachable at ${target} as ${username || "(no user)"}.`,
    };
  }

  const remote = await callMockLighting("testProcessor", {
    host,
    port,
    protocol,
    username,
    password,
  }, effectiveType);

  if (remote?.success) return { protocol, ...remote };
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
      `Unable to reach ${effectiveType.toUpperCase()} processor`,
  };
}

// ── User-authored scenes (Scenes page) ──────────────────────────────────

async function loadCustomScenesFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_CUSTOM_SCENES_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeCustomScenes(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[lightingApi] custom scenes load failed:", err);
  }
  return loadCustomScenesLocal() || { ...DEFAULT_CUSTOM_SCENES };
}

async function persistCustomScenesToSettings(payload) {
  const normalized = normalizeCustomScenes(payload);
  saveCustomScenesLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_CUSTOM_SCENES_KEY,
    });
    const body = { key: LIGHTING_CUSTOM_SCENES_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[lightingApi] custom scenes save failed:", err);
  }
  return normalized;
}

function broadcastCustomScenes(payload) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIGHTING_CUSTOM_SCENES_CHANGED_EVENT, { detail: payload })
    );
  }
}

export async function loadCustomScenes() {
  if (isDemoModeActive()) return loadCustomScenesLocal() || { ...DEFAULT_CUSTOM_SCENES };
  return loadCustomScenesFromSettings();
}

export async function saveCustomScenes(payload) {
  const normalized = normalizeCustomScenes(payload);
  broadcastCustomScenes(normalized);
  if (isDemoModeActive()) {
    saveCustomScenesLocal(normalized);
    return normalized;
  }
  return persistCustomScenesToSettings(normalized);
}

/** Add (or update by id) a single custom scene. */
export async function addCustomScene(scene) {
  const incoming = normalizeCustomScene(scene);
  if (!incoming) throw new Error("Invalid scene payload");
  const current = await loadCustomScenes();
  const idx = current.scenes.findIndex((s) => s.id === incoming.id);
  const next = { ...current };
  if (idx >= 0) {
    next.scenes = current.scenes.map((s, i) => (i === idx ? incoming : s));
  } else {
    next.scenes = [...current.scenes, incoming];
  }
  return saveCustomScenes(next);
}

export async function removeCustomScene(id) {
  if (!id) return loadCustomScenes();
  const current = await loadCustomScenes();
  const next = {
    ...current,
    scenes: current.scenes.filter((s) => s.id !== id),
  };
  return saveCustomScenes(next);
}

/**
 * Execute a user-authored scene against the live processor.
 *
 * Each scene kind dispatches differently:
 *   - area_scene     → #AREA,<id>,6,<n> via liveClient.activateAreaScene().
 *   - leap_href      → parsed as /area/<id>/scene/<n> and routed through
 *                      activateAreaScene as well (a real LEAP processor
 *                      only exposes scenes through an area context).
 *   - phantom_button → CreateRequest /button/<comp> on a virtual phantom
 *                      keypad device (#DEVICE on Telnet).
 *
 * Returns the mock-server response so the UI can record the result in the
 * event log. Updates `lastRunAt` on the saved scene record on success.
 */
export async function runCustomScene(sceneOrId) {
  const id = typeof sceneOrId === "string" ? sceneOrId : sceneOrId?.id;
  if (!id) throw new Error("scene id required");
  const current = await loadCustomScenes();
  const scene = current.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Scene ${id} not found`);

  if (isDemoModeActive() || !isMockServer) {
    // Demo / no-server: just simulate success and bump lastRunAt so the
    // UI still feels alive. The local engine doesn't know about user
    // scenes, but it does know about parsed-report scenes; a custom
    // scene typically references a real Lutron area scene so this is
    // mainly a UX nicety.
    const updated = {
      ...scene,
      lastRunAt: new Date().toISOString(),
      lastResult: "success",
    };
    await addCustomScene(updated);
    logEvent({
      kind: "custom",
      action: "runCustomScene",
      result: "success",
      message: `Mock engine ran scene ${scene.name}`,
    });
    return { success: true, mode: "mock", scene: updated };
  }

  const conn = await loadLutronConnection();
  const liveEnabled = !!(conn?.enabled && conn?.host);

  const remote = await callMockLutron("customScene", { scene });
  if (remote?.success) {
    const updated = {
      ...scene,
      lastRunAt: new Date().toISOString(),
      lastResult: "success",
    };
    await addCustomScene(updated);
    if (Array.isArray(remote.zones) && remote.zones.length > 0) {
      await broadcastZoneUpdate(remote.zones);
    }
    logEvent({
      kind: "custom",
      action: "runCustomScene",
      result: "success",
      message: `Processor ran scene ${scene.name}`,
    });
    return remote;
  }
  if (shouldSurfaceLiveError(remote, liveEnabled)) {
    const updated = {
      ...scene,
      lastRunAt: new Date().toISOString(),
      lastResult: "failed",
    };
    await addCustomScene(updated);
    const msg = remote?.error || "Lutron processor rejected the scene command.";
    logEvent({
      kind: "custom",
      severity: "warning",
      action: "runCustomScene",
      result: "failed",
      message: `${scene.name}: ${msg}`,
    });
    throw new Error(msg);
  }
  // Mock-server unreachable — record as unknown so the UI doesn't lie.
  const updated = {
    ...scene,
    lastRunAt: new Date().toISOString(),
    lastResult: "unreachable",
  };
  await addCustomScene(updated);
  logEvent({
    kind: "custom",
    severity: "warning",
    action: "runCustomScene",
    result: "unreachable",
    message: `${scene.name}: mock server unreachable`,
  });
  return { success: false, mode: "live", scene: updated, error: "Mock server unreachable" };
}

// ── LEAP certificate pairing ──────────────────────────────────────────────

async function callLeapFunction(endpoint, body) {
  if (!isMockServer) {
    return { success: true, mock: true };
  }
  const base = getMockAppApiBase();
  try {
    const res = await fetch(`${base}/functions/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
      body: JSON.stringify(body),
    });
    return await res.json().catch(() => ({}));
  } catch {
    return null;
  }
}

/**
 * Start LEAP certificate pairing with a Lutron processor. Returns immediately
 * with `{ status: "pairing", pollIntervalMs }`. Use `leapGetPairingStatus()`
 * to poll for progress updates.
 */
export async function leapPairWithProcessor(host, port = 8083) {
  if (isDemoModeActive() || !isMockServer) {
    await new Promise((r) => setTimeout(r, 1500));
    return { success: true, status: "paired", host, message: "Pairing simulated (demo mode)" };
  }
  const result = await callLeapFunction("lutronLeapPair", { host, port });
  return result || { success: false, status: "failed", host, message: "Mock server unreachable" };
}

/**
 * Check LEAP pairing status / progress for a given host. Returns detailed
 * status:
 *   { status: "paired"|"pairing"|"failed"|"unpaired",
 *     state?: "connecting"|"waiting-button"|"signing",
 *     message?: string,
 *     error?: string,
 *     elapsedMs?: number,
 *     pairedHosts?: string[] }
 */
export async function leapGetPairingStatus(host) {
  const result = await callLeapFunction("lutronLeapPairingStatus", { host });
  return result || { host, status: "unpaired", pairedHosts: [] };
}

/**
 * Cancel an in-progress LEAP pairing for a host.
 */
export async function leapCancelPairing(host) {
  const result = await callLeapFunction("lutronLeapCancel", { host });
  return result || { success: false, host, status: "error" };
}

/**
 * Diagnostic: test raw TCP + TLS connectivity to the processor's LEAP port
 * (8081). Does NOT attempt pairing. Useful to separate network / firewall
 * issues from authentication issues.
 *
 * Returns: { success, reachable, tlsAccepted, peerCert, error, durationMs }
 */
export async function leapTestConnection(host, port) {
  if (!isMockServer) {
    return {
      success: false,
      reachable: false,
      tlsAccepted: false,
      error: "Connectivity test requires the local mock server.",
    };
  }
  const result = await callLeapFunction("lutronLeapTestConnection", { host, port });
  return result || {
    success: false,
    reachable: false,
    tlsAccepted: false,
    error: "Mock server unreachable",
  };
}

/**
 * Unpair (remove certificates) for a given host.
 */
export async function leapUnpairProcessor(host) {
  const result = await callLeapFunction("lutronLeapUnpair", { host });
  return result || { success: false, host, status: "error" };
}
