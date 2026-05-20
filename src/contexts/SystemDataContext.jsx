import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchSystemDataSources } from "@/api/systemDataApi";
import { buildSystemSnapshot } from "@/lib/systemData/buildSystemSnapshot";
import {
  generateDiagnosesFromSystem,
  getDismissedDiagnosisIds,
  dismissDiagnosisId,
} from "@/lib/systemData/generateDiagnoses";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";

const SystemDataContext = createContext(null);

export function SystemDataProvider({ children }) {
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dismissedVersion, setDismissedVersion] = useState(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await fetchSystemDataSources();
      setSources(data);
    } catch (err) {
      console.error("[SystemData] load failed:", err);
      setError(err.message || "Failed to load system data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onChange = () => load({ silent: true });
    window.addEventListener(EQUIPMENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(EQUIPMENT_CHANGED_EVENT, onChange);
  }, [load]);

  const snapshot = useMemo(
    () => (sources ? buildSystemSnapshot(sources) : null),
    [sources]
  );

  const diagnoses = useMemo(() => {
    if (!sources) return [];
    return generateDiagnosesFromSystem(sources, {
      excludeIds: getDismissedDiagnosisIds(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismissedVersion bumps on dismiss
  }, [sources, dismissedVersion]);

  const dismissDiagnosis = useCallback((id) => {
    dismissDiagnosisId(id);
    setDismissedVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      snapshot,
      diagnoses,
      loading,
      refreshing,
      error,
      refresh: () => load({ silent: true }),
      dismissDiagnosis,
      sources,
    }),
    [snapshot, diagnoses, loading, refreshing, error, load, dismissDiagnosis, sources]
  );

  return (
    <SystemDataContext.Provider value={value}>{children}</SystemDataContext.Provider>
  );
}

export function useSystemData() {
  const ctx = useContext(SystemDataContext);
  if (!ctx) {
    throw new Error("useSystemData must be used within SystemDataProvider");
  }
  return ctx;
}

/** Safe hook for layout — returns null counts when provider not mounted. */
export function useSystemDataOptional() {
  return useContext(SystemDataContext);
}
