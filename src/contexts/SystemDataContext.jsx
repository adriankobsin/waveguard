import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { generateLightingDiagnoses } from "@/lib/lighting/lightingDiagnoses";
import { loadLightingEvents } from "@/lib/lighting/lightingEventLog";
import { loadLutronConnection, testLutronProcessor } from "@/api/lightingApi";
import {
  LIGHTING_EVENT_LOG_CHANGED_EVENT,
  LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT,
} from "@/lib/lighting/lightingSettings";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";
import { SNMP_SWITCHES_CHANGED_EVENT } from "@/lib/snmp/snmpSwitchProfiles";
import { WAN_MANAGEMENT_CHANGED_EVENT } from "@/lib/wan/wanManagementSettings";
import { PLATFORM_MODE_CHANGED_EVENT } from "@/lib/platformMode";

// How often we re-probe the Lutron processor to refresh the
// `lighting-processor-offline` diagnosis. 60s is the same cadence the
// SNMP poller uses for its critical-only checks, which is a sensible
// trade-off between freshness and processor load.
const LIGHTING_PROBE_INTERVAL_MS = 60_000;

const SystemDataContext = createContext(null);

export function SystemDataProvider({ children }) {
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const [ackVersion, setAckVersion] = useState(0);

  // Lighting state that feeds the lighting diagnoses pipeline.
  const [lightingEvents, setLightingEvents] = useState([]);
  const [lutronConnection, setLutronConnection] = useState(null);
  const [lightingProbe, setLightingProbe] = useState(null);
  const probeAbortRef = useRef(false);

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

  // ── Lighting diagnosis pipeline ─────────────────────────────────────
  // We listen for connection + event-log changes and re-probe the
  // processor on a slow timer so the Diagnoses page picks up live
  // failures the moment the operator sees them on Lights / Shades.
  const refreshLightingState = useCallback(async () => {
    try {
      const [events, conn] = await Promise.all([
        loadLightingEvents(),
        loadLutronConnection(),
      ]);
      setLightingEvents(events?.events || []);
      setLutronConnection(conn);
    } catch (err) {
      console.warn("[SystemData] lighting state load failed:", err);
    }
  }, []);

  const probeLightingProcessor = useCallback(async () => {
    let conn = lutronConnection;
    if (!conn) {
      try {
        conn = await loadLutronConnection();
        setLutronConnection(conn);
      } catch (_err) {
        return;
      }
    }
    if (!conn?.enabled || !conn?.host) {
      // Nothing to probe — clear any stale result so the diagnosis
      // does not linger after the operator disables live control.
      setLightingProbe(null);
      return;
    }
    try {
      const result = await testLutronProcessor();
      if (probeAbortRef.current) return;
      setLightingProbe({
        ...result,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      if (probeAbortRef.current) return;
      setLightingProbe({
        success: false,
        message: err?.message || String(err),
        checkedAt: new Date().toISOString(),
      });
    }
  }, [lutronConnection]);

  useEffect(() => {
    refreshLightingState();
  }, [refreshLightingState]);

  useEffect(() => {
    probeAbortRef.current = false;
    probeLightingProcessor();
    const id = setInterval(probeLightingProcessor, LIGHTING_PROBE_INTERVAL_MS);
    return () => {
      probeAbortRef.current = true;
      clearInterval(id);
    };
  }, [probeLightingProcessor]);

  useEffect(() => {
    const onEventLog = (e) => {
      if (e?.detail?.events) setLightingEvents(e.detail.events);
      else refreshLightingState();
    };
    const onConn = (e) => {
      if (e?.detail) setLutronConnection(e.detail);
      // Re-probe immediately so the diagnosis reflects the new credentials.
      probeLightingProcessor();
    };
    window.addEventListener(LIGHTING_EVENT_LOG_CHANGED_EVENT, onEventLog);
    window.addEventListener(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, onConn);
    return () => {
      window.removeEventListener(LIGHTING_EVENT_LOG_CHANGED_EVENT, onEventLog);
      window.removeEventListener(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, onConn);
    };
  }, [refreshLightingState, probeLightingProcessor]);

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
    const dismissed = new Set(getDismissedDiagnosisIds());
    const base = generateDiagnosesFromSystem(sources, {
      excludeIds: [...dismissed],
    });
    const snmp = generateSnmpDiagnoses({
      profiles: sources.snmpSwitches?.profiles || [],
      equipment: sources.equipment || [],
      global: sources.snmpSwitches?.global || {},
    }).filter((d) => !dismissed.has(d.id));
    const lighting = generateLightingDiagnoses({
      events: lightingEvents,
      connection: lutronConnection,
      probe: lightingProbe,
    }).filter((d) => !dismissed.has(d.id));

    const order = { critical: 0, warning: 1, info: 2 };
    const merged = applyAcknowledgements([...base, ...snmp, ...lighting]).sort(
      (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
    );
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sources,
    dismissedVersion,
    ackVersion,
    lightingEvents,
    lutronConnection,
    lightingProbe,
  ]);

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
