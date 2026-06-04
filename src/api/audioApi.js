import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  AUDIO_EVENT_LOG_KEY,
  AUDIO_SYSTEMS_KEY,
  AUDIO_ZONE_STATE_KEY,
  normalizeAudioSystems,
  normalizeAudioEventLog,
  loadAudioSystemsLocal,
  saveAudioSystemsLocal,
  loadZoneStateLocal,
  saveZoneStateLocal,
  loadAudioEventLogLocal,
  saveAudioEventLogLocal,
} from "@/lib/audio/audioSettings";
import { DEMO_AUDIO_SYSTEMS, DEMO_AUDIO_EVENTS } from "@/lib/demo/demoAudioData";

export async function fetchAudioSystems() {
  if (isDemoModeActive()) return DEMO_AUDIO_SYSTEMS;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: AUDIO_SYSTEMS_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeAudioSystems(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[audioApi] fetchAudioSystems failed:", err);
  }
  return loadAudioSystemsLocal();
}

export async function saveAudioSystems(payload) {
  const normalized = normalizeAudioSystems(payload);
  saveAudioSystemsLocal(normalized);
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: AUDIO_SYSTEMS_KEY,
    });
    const body = { key: AUDIO_SYSTEMS_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[audioApi] saveAudioSystems failed:", err);
  }
  return normalized;
}

export async function fetchAudioZoneState() {
  if (isDemoModeActive()) return {};
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: AUDIO_ZONE_STATE_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return parseSettingsValue(records[0].value);
    }
  } catch {}
  return loadZoneStateLocal();
}

export async function saveAudioZoneState(payload) {
  saveZoneStateLocal(payload);
  if (isDemoModeActive()) return;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: AUDIO_ZONE_STATE_KEY,
    });
    const body = { key: AUDIO_ZONE_STATE_KEY, value: payload };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[audioApi] saveZoneState failed:", err);
  }
}

export async function fetchAudioEventLog() {
  if (isDemoModeActive()) return { events: DEMO_AUDIO_EVENTS };
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: AUDIO_EVENT_LOG_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeAudioEventLog(parseSettingsValue(records[0].value));
    }
  } catch {}
  return loadAudioEventLogLocal();
}

export async function saveAudioEventLog(payload) {
  const normalized = normalizeAudioEventLog(payload);
  saveAudioEventLogLocal(normalized);
  if (isDemoModeActive()) return;
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
    console.warn("[audioApi] saveAudioEventLog failed:", err);
  }
}

export async function qsysQrcProxy(method, params) {
  const base = "/api/apps/mock-app/audio/qsys/qrc";
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params }),
    });
    if (!res.ok) throw new Error(`QRC proxy returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[audioApi] QRC proxy failed:", err);
    throw err;
  }
}

export async function qsysDesignUpload(file) {
  const formData = new FormData();
  formData.append("design", file);
  try {
    const res = await fetch("/api/apps/mock-app/audio/qsys/design", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Design upload returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[audioApi] design upload failed:", err);
    throw err;
  }
}

export async function discoverAudioSystems() {
  try {
    const res = await fetch("/api/apps/mock-app/audio/discover");
    if (!res.ok) throw new Error(`Discovery returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[audioApi] discovery failed:", err);
    return { systems: [] };
  }
}
