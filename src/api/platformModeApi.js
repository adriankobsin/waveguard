import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import {
  PLATFORM_MODE_KEY,
  DEFAULT_PLATFORM_MODE,
  normalizePlatformMode,
  loadPlatformModeLocal,
  savePlatformModeLocal,
} from "@/lib/platformMode";

export async function loadPlatformMode() {
  try {
    const records = await base44.entities.SystemSettings.filter({ key: PLATFORM_MODE_KEY });
    if (records.length > 0 && records[0].value != null) {
      const parsed = normalizePlatformMode(parseSettingsValue(records[0].value));
      savePlatformModeLocal(parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("[platformModeApi] load failed:", err);
  }
  return loadPlatformModeLocal() || DEFAULT_PLATFORM_MODE;
}

export async function savePlatformMode(state) {
  const normalized = normalizePlatformMode(state);
  savePlatformModeLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({ key: PLATFORM_MODE_KEY });
    const payload = { key: PLATFORM_MODE_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch (err) {
    console.warn("[platformModeApi] save failed:", err);
  }
  return normalized;
}
