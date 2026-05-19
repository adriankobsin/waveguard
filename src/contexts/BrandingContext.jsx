import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { loadGeneralSettingsLocal, saveGeneralSettingsLocal } from "@/lib/generalSettingsStorage";

export const DEFAULT_BRANDING = {
  name: "M/Y Horizon",
  displayName: "Horizon",
  homePort: "Palma de Mallorca",
  timezone: "Europe/London",
  notes: "",
  appTitle: "Wave Guard",
  appSubtitle: "",
  logoUrl: null,
};

const BrandingContext = createContext(null);

function mergeBranding(data) {
  return { ...DEFAULT_BRANDING, ...(data || {}) };
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(() => mergeBranding(loadGeneralSettingsLocal()));
  const [loading, setLoading] = useState(true);

  const applyBranding = useCallback((data) => {
    const next = mergeBranding(data);
    setBranding(next);
    saveGeneralSettingsLocal(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    const local = loadGeneralSettingsLocal();
    let merged = mergeBranding(local);

    try {
      const records = await base44.entities.SystemSettings.filter({ key: "general" });
      if (records.length > 0 && records[0].value != null) {
        const parsed = parseSettingsValue(records[0].value);
        merged = mergeBranding({ ...parsed, ...local });
        saveGeneralSettingsLocal(merged);
      }
    } catch (err) {
      console.warn("[Branding] API load failed, using local settings:", err);
    }

    setBranding(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onLocalChange = (e) => {
      if (e.detail) setBranding(mergeBranding(e.detail));
    };
    window.addEventListener("waveguard-general-settings-changed", onLocalChange);
    return () => window.removeEventListener("waveguard-general-settings-changed", onLocalChange);
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh, applyBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding must be used within BrandingProvider");
  }
  return ctx;
}
