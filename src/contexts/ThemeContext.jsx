import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import {
  loadAppearanceLocal,
  saveAppearanceLocal,
  applyThemeToDocument,
} from "@/lib/appearanceSettingsStorage";

const ThemeContext = createContext(null);

const DEFAULT_THEME = "dark";

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => loadAppearanceLocal()?.theme || DEFAULT_THEME);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let merged = { theme: DEFAULT_THEME };
      const local = loadAppearanceLocal();
      if (local?.theme) merged = { ...merged, ...local };

      try {
        const records = await base44.entities.SystemSettings.filter({ key: "appearance" });
        if (records.length > 0 && records[0].value != null) {
          const parsed = parseSettingsValue(records[0].value);
          merged = { ...merged, ...parsed };
        }
      } catch (err) {
        console.warn("[ThemeProvider] API load failed, using local:", err);
      }

      if (!cancelled) {
        const t = merged.theme === "light" ? "light" : "dark";
        setThemeState(t);
        applyThemeToDocument(t);
        saveAppearanceLocal({ theme: t });
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((next) => {
    const t = next === "light" ? "light" : "dark";
    setThemeState(t);
    applyThemeToDocument(t);
    saveAppearanceLocal({ theme: t });
  }, []);

  const saveTheme = useCallback(
    async (themeToSave) => {
      const t = (themeToSave ?? theme) === "light" ? "light" : "dark";
      setSaving(true);
      setSaved(false);
      try {
        const records = await base44.entities.SystemSettings.filter({ key: "appearance" });
        const payload = { key: "appearance", value: { theme: t } };
        if (records.length > 0) {
          await base44.entities.SystemSettings.update(records[0].id, payload);
        } else {
          await base44.entities.SystemSettings.create(payload);
        }
        saveAppearanceLocal({ theme: t });
        setThemeState(t);
        applyThemeToDocument(t);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        console.warn("[ThemeProvider] save failed:", err);
        saveAppearanceLocal({ theme: t });
        setThemeState(t);
        applyThemeToDocument(t);
      } finally {
        setSaving(false);
      }
    },
    [theme]
  );

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, saveTheme, ready, saving, saved }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
