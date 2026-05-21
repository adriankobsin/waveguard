import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SnmpAlertsPanel({ summary, onSelectSwitch }) {
  const hasAlerts = summary.faults.length > 0 || summary.downAlerts.length > 0;

  if (!hasAlerts) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-border">
        <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
        <h3 className="font-semibold text-foreground">No active alerts</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Cable fault and port-down thresholds are clear across the managed fleet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summary.faults.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle size={14} /> Cable faults ({summary.faults.length})
          </h3>
          <div className="space-y-2">
            {summary.faults.map((f, i) => (
              <button
                key={`${f.switchId}-${f.portIndex}-${i}`}
                type="button"
                onClick={() => onSelectSwitch?.(f.switchId, f.portIndex)}
                className="w-full text-left px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{f.switchName}</span>
                  <Badge variant="outline" className="text-red-400 border-red-500/30">
                    Port {f.portIndex}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{f.switchIp}</p>
                <p className="text-sm text-red-300/90 mt-1">
                  {f.connectedDevice} — expected link down
                </p>
                {f.ifAlias && <p className="text-xs text-muted-foreground">{f.ifAlias}</p>}
              </button>
            ))}
          </div>
        </section>
      )}

      {summary.downAlerts.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-amber-400 mb-3">Port availability</h3>
          <div className="space-y-2">
            {summary.downAlerts.map((a, i) => (
              <button
                key={`${a.switchId}-${i}`}
                type="button"
                onClick={() => onSelectSwitch?.(a.switchId)}
                className="w-full text-left px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/5"
              >
                <span className="font-medium">{a.switchName}</span>
                <p className="text-sm text-muted-foreground mt-0.5">{a.message}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
