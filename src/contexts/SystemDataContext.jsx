import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchSystemDataSources } from "@/api/systemDataApi";
import { buildSystemSnapshot } from "@/lib/systemData/buildSystemSnapshot";
import {
  generateDiagnosesFromSystem,
  getDismissedDiagnosisIds,
  dismissDiagnosisId,
} from "@/lib/systemData/generateDiagnoses";
import {
  applyAcknowledgements,
  acknowledgeDiagnosisId,
} from "@/lib/systemData/diagnosisAcknowledgement";
import { generateSnmpDiagnoses } from "@/lib/snmp/generateSnmpDiagnoses";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";
import { SNMP_SWITCHES_CHANGED_EVENT } from "@/lib/snmp/snmpSwitchProfiles";
import { WAN_MANAGEMENT_CHANGED_EVENT } from "@/lib/wan/wanManagementSettings";
import { PLATFORM_MODE_CHANGED_EVENT } from "@/lib/platformMode";

const SystemDataContext = createContext(null);

export function SystemDataProvider({ children }) {
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const [ackVersion, setAckVersion] = useState(0);

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
    const onModeChange = () => load({ silent: false });
    window.addEventListener(EQUIPMENT_CHANGED_EVENT, onChange);
    window.addEventListener(SNMP_SWITCHES_CHANGED_EVENT, onChange);
    window.addEventListener(WAN_MANAGEMENT_CHANGED_EVENT, onChange);
    window.addEventListener(PLATFORM_MODE_CHANGED_EVENT, onModeChange);
    return () => {
      window.removeEventListener(EQUIPMENT_CHANGED_EVENT, onChange);
      window.removeEventListener(SNMP_SWITCHES_CHANGED_EVENT, onChange);
      window.removeEventListener(WAN_MANAGEMENT_CHANGED_EVENT, onChange);
      window.removeEventListener(PLATFORM_MODE_CHANGED_EVENT, onModeChange);
    };
  }, [load]);

  useEffect(() => {
    const onAck = () => setAckVersion((v) => v + 1);
    window.addEventListener("waveguard-diagnoses-ack-changed", onAck);
    return () => window.removeEventListener("waveguard-diagnoses-ack-changed", onAck);
  }, []);

  const snapshot = useMemo(
    () =>
      sources
        ? buildSystemSnapshot({
            equipment: sources.equipment,
            tasks: sources.tasks,
            logs: sources.logs,
            rules: sources.rules,
            snmpSwitches: sources.snmpSwitches,
            wanManagement: sources.wanManagement,
          })
        : null,
    [sources]
  );

  const diagnoses = useMemo(() => {
    if (!sources) return [];
    const base = generateDiagnosesFromSystem(sources, {
      excludeIds: getDismissedDiagnosisIds(),
    });
    const snmp = generateSnmpDiagnoses({
      profiles: sources.snmpSwitches?.profiles || [],
      equipment: sources.equipment || [],
      global: sources.snmpSwitches?.global || {},
    }).filter((d) => !getDismissedDiagnosisIds().includes(d.id));

    const order = { critical: 0, warning: 1, info: 2 };
    const merged = applyAcknowledgements([...base, ...snmp]).sort(
      (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
    );
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, dismissedVersion, ackVersion]);

  const dismissDiagnosis = useCallback((id) => {
    dismissDiagnosisId(id);
    setDismissedVersion((v) => v + 1);
  }, []);

  const acknowledgeDiagnosis = useCallback((id) => {
    acknowledgeDiagnosisId(id);
    setAckVersion((v) => v + 1);
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
      acknowledgeDiagnosis,
      sources,
    }),
    [snapshot, diagnoses, loading, refreshing, error, load, dismissDiagnosis, acknowledgeDiagnosis, sources]
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
