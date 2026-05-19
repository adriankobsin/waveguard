import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { loadGeneralSettingsLocal, saveGeneralSettingsLocal } from "@/lib/generalSettingsStorage";

export function useSettings(key, defaults, options = {}) {
  const { onSaved } = options;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const [value, setValue] = useState(() => {
    if (key === "general") {
      const local = loadGeneralSettingsLocal();
      if (local) return { ...defaults, ...local };
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
    const local = key === "general" ? loadGeneralSettingsLocal() : null;

    try {
      const records = await base44.entities.SystemSettings.filter({ key });
      if (records.length > 0 && records[0].value != null) {
        const parsed = parseSettingsValue(records[0].value);
        merged = { ...merged, ...parsed };
      }
    } catch (err) {
      console.warn(`[useSettings] API load failed for "${key}", using local defaults:`, err);
    }

    if (local) merged = { ...merged, ...local };

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
          if (key !== "general") {
            toast.error("Could not save settings. Please try again.");
            return;
          }
        }

        if (key !== "general") {
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
