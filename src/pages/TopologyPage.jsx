import { useState, useEffect, useCallback } from "react";
import { Layers, Map, Monitor, Cpu, Server, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DeckMapTab from "../components/topology/DeckMapTab";
import RackElevationTab from "../components/topology/RackElevationTab";
import NetworkMapTab from "../components/topology/NetworkMapTab";

const TOPOLOGY_TABS = [
  { key: "network", label: "Network", icon: Layers },
  { key: "deckmap", label: "Deck Map", icon: Map },
  { key: "av", label: "AV signal flow", icon: Monitor },
  { key: "control", label: "Control path", icon: Cpu },
  { key: "rack", label: "Rack layout", icon: Server },
];

function PlaceholderTab({ icon: Icon, title, body, color = "text-cyan-400" }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
        <Icon size={28} className={color} />
      </div>
      <div>
        <p className="text-base font-semibold text-white mb-1">{title}</p>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export default function TopologyPage() {
  const [activeTab, setActiveTab] = useState("network");
  const [topologyData, setTopologyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(null);

  const fetchTopology = useCallback(async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('snmpTopologyScan', {});
      if (response.data.success) {
        setTopologyData(response.data);
        setLastScan(new Date(response.data.scanned_at));
      }
    } catch (error) {
      console.error('Failed to fetch topology:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/30">
            <Layers size={14} className="text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-none">Topology & racks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Signal flow, patching, VLAN overlays, rack elevation, weight, thermal, power, uplinks.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {topologyData?.stats && (
            <div className="hidden sm:flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {topologyData.stats.online} online
              </span>
              {topologyData.stats.warning > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {topologyData.stats.warning} warning
                </span>
              )}
              {topologyData.stats.offline > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {topologyData.stats.offline} offline
                </span>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{topologyData.stats.active_connections} active connections</span>
            </div>
          )}
          {lastScan && (
            <p className="text-[10px] text-muted-foreground">
              Last scan: {lastScan.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-card/60 flex-shrink-0 overflow-x-auto">
        {TOPOLOGY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative overflow-hidden bg-background">
        {loading && activeTab === "network" ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
              <p className="text-sm">Scanning network topology via SNMP...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "network" && (
              <NetworkMapTab
                topologyData={topologyData}
                loading={loading}
                onRefresh={fetchTopology}
              />
            )}
            {activeTab === "av" && <PlaceholderTab icon={Monitor} color="text-blue-400" title="AV signal flow" body="NVX encoder → core → decoder → display. Live route analytics plug into the AV driver bus." />}
            {activeTab === "control" && <PlaceholderTab icon={Cpu} color="text-purple-400" title="Control signal flow" body="CP4 orchestration to subsystems — REST/CIP placeholders per integration driver." />}
            {activeTab === "rack" && <RackElevationTab />}
            {activeTab === "deckmap" && <DeckMapTab topologyData={topologyData} />}
          </>
        )}
      </div>
    </div>
  );
}