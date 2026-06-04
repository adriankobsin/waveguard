import { AlertCircle, Info, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

const SEVERITY_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const SEVERITY_COLORS = {
  error: "text-red-400 bg-red-500/10 border-red-500/20",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  info: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

export default function AudioEventLogPanel({ events = [], onRefresh }) {
  if (!events.length) {
    return (
      <div className="flex-1 p-4">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <Info size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No audio events recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Event Log ({events.length})
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {events.map((ev) => {
          const Icon = SEVERITY_ICONS[ev.severity] || Info;
          const colorClass = SEVERITY_COLORS[ev.severity] || SEVERITY_COLORS.info;

          return (
            <div
              key={ev.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg border ${colorClass}`}
            >
              <Icon size={13} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground">{ev.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {ev.systemName && (
                    <span className="text-[9px] text-muted-foreground/60">
                      {ev.systemName}
                    </span>
                  )}
                  {ev.action && (
                    <span className="text-[9px] text-muted-foreground/40">
                      {ev.action}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground/40 flex-shrink-0">
                {formatTime(ev.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
