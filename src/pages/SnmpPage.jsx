import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Network,
  RefreshCw,
  Plus,
  Loader2,
  AlertTriangle,
  Download,
  LayoutDashboard,
  Server,
  Bell,
  SlidersHorizontal,
  Trash2,
  Globe,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listEquipment, updateEquipment } from "@/api/equipmentApi";
import { listCredentials, saveCredentials } from "@/api/credentialsApi";
import { upsertEquipmentCredential } from "@/lib/credentials/credentialsVault";
import { getEquipmentIp } from "@/lib/snmp/snmpSwitchProfiles";
import {
  listManagedSwitches,
  saveManagedSwitches,
  pollSwitch,
  pollAll,
  testInterface,
} from "@/api/snmpSwitchApi";
import {
  profileIdForEquipment,
  portCountFromModel,
  parseSwitchModel,
  parseNetworkDeviceModel,
  buildDefaultProfileFields,
  buildFleetProfileForEquipment,
  SNMP_SWITCHES_CHANGED_EVENT,
  DEFAULT_SNMP_SWITCHES,
} from "@/lib/snmp/snmpSwitchProfiles";
import { DEFAULT_SNMP_GLOBAL } from "@/lib/snmp/snmpManagementSettings";
import {
  loadDiscoverySettingsLocal,
  DEFAULT_DISCOVERY_SETTINGS,
} from "@/lib/discoverySettings";
import {
  enrichProfiles,
  computeFleetSummary,
  exportPortsCsv,
  downloadCsv,
} from "@/lib/snmp/snmpAnalytics";
import SnmpFleetOverview from "@/components/snmp/SnmpFleetOverview";
import SnmpPortMapPanel from "@/components/snmp/SnmpPortMapPanel";
import SnmpSwitchWorkspace from "@/components/snmp/SnmpSwitchWorkspace";
import SnmpAlertsPanel from "@/components/snmp/SnmpAlertsPanel";
import SnmpPlatformSettings from "@/components/snmp/SnmpPlatformSettings";
import SnmpAddSwitchModal from "@/components/snmp/SnmpAddSwitchModal";
import SnmpSwitchSettingsDrawer from "@/components/snmp/SnmpSwitchSettingsDrawer";
import SnmpWanManagementPanel from "@/components/snmp/SnmpWanManagementPanel";
import { loadWanManagement, saveWanManagement } from "@/api/wanManagementApi";
import { DEFAULT_WAN_MANAGEMENT } from "@/lib/wan/wanManagementSettings";
import CiscoSwitchesPage from "@/pages/CiscoSwitchesPage";

const HEALTH_BORDER = {
  healthy: "border-l-emerald-500",
  warning: "border-l-amber-500",
  critical: "border-l-red-500",
  disabled: "border-l-slate-600",
  unknown: "border-l-slate-500",
};

function EmptyFleetPrompt({ onRegister }) {
  return (
    <div className="glass rounded-2xl p-12 text-center border border-border">
      <Server size={48} className="mx-auto text-muted-foreground mb-4 opacity-60" />
      <h2 className="text-lg font-semibold">Build your Core Network fleet</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
        Register switches, Peplink WAN routers, and firewalls from Equipment. Poll IF-MIB and
        vendor APIs for interface status, traffic, and WAN/cellular health.
      </p>
      <button
        type="button"
        onClick={onRegister}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
      >
        <Plus size={16} /> Register first device
      </button>
    </div>
  );
}

const VALID_TABS = new Set(["overview", "switches", "cisco", "wan", "alerts", "settings"]);

export default function SnmpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState(DEFAULT_SNMP_SWITCHES);
  const [equipment, setEquipment] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPort, setSelectedPort] = useState(null);
  const [portView, setPortView] = useState(DEFAULT_SNMP_GLOBAL.defaultPortView);
  const [tab, setTab] = useState(() => {
    const q = searchParams.get("tab");
    return q && VALID_TABS.has(q) ? q : "overview";
  });
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [testingPort, setTestingPort] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [globalDraft, setGlobalDraft] = useState(DEFAULT_SNMP_GLOBAL);
  const [wanManagement, setWanManagement] = useState(DEFAULT_WAN_MANAGEMENT);
  const [pollingRouterId, setPollingRouterId] = useState(null);
  const pollInFlight = useRef(false);
  const profileCountRef = useRef(0);

  const discovery = useMemo(
    () => loadDiscoverySettingsLocal() || DEFAULT_DISCOVERY_SETTINGS,
    []
  );

  useEffect(() => {
    profileCountRef.current = state.profiles.length;
  }, [state.profiles.length]);

  useEffect(() => {
    const q = searchParams.get("tab");
    if (q && VALID_TABS.has(q) && q !== tab) setTab(q);
  }, [searchParams, tab]);

  const handleTabChange = useCallback(
    (value) => {
      setTab(value);
      if (value === "overview") {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ tab: value }, { replace: true });
      }
    },
    [setSearchParams]
  );

  const ciscoTabPanel = (
    <TabsContent value="cisco" className="mt-0">
      <div className="rounded-2xl border border-border overflow-hidden min-h-[calc(100vh-14rem)]">
        <CiscoSwitchesPage embedded />
      </div>
    </TabsContent>
  );

  const ciscoTabTrigger = (
    <TabsTrigger value="cisco" className="gap-1.5">
      <Cpu size={14} /> Cisco Switches
    </TabsTrigger>
  );

  const load = useCallback(async () => {
    const showFullPageLoader = profileCountRef.current === 0;
    if (showFullPageLoader) setLoading(true);
    try {
      const [swState, eq, wanMgmt] = await Promise.all([
        listManagedSwitches(),
        listEquipment(),
        loadWanManagement(),
      ]);
      setState(swState);
      setGlobalDraft(swState.global || DEFAULT_SNMP_GLOBAL);
      setPortView(swState.global?.defaultPortView || "panel");
      setEquipment(eq);
      setWanManagement(wanMgmt || DEFAULT_WAN_MANAGEMENT);
      setSelectedId((id) => id || swState.profiles?.[0]?.id || null);
    } catch (err) {
      toast.error(err.message || "Failed to load Core Network");
    } finally {
      if (showFullPageLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(SNMP_SWITCHES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SNMP_SWITCHES_CHANGED_EVENT, onChange);
  }, [load]);

  const equipmentById = useMemo(
    () => new Map(equipment.map((e) => [e.id, e])),
    [equipment]
  );

  const enriched = useMemo(
    () => enrichProfiles(state.profiles, equipmentById),
    [state.profiles, equipmentById]
  );

  const summary = useMemo(
    () => computeFleetSummary(enriched, state.global),
    [enriched, state.global]
  );

  const overviewPollMeta = useMemo(() => {
    const latestPoll = (state.profiles || []).reduce((best, p) => {
      if (!p.lastPollAt) return best;
      return !best || p.lastPollAt > best ? p.lastPollAt : best;
    }, null);
    return latestPoll ? { polledAt: latestPoll, error: null } : null;
  }, [state.profiles]);

  const selected = enriched.find((s) => s.id === selectedId) || enriched[0];
  const existingIds = new Set(state.profiles.map((p) => p.equipmentId));

  const persist = async (nextState) => {
    const saved = await saveManagedSwitches(nextState);
    setState(saved);
    setGlobalDraft(saved.global);
    return saved;
  };

  const persistProfiles = async (profiles) => {
    return persist({ ...state, profiles });
  };

  const openAddModal = async () => {
    try {
      setEquipment(await listEquipment());
    } catch {
      /* cached */
    }
    setShowAdd(true);
  };

  const handleAdd = async (eq) => {
    const defaults = buildDefaultProfileFields(eq);
    const profile = {
      id: profileIdForEquipment(eq.id),
      equipmentId: eq.id,
      enabled: true,
      portCount: portCountFromModel(eq.model) || parseNetworkDeviceModel(eq.model)?.portCount || null,
      pollIntervalSec: null,
      deckId: eq.deckId || "",
      roomId: eq.roomId || "",
      location: eq.location || "",
      snmpCommunity: "",
      snmpVersion: discovery.snmpVersion || "2c",
      notes: "",
      tags: [],
      lastPollAt: null,
      lastPollError: null,
      lastPoll: null,
      ...defaults,
    };
    await persistProfiles([...state.profiles, profile]);
    setSelectedId(profile.id);
    setTab("switches");
    setShowAdd(false);
    const spec = parseSwitchModel(eq.model);
    toast.success(
      spec
        ? `Registered ${eq.name} (${spec.portCount}-port ${spec.series})`
        : `Registered ${eq.name}`
    );
  };

  const runPollAll = useCallback(
    async (silent = false) => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      setPolling(true);
      try {
        const res = await pollAll();
        if (res.profiles) {
          setState((prev) => ({ ...prev, profiles: res.profiles }));
        } else {
          await load();
        }
        if (!silent) {
          toast.success(`Fleet poll complete — ${res.switches?.length ?? state.profiles.length} switch(es)`);
        }
      } catch (err) {
        if (!silent) toast.error(err.message || "Fleet poll failed");
      } finally {
        setPolling(false);
        pollInFlight.current = false;
      }
    },
    [load, state.profiles]
  );

  useEffect(() => {
    if (!state.global?.autoPollEnabled || !state.profiles.length) return;
    const ms = (state.global.autoPollIntervalSec || 300) * 1000;
    const id = setInterval(() => runPollAll(true), ms);
    return () => clearInterval(id);
  }, [state.global?.autoPollEnabled, state.global?.autoPollIntervalSec, state.profiles.length, runPollAll]);

  const runPollOne = async () => {
    if (!selected?.equipmentId) return;
    setPolling(true);
    try {
      const res = await pollSwitch(selected.equipmentId);
      if (res.profile) {
        setState((prev) => {
          const profiles = prev.profiles.map((p) =>
            p.id === res.profile.id ? res.profile : p
          );
          return { ...prev, profiles };
        });
        if (res.source === "mock" && !discovery.snmpEnabled) {
          toast.info("Using mock MIB data — enable SNMP in Discovery for live walks");
        } else if (res.source === "mock") {
          toast.info("SNMP walk unavailable on scanner host — mock data applied");
        } else {
          toast.success("Switch polled successfully");
        }
      }
    } catch (err) {
      toast.error(err.message || "Poll failed");
    } finally {
      setPolling(false);
    }
  };

  const runTestPort = async () => {
    if (!selected?.equipmentId || !selectedPort) return;
    setTestingPort(true);
    try {
      const res = await testInterface(selected.equipmentId, selectedPort.index);
      if (res.success && res.port) {
        toast.success(`Port ${selectedPort.index}: ${res.port.status?.toUpperCase()}`);
        setSelectedPort((p) => ({ ...p, ...res.port }));
        setState((prev) => ({
          ...prev,
          profiles: prev.profiles.map((prof) => {
            if (prof.id !== selected.id || !prof.lastPoll) return prof;
            return {
              ...prof,
              lastPoll: {
                ...prof.lastPoll,
                ports: prof.lastPoll.ports.map((p) =>
                  p.index === selectedPort.index ? { ...p, ...res.port } : p
                ),
              },
            };
          }),
        }));
      } else {
        toast.error(res.message || "Interface test failed");
      }
    } catch (err) {
      toast.error(err.message || "Test failed");
    } finally {
      setTestingPort(false);
    }
  };

  const handleSaveGlobal = async () => {
    setSavingGlobal(true);
    try {
      await persist({ ...state, global: globalDraft });
      setPortView(globalDraft.defaultPortView);
      toast.success("Platform settings saved");
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleExport = () => {
    const csv = exportPortsCsv(enriched);
    downloadCsv(`waveguard-ports-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Port inventory exported");
  };

  const removeFromFleet = async (profileId) => {
    const p = state.profiles.find((x) => x.id === profileId);
    if (!p) return;
    if (!window.confirm(`Remove "${equipmentById.get(p.equipmentId)?.name || p.id}" from Core Network fleet?`)) {
      return;
    }
    await persistProfiles(state.profiles.filter((x) => x.id !== profileId));
    if (selectedId === profileId) {
      const next = state.profiles.filter((x) => x.id !== profileId)[0];
      setSelectedId(next?.id || null);
    }
    toast.success("Device removed from fleet");
  };

  const goToSwitch = (switchId, portIndex) => {
    setSelectedId(switchId);
    setTab("switches");
    if (portIndex != null) {
      const sw = enriched.find((s) => s.id === switchId);
      const port = sw?.ports?.find((p) => p.index === portIndex);
      if (port) setSelectedPort(port);
    } else {
      setSelectedPort(null);
    }
  };

  const goToRouter = (profileId) => {
    setSelectedId(profileId);
    setSelectedPort(null);
    setTab("switches");
  };

  const handleSaveWanManagement = async (next) => {
    const saved = await saveWanManagement(next);
    setWanManagement(saved);
    return saved;
  };

  const handleAssignWanRouter = async (eq) => {
    if (!eq?.id) return;
    const existing = state.profiles.find((p) => p.equipmentId === eq.id);
    let nextProfiles = state.profiles;
    if (!existing) {
      const profile = buildFleetProfileForEquipment(eq, { forceWanRouter: true });
      nextProfiles = [...state.profiles, profile];
      await persistProfiles(nextProfiles);
      setSelectedId(profile.id);
    } else if (existing.deviceRole !== "wan_router") {
      nextProfiles = state.profiles.map((p) =>
        p.id === existing.id ? { ...p, deviceRole: "wan_router" } : p
      );
      await persistProfiles(nextProfiles);
    }
    const nextWan = {
      ...wanManagement,
      assignedRouterEquipmentIds: [
        ...new Set([...(wanManagement.assignedRouterEquipmentIds || []), eq.id]),
      ],
    };
    await handleSaveWanManagement(nextWan);
    pollRouterForWan(profileIdForEquipment(eq.id)).catch(() => {});
  };

  const handleUnassignWanRouter = async (equipmentId) => {
    if (!equipmentId) return;
    const nextWan = {
      ...wanManagement,
      assignedRouterEquipmentIds: (wanManagement.assignedRouterEquipmentIds || []).filter(
        (id) => id !== equipmentId
      ),
    };
    await handleSaveWanManagement(nextWan);
  };

  const pollRouterForWan = async (profileId) => {
    const profile = state.profiles.find((p) => p.id === profileId);
    if (!profile?.equipmentId) {
      toast.error("Router not found in fleet");
      return;
    }
    setPollingRouterId(profileId);
    try {
      const res = await pollSwitch(profile.equipmentId);
      if (res.profile) {
        setState((prev) => ({
          ...prev,
          profiles: prev.profiles.map((p) => (p.id === res.profile.id ? res.profile : p)),
        }));
        toast.success("WAN router polled successfully");
      }
    } catch (err) {
      toast.error(err.message || "Poll failed");
    } finally {
      setPollingRouterId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading Core Network…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-5">
      {!discovery.snmpEnabled && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <span>
            Discovery SNMP is off — polls use structured mock data.{" "}
            <Link to="/settings?section=discovery" className="text-primary font-medium hover:underline">
              Enable in Settings → Discovery
            </Link>
          </span>
        </div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Network size={22} className="text-primary" />
            Core Network
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Managed switches, Cisco Catalyst fleet, WAN routers, and firewalls — health, interfaces, and cable faults
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!enriched.some((s) => s.ports?.length)}
            className="flex items-center gap-2 text-sm border border-border rounded-xl px-3 py-2 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 text-sm border border-border rounded-xl px-3 py-2 hover:border-primary/40"
          >
            <Plus size={14} /> Register device
          </button>
          <button
            type="button"
            onClick={() => runPollAll(false)}
            disabled={polling || !state.profiles.length}
            className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-xl px-4 py-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={polling ? "animate-spin" : ""} />
            Poll fleet
          </button>
        </div>
      </header>

      {state.profiles.length === 0 ? (
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard size={14} /> Overview
            </TabsTrigger>
            <TabsTrigger value="switches" className="gap-1.5">
              <Server size={14} /> Fleet
            </TabsTrigger>
            {ciscoTabTrigger}
            <TabsTrigger value="wan" className="gap-1.5">
              <Globe size={14} /> WAN Management
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5">
              <Bell size={14} /> Alerts
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <SlidersHorizontal size={14} /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <EmptyFleetPrompt onRegister={openAddModal} />
          </TabsContent>

          <TabsContent value="switches" className="mt-0">
            <EmptyFleetPrompt onRegister={openAddModal} />
          </TabsContent>

          {ciscoTabPanel}

          <TabsContent value="wan" className="mt-0">
            <SnmpWanManagementPanel
              snmpState={state}
              equipment={equipment}
              wanManagement={wanManagement}
              onSaveWanManagement={handleSaveWanManagement}
              onAssignRouter={handleAssignWanRouter}
              onUnassignRouter={handleUnassignWanRouter}
              onPollRouter={pollRouterForWan}
              pollingRouterId={pollingRouterId}
              onSelectRouter={goToRouter}
            />
          </TabsContent>

          <TabsContent value="alerts" className="mt-0">
            <SnmpAlertsPanel summary={summary} onSelectSwitch={goToSwitch} />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SnmpPlatformSettings
              global={globalDraft}
              discovery={discovery}
              onChange={setGlobalDraft}
              onSave={handleSaveGlobal}
              saving={savingGlobal}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard size={14} /> Overview
            </TabsTrigger>
            <TabsTrigger value="switches" className="gap-1.5">
              <Server size={14} /> Fleet
            </TabsTrigger>
            {ciscoTabTrigger}
            <TabsTrigger value="wan" className="gap-1.5">
              <Globe size={14} /> WAN Management
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5 relative">
              <Bell size={14} /> Alerts
              {summary.cableFaults > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 text-white">
                  {summary.cableFaults}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <SlidersHorizontal size={14} /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-8">
            <SnmpFleetOverview
              summary={summary}
              enriched={enriched}
              onSelectSwitch={(id) => goToSwitch(id)}
              onRemoveDevice={removeFromFleet}
            />
            <SnmpPortMapPanel
              enriched={enriched}
              onPoll={() => runPollAll(false)}
              polling={polling}
              pollMeta={overviewPollMeta}
              discoverySnmpEnabled={discovery.snmpEnabled}
              onPortClick={(switchId, port) => goToSwitch(switchId, port.port)}
              onRemoveDevice={removeFromFleet}
            />
          </TabsContent>

          <TabsContent value="switches" className="mt-0">
            <div className="grid lg:grid-cols-[260px_1fr] gap-5">
              <aside className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Fleet ({enriched.length})
                </p>
                {enriched.map((sw) => {
                  const up = sw.ports.filter((p) => p.status === "up").length;
                  return (
                    <div
                      key={sw.id}
                      className={`relative rounded-xl border border-border border-l-4 transition-all ${
                        HEALTH_BORDER[sw.health?.status] || HEALTH_BORDER.unknown
                      } ${selected?.id === sw.id ? "bg-primary/10 ring-1 ring-primary/30" : "bg-card/40 hover:bg-secondary/30"}`}
                    >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(sw.id);
                        setSelectedPort(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setSelectedId(sw.id);
                          setSelectedPort(null);
                        }
                      }}
                      className="w-full text-left p-3 cursor-pointer pr-10"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate flex-1">{sw.displayName}</p>
                        {sw.roleLabel && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                            {sw.roleLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{sw.ip || "No IP"}</p>
                      {sw.model && (
                        <p className="text-xs font-mono text-muted-foreground/80 truncate">{sw.model}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {sw.ports.length ? `${up}/${sw.ports.length} up` : "Not polled"}
                        {sw.enabled === false && " · Disabled"}
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Remove from fleet"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromFleet(sw.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                    </div>
                  );
                })}
              </aside>
              <SnmpSwitchWorkspace
                sw={selected}
                equipment={equipment}
                portView={portView}
                onPortViewChange={setPortView}
                showInactivePorts={state.global?.showInactivePorts !== false}
                selectedPort={selectedPort}
                onSelectPort={setSelectedPort}
                polling={polling}
                testingPort={testingPort}
                onPoll={runPollOne}
                onTestPort={runTestPort}
                onEditSettings={() => setEditProfile(selected)}
              />
            </div>
          </TabsContent>

          {ciscoTabPanel}

          <TabsContent value="wan" className="mt-0">
            <SnmpWanManagementPanel
              snmpState={state}
              equipment={equipment}
              wanManagement={wanManagement}
              onSaveWanManagement={handleSaveWanManagement}
              onAssignRouter={handleAssignWanRouter}
              onUnassignRouter={handleUnassignWanRouter}
              onPollRouter={pollRouterForWan}
              pollingRouterId={pollingRouterId}
              onSelectRouter={goToRouter}
            />
          </TabsContent>

          <TabsContent value="alerts" className="mt-0">
            <SnmpAlertsPanel summary={summary} onSelectSwitch={goToSwitch} />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SnmpPlatformSettings
              global={globalDraft}
              discovery={discovery}
              onChange={setGlobalDraft}
              onSave={handleSaveGlobal}
              saving={savingGlobal}
            />
          </TabsContent>
        </Tabs>
      )}

      {showAdd && (
        <SnmpAddSwitchModal
          equipment={equipment}
          existingIds={existingIds}
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editProfile && (
        <SnmpSwitchSettingsDrawer
          profile={editProfile}
          equipment={equipmentById.get(editProfile.equipmentId)}
          discovery={discovery}
          onSave={async ({ profile: draft, equipmentPatch }) => {
            const eq = equipmentById.get(draft.equipmentId);
            if (eq && equipmentPatch) {
              const pepMake =
                draft.integrationVendor === "peplink"
                  ? equipmentPatch.make || "Peplink"
                  : equipmentPatch.make;
              await updateEquipment(eq.id, {
                ...eq,
                name: equipmentPatch.name,
                make: pepMake,
                vendor: pepMake,
                model: equipmentPatch.model,
                ip: equipmentPatch.ip,
                mac: equipmentPatch.mac,
                serial: equipmentPatch.serial,
                category: equipmentPatch.category || "Network",
              });
              setEquipment((prev) =>
                prev.map((e) =>
                  e.id === eq.id
                    ? { ...e, ...equipmentPatch, make: pepMake, vendor: pepMake }
                    : e
                )
              );
            }
            let profileToSave = draft;
            if (draft.browserLogin && (draft.browserLogin.username || draft.browserLogin.password)) {
              const creds = await listCredentials();
              const platform = draft.integrationVendor === "peplink" ? "peplink" : "web";
              const { credentials, credentialId } = upsertEquipmentCredential(
                creds,
                draft.equipmentId,
                {
                  platform,
                  loginUrl: draft.browserLogin.loginUrl,
                  username: draft.browserLogin.username,
                  password: draft.browserLogin.password,
                  host: equipmentPatch?.ip || getEquipmentIp(eq),
                  label: `${equipmentPatch?.name || eq?.name || "Device"} — browser`,
                },
                `${equipmentPatch?.name || eq?.name} login`
              );
              await saveCredentials(credentials);
              profileToSave = {
                ...draft,
                browserLogin: { ...draft.browserLogin, credentialId },
              };
            }
            await persistProfiles(
              state.profiles.map((p) => (p.id === profileToSave.id ? profileToSave : p))
            );
            setEditProfile(null);
            toast.success("Device and login credentials saved");
          }}
          onRemove={async (draft) => {
            await persistProfiles(state.profiles.filter((p) => p.id !== draft.id));
            if (selectedId === draft.id) setSelectedId(state.profiles[0]?.id);
            setEditProfile(null);
            toast.success("Device removed from fleet");
          }}
          onClose={() => setEditProfile(null)}
        />
      )}
    </div>
  );
}
