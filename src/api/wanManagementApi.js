import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import {
  WAN_MANAGEMENT_SETTINGS_KEY,
  DEFAULT_WAN_MANAGEMENT,
  normalizeWanManagement,
  saveWanManagementLocal,
  loadWanManagementLocal,
  WAN_MANAGEMENT_CHANGED_EVENT,
} from "@/lib/wan/wanManagementSettings";
import { isDemoModeActive } from "@/lib/platformMode";
import { getDemoWanManagement } from "@/lib/demo/demoSystemSnapshot";

async function loadFromSystemSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({ key: WAN_MANAGEMENT_SETTINGS_KEY });
    if (records.length > 0 && records[0].value != null) {
      return normalizeWanManagement(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[wanManagementApi] settings load failed:", err);
  }
  return loadWanManagementLocal() || DEFAULT_WAN_MANAGEMENT;
}

async function persistToSystemSettings(state) {
  const normalized = normalizeWanManagement(state);
  saveWanManagementLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({ key: WAN_MANAGEMENT_SETTINGS_KEY });
    const payload = { key: WAN_MANAGEMENT_SETTINGS_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, payload);
    } else {
      await base44.entities.SystemSettings.create(payload);
    }
  } catch (err) {
    console.warn("[wanManagementApi] settings save failed:", err);
  }
  return normalized;
}

export async function loadWanManagement() {
  if (isDemoModeActive()) {
    return normalizeWanManagement(getDemoWanManagement());
  }
  return loadFromSystemSettings();
}

export async function saveWanManagement(state) {
  if (isDemoModeActive()) {
    const normalized = normalizeWanManagement(state);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(WAN_MANAGEMENT_CHANGED_EVENT, { detail: normalized }));
    }
    return normalized;
  }
  return persistToSystemSettings(state);
}
