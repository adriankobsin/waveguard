import { Link } from "react-router-dom";
import {
  Network,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowDownUp,
  Server,
  Trash2,
} from "lucide-react";
import { formatSpeedMbps } from "@/lib/snmp/snmpAnalytics";

function KpiCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${accent || "text-foreground"}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-secondary/60">
          <Icon size={18} className="text-primary" />
        </div>
      </div>
    </div>
  );
}

const HEALTH_DOT = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  disabled: "bg-slate-600",
  unknown: "bg-slate-500",
};

export default function SnmpFleetOverview({ summary, enriched, onSelectSwitch, onRemoveDevice }) {
  const sorted = [...(enriched || [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, unknown: 2, healthy: 3, disabled: 4 };
    return (order[a.health?.status] ?? 5) - (order[b.health?.status] ?? 5);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Server}
          label="Managed switches"
          value={summary.switchCount}
          sub={`${summary.enabledCount} polling enabled`}
        />
        <KpiCard
          icon={Activity}
          label="Ports operational"
          value={`${summary.portsUp}/${summary.portsTotal}`}
          sub={summary.portsDown > 0 ? `${summary.portsDown} down` : "All polled ports up"}
          accent={summary.portsDown > 0 ? "text-amber-400" : "text-emerald-400"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Cable faults"
          value={summary.cableFaults}
          sub="Down with known endpoint"
          accent={summary.cableFaults > 0 ? "text-red-400" : "text-emerald-400"}
        />
        <KpiCard
          icon={Zap}
          label="PoE budget (live)"
          value={`${summary.poeWatts} W`}
          sub={`${formatSpeedMbps(summary.trafficIn)} in · ${formatSpeedMbps(summary.trafficOut)} out`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Network size={14} /> Switch health
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No switches registered</p>
            ) : (
              sorted.map((sw) => (
                <div
                  key={sw.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/50 group"
                >
                  <button
                    type="button"
                    onClick={() => onSelectSwitch?.(sw.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0 py-1"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${HEALTH_DOT[sw.health?.status] || HEALTH_DOT.unknown}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sw.displayName}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {sw.ip || "No IP"}
                        {sw.model ? ` · ${sw.model}` : ""}
                        {sw.location ? ` · ${sw.location}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{sw.health?.label}</span>
                  </button>
                  {onRemoveDevice && (
                    <button
                      type="button"
                      title="Remove from fleet"
                      onClick={() => onRemoveDevice(sw.id)}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-red-400" /> Active alerts
          </h3>
          {summary.faults.length === 0 && summary.downAlerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400 py-4">
              <CheckCircle2 size={16} /> No active alerts
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {summary.faults.slice(0, 8).map((f, i) => (
                <div
                  key={`f-${i}`}
                  className="text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <span className="font-semibold text-red-300">{f.switchName}</span>
                  <span className="text-muted-foreground"> · Port {f.portIndex}</span>
                  <p className="text-muted-foreground mt-0.5 truncate">
                    {f.connectedDevice} — link down
                  </p>
                </div>
              ))}
              {summary.downAlerts.map((a, i) => (
                <div
                  key={`d-${i}`}
                  className="text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
                >
                  <span className="font-semibold text-amber-200">{a.switchName}</span>
                  <p className="text-muted-foreground mt-0.5">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ArrowDownUp size={12} />
        Fleet aggregates from last poll per switch. Configure polling in the{" "}
        <Link to="/snmp" className="text-primary hover:underline" onClick={(e) => e.preventDefault()}>
          Settings tab
        </Link>
        .
      </p>
    </div>
  );
}
