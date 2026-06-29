/**
 * Lighting event log — append-only ring buffer of every command the
 * platform issued against the Lutron processor (or local mock engine).
 *
 * Each entry records who/what was commanded, the resolved result, and a
 * short human message. The log feeds:
 *   - The "Recent activity" rail on the Lighting and Scenes pages.
 *   - The Diagnoses page (via lightingDiagnoses.js) — successive failures
 *     on the same zone escalate into a critical diagnosis.
 *
 * Storage shape:
 *   SystemSettings key `lighting-event-log` → { events: [Event] }
 *   localStorage `waveguard:lighting:event-log` mirror for offline use.
 *
 * Events are capped at LIGHTING_EVENT_LOG_MAX (200) — older entries are
 * dropped on the next write.
 */

import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  LIGHTING_EVENT_LOG_KEY,
  LIGHTING_EVENT_LOG_CHANGED_EVENT,
  LIGHTING_EVENT_LOG_MAX,
  DEFAULT_LIGHTING_EVENT_LOG,
  normalizeLightingEvent,
  normalizeLightingEventLog,
  loadLightingEventLogLocal,
  saveLightingEventLogLocal,
} from "@/lib/lighting/lightingSettings";

// In-memory mirror used to coalesce rapid writes. Writes are still
// persisted to SystemSettings + localStorage, but we always read from
// this cache first so back-to-back records remain fast.
let memCache = null;

async function loadFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_EVENT_LOG_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeLightingEventLog(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[lightingEventLog] load failed:", err);
  }
  return loadLightingEventLogLocal();
}

async function persistToSettings(payload) {
  const normalized = normalizeLightingEventLog(payload);
  saveLightingEventLogLocal(normalized);
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: LIGHTING_EVENT_LOG_KEY,
    });
    const body = { key: LIGHTING_EVENT_LOG_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[lightingEventLog] save failed:", err);
  }
  return normalized;
}

function broadcast(payload) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIGHTING_EVENT_LOG_CHANGED_EVENT, { detail: payload })
    );
  }
}

/**
 * Read the full event log. Cheap (returns the in-memory cache after the
 * first load) — safe to call from useEffect hooks.
 */
export async function loadLightingEvents() {
  if (memCache) return memCache;
  if (isDemoModeActive()) {
    memCache = loadLightingEventLogLocal();
    return memCache;
  }
  memCache = await loadFromSettings();
  return memCache;
}

/**
 * Append a single event. Returns the updated log.
 *
 * `event` is anything `normalizeLightingEvent` accepts:
 *   { kind, severity, zoneHref, zoneName, action, level, result, message }
 *
 * `kind` is conventionally one of:
 *   - "zone"   : setZoneLevel / stopShade / raiseLowerShade on a zone
 *   - "scene"  : activateScene from the parsed report
 *   - "custom" : runCustomScene from the Scenes page
 *   - "system" : processor connect/disconnect / pairing notifications
 *
 * `severity` defaults to "info"; pass "warning" for a single rejection
 * and "critical" if the caller knows the zone is now considered down.
 */
export async function recordLightingEvent(event) {
  const normalized = normalizeLightingEvent(event);
  if (!normalized) return memCache || { ...DEFAULT_LIGHTING_EVENT_LOG };

  const current = memCache || (await loadLightingEvents());
  const next = {
    events: [...current.events, normalized].slice(-LIGHTING_EVENT_LOG_MAX),
  };
  memCache = next;
  broadcast(next);
  // Don't await persistence — the operator shouldn't wait on a network
  // round-trip just to drive a slider. The localStorage mirror is
  // synchronous and will save on next page load if SystemSettings fails.
  persistToSettings(next).catch((err) => {
    console.warn("[lightingEventLog] persist failed (will retry on next event):", err);
  });
  return next;
}

/**
 * Clear the entire log. Used by the "Clear activity" button in the
 * Lighting page's Recent activity panel.
 */
export async function clearLightingEvents() {
  const empty = { ...DEFAULT_LIGHTING_EVENT_LOG, events: [] };
  memCache = empty;
  broadcast(empty);
  await persistToSettings(empty);
  return empty;
}

/**
 * Convenience selector — number of failures in the most recent `windowMs`
 * for a given zone href. Used by `lightingDiagnoses.js` to decide when a
 * zone has flaked enough times to deserve a critical diagnosis.
 */
export function countRecentFailures(events, zoneHref, windowMs = 5 * 60 * 1000) {
  if (!Array.isArray(events) || !zoneHref) return 0;
  const cutoff = Date.now() - windowMs;
  let n = 0;
  for (const e of events) {
    if (!e || e.zoneHref !== zoneHref || e.result === "success") continue;
    const ts = Date.parse(e.ts);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    n += 1;
  }
  return n;
}
