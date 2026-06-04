import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  AUDIO_EVENT_LOG_KEY,
  AUDIO_EVENT_LOG_CHANGED_EVENT,
  AUDIO_EVENT_LOG_MAX,
  DEFAULT_AUDIO_EVENT_LOG,
  normalizeAudioEvent,
  normalizeAudioEventLog,
  loadAudioEventLogLocal,
  saveAudioEventLogLocal,
} from "@/lib/audio/audioSettings";

let memCache = null;

async function loadFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: AUDIO_EVENT_LOG_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeAudioEventLog(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[audioEventLog] load failed:", err);
  }
  return loadAudioEventLogLocal();
}

async function persistToSettings(payload) {
  const normalized = normalizeAudioEventLog(payload);
  saveAudioEventLogLocal(normalized);
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: AUDIO_EVENT_LOG_KEY,
    });
    const body = { key: AUDIO_EVENT_LOG_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[audioEventLog] save failed:", err);
  }
  return normalized;
}

function broadcast(payload) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AUDIO_EVENT_LOG_CHANGED_EVENT, { detail: payload })
    );
  }
}

export async function loadAudioEvents() {
  if (memCache) return memCache;
  if (isDemoModeActive()) return loadAudioEventLogLocal();
  const data = await loadFromSettings();
  memCache = data;
  return data;
}

export async function recordAudioEvent(payload) {
  const current = memCache || (await loadAudioEvents());
  const event = normalizeAudioEvent({
    ...payload,
    id: `audio-evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: payload.timestamp || new Date().toISOString(),
  });
  if (!event) return current;

  let events = [event, ...(current.events || [])];
  if (events.length > AUDIO_EVENT_LOG_MAX) {
    events = events.slice(0, AUDIO_EVENT_LOG_MAX);
  }

  const next = { events };
  memCache = next;
  broadcast(next);
  persistToSettings(next).catch((err) =>
    console.warn("[audioEventLog] background persist failed:", err)
  );
  return next;
}
