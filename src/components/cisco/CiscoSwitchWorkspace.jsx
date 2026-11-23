import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Cable, Activity, LayoutGrid, RefreshCw, Loader2, Radio, Save } from "lucide-react";
import { toast } from "sonner";
import CiscoPortPanel from "./CiscoPortPanel";
import CiscoMulticastPanel from "./CiscoMulticastPanel";
import { useAuth } from "@/lib/AuthContext";
import { isTechnician } from "@/lib/permissions";
import { portKey, normMac } from "@/lib/av/avFlowModel";
import CiscoSystemInfoCard from "./CiscoSystemInfoCard";
import CiscoInterfaceTable from "./CiscoInterfaceTable";
import CiscoConnectedDevicesPanel from "./CiscoConnectedDevicesPanel";
import CiscoEventLogPanel from "./CiscoEventLogPanel";
import { pollCiscoSwitchSnapshot, saveCiscoSwitch, saveCiscoConfig, subscribeCiscoEvents } from "@/api/ciscoApi";
import { CISCO_LIVE_POLL_INTERVAL_MS } from "@/lib/network/ciscoSwitchSettings";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "interfaces", label: "Ports", icon: Cpu },
  { id: "connected", label: "Connected devices", icon: Cable },
  { id: "multicast", label: "Multicast / AV", icon: Radio },
  { id: "events", label: "Activity", icon: Activity },
];

/**
 * Put a name on every port: LLDP/CDP neighbour first, then a WaveGuard
 * equipment record matched by MAC, then "N devices" for shared ports.
 */
function enrichPorts(snapshot, equipment) {
  const ifaces = snapshot?.interfaces || [];
  const macsByPort = new Map();
  for (const m of snapshot?.macs || []) {
    const k = portKey(m.port);
    if (!macsByPort.has(k)) macsByPort.set(k, []);
    macsByPort.get(k).push(normMac(m.mac));
  }
  const nbByPort = new Map();
  for (const n of snapshot?.neighbors?.lldp || []) if (n.port && n.systemName) nbByPort.set(portKey(n.port), n.systemName);
  for (const n of snapshot?.neighbors?.cdp || []) if (n.port && n.deviceId && !nbByPort.has(portKey(n.port))) nbByPort.set(portKey(n.port), n.deviceId.split(".")[0]);
  const eqByMac = new Map();
  for (const e of equipment || []) {
    const mac = normMac(e.mac || e.macAddress);
    if (mac) eqByMac.set(mac, e.name);
  }
  return ifaces.map((p) => {
    if (p.connectedDevice) return p;
    const k = portKey(p.name);
    const macs = (macsByPort.get(k) || []).filter(Boolean);
    const named = nbByPort.get(k) || macs.map((m) => eqByMac.get(m)).find(Boolean);
    return {
      ...p,
      macCount: macs.length,
      macAddr: p.macAddr || (macs.length === 1 ? macs[0] : null),
      connectedDevice: named || (macs.length > 1 && !p.isUplink ? `${macs.length} devices` : null),
    };
  });
}

export default function CiscoSwitchWorkspace({ switchRecord, equipment = [] }) {
  const { user } = useAuth();
  const canEdit = isTechnician(user);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPort, setSelectedPort] = useState(null);
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // The record object changes every time it's saved; read it through a ref so
  // polling doesn't restart (and re-save) in a loop.
  const recordRef = useRef(switchRecord);
  recordRef.current = switchRecord;
  const lastSavedRef = useRef(0);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastPolledAt, setLastPolledAt] = useState(null);

  const host = switchRecord?.host;
  const switchId = switchRecord?.id;

  const applySnapshot = useCallback((data) => {
    if (!data) return;
    const snap = data.system || data.interfaces ? data : null;
    if (!snap) return;
    setSnapshot(snap);
    setLastPolledAt(snap.polledAt || new Date().toISOString());
    setError(null);
  }, []);

  /** Persist "last seen" at most every 5 minutes (each save broadcasts a change event). */
  const rememberSystem = useCallback((system) => {
    const rec = recordRef.current;
    if (!rec?.id || Date.now() - lastSavedRef.current < 5 * 60_000) return;
    lastSavedRef.current = Date.now();
    saveCiscoSwitch({ ...rec, system: system || rec.system, lastConnectedAt: new Date().toISOString(), lastError: null }).catch(() => {});
  }, []);

  const pollLive = useCallback(
    async ({ background = false } = {}) => {
      const rec = recordRef.current;
      if (!rec?.host || !rec?.enabled) return;
      if (!background) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await pollCiscoSwitchSnapshot(rec);
        if (result?.snapshot) {
          applySnapshot(result.snapshot);
          rememberSystem(result.snapshot.system);
        } else if (!background) {
          setError(result?.message || result?.error || "Failed to fetch snapshot");
        }
      } catch (err) {
        if (!background) setError(err?.message || "Failed to fetch snapshot");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [applySnapshot, rememberSystem]
  );

  const enabled = !!switchRecord?.enabled;
  useEffect(() => {
    if (!host || !enabled) return;
    lastSavedRef.current = 0;
    setSnapshot(null);
    setUnsaved(false);
    pollLive();
    const id = setInterval(() => pollLive({ background: true }), CISCO_LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [host, switchId, enabled, pollLive]);

  useEffect(() => {
    if (!host) return;
    const unsubscribe = subscribeCiscoEvents({
      host,
      onSnapshot: (data) => {
        if (!data) return;
        applySnapshot(data);
        if (data.system) rememberSystem(data.system);
      },
      onError: (err) => {
        // Don't surface SSE errors as fatal — they're transient.
        console.warn("[CiscoSwitchWorkspace] SSE error:", err?.message);
      },
    });
    return () => unsubscribe?.();
  }, [applySnapshot, host, rememberSystem]);

  async function handleSaveConfig() {
    setSaving(true);
    const r = await saveCiscoConfig(recordRef.current);
    setSaving(false);
    if (r?.success) {
      setUnsaved(false);
      toast.success("Saved — changes survive a switch reboot");
    } else {
      toast.error(r?.error || "Save failed");
    }
  }

  async function handleRefresh() {
    await pollLive();
  }

  const interfaces = useMemo(() => enrichPorts(snapshot, equipment), [snapshot, equipment]);
  const portLabel = useCallback((name) => {
    const p = interfaces.find((x) => portKey(x.name) === portKey(name));
    return p?.connectedDevice || p?.ifAlias ? `${name} (${p.connectedDevice || p.ifAlias})` : name;
  }, [interfaces]);
  const summary = useMemo(() => {
    if (!interfaces.length) return { up: 0, down: 0, poe: 0 };
    const up = interfaces.filter((p) => p.status === "up").length;
    const down = interfaces.filter((p) => p.status === "down").length;
    const poe = interfaces.filter((p) => (p.poeWatts || 0) > 0).length;
    return { up, down, poe };
  }, [interfaces]);

  if (!switchRecord) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="text-center">
          <Cpu size={36} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">Select a switch</p>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a switch from the left rail to view its live data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-card/60 overflow-x-auto flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              activeTab === tab.id
                ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
            {tab.id === "interfaces" && summary.up > 0 && (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                {summary.up}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {lastPolledAt && (
            <span className="text-[10px] text-muted-foreground font-mono">
              Polled · {new Date(lastPolledAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading || !switchRecord?.enabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-background">
        {error && (
          <div className="mb-4 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
            {error}
          </div>
        )}
        {activeTab === "overview" && (
          <CiscoSystemInfoCard switchRecord={switchRecord} snapshot={snapshot} />
        )}
        {unsaved && (
          <div className="mb-4 flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300">
            <span>Changes are live but not saved. If the switch reboots they&apos;re lost.</span>
            <button type="button" onClick={handleSaveConfig} disabled={saving} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-amber-950 font-semibold disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save to switch
            </button>
          </div>
        )}
        {activeTab === "interfaces" && (
          <CiscoInterfaceTable interfaces={interfaces} onSelect={setSelectedPort} />
        )}
        {activeTab === "multicast" && <CiscoMulticastPanel snapshot={snapshot} portLabel={portLabel} />}
        {activeTab === "connected" && (
          <CiscoConnectedDevicesPanel snapshot={snapshot} equipment={equipment} />
        )}
        {activeTab === "events" && <CiscoEventLogPanel host={host} />}
      </div>
      <CiscoPortPanel
        open={!!selectedPort}
        port={selectedPort}
        switchRecord={switchRecord}
        vlans={snapshot?.vlans || []}
        canEdit={canEdit}
        onClose={() => setSelectedPort(null)}
        onChanged={() => {
          setUnsaved(true);
          setSelectedPort(null);
          setTimeout(() => pollLive({ background: true }), 4000);
        }}
      />
    </div>
  );
}
