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
import { generateCiscoDiagnoses } from "@/lib/integrations/cisco/ciscoDiagnoses";
import { loadLightingEvents } from "@/lib/lighting/lightingEventLog";
import { loadCiscoEvents } from "@/lib/integrations/cisco/ciscoEventLog";
import { loadLutronConnection, testLutronProcessor, loadLightingHouse, loadZoneState } from "@/api/lightingApi";
import { listCiscoSwitches, testCiscoSwitch } from "@/api/ciscoApi";
import {
  LIGHTING_EVENT_LOG_CHANGED_EVENT,
  LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT,
  LIGHTING_HOUSE_CHANGED_EVENT,
  LIGHTING_ZONE_STATE_CHANGED_EVENT,
  isShadeZone,
} from "@/lib/lighting/lightingSettings";
import {
  NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT,
  NETWORK_CISCO_SWITCHES_CHANGED_EVENT,
} from "@/lib/network/ciscoSwitchSettings";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";
import { SNMP_SWITCHES_CHANGED_EVENT } from "@/lib/snmp/snmpSwitchProfiles";
import { WAN_MANAGEMENT_CHANGED_EVENT } from "@/lib/wan/wanManagementSettings";
import { PLATFORM_MODE_CHANGED_EVENT } from "@/lib/platformMode";

// How often we re-probe the Lutron processor to refresh the
// `lighting-processor-offline` diagnosis. 60s is the same cadence the
// SNMP poller uses for its critical-only checks, which is a sensible
// trade-off between freshness and processor load.
const LIGHTING_PROBE_INTERVAL_MS = 60_000;
const CISCO_PROBE_INTERVAL_MS = 60_000;

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
  const [lightingHouse, setLightingHouse] = useState(null);
  const [zoneState, setZoneState] = useState({});
  const probeAbortRef = useRef(false);

  // Cisco state that feeds the Cisco diagnoses pipeline.
  const [ciscoEvents, setCiscoEvents] = useState([]);
  const [ciscoSwitches, setCiscoSwitches] = useState([]);
  const [ciscoProbes, setCiscoProbes] = useState({}); // { [host]: probeResult }
  const ciscoProbeAbortRef = useRef(false);

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
      const [events, conn, house, zs] = await Promise.all([
        loadLightingEvents(),
        loadLutronConnection(),
        loadLightingHouse(),
        loadZoneState(),
      ]);
      setLightingEvents(events?.events || []);
      setLutronConnection(conn);
      setLightingHouse(house);
      setZoneState(zs || {});
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
    const onHouse = (e) => {
      if (e?.detail) setLightingHouse(e.detail);
      else refreshLightingState();
    };
    const onZoneState = (e) => {
      if (e?.detail?.state) setZoneState(e.detail.state);
      else refreshLightingState();
    };
    window.addEventListener(LIGHTING_EVENT_LOG_CHANGED_EVENT, onEventLog);
    window.addEventListener(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, onConn);
    window.addEventListener(LIGHTING_HOUSE_CHANGED_EVENT, onHouse);
    window.addEventListener(LIGHTING_ZONE_STATE_CHANGED_EVENT, onZoneState);
    return () => {
      window.removeEventListener(LIGHTING_EVENT_LOG_CHANGED_EVENT, onEventLog);
      window.removeEventListener(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, onConn);
      window.removeEventListener(LIGHTING_HOUSE_CHANGED_EVENT, onHouse);
      window.removeEventListener(LIGHTING_ZONE_STATE_CHANGED_EVENT, onZoneState);
    };
  }, [refreshLightingState, probeLightingProcessor]);

  // ── Cisco diagnosis pipeline ────────────────────────────────────────
  const refreshCiscoState = useCallback(async () => {
    try {
      const [events, list] = await Promise.all([
        loadCiscoEvents(),
        listCiscoSwitches(),
      ]);
      setCiscoEvents(events?.events || []);
      setCiscoSwitches(list?.switches || []);
    } catch (err) {
      console.warn("[SystemData] cisco state load failed:", err);
    }
  }, []);

  const probeCiscoSwitches = useCallback(async () => {
    let list = ciscoSwitches;
    if (!list || list.length === 0) {
      try {
        const payload = await listCiscoSwitches();
        list = payload?.switches || [];
        setCiscoSwitches(list);
      } catch (_err) {
        return;
      }
    }
    if (!list || list.length === 0) {
      setCiscoProbes({});
      return;
    }
    const next = {};
    for (const sw of list) {
      if (!sw.enabled || !sw.host) continue;
      try {
        const result = await testCiscoSwitch(sw);
        if (ciscoProbeAbortRef.current) return;
        next[sw.host] = {
          ...result,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        if (ciscoProbeAbortRef.current) return;
        next[sw.host] = {
          success: false,
          message: err?.message || String(err),
          checkedAt: new Date().toISOString(),
        };
      }
    }
    if (ciscoProbeAbortRef.current) return;
    setCiscoProbes(next);
  }, [ciscoSwitches]);

  useEffect(() => {
    refreshCiscoState();
  }, [refreshCiscoState]);

  useEffect(() => {
    ciscoProbeAbortRef.current = false;
    probeCiscoSwitches();
    const id = setInterval(probeCiscoSwitches, CISCO_PROBE_INTERVAL_MS);
    return () => {
      ciscoProbeAbortRef.current = true;
      clearInterval(id);
    };
  }, [probeCiscoSwitches]);

  useEffect(() => {
    const onCiscoEventLog = (e) => {
      if (e?.detail?.events) setCiscoEvents(e.detail.events);
      else refreshCiscoState();
    };
    const onCiscoSwitches = (e) => {
      if (e?.detail?.switches) setCiscoSwitches(e.detail.switches);
      else refreshCiscoState();
      // Re-probe immediately so the diagnosis reflects the new switch list.
      probeCiscoSwitches();
    };
    window.addEventListener(NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT, onCiscoEventLog);
    window.addEventListener(NETWORK_CISCO_SWITCHES_CHANGED_EVENT, onCiscoSwitches);
    return () => {
      window.removeEventListener(NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT, onCiscoEventLog);
      window.removeEventListener(NETWORK_CISCO_SWITCHES_CHANGED_EVENT, onCiscoSwitches);
    };
  }, [refreshCiscoState, probeCiscoSwitches]);

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
    const cisco = generateCiscoDiagnoses({
      switches: ciscoSwitches.map((sw) => ({
        ...sw,
        lastProbe: ciscoProbes[sw.host] || null,
      })),
      events: ciscoEvents,
    }).filter((d) => !dismissed.has(d.id));

    const order = { critical: 0, warning: 1, info: 2 };
    const merged = applyAcknowledgements([
      ...base,
      ...snmp,
      ...lighting,
      ...cisco,
    ]).sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sources,
    dismissedVersion,
    ackVersion,
    lightingEvents,
    lutronConnection,
    lightingProbe,
    ciscoEvents,
    ciscoSwitches,
    ciscoProbes,
  ]);

  const dismissDiagnosis = useCallback((id) => {
    dismissDiagnosisId(id);
    setDismissedVersion((v) => v + 1);
  }, []);

  const acknowledgeDiagnosis = useCallback((id) => {
    acknowledgeDiagnosisId(id);
    setAckVersion((v) => v + 1);
  }, []);

  const lightingStats = useMemo(() => {
    const zones = (lightingHouse?.zones || []).filter((z) => !isShadeZone(z));
    const total = zones.length;
    const on = zones.filter((z) => zoneState[z.href]?.on).length;
    return { total, on };
  }, [lightingHouse, zoneState]);

  const ciscoStats = useMemo(() => {
    const enabled = ciscoSwitches.filter((s) => s.enabled !== false);
    const online = enabled.filter((sw) => {
      const probe = ciscoProbes[sw.host];
      if (probe?.success) return true;
      return !!(sw.lastConnectedAt && !sw.lastError);
    }).length;
    return { total: enabled.length, online, offline: Math.max(0, enabled.length - online) };
  }, [ciscoSwitches, ciscoProbes]);

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
      lutronConnection,
      lightingProbe,
      lightingHouse,
      zoneState,
      lightingStats,
      ciscoSwitches,
      ciscoProbes,
      ciscoStats,
    }),
    [
      snapshot,
      diagnoses,
      loading,
      refreshing,
      error,
      load,
      dismissDiagnosis,
      acknowledgeDiagnosis,
      sources,
      lutronConnection,
      lightingProbe,
      lightingHouse,
      zoneState,
      lightingStats,
      ciscoSwitches,
      ciscoProbes,
      ciscoStats,
    ]
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
