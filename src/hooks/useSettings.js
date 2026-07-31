import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { loadGeneralSettingsLocal, saveGeneralSettingsLocal } from "@/lib/generalSettingsStorage";
import {
  loadSiteLocationsLocal,
  saveSiteLocationsLocal,
  SITE_LOCATIONS_SETTINGS_KEY,
  normalizeSiteLocations,
} from "@/lib/siteLocations";
import {
  loadDiscoverySettingsLocal,
  saveDiscoverySettingsLocal,
  DISCOVERY_SETTINGS_KEY,
  DISCOVERY_CHANGED_EVENT,
  normalizeDiscoverySettings,
} from "@/lib/discoverySettings";

export function useSettings(key, defaults, options = {}) {
  const { onSaved } = options;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const [value, setValue] = useState(() => {
    if (key === "general") {
      const local = loadGeneralSettingsLocal();
      if (local) return { ...defaults, ...local };
    }
    if (key === SITE_LOCATIONS_SETTINGS_KEY) {
      const local = loadSiteLocationsLocal();
      if (local) return normalizeSiteLocations({ ...defaults, ...local });
    }
    if (key === DISCOVERY_SETTINGS_KEY) {
      const local = loadDiscoverySettingsLocal();
      if (local) return normalizeDiscoverySettings({ ...defaults, ...local });
    }
    return defaults;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const load = useCallback(async () => {
    setLoading(true);
    let merged = { ...defaultsRef.current };
    const local =
      key === "general"
        ? loadGeneralSettingsLocal()
        : key === SITE_LOCATIONS_SETTINGS_KEY
          ? loadSiteLocationsLocal()
          : key === DISCOVERY_SETTINGS_KEY
            ? loadDiscoverySettingsLocal()
            : null;

    try {
      const records = await base44.entities.SystemSettings.filter({ key });
      if (records.length > 0 && records[0].value != null) {
        const parsed = parseSettingsValue(records[0].value);
        merged =
          key === SITE_LOCATIONS_SETTINGS_KEY
            ? normalizeSiteLocations({ ...merged, ...parsed })
            : key === DISCOVERY_SETTINGS_KEY
              ? normalizeDiscoverySettings({ ...merged, ...parsed })
              : { ...merged, ...parsed };
      }
    } catch (err) {
      console.warn(`[useSettings] API load failed for "${key}", using local defaults:`, err);
    }

    if (local) {
      merged =
        key === SITE_LOCATIONS_SETTINGS_KEY
          ? normalizeSiteLocations({ ...merged, ...local })
          : key === DISCOVERY_SETTINGS_KEY
            ? normalizeDiscoverySettings({ ...merged, ...local })
            : { ...merged, ...local };
    }

    setValue(merged);
    if (key === "general") {
      saveGeneralSettingsLocal(merged);
    }
    setLoading(false);
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (key !== "general") return;
    const onLocalChange = (e) => {
      if (e.detail) setValue((v) => ({ ...v, ...e.detail }));
    };
    window.addEventListener("waveguard-general-settings-changed", onLocalChange);
    return () => window.removeEventListener("waveguard-general-settings-changed", onLocalChange);
  }, [key]);

  useEffect(() => {
    if (key !== DISCOVERY_SETTINGS_KEY) return;
    const onDiscoveryChange = (e) => {
      if (e.detail) setValue(normalizeDiscoverySettings(e.detail));
    };
    window.addEventListener(DISCOVERY_CHANGED_EVENT, onDiscoveryChange);
    return () => window.removeEventListener(DISCOVERY_CHANGED_EVENT, onDiscoveryChange);
  }, [key]);

  const save = useCallback(
    async (data) => {
      const toSave = data ?? value;
      setSaving(true);
      setSaved(false);

      try {
        if (key === "general") {
          saveGeneralSettingsLocal(toSave);
          setValue(toSave);
        }
        if (key === SITE_LOCATIONS_SETTINGS_KEY) {
          const normalized = normalizeSiteLocations(toSave);
          saveSiteLocationsLocal(normalized);
          setValue(normalized);
        }
        if (key === DISCOVERY_SETTINGS_KEY) {
          const normalized = normalizeDiscoverySettings(toSave);
          saveDiscoverySettingsLocal(normalized);
          setValue(normalized);
        }

        let apiOk = false;
        try {
          const records = await base44.entities.SystemSettings.filter({ key });
          if (records.length > 0) {
            await base44.entities.SystemSettings.update(records[0].id, { key, value: toSave });
          } else {
            await base44.entities.SystemSettings.create({ key, value: toSave });
          }
          apiOk = true;
        } catch (err) {
          console.warn(`[useSettings] API save failed for "${key}":`, err);
          if (
            key !== "general" &&
            key !== SITE_LOCATIONS_SETTINGS_KEY &&
            key !== DISCOVERY_SETTINGS_KEY
          ) {
            toast.error("Could not save settings. Please try again.");
            return;
          }
        }

        if (
          key !== "general" &&
          key !== SITE_LOCATIONS_SETTINGS_KEY &&
          key !== DISCOVERY_SETTINGS_KEY
        ) {
          setValue(toSave);
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        onSavedRef.current?.(toSave);

        if (key === "general" && !apiOk) {
          console.info("[useSettings] General settings saved to browser storage (API unavailable).");
        }
      } finally {
        setSaving(false);
      }
    },
    [key, value]
  );

  return { value, setValue, save, load, loading, saving, saved };
}
