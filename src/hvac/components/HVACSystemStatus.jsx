import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function HVACSystemStatus({ status }) {
  if (!status) return null;

  const overallColor = status.overall === "healthy"
    ? "text-emerald-400"
    : status.overall === "degraded"
      ? "text-amber-400"
      : "text-red-400";

  const overallBg = status.overall === "healthy"
    ? "bg-emerald-500/10 border-emerald-500/20"
    : status.overall === "degraded"
      ? "bg-amber-500/10 border-amber-500/20"
      : "bg-red-500/10 border-red-500/20";

  return (
    <div className={`rounded-xl border ${overallBg} px-4 py-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity size={14} className={overallColor} />
          <span className={`text-sm font-semibold ${overallColor}`}>
            System {status.overall.charAt(0).toUpperCase() + status.overall.slice(1)}
          </span>
        </div>
        {status.lastPollTime && (
          <span className="text-[10px] text-muted-foreground">
            Last poll: {new Date(status.lastPollTime).toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-emerald-400" />
          <span className="text-muted-foreground">Online:</span>
          <span className="font-medium text-foreground">{status.onlineZones}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <WifiOff size={11} className="text-red-400" />
          <span className="text-muted-foreground">Offline:</span>
          <span className="font-medium text-foreground">{status.offlineZones}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-amber-400" />
          <span className="text-muted-foreground">Alarms:</span>
          <span className="font-medium text-foreground">{status.alarmZones}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi size={11} className="text-muted-foreground" />
          <span className="text-muted-foreground">Total:</span>
          <span className="font-medium text-foreground">{status.totalZones}</span>
        </div>
      </div>
    </div>
  );
}
