/**
 * Patch panel edit log — append-only ring buffer of schedule changes.
 * Mirrored in SystemSettings + localStorage; also written to ActionLog.
 */

import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";

export const PATCH_PANEL_EVENT_LOG_KEY = "patch-panel-event-log";
export const PATCH_PANEL_EVENT_LOG_CHANGED_EVENT = "waveguard-patch-panel-log-changed";
export const PATCH_PANEL_EVENT_LOG_MAX = 300;
export const PATCH_PANEL_EVENT_LOG_LOCAL = "waveguard:patch-panel:event-log";

const DEFAULT_LOG = { events: [] };

let memCache = null;

function normalizeEvent(raw = {}) {
  return {
    id: raw.id || `ppe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: raw.at || new Date().toISOString(),
    action: raw.action || "update",
    panel: raw.panel || "",
    port: raw.port != null ? String(raw.port) : "",
    summary: raw.summary || "",
    details: raw.details || "",
    status: raw.status || "success",
  };
}

function normalizeLog(raw) {
  const events = Array.isArray(raw?.events) ? raw.events.map(normalizeEvent) : [];
  return { events: events.slice(0, PATCH_PANEL_EVENT_LOG_MAX) };
}

export function loadPatchPanelEventLogLocal() {
  try {
    const raw = localStorage.getItem(PATCH_PANEL_EVENT_LOG_LOCAL);
    if (!raw) return { ...DEFAULT_LOG };
    return normalizeLog(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LOG };
  }
}

export function savePatchPanelEventLogLocal(payload) {
  const normalized = normalizeLog(payload);
  localStorage.setItem(PATCH_PANEL_EVENT_LOG_LOCAL, JSON.stringify(normalized));
  return normalized;
}

async function loadFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: PATCH_PANEL_EVENT_LOG_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeLog(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[patchPanelEventLog] load failed:", err);
  }
  return loadPatchPanelEventLogLocal();
}

async function persistToSettings(payload) {
  const normalized = normalizeLog(payload);
  savePatchPanelEventLogLocal(normalized);
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: PATCH_PANEL_EVENT_LOG_KEY,
    });
    const body = { key: PATCH_PANEL_EVENT_LOG_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[patchPanelEventLog] save failed:", err);
  }
  return normalized;
}

function broadcast(payload) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PATCH_PANEL_EVENT_LOG_CHANGED_EVENT, { detail: payload })
    );
  }
}

export async function loadPatchPanelEventLog() {
  if (memCache) return memCache;
  memCache = await loadFromSettings();
  return memCache;
}

/** List recent events, optionally filtered to one panel name. */
export async function listPatchPanelEventLogs({ panel = "", limit = 80 } = {}) {
  const log = await loadPatchPanelEventLog();
  const panelKey = String(panel || "").trim().toLowerCase();
  let events = log.events || [];
  if (panelKey) {
    events = events.filter((e) => String(e.panel || "").trim().toLowerCase() === panelKey);
  }
  return events.slice(0, limit);
}

/**
 * Record a patch-panel schedule change to the event log + ActionLog entity.
 */
export async function recordPatchPanelEvent({
  action = "update",
  panel = "",
  port = "",
  summary = "",
  details = "",
  status = "success",
} = {}) {
  const event = normalizeEvent({ action, panel, port, summary, details, status });
  const current = await loadPatchPanelEventLog();
  const next = normalizeLog({ events: [event, ...(current.events || [])] });
  memCache = next;
  await persistToSettings(next);
  broadcast(next);

  try {
    if (!isDemoModeActive()) {
      await base44.entities.ActionLog.create({
        action: `patch_panel_${action}`,
        rule_name: "Patch panel schedule",
        trigger_device: panel || "patch-panel",
        action_target: port ? `${panel} P${port}` : panel,
        status,
        result_message: summary || details || "Patch panel updated",
        details: details || summary,
        observed_value: port ? `port ${port}` : "",
      });
    }
  } catch (err) {
    console.warn("[patchPanelEventLog] ActionLog write failed:", err);
  }

  return event;
}
