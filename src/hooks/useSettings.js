import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

export function useSettings(key, defaults) {
  const [value, setValue] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const records = await base44.entities.SystemSettings.filter({ key });
        if (records.length > 0 && records[0].value) {
          setValue(v => ({ ...v, ...records[0].value }));
        }
      } catch (_) {
        // use defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [key]);

  const save = useCallback(async (data) => {
    const toSave = data ?? value;
    setSaving(true);
    try {
      const records = await base44.entities.SystemSettings.filter({ key });
      if (records.length > 0) {
        await base44.entities.SystemSettings.update(records[0].id, { key, value: toSave });
      } else {
        await base44.entities.SystemSettings.create({ key, value: toSave });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [key, value]);

  return { value, setValue, save, loading, saving, saved };
}