import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Thermometer, Gauge, Settings, RefreshCcw,
  Building2, CheckCircle2, Loader2, Wrench, Sliders, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import HvacZoneCard from "@/components/hvac/HvacZoneCard";
import {
  loadHvacHouse,
  loadHvacZoneState,
  saveHvacZoneState,
  setHvacZoneLevel,
  pollHvacZones,
} from "@/api/hvacApi";
import {
  buildHvacDeckHierarchy,
  HVAC_HOUSE_CHANGED_EVENT,
  HVAC_ZONE_STATE_CHANGED_EVENT,
  SYSTEM_TYPE_LABELS,
  ZONE_KIND_LABELS,
} from "@/lib/hvac/hvacSettings";

const PAGE_TABS = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "zones", label: "Zones", icon: Sliders },
  { key: "equipment", label: "Equipment", icon: Settings },
];

export default function HvacPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [house, setHouse] = useState(null);
  const [houseLoading, setHouseLoading] = useState(true);
  const [zoneState, setZoneState] = useState({});
  const [pendingZones, setPendingZones] = useState({});
  const [pollingAll, setPollingAll] = useState(false);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [filterSystem, setFilterSystem] = useState("all");
  const [filterDeck, setFilterDeck] = useState("all");

  const hasHouse = !!house && (house.zones?.length || 0) > 0;
  const hierarchy = useMemo(() => buildHvacDeckHierarchy(house), [house]);
  const allSystems = useMemo(() => {
    if (!house?.zones) return [];
    return [...new Set(house.zones.map((z) => z.systemType))];
  }, [house]);

  useEffect(() => {
    if (!hierarchy.length) { setActiveDeckId(null); return; }
    if (!activeDeckId || !hierarchy.find((d) => d.id === activeDeckId)) {
      setActiveDeckId(hierarchy[0]?.id || null);
    }
  }, [hierarchy, activeDeckId]);

  const activeDeck = useMemo(() => hierarchy.find((d) => d.id === activeDeckId) || null, [hierarchy, activeDeckId]);

  const refresh = useCallback(async () => {
    setHouseLoading(true);
    try {
      const [h, s] = await Promise.all([loadHvacHouse(), loadHvacZoneState()]);
      setHouse(h);
      setZoneState(s || {});
    } finally {
      setHouseLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onHouse = (e) => { if (e?.detail) setHouse(e.detail); else refresh(); };
    const onZone = (e) => { if (e?.detail) setZoneState(e.detail); };
    window.addEventListener(HVAC_HOUSE_CHANGED_EVENT, onHouse);
    window.addEventListener(HVAC_ZONE_STATE_CHANGED_EVENT, onZone);
    return () => {
      window.removeEventListener(HVAC_HOUSE_CHANGED_EVENT, onHouse);
      window.removeEventListener(HVAC_ZONE_STATE_CHANGED_EVENT, onZone);
    };
  }, [refresh]);

  const filteredZones = useMemo(() => {
    if (!house?.zones) return [];
    let zones = house.zones;
    if (filterSystem !== "all") zones = zones.filter((z) => z.systemType === filterSystem);
    if (filterDeck !== "all") zones = zones.filter((z) => z.deck === filterDeck);
    return zones;
  }, [house?.zones, filterSystem, filterDeck]);

  const setPending = (id, v) => setPendingZones((prev) => ({ ...prev, [id]: v }));

  const handleSetpoint = useCallback(async (zone, temp) => {
    setPending(zone.id, true);
    try {
      await setHvacZoneLevel({ zoneId: zone.href || zone.id, level: temp, zone });
      const next = await loadHvacZoneState();
      setZoneState(next);
    } catch (err) {
      toast.error(err.message || "Failed to set temperature");
    } finally {
      setPending(zone.id, false);
    }
  }, []);

  const handleMode = useCallback(async (zone, mode) => {
    setPending(zone.id, true);
    try {
      const id = zone.systemType === "knx" ? `mode:${zone.href}` : `hvac_mode:${zone.register || 0}`;
      await setHvacZoneLevel({ zoneId: id, level: { cool: 50, heat: 25, auto: 75, off: 0, fanOnly: 100, dry: 60, comfort: 20, standby: 40, night: 60, frost: 80 }[mode] || 0, zone });
      const next = await loadHvacZoneState();
      setZoneState(next);
    } catch (err) {
      toast.error(err.message || "Failed to set mode");
    } finally {
      setPending(zone.id, false);
    }
  }, []);

  const handlePower = useCallback(async (zone, on) => {
    setPending(zone.id, true);
    try {
      const id = zone.systemType === "coolmaster" ? `power:${zone.unitId}` : zone.href || zone.id;
      await setHvacZoneLevel({ zoneId: id, level: on ? 100 : 0, zone });
      setZoneState((prev) => ({ ...prev, [zone.id]: { ...prev[zone.id], on, updatedAt: new Date().toISOString() } }));
    } catch (err) {
      toast.error(err.message || "Failed to toggle power");
    } finally {
      setPending(zone.id, false);
    }
  }, []);

  const handlePollAll = useCallback(async () => {
    setPollingAll(true);
    try {
      const remote = await pollHvacZones({ zoneIds: filteredZones.map((z) => z.id) });
      const merged = { ...zoneState };
      for (const r of remote || []) {
        if (r.id) merged[r.id] = { ...merged[r.id], ...r, updatedAt: r.updatedAt || new Date().toISOString() };
      }
      setZoneState(merged);
      await saveHvacZoneState(merged);
    } finally {
      setPollingAll(false);
    }
  }, [filteredZones, zoneState]);

  const totalZones = house?.zones?.length || 0;
  const onCount = Object.values(zoneState).filter((s) => s?.on).length;
  const avgSetpoint = useMemo(() => {
    const vals = Object.values(zoneState).filter((s) => s?.setpoint != null).map((s) => s.setpoint);
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }, [zoneState]);

  const deckNames = useMemo(() => {
    if (!house?.zones) return [];
    return [...new Set(house.zones.map((z) => z.deck || "Main"))];
  }, [house?.zones]);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/90 backdrop-blur-xl flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-sky-500/12 flex items-center justify-center ring-1 ring-sky-500/20 flex-shrink-0">
            <Thermometer size={16} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground leading-none">HVAC Control</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Building Management System — temperature, zones &amp; equipment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasHouse && (
            <button
              onClick={handlePollAll}
              disabled={pollingAll}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {pollingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              Poll
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-card/60 flex-shrink-0 overflow-x-auto">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              activeTab === tab.key
                ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {houseLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-6">
          <Loader2 size={12} className="animate-spin" />
          Loading HVAC configuration…
        </div>
      ) : !hasHouse ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-4 ring-1 ring-sky-500/20 mx-auto">
              <Thermometer size={28} className="text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">No HVAC system configured</h3>
            <p className="text-xs text-muted-foreground">
              Configure HVAC integrations in Settings → Integrations, then add zones and equipment here.
              Supported systems: Modbus TCP, Coolmaster Net, KNX, RS485 Serial Bridge.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="flex-1 overflow-auto p-5 space-y-5">
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-secondary/40 border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Sliders size={12} /> Zones
                  </div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{totalZones}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{onCount} active</p>
                </div>
                <div className="rounded-xl bg-secondary/40 border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Building2 size={12} /> Decks / Areas
                  </div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{hierarchy.length}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{deckNames.length} decks</p>
                </div>
                <div className="rounded-xl bg-secondary/40 border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Thermometer size={12} /> Avg Setpoint
                  </div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{avgSetpoint ?? "—"}°</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">across active zones</p>
                </div>
                <div className="rounded-xl bg-secondary/40 border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Settings size={12} /> Systems
                  </div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{allSystems.length}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{allSystems.map((s) => SYSTEM_TYPE_LABELS[s] || s).join(", ")}</p>
                </div>
              </div>

              {/* System status */}
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">System Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {allSystems.map((st) => (
                    <div key={st} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-card border border-border">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span className="text-sm text-foreground">{SYSTEM_TYPE_LABELS[st] || st}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {house.zones.filter((z) => z.systemType === st).length} zones
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deck overview */}
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Deck Overview</p>
                <div className="space-y-3">
                  {hierarchy.map((deck) => {
                    const deckZones = house.zones.filter((z) => (z.deck || "Main") === deck.name);
                    const deckOn = deckZones.filter((z) => zoneState[z.id]?.on).length;
                    return (
                      <div key={deck.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-2">
                          <Building2 size={12} className="text-sky-400" />
                          <span className="text-sm font-medium text-foreground">{deck.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{deck.areas.length} areas</span>
                          <span>{deckOn}/{deckZones.length} zones active</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Zone kind distribution */}
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Zone Types</p>
                <div className="flex flex-wrap gap-2">
                  {["temperature", "setpoint", "mode", "onoff", "fan", "humidity"].map((kind) => {
                    const count = house.zones.filter((z) => z.kind === kind).length;
                    if (!count) return null;
                    return (
                      <span key={kind} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-foreground">
                        {count} {ZONE_KIND_LABELS[kind] || kind}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Zones Tab */}
          {activeTab === "zones" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Filters */}
              <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-card/50 flex-shrink-0 overflow-x-auto">
                <select
                  value={filterSystem}
                  onChange={(e) => setFilterSystem(e.target.value)}
                  className="bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="all">All Systems</option>
                  {allSystems.map((s) => (
                    <option key={s} value={s}>{SYSTEM_TYPE_LABELS[s] || s}</option>
                  ))}
                </select>
                <select
                  value={filterDeck}
                  onChange={(e) => setFilterDeck(e.target.value)}
                  className="bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="all">All Decks</option>
                  {deckNames.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredZones.length} zones
                </span>
              </div>

              {/* Deck tabs */}
              {hierarchy.length > 0 && (
                <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-card/30 flex-shrink-0 overflow-x-auto">
                  {hierarchy.map((deck) => (
                    <button
                      key={deck.id}
                      onClick={() => setActiveDeckId(deck.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                        activeDeckId === deck.id
                          ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                      }`}
                    >
                      <Building2 size={11} />
                      {deck.name}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        activeDeckId === deck.id ? "bg-sky-500/20 text-sky-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {deck.areas.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Zone cards grouped by area */}
              <div className="flex-1 overflow-y-auto p-5">
                {activeDeck ? (
                  <div className="space-y-6">
                    {activeDeck.areas.map((area) => {
                      const areaZones = filteredZones.filter((z) => (z.area || "General") === area.name);
                      if (!areaZones.length) return null;
                      return (
                        <div key={area.id}>
                          <div className="flex items-center gap-2 mb-3">
                            <LayoutGrid size={12} className="text-muted-foreground" />
                            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">{area.name}</h3>
                            <span className="text-[10px] text-muted-foreground">{areaZones.length} zones</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {areaZones.map((zone) => (
                              <HvacZoneCard
                                key={zone.id}
                                zone={zone}
                                state={zoneState[zone.id]}
                                pending={pendingZones}
                                onSetpoint={handleSetpoint}
                                onMode={handleMode}
                                onPower={handlePower}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                    Select a deck to view zones
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Equipment Tab */}
          {activeTab === "equipment" && (
            <div className="flex-1 overflow-auto p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(house.equipment || []).map((eq) => {
                  const eqZones = house.zones.filter((z) => z.equipmentId === eq.id);
                  const isOnline = eq.status === "online";
                  return (
                    <div key={eq.id} className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-red-400"}`} />
                          <span className="text-sm font-medium text-foreground">{eq.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase font-semibold">
                          {SYSTEM_TYPE_LABELS[eq.systemType] || eq.systemType}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Model</span>
                        <span className="text-foreground">{eq.model || "—"}</span>
                        <span className="text-muted-foreground">Host</span>
                        <span className="text-foreground font-mono">{eq.host || "—"}</span>
                        <span className="text-muted-foreground">Port</span>
                        <span className="text-foreground">{eq.port || "—"}</span>
                        <span className="text-muted-foreground">Zones</span>
                        <span className="text-foreground">{eqZones.length}</span>
                        <span className="text-muted-foreground">Status</span>
                        <span className={`${isOnline ? "text-emerald-400" : "text-red-400"}`}>
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {(!house.equipment || house.equipment.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wrench size={24} className="text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No HVAC equipment configured</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Add equipment entries in Settings → Integrations</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
