import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Zap,
  LayoutGrid,
  Map,
  GitBranch,
  Upload,
  Wand2,
  RefreshCcw,
  Activity,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Settings,
  Table2,
} from "lucide-react";
import LightingZoneMap from "../components/lighting/LightingZoneMap";
import LightingZoneList from "../components/lighting/LightingZoneList";
import LightingScenePanel from "../components/lighting/LightingScenePanel";
import LightingSystemStatus from "../components/lighting/LightingSystemStatus";
import LightingMapTab from "../components/topology/LightingMapTab";
import LutronAreaLoads from "../components/lighting/LutronAreaLoads";
import LutronImportModal from "../components/lighting/LutronImportModal";
import LutronConnectionModal from "../components/lighting/LutronConnectionModal";
import LoadScheduleTable from "../components/lighting/LoadScheduleTable";
import { toast } from "@/components/ui/use-toast";
import {
  loadLightingHouse,
  saveLightingHouse,
  clearLightingHouse,
  loadZoneState,
  loadLutronConnection,
  saveLutronConnection,
  setZoneLevel,
  activateScene,
  pollZones,
  stopShade,
  testLutronProcessor,
} from "@/api/lightingApi";
import {
  buildLightingHierarchy,
  DEFAULT_LUTRON_CONNECTION,
  LIGHTING_HOUSE_CHANGED_EVENT,
  LIGHTING_ZONE_STATE_CHANGED_EVENT,
  LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT,
} from "@/lib/lighting/lightingSettings";

const PAGE_TABS = [
  { key: "loads", label: "Loads by Area", icon: Lightbulb },
  { key: "control", label: "Area Control", icon: LayoutGrid },
  { key: "topology", label: "Lighting Map", icon: GitBranch },
];

export default function LightingPage() {
  const [activePageTab, setActivePageTab] = useState("loads");

  // ── Lutron house (parsed integration report) ───────────────────────────
  const [house, setHouse] = useState(null);
  const [houseLoading, setHouseLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [zoneState, setZoneState] = useState({});
  const [pendingZones, setPendingZones] = useState({});
  const [pendingScene, setPendingScene] = useState(null);
  const [connection, setConnection] = useState(null);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [lutronConn, setLutronConn] = useState(DEFAULT_LUTRON_CONNECTION);
  const [pollingAll, setPollingAll] = useState(false);

  // ── Deck Control state (floor-based, Lutron-driven) ────────────────────
  const [activeFloorId, setActiveFloorId] = useState(null);
  const [selectedZoneHref, setSelectedZoneHref] = useState(null);
  const [viewMode, setViewMode] = useState("map");

  const hasHouse = !!house && (house.zones?.length || 0) > 0;
  const hierarchy = useMemo(() => buildLightingHierarchy(house), [house]);

  // Pick a sensible default floor whenever the hierarchy changes (e.g.
  // first load, re-import or clear).
  useEffect(() => {
    if (!hierarchy.length) {
      setActiveFloorId(null);
      return;
    }
    if (!activeFloorId || !hierarchy.find((f) => f.id === activeFloorId)) {
      setActiveFloorId(hierarchy[0].id);
    }
  }, [hierarchy, activeFloorId]);

  const activeFloor = useMemo(
    () => hierarchy.find((f) => f.id === activeFloorId) || null,
    [hierarchy, activeFloorId]
  );

  // Flat list of zones on the active floor (used by the list view).
  const activeFloorZones = useMemo(() => {
    if (!activeFloor) return [];
    return (activeFloor.areas || []).flatMap((a) => a.zones || []);
  }, [activeFloor]);

  // Scenes scoped to the active floor (used by the side panel).
  const activeFloorScenes = useMemo(() => {
    const all = house?.scenes || [];
    if (!activeFloor) return [];
    return all.filter((s) => s.floor === activeFloor.id);
  }, [house?.scenes, activeFloor]);

  // ── Loaders ────────────────────────────────────────────────────────────
  const refreshHouse = useCallback(async () => {
    setHouseLoading(true);
    try {
      const [h, s, c] = await Promise.all([
        loadLightingHouse(),
        loadZoneState(),
        loadLutronConnection(),
      ]);
      setHouse(h);
      setZoneState(s || {});
      setLutronConn(c || DEFAULT_LUTRON_CONNECTION);
    } finally {
      setHouseLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHouse();
  }, [refreshHouse]);

  useEffect(() => {
    const onHouseChanged = (e) => {
      if (e?.detail) setHouse(e.detail);
      else refreshHouse();
    };
    const onZoneChanged = (e) => {
      if (e?.detail?.state) setZoneState(e.detail.state);
    };
    const onConnChanged = (e) => {
      if (e?.detail) setLutronConn(e.detail);
    };
    window.addEventListener(LIGHTING_HOUSE_CHANGED_EVENT, onHouseChanged);
    window.addEventListener(LIGHTING_ZONE_STATE_CHANGED_EVENT, onZoneChanged);
    window.addEventListener(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, onConnChanged);
    return () => {
      window.removeEventListener(LIGHTING_HOUSE_CHANGED_EVENT, onHouseChanged);
      window.removeEventListener(LIGHTING_ZONE_STATE_CHANGED_EVENT, onZoneChanged);
      window.removeEventListener(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, onConnChanged);
    };
  }, [refreshHouse]);

  // ── Handlers (live LEAP / Telnet / mock engine) ────────────────────────
  const setPendingZone = (href, on) =>
    setPendingZones((prev) => ({ ...prev, [href]: on }));

  const reportLightingError = useCallback((title, err) => {
    const message =
      err?.message ||
      (typeof err === "string" ? err : "Lutron processor did not respond.");
    console.error("[lighting]", title, err);
    toast({
      variant: "destructive",
      title,
      description: message,
    });
  }, []);

  const handleZoneLevel = useCallback(
    async (zone, level) => {
      setPendingZone(zone.href, true);
      try {
        await setZoneLevel({ zoneHref: zone.href, level });
      } catch (err) {
        reportLightingError(`Could not set ${zone.name || "zone"}`, err);
      } finally {
        setPendingZone(zone.href, false);
      }
    },
    [reportLightingError]
  );

  const handleZoneToggle = useCallback(
    async (zone, turnOn) => {
      const next = turnOn ? Math.max(zoneState[zone.href]?.level || 0, 80) : 0;
      await handleZoneLevel(zone, next);
    },
    [zoneState, handleZoneLevel]
  );

  const handleStopShade = useCallback(
    async (zone) => {
      setPendingZone(zone.href, true);
      try {
        await stopShade({ zoneHref: zone.href });
      } catch (err) {
        reportLightingError(`Could not stop ${zone.name || "shade"}`, err);
      } finally {
        setPendingZone(zone.href, false);
      }
    },
    [reportLightingError]
  );

  const handleActivateScene = useCallback(
    async (sceneOrArea, maybeScene) => {
      // The Loads-by-area panel passes `(area, scene)`; the Deck Control
      // and Map tabs pass just `(scene)` — derive the area from the scene
      // when the first arg is the scene itself.
      const scene = maybeScene || sceneOrArea;
      const area =
        maybeScene
          ? sceneOrArea
          : hierarchy
              .flatMap((f) => f.areas || [])
              .find((a) => (a.fullPath || a.id) === scene.areaFullPath) ||
            null;

      setPendingScene(scene.href);
      try {
        const isOff = /off scene/i.test(scene.name || "");
        // The mock engine does not know per-zone scene targets, so we
        // approximate by setting every load in the scene's area to a level
        // inferred from the scene index. On a live processor the server
        // also issues `#AREA,<area_id>,6,<scene_number>` which applies the
        // Designer-saved levels — the per-zone OUTPUT commands keep the
        // platform's commanded state in sync with what the processor did.
        const idx = parseInt((scene.name?.match(/(\d+)/) || [])[1] || "0", 10);
        const levels = [100, 75, 50, 25, 10];
        const target = isOff
          ? 0
          : levels[Math.min(idx - 1, levels.length - 1)] ?? 60;
        const sceneZones = (area?.zones || [])
          .filter((z) => z.kind === "light" || z.kind === "load")
          .map((z) => ({ href: z.href, level: target }));
        await activateScene({
          sceneHref: scene.href,
          sceneName: scene.name,
          sceneAreaId: scene.area_id || area?.id,
          sceneZones,
        });
      } catch (err) {
        reportLightingError(`Could not activate ${scene.name || "scene"}`, err);
      } finally {
        setPendingScene(null);
      }
    },
    [hierarchy, reportLightingError]
  );

  const handleTestConnection = useCallback(async () => {
    setConnectionTesting(true);
    try {
      const r = await testLutronProcessor({});
      setConnection(r);
      if (!r?.success) {
        reportLightingError("Lutron processor unreachable", r?.message || "");
      }
    } catch (err) {
      reportLightingError("Could not test the Lutron processor", err);
    } finally {
      setConnectionTesting(false);
    }
  }, [reportLightingError]);

  // Once the stored Lutron connection has loaded and live mode is enabled,
  // probe the processor automatically so the operator sees up-front whether
  // the Telnet socket / credentials are accepted, rather than discovering it
  // after the first slider drag.
  useEffect(() => {
    if (!lutronConn?.enabled || !lutronConn?.host) return;
    if (connection || connectionTesting) return;
    handleTestConnection();
  }, [
    lutronConn?.enabled,
    lutronConn?.host,
    connection,
    connectionTesting,
    handleTestConnection,
  ]);

  const handlePollAll = useCallback(async () => {
    if (!house?.zones?.length) return;
    setPollingAll(true);
    try {
      const hrefs = house.zones.map((z) => z.href);
      const remote = await pollZones({ hrefs });
      const merged = { ...zoneState };
      for (const r of remote || []) {
        merged[r.href] = {
          level: r.level ?? 0,
          on: r.on ?? (r.level ?? 0) > 0,
          updatedAt: r.updatedAt || new Date().toISOString(),
        };
      }
      setZoneState(merged);
    } finally {
      setPollingAll(false);
    }
  }, [house?.zones, zoneState]);

  const handleImport = useCallback(async (parsed) => {
    await saveLightingHouse(parsed);
    setHouse(parsed);
  }, []);

  const handleClearHouse = useCallback(async () => {
    if (!window.confirm("Remove the loaded Lutron house? Devices, zones and scenes will be cleared.")) return;
    await clearLightingHouse();
    setHouse(null);
    setZoneState({});
  }, []);

  const handleSaveConnection = useCallback(async (next) => {
    const saved = await saveLutronConnection(next);
    setLutronConn(saved);
    setConnectionTesting(true);
    try {
      const r = await testLutronProcessor();
      setConnection(r);
    } finally {
      setConnectionTesting(false);
    }
    return saved;
  }, []);

  const onCountForHouse = useMemo(
    () => Object.values(zoneState).filter((s) => s?.on).length,
    [zoneState]
  );
  const totalZones = house?.zones?.length || 0;

  // KPIs for the Deck Control top strip (active-floor scope).
  const deckKpis = useMemo(() => {
    const zones = activeFloorZones;
    const on = zones.filter((z) => zoneState?.[z.href]?.on).length;
    const areas = activeFloor?.areas?.length || 0;
    return { total: zones.length, on, areas };
  }, [activeFloorZones, activeFloor, zoneState]);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/90 backdrop-blur-xl flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/12 flex items-center justify-center ring-1 ring-amber-500/20 flex-shrink-0">
            <Lightbulb size={16} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground leading-none">Lighting Control</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Lutron HomeWorks QSX · Athena · RadioRA 3 — area-based load monitoring &amp; control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasHouse && (
            <>
              <button
                onClick={handlePollAll}
                disabled={pollingAll}
                title="Poll all zones"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
              >
                {pollingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                Poll
              </button>
              <button
                onClick={handleTestConnection}
                disabled={connectionTesting}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
              >
                {connectionTesting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Activity size={12} />
                )}
                Test processor
              </button>
            </>
          )}
          <button
            onClick={() => setConnectionOpen(true)}
            title="Lutron processor credentials"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              lutronConn?.enabled && lutronConn?.host
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <KeyRound size={12} />
            <span className="hidden sm:inline">
              {lutronConn?.host ? "Processor" : "Set credentials"}
            </span>
            <span className="sm:hidden">Creds</span>
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/25"
          >
            <Upload size={12} />
            <span className="hidden sm:inline">Import report</span>
            <span className="sm:hidden">Import</span>
          </button>
          {hasHouse && (
            <button
              onClick={handleClearHouse}
              title="Clear loaded Lutron house"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/10"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Page tab bar ── */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-card/60 flex-shrink-0 overflow-x-auto">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActivePageTab(tab.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              activePageTab === tab.key
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Loads-by-area tab ── */}
      {activePageTab === "loads" && (
        <div className="flex-1 overflow-auto bg-background">
          {hasHouse && (
            <div className="px-5 py-3 border-b border-border bg-card/50 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                <Lightbulb size={12} />
                {onCountForHouse}/{totalZones} loads on
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Building2 size={12} />
                {house?.areas?.length || 0} areas across {hierarchy.length} floors
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Wand2 size={12} />
                {house?.scenes?.length || 0} scenes
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Settings size={12} />
                {house?.devices?.length || 0} keypads
              </span>
              {(house?.loadSchedule?.length || 0) > 0 && (
                <button
                  onClick={() => setScheduleOpen(!scheduleOpen)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                    scheduleOpen
                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Table2 size={11} />
                  Schedule · {house.loadSchedule.length}
                </button>
              )}
              {connection && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                    connection.success
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}
                >
                  {connection.success ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  {connection.success ? "Processor OK" : "Processor offline"}
                  <span className="text-[10px] opacity-80">
                    · {connection.processor} · {connection.api || connection.mode}
                  </span>
                </span>
              )}
              {!connection && lutronConn?.host && (
                <button
                  onClick={() => setConnectionOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Edit processor credentials"
                >
                  <KeyRound size={11} />
                  {lutronConn.protocol === "leap" ? "LEAP" : "Telnet"} · {lutronConn.host}:{lutronConn.port}
                  <span className="opacity-70">
                    · {lutronConn.enabled ? "live" : "mock"}
                  </span>
                </button>
              )}
              {!lutronConn?.host && (
                <button
                  onClick={() => setConnectionOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20"
                  title="Add Lutron integration credentials"
                >
                  <KeyRound size={11} />
                  No processor credentials
                </button>
              )}
            </div>
          )}

          <LoadScheduleTable
            house={house}
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
          />

          {houseLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-6">
              <Loader2 size={12} className="animate-spin" />
              Loading lighting house…
            </div>
          ) : (
            <LutronAreaLoads
              hierarchy={hierarchy}
              zoneState={zoneState}
              pendingZones={pendingZones}
              pendingScene={pendingScene}
              onZoneLevel={handleZoneLevel}
              onZoneToggle={handleZoneToggle}
              onStopShade={handleStopShade}
              onActivateScene={handleActivateScene}
            />
          )}
        </div>
      )}

      {/* ── Deck Control tab (per-floor Lutron control) ── */}
      {activePageTab === "control" && (
        <div className="flex flex-1 overflow-hidden">
          {!hasHouse ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 ring-1 ring-amber-500/20 mx-auto">
                  <Wand2 size={28} className="text-amber-400" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">
                  No lighting house loaded
                </h3>
                <p className="text-xs text-muted-foreground">
                  Import a Lutron Integration Report to enable per-floor
                  zone control.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-64 flex-shrink-0 border-r border-border bg-card/70 flex flex-col overflow-y-auto">
                <LightingScenePanel
                  scenes={activeFloorScenes}
                  pendingScene={pendingScene}
                  onActivateScene={handleActivateScene}
                  title={
                    activeFloor
                      ? `Scenes · ${activeFloor.name}`
                      : "Scenes"
                  }
                />
                <LightingSystemStatus
                  house={house}
                  hierarchy={hierarchy}
                  zoneState={zoneState}
                  connection={connection}
                  lutronConn={lutronConn}
                />
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Floor tabs + view-mode toggle */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/50 flex-shrink-0 overflow-x-auto">
                  {hierarchy.map((floor) => {
                    const zones = (floor.areas || []).flatMap(
                      (a) => a.zones || []
                    );
                    const on = zones.filter(
                      (z) => zoneState?.[z.href]?.on
                    ).length;
                    return (
                      <button
                        key={floor.id}
                        onClick={() => setActiveFloorId(floor.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                          activeFloorId === floor.id
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
                        }`}
                      >
                        <Building2 size={11} />
                        {floor.name}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            activeFloorId === floor.id
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {on}/{zones.length}
                        </span>
                      </button>
                    );
                  })}

                  <div className="flex items-center gap-1 bg-secondary border border-border rounded-xl p-1 ml-auto">
                    {[
                      { key: "map", icon: Map, label: "Map" },
                      { key: "list", icon: LayoutGrid, label: "List" },
                    ].map((v) => (
                      <button
                        key={v.key}
                        onClick={() => setViewMode(v.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          viewMode === v.key
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "text-muted-foreground hover:text-secondary-foreground"
                        }`}
                      >
                        <v.icon size={12} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KPI strip for the active floor */}
                <div className="flex items-center gap-3 px-5 py-2 border-b border-border bg-card/30 text-xs flex-shrink-0">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Lightbulb size={11} />
                    {deckKpis.on} loads on
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 size={11} />
                    {deckKpis.areas} areas · {deckKpis.total} loads
                  </span>
                  {pendingScene && (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Loader2 size={11} className="animate-spin" />
                      Activating scene…
                    </span>
                  )}
                  {connection && !connection.success && (
                    <span className="flex items-center gap-1.5 text-red-400 ml-auto">
                      <Zap size={11} />
                      Processor offline
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    {viewMode === "map" ? (
                      <motion.div
                        key="map"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0"
                      >
                        <LightingZoneMap
                          floor={activeFloor}
                          zoneState={zoneState}
                          pendingZones={pendingZones}
                          selectedHref={selectedZoneHref}
                          onSelectZone={setSelectedZoneHref}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 overflow-y-auto"
                      >
                        <LightingZoneList
                          zones={activeFloorZones}
                          zoneState={zoneState}
                          pendingZones={pendingZones}
                          selectedHref={selectedZoneHref}
                          onSelectZone={setSelectedZoneHref}
                          onZoneLevel={handleZoneLevel}
                          onZoneToggle={handleZoneToggle}
                          onStopShade={handleStopShade}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Lighting Map tab (whole-house topology) ── */}
      {activePageTab === "topology" && (
        <div className="flex-1 overflow-hidden">
          <LightingMapTab
            hierarchy={hierarchy}
            scenes={house?.scenes || []}
            zoneState={zoneState}
            pendingZones={pendingZones}
            pendingScene={pendingScene}
            onZoneLevel={handleZoneLevel}
            onZoneToggle={handleZoneToggle}
            onStopShade={handleStopShade}
            onActivateScene={handleActivateScene}
          />
        </div>
      )}

      <LutronImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      <LutronConnectionModal
        open={connectionOpen}
        connection={lutronConn}
        onClose={() => setConnectionOpen(false)}
        onSave={handleSaveConnection}
      />
    </div>
  );
}
