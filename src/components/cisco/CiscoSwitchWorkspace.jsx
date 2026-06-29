import { useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, Cable, Activity, LayoutGrid, RefreshCw, Loader2 } from "lucide-react";
import CiscoSystemInfoCard from "./CiscoSystemInfoCard";
import CiscoInterfaceTable from "./CiscoInterfaceTable";
import CiscoConnectedDevicesPanel from "./CiscoConnectedDevicesPanel";
import CiscoEventLogPanel from "./CiscoEventLogPanel";
import { pollCiscoSwitchSnapshot, saveCiscoSwitch, subscribeCiscoEvents } from "@/api/ciscoApi";
import { CISCO_LIVE_POLL_INTERVAL_MS } from "@/lib/network/ciscoSwitchSettings";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "interfaces", label: "Interfaces", icon: Cpu },
  { id: "connected", label: "Connected devices", icon: Cable },
  { id: "events", label: "Activity", icon: Activity },
];

export default function CiscoSwitchWorkspace({ switchRecord, equipment = [] }) {
  const [activeTab, setActiveTab] = useState("overview");
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

  const pollLive = useCallback(
    async ({ background = false } = {}) => {
      if (!switchRecord?.host || !switchRecord?.enabled) return;
      if (!background) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await pollCiscoSwitchSnapshot(switchRecord);
        if (result?.snapshot) {
          applySnapshot(result.snapshot);
          saveCiscoSwitch({
            ...switchRecord,
            system: result.snapshot.system || switchRecord.system,
            lastConnectedAt: new Date().toISOString(),
            lastError: null,
          }).catch(() => {});
        } else if (!background) {
          setError(result?.message || result?.error || "Failed to fetch snapshot");
        }
      } catch (err) {
        if (!background) setError(err?.message || "Failed to fetch snapshot");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [applySnapshot, switchRecord]
  );

  useEffect(() => {
    if (!host || !switchRecord?.enabled) return;
    pollLive();
    const id = setInterval(() => pollLive({ background: true }), CISCO_LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [host, switchId, switchRecord?.enabled, pollLive]);

  useEffect(() => {
    if (!host) return;
    const unsubscribe = subscribeCiscoEvents({
      host,
      onSnapshot: (data) => {
        if (!data) return;
        applySnapshot(data);
        if (switchRecord?.id && data.system) {
          saveCiscoSwitch({
            ...switchRecord,
            system: data.system || switchRecord.system,
            lastConnectedAt: new Date().toISOString(),
            lastError: null,
          }).catch(() => {});
        }
      },
      onError: (err) => {
        // Don't surface SSE errors as fatal — they're transient.
        console.warn("[CiscoSwitchWorkspace] SSE error:", err?.message);
      },
    });
    return () => unsubscribe?.();
  }, [applySnapshot, host, switchRecord]);

  async function handleRefresh() {
    await pollLive();
  }

  const interfaces = snapshot?.interfaces || [];
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
        {activeTab === "interfaces" && (
          <CiscoInterfaceTable interfaces={interfaces} />
        )}
        {activeTab === "connected" && (
          <CiscoConnectedDevicesPanel snapshot={snapshot} equipment={equipment} />
        )}
        {activeTab === "events" && <CiscoEventLogPanel host={host} />}
      </div>
    </div>
  );
}
