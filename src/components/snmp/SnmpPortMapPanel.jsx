import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { listEquipment } from "@/api/equipmentApi";
import { listManagedSwitches, pollAll } from "@/api/snmpSwitchApi";
import { enrichProfiles } from "@/lib/snmp/snmpAnalytics";
import { switchToConnectionView } from "@/lib/snmp/connectionMapView";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Clock,
  Server,
} from "lucide-react";

const SPEED_LABEL = { 10: "10M", 100: "100M", 1000: "1G", 10000: "10G" };

function speedLabel(speed) {
  if (SPEED_LABEL[speed]) return SPEED_LABEL[speed];
  if (typeof speed === "string") return speed;
  return speed ? `${speed}M` : "—";
}

function SwitchCard({ sw }) {
  const [open, setOpen] = useState(false);
  const hasPoll = !!sw.lastPollAt;
  const connections = (sw.ports || []).filter(
    (p) => !p.slotEmpty && (p.connectedDevice || p.macAddr)
  );

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        sw.enabled ? "border-border bg-card/50" : "border-border/60 bg-card/20 opacity-70"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Server size={14} className="text-primary flex-shrink-0" />
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
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          {!sw.enabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              Polling off
            </span>
          )}
          {hasPoll ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {sw.portsUp}/{sw.portsUp + sw.portsDown} up
            </span>
          ) : (
            <span className="text-xs text-amber-500/90">Not polled</span>
          )}
          {connections.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {connections.length} link{connections.length !== 1 ? "s" : ""}
            </span>
          )}
          {open ? (
            <ChevronDown size={14} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/60"
          >
            <div className="px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {hasPoll ? (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    Last poll {new Date(sw.lastPollAt).toLocaleString()}
                    {sw.pollSource === "mock" && " (mock)"}
                  </span>
                ) : (
                  <span>Press Poll SNMP to load connection data</span>
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

              {connections.length > 0 ? (
                <div className="space-y-1">
                  {connections.map((p) => (
                    <div
                      key={p.port}
                      className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg bg-secondary/30"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          p.ifOperStatus === "up" ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      <span className="text-muted-foreground font-mono w-12">Port {p.port}</span>
                      <span className="text-foreground flex-1 truncate">
                        {p.connectedDevice || p.macAddr}
                      </span>
                      <span className="text-muted-foreground">{speedLabel(p.ifSpeed)}</span>
                    </div>
                  ))}
                </div>
              ) : hasPoll ? (
                <p className="text-xs text-muted-foreground py-2">No L2 neighbours detected on polled ports.</p>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Connections tab — lists registered SNMP switches only; expand a switch for its links.
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

  const switches = useMemo(
    () => (enriched || []).map(switchToConnectionView),
    [enriched]
  );

  const latestPoll = pollMeta?.polledAt
    || switches.reduce((latest, s) => {
        if (!s.lastPollAt) return latest;
        return !latest || s.lastPollAt > latest ? s.lastPollAt : latest;
      }, null);

  const polledCount = switches.filter((s) => s.lastPollAt).length;

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
            Registered switches
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {switches.length} switch{switches.length !== 1 ? "es" : ""} registered
            {latestPoll && (
              <>
                {" "}
                · last updated {new Date(latestPoll).toLocaleString()}
                {pollMeta?.snmpWalkAvailable === false && " (mock data)"}
              </>
            )}
            {switches.length > 0 && (
              <> · {polledCount}/{switches.length} polled</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onPoll}
          disabled={polling || !switches.length}
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

      {switches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
          <Server size={32} className="text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-foreground font-medium">No switches registered</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Register switches from Equipment on the Switches tab, then return here to view connections.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {switches.map((sw) => (
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
