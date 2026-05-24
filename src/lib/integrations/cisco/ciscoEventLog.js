/**
 * Cisco event log — append-only ring buffer (max 200) of every Cisco
 * command the platform issued, every port up/down transition observed
 * via SSE, and every connection test outcome.
 *
 * Storage shape:
 *   SystemSettings key `network-cisco-event-log` → { events: [Event] }
 *   localStorage `waveguard:network:cisco-event-log` mirror for offline use.
 *
 * Mirrors the Lutron implementation in
 * `src/lib/lighting/lightingEventLog.js`.
 */

import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  NETWORK_CISCO_EVENT_LOG_KEY,
  NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT,
  NETWORK_CISCO_EVENT_LOG_MAX,
  DEFAULT_CISCO_EVENT_LOG,
  normalizeCiscoEvent,
  normalizeCiscoEventLog,
  loadCiscoEventLogLocal,
  saveCiscoEventLogLocal,
} from "@/lib/network/ciscoSwitchSettings";

let memCache = null;

async function loadFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: NETWORK_CISCO_EVENT_LOG_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeCiscoEventLog(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[ciscoEventLog] load failed:", err);
  }
  return loadCiscoEventLogLocal();
}

async function persistToSettings(payload) {
  const normalized = normalizeCiscoEventLog(payload);
  saveCiscoEventLogLocal(normalized);
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: NETWORK_CISCO_EVENT_LOG_KEY,
    });
    const body = { key: NETWORK_CISCO_EVENT_LOG_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[ciscoEventLog] save failed:", err);
  }
  return normalized;
}

function broadcast(payload) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT, { detail: payload })
    );
  }
}

export async function loadCiscoEvents() {
  if (memCache) return memCache;
  if (isDemoModeActive()) {
    memCache = loadCiscoEventLogLocal();
    return memCache;
  }
  memCache = await loadFromSettings();
  return memCache;
}

export async function recordCiscoEvent(event) {
  const normalized = normalizeCiscoEvent(event);
  if (!normalized) return memCache || { ...DEFAULT_CISCO_EVENT_LOG };
  const current = memCache || (await loadCiscoEvents());
  const next = {
    events: [...current.events, normalized].slice(-NETWORK_CISCO_EVENT_LOG_MAX),
  };
  memCache = next;
  broadcast(next);
  persistToSettings(next).catch((err) => {
    console.warn("[ciscoEventLog] persist failed (will retry on next event):", err);
  });
  return next;
}

export async function clearCiscoEvents() {
  const empty = { ...DEFAULT_CISCO_EVENT_LOG, events: [] };
  memCache = empty;
  broadcast(empty);
  await persistToSettings(empty);
  return empty;
}

/** Convenience selector — count of recent port-changes for a port. */
export function countRecentPortChanges(events, host, ifIndex, windowMs = 5 * 60 * 1000) {
  if (!Array.isArray(events)) return 0;
  const cutoff = Date.now() - windowMs;
  let n = 0;
  for (const e of events) {
    if (!e || e.kind !== "port-change") continue;
    if (e.host !== host || String(e.ifIndex) !== String(ifIndex)) continue;
    const ts = Date.parse(e.ts);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    n += 1;
  }
  return n;
}
