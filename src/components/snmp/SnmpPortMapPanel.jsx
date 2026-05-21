import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { listEquipment } from "@/api/equipmentApi";
import { listManagedSwitches, pollAll } from "@/api/snmpSwitchApi";
import { enrichProfiles } from "@/lib/snmp/snmpAnalytics";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Unplug,
  Clock,
  Server,
} from "lucide-react";
import { buildConnectionsFleetView } from "@/lib/snmp/connectionMapView";

const SPEED_LABEL = { 10: "10M", 100: "100M", 1000: "1G", 10000: "10G" };

function speedLabel(speed) {
  if (SPEED_LABEL[speed]) return SPEED_LABEL[speed];
  if (typeof speed === "string") return speed;
  return speed ? `${speed}M` : "—";
}

function PortBadge({ port }) {
  if (port.slotEmpty) {
    return (
      <div
        title={`Port ${port.port} — awaiting SNMP data`}
        className="w-8 h-8 rounded-md border border-dashed border-border text-[10px] font-bold flex items-center justify-center text-muted-foreground/50"
      >
        {port.port}
      </div>
    );
  }

  const up = port.ifOperStatus === "up";
  return (
    <div
      title={`Port ${port.port}${port.ifAlias ? ` · ${port.ifAlias}` : ""}${port.connectedDevice ? ` → ${port.connectedDevice}` : ""}${port.poeWatts != null ? ` · PoE ${port.poeWatts}W` : ""}`}
      className={`relative group w-8 h-8 rounded-md border text-[10px] font-bold flex items-center justify-center cursor-default transition-all
        ${up
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : port.connectedDevice
            ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
            : "border-border bg-secondary/40 text-muted-foreground"
        }`}
    >
      {port.port}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block w-max max-w-[220px]">
        <div className="bg-popover border border-border rounded-lg px-2.5 py-2 text-xs shadow-lg">
          <p className="font-semibold text-foreground mb-0.5">Port {port.port}</p>
          {port.ifAlias && <p className="text-muted-foreground">{port.ifAlias}</p>}
          {port.connectedDevice && <p className="text-primary">{port.connectedDevice}</p>}
          {port.macAddr && <p className="font-mono text-muted-foreground">{port.macAddr}</p>}
          <p className={`mt-1 font-semibold ${up ? "text-emerald-500" : "text-red-500"}`}>
            {up ? "UP" : "DOWN"} · {speedLabel(port.ifSpeed)}
          </p>
          {port.vlan != null && <p className="text-muted-foreground">VLAN {port.vlan}</p>}
          {port.poeWatts != null && <p className="text-amber-500">PoE {port.poeWatts} W</p>}
        </div>
      </div>
    </div>
  );
}

function SwitchCard({ sw }) {
  const [open, setOpen] = useState(true);
  const downWithDevice = sw.ports.filter(
    (p) => !p.slotEmpty && p.ifOperStatus === "down" && p.connectedDevice
  );
  const hasPoll = !!sw.lastPollAt;
  const polledPorts = sw.ports.filter((p) => !p.slotEmpty);

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-opacity ${
        sw.enabled ? "border-border bg-card/50" : "border-border/60 bg-card/20 opacity-70"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Network size={14} className="text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{sw.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{sw.ip || "No IP"}</p>
            {sw.model && (
              <p className="text-xs text-muted-foreground font-mono truncate">{sw.model}</p>
            )}
            {sw.location && (
              <p className="text-xs text-muted-foreground truncate">{sw.location}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-2">
            {!sw.enabled && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                Polling off
              </span>
            )}
            {hasPoll ? (
              <>
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {sw.portsUp} up
                </span>
                {sw.portsDown > 0 && (
                  <span className="text-xs text-muted-foreground">{sw.portsDown} down</span>
                )}
              </>
            ) : (
              <span className="text-xs text-amber-500/90">Not polled yet</span>
            )}
            {downWithDevice.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                <AlertTriangle size={10} /> {downWithDevice.length} fault
                {downWithDevice.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {open ? (
          <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-3 py-2 text-xs text-muted-foreground">
                {hasPoll ? (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    Last poll {new Date(sw.lastPollAt).toLocaleString()}
                    {sw.pollSource === "mock" && " (mock)"}
                  </span>
                ) : (
                  <span>Press Poll SNMP to load interface data</span>
                )}
                {sw.lastPollError && (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertTriangle size={11} /> {sw.lastPollError}
                  </span>
                )}
                {sw.health?.label && (
                  <span className="ml-auto">Health: {sw.health.label}</span>
                )}
              </div>

              {sw.ports.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {sw.ports.map((p) => (
                    <PortBadge key={p.port} port={p} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No chassis layout — set Equipment model (e.g. C9300L-24P-4X-E)
                </p>
              )}

              {downWithDevice.length > 0 && (
                <div className="space-y-1.5 mb-3 border-t border-border/60 pt-3">
                  <p className="text-xs text-red-500 font-semibold flex items-center gap-1.5">
                    <Unplug size={11} /> Cable faults
                  </p>
                  {downWithDevice.map((p) => (
                    <div
                      key={p.port}
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/20"
                    >
                      <AlertTriangle size={10} className="text-red-500 flex-shrink-0" />
                      <span className="font-medium text-red-600 dark:text-red-400">
                        Port {p.port}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-foreground">{p.connectedDevice}</span>
                      <span className="font-mono text-muted-foreground ml-auto">{p.macAddr}</span>
                    </div>
                  ))}
                </div>
              )}

              {polledPorts.filter((p) => p.connectedDevice).length > 0 && (
                <div className="border-t border-border/60 pt-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Active connections
                  </p>
                  {polledPorts
                    .filter((p) => p.connectedDevice)
                    .map((p) => (
                      <div key={p.port} className="flex items-center gap-2 text-xs">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.ifOperStatus === "up" ? "bg-emerald-500" : "bg-red-500"}`}
                        />
                        <span className="text-muted-foreground w-14 font-mono">Port {p.port}</span>
                        <span className="text-foreground flex-1 truncate">{p.connectedDevice}</span>
                        <span className="text-muted-foreground font-mono">{speedLabel(p.ifSpeed)}</span>
                        {p.vlan != null && (
                          <span className="text-muted-foreground">VLAN {p.vlan}</span>
                        )}
                        {p.poeWatts != null && (
                          <span className="text-amber-500">{p.poeWatts}W</span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Connections tab — always lists registered switches; shows last poll data until refreshed.
 */
export default function SnmpPortMapPanel({
  enriched: enrichedProp,
  onPoll: onPollProp,
  polling: pollingProp = false,
  pollMeta: pollMetaProp = null,
  discoverySnmpEnabled = true,
}) {
  const isStandalone = enrichedProp === undefined;
  const [standaloneEnriched, setStandaloneEnriched] = useState([]);
  const [standalonePolling, setStandalonePolling] = useState(false);
  const [standaloneMeta, setStandaloneMeta] = useState(null);

  const loadStandalone = useCallback(async () => {
    try {
      const [swState, eq] = await Promise.all([listManagedSwitches(), listEquipment()]);
      const byId = new Map((eq || []).map((e) => [e.id, e]));
      setStandaloneEnriched(enrichProfiles(swState.profiles || [], byId));
    } catch (err) {
      toast.error(err.message || "Failed to load switches");
    }
  }, []);

  useEffect(() => {
    if (isStandalone) loadStandalone();
  }, [isStandalone, loadStandalone]);

  const pollStandalone = useCallback(async () => {
    setStandalonePolling(true);
    try {
      const res = await pollAll();
      const eq = await listEquipment();
      const byId = new Map((eq || []).map((e) => [e.id, e]));
      if (res.profiles) {
        setStandaloneEnriched(enrichProfiles(res.profiles, byId));
      } else {
        await loadStandalone();
      }
      setStandaloneMeta({
        polledAt: res.polledAt || new Date().toISOString(),
        snmpWalkAvailable: res.snmpWalkAvailable,
        error: null,
      });
      toast.success(`Polled ${res.switches?.length || 0} switch(es)`);
    } catch (err) {
      setStandaloneMeta({ error: err.message });
      toast.error(err.message || "SNMP poll failed");
    } finally {
      setStandalonePolling(false);
    }
  }, [loadStandalone]);

  const enriched = isStandalone ? standaloneEnriched : enrichedProp;
  const polling = isStandalone ? standalonePolling : pollingProp;
  const pollMeta = isStandalone ? standaloneMeta : pollMetaProp;
  const onPoll = isStandalone ? pollStandalone : onPollProp;

  const fleet = useMemo(() => buildConnectionsFleetView(enriched || []), [enriched]);

  const latestPoll = pollMeta?.polledAt
    || fleet.switches.reduce((latest, s) => {
        if (!s.lastPollAt) return latest;
        return !latest || s.lastPollAt > latest ? s.lastPollAt : latest;
      }, null);

  return (
    <div className="space-y-4">
      {!discoverySnmpEnabled && (
        <p className="text-xs text-amber-500/90 flex items-center gap-1.5 px-1">
          <AlertTriangle size={12} />
          SNMP disabled in Discovery — polls use mock data.{" "}
          <Link to="/settings?section=discovery" className="text-primary hover:underline">
            Enable SNMP
          </Link>
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Network size={15} className="text-primary" />
            Registered switches — L2 connections
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fleet.switches.length} switch{fleet.switches.length !== 1 ? "es" : ""} in fleet
            {latestPoll && (
              <>
                {" "}
                · last updated {new Date(latestPoll).toLocaleString()}
                {pollMeta?.snmpWalkAvailable === false && " (mock data)"}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onPoll}
          disabled={polling || !fleet.switches.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {polling ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {polling ? "Polling SNMP…" : "Poll SNMP"}
        </button>
      </div>

      {fleet.switches.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl border border-border bg-secondary/20 text-xs">
          <span className="flex items-center gap-1.5 text-foreground">
            <Server size={12} className="text-primary" />
            {fleet.switches.length} registered
          </span>
          <span className="flex items-center gap-1.5 text-foreground">
            <CheckCircle2 size={12} className="text-emerald-500" />
            {fleet.activeConnections} active links
          </span>
          {fleet.cableFaults > 0 ? (
            <span className="flex items-center gap-1.5 text-red-500 font-semibold">
              <AlertTriangle size={12} />
              {fleet.cableFaults} cable fault{fleet.cableFaults > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 size={12} className="text-emerald-500" />
              No cable faults
            </span>
          )}
          <span className="text-muted-foreground ml-auto">
            {fleet.switches.filter((s) => s.lastPollAt).length}/{fleet.switches.length} polled
          </span>
        </div>
      )}

      {fleet.switches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
          <Network size={32} className="text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-foreground font-medium">No switches registered</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Register switches from Equipment on the Switches tab, then return here to map connections.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fleet.switches.map((sw) => (
            <SwitchCard key={sw.id} sw={sw} />
          ))}
        </div>
      )}

      {pollMeta?.error && (
        <div className="flex items-center gap-2 text-xs text-red-500 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={11} /> {pollMeta.error}
        </div>
      )}
    </div>
  );
}
