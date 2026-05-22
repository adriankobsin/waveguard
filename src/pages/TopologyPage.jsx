import { useState, useEffect, useCallback, useRef } from "react";

import { Layers, Map, Monitor, Cpu, Server, Loader2 } from "lucide-react";

import { base44 } from "@/api/base44Client";

import { listEquipment } from "@/api/equipmentApi";

import { loadDiscoverySettingsLocal, DEFAULT_DISCOVERY_SETTINGS } from "@/lib/discoverySettings";

import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";

import {
  mergeEquipmentIntoTopology,
  patchDeviceInTopology,
} from "@/lib/topology/syncTopologyFromEquipment";

import {
  getTopologySessionCache,
  setTopologySessionCache,
} from "@/lib/topology/topologySessionCache";

import DeckMapTab from "../components/topology/DeckMapTab";

import RackElevationTab from "../components/topology/RackElevationTab";

import NetworkMapTab from "../components/topology/NetworkMapTab";

import ControlPathTab from "../components/topology/ControlPathTab";

import AvSignalFlowTab from "../components/topology/AvSignalFlowTab";

const TOPOLOGY_TABS = [
  { key: "network", label: "Network", icon: Layers },
  { key: "deckmap", label: "Deck Map", icon: Map },
  { key: "av", label: "AV signal flow", icon: Monitor },
  { key: "control", label: "Control path", icon: Cpu },
  { key: "rack", label: "Rack layout", icon: Server },
];

function readCachedState() {
  const { topologyData, lastScan } = getTopologySessionCache();
  return {
    topologyData,
    lastScan: lastScan ? new Date(lastScan) : null,
  };
}

export default function TopologyPage() {
  const cached = readCachedState();
  const [activeTab, setActiveTab] = useState("network");
  const [topologyData, setTopologyData] = useState(cached.topologyData);
  const [initialLoading, setInitialLoading] = useState(!cached.topologyData);
  const [refreshing, setRefreshing] = useState(false);
  const [lastScan, setLastScan] = useState(cached.lastScan);

  const topologyRef = useRef(null);
  const fetchGenerationRef = useRef(0);

  topologyRef.current = topologyData;

  useEffect(() => {
    if (topologyData) {
      setTopologySessionCache(topologyData, lastScan);
    }
  }, [topologyData, lastScan]);

  const invalidateInFlightFetch = useCallback(() => {
    fetchGenerationRef.current += 1;
  }, []);

  /** Full SNMP topology scan — only for explicit Refresh. */
  const fetchTopology = useCallback(async () => {
    const fetchId = ++fetchGenerationRef.current;
    setRefreshing(true);

    try {
      const discovery = loadDiscoverySettingsLocal() || DEFAULT_DISCOVERY_SETTINGS;

      const response = await base44.functions.invoke("snmpTopologyScan", {
        subnets: discovery.subnets,
        scanType: discovery.scanType,
        snmpEnabled: discovery.snmpEnabled,
        snmpCommunity: discovery.snmpCommunity,
        snmpVersion: discovery.snmpVersion,
        maxConcurrent: discovery.maxConcurrent,
        timeoutMs: discovery.timeoutMs,
      });

      if (fetchId !== fetchGenerationRef.current) return;

      if (response.data?.success) {
        const equipment = await listEquipment();
        if (fetchId !== fetchGenerationRef.current) return;
        const merged = mergeEquipmentIntoTopology(response.data, equipment);
        setTopologyData(merged);
        const scannedAt = new Date(response.data.scanned_at);
        setLastScan(scannedAt);
        setTopologySessionCache(merged, scannedAt);
      }
    } catch (error) {
      console.error("Failed to fetch topology:", error);
    } finally {
      if (fetchId === fetchGenerationRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const syncTopologyFromEquipment = useCallback(async () => {
    invalidateInFlightFetch();
    try {
      const equipment = await listEquipment();
      setTopologyData((prev) => {
        const merged = mergeEquipmentIntoTopology(prev, equipment);
        setTopologySessionCache(merged, lastScan);
        return merged;
      });
    } catch (error) {
      console.error("Failed to sync topology from equipment:", error);
    }
  }, [invalidateInFlightFetch, lastScan]);

  const patchTopologyDevice = useCallback((deviceId, patch) => {
    invalidateInFlightFetch();
    setTopologyData((prev) => {
      const next = patchDeviceInTopology(prev, deviceId, patch);
      setTopologySessionCache(next, lastScan);
      return next;
    });
  }, [invalidateInFlightFetch, lastScan]);

  /** Load device list from inventory only — no SNMP scan. */
  useEffect(() => {
    let cancelled = false;

    async function loadFromInventory() {
      if (!topologyRef.current) {
        setInitialLoading(true);
      }

      try {
        const equipment = await listEquipment();
        if (cancelled) return;

        setTopologyData((prev) => {
          const merged = mergeEquipmentIntoTopology(prev, equipment);
          setTopologySessionCache(merged, lastScan);
          return merged;
        });
      } catch (error) {
        console.error("Failed to load topology from equipment:", error);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    loadFromInventory();
    return () => {
      cancelled = true;
    };
     
  }, []);

  useEffect(() => {
    const onEquipmentChange = () => syncTopologyFromEquipment();
    window.addEventListener(EQUIPMENT_CHANGED_EVENT, onEquipmentChange);
    return () => window.removeEventListener(EQUIPMENT_CHANGED_EVENT, onEquipmentChange);
  }, [syncTopologyFromEquipment]);

  const handleFullRefresh = useCallback(() => {
    fetchTopology();
  }, [fetchTopology]);

  return (
    <div className="h-full flex flex-col bg-background">
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

      <div className="flex-1 relative overflow-hidden bg-background">
        {initialLoading && activeTab === "network" ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
              <p className="text-sm">Loading network equipment…</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "network" && (
              <NetworkMapTab
                topologyData={topologyData}
                refreshing={refreshing}
                onFullRefresh={handleFullRefresh}
                onPatchDevice={patchTopologyDevice}
                onSyncFromEquipment={syncTopologyFromEquipment}
              />
            )}
            {activeTab === "av" && (
              <AvSignalFlowTab topologyData={topologyData} loading={false} onRefresh={handleFullRefresh} />
            )}
            {activeTab === "control" && (
              <ControlPathTab topologyData={topologyData} loading={false} onRefresh={handleFullRefresh} />
            )}
            {activeTab === "rack" && <RackElevationTab topologyData={topologyData} onRefresh={handleFullRefresh} />}
            {activeTab === "deckmap" && <DeckMapTab topologyData={topologyData} />}
          </>
        )}
      </div>
    </div>
  );
}
