import { createContext, useContext, useCallback, useEffect, useMemo } from "react";
import { useSettings } from "@/hooks/useSettings";
import {
  DEFAULT_SITE_LOCATIONS,
  SITE_LOCATIONS_SETTINGS_KEY,
  SITE_LOCATIONS_CHANGED_EVENT,
  normalizeSiteLocations,
  formatLocationLabel,
  findLocationIds,
  loadSiteLocationsLocal,
  saveSiteLocationsLocal,
} from "@/lib/siteLocations";

const SiteLocationsContext = createContext(null);

export function SiteLocationsProvider({ children }) {
  const { value, setValue, save, loading, saving, saved } = useSettings(
    SITE_LOCATIONS_SETTINGS_KEY,
    DEFAULT_SITE_LOCATIONS
  );

  const decks = useMemo(() => normalizeSiteLocations(value).decks, [value]);

  useEffect(() => {
    const onChange = (e) => {
      if (e.detail) setValue(normalizeSiteLocations(e.detail));
    };
    window.addEventListener(SITE_LOCATIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SITE_LOCATIONS_CHANGED_EVENT, onChange);
  }, [setValue]);

  const formatLocation = useCallback(
    (deckId, roomId) => formatLocationLabel(decks, deckId, roomId),
    [decks]
  );

  const resolveIds = useCallback(
    (locationText) => findLocationIds(decks, locationText),
    [decks]
  );

  const persist = useCallback(
    async (next) => {
      const normalized = normalizeSiteLocations(next);
      saveSiteLocationsLocal(normalized);
      await save(normalized);
      return normalized;
    },
    [save]
  );

  return (
    <SiteLocationsContext.Provider
      value={{
        decks,
        loading,
        saving,
        saved,
        setDecks: (updater) => {
          setValue((prev) => {
            const current = normalizeSiteLocations(prev);
            return typeof updater === "function" ? updater(current) : updater;
          });
        },
        saveLocations: persist,
        formatLocation,
        resolveIds,
      }}
    >
      {children}
    </SiteLocationsContext.Provider>
  );
}

export function useSiteLocations() {
  const ctx = useContext(SiteLocationsContext);
  if (!ctx) {
    const local = loadSiteLocationsLocal();
    const decks = normalizeSiteLocations(local || DEFAULT_SITE_LOCATIONS).decks;
    return {
      decks,
      loading: false,
      saving: false,
      saved: false,
      setDecks: () => {},
      saveLocations: async () => decks,
      formatLocation: (deckId, roomId) => formatLocationLabel(decks, deckId, roomId),
      resolveIds: (text) => findLocationIds(decks, text),
    };
  }
  return ctx;
}
