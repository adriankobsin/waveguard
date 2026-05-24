import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Lightbulb,
  Wand2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  clearLightingEvents,
  loadLightingEvents,
} from "@/lib/lighting/lightingEventLog";
import {
  LIGHTING_EVENT_LOG_CHANGED_EVENT,
  DEFAULT_LIGHTING_EVENT_LOG,
} from "@/lib/lighting/lightingSettings";

function severityIcon(severity, result) {
  if (severity === "critical") return AlertTriangle;
  if (severity === "warning" || result === "failed") return AlertCircle;
  return CheckCircle2;
}

function kindIcon(kind) {
  if (kind === "scene" || kind === "custom") return Wand2;
  return Lightbulb;
}

function timeAgo(iso) {
  if (!iso) return "—";
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return iso;
    const diff = Math.max(0, (Date.now() - t) / 1000);
    if (diff < 60) return `${Math.round(diff)}s`;
    if (diff < 3600) return `${Math.round(diff / 60)}m`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h`;
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Compact "Recent activity" panel for the Lighting + Scenes pages.
 *
 * Subscribes to `LIGHTING_EVENT_LOG_CHANGED_EVENT` so it updates in real
 * time as the rest of the app issues commands. Pass `limit` to cap how
 * many entries are rendered (defaults to 25).
 */
export default function LightingEventLogPanel({
  limit = 25,
  className = "",
  title = "Recent activity",
}) {
  const [data, setData] = useState(DEFAULT_LIGHTING_EVENT_LOG);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadLightingEvents());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (e) => {
      if (e?.detail?.events) setData(e.detail);
      else refresh();
    };
    window.addEventListener(LIGHTING_EVENT_LOG_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(LIGHTING_EVENT_LOG_CHANGED_EVENT, onChange);
    };
  }, [refresh]);

  const events = useMemo(() => {
    const arr = data?.events || [];
    // Newest first.
    return [...arr].reverse().slice(0, limit);
  }, [data, limit]);

  const handleClear = useCallback(async () => {
    if (clearing) return;
    const ok =
      typeof window !== "undefined"
        ? window.confirm("Clear all lighting activity? This cannot be undone.")
        : true;
    if (!ok) return;
    setClearing(true);
    try {
      await clearLightingEvents();
    } finally {
      setClearing(false);
    }
  }, [clearing]);

  return (
    <div
      className={`rounded-2xl border border-border bg-card/60 flex flex-col overflow-hidden ${className}`}
    >
      <div className="px-3 py-2.5 border-b border-border bg-card/80 flex items-center gap-2 flex-shrink-0">
        <Activity size={13} className="text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground flex-1">
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {data?.events?.length || 0} entries
        </span>
        {(data?.events?.length || 0) > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            title="Clear activity"
            className="w-6 h-6 rounded border border-border bg-muted hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-muted-foreground flex items-center justify-center disabled:opacity-40"
          >
            {clearing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground p-3">
            <Loader2 size={10} className="animate-spin" />
            Loading…
          </div>
        ) : events.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic px-3 py-6 text-center">
            No commands recorded yet. Adjust a slider or run a scene to see it
            appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((evt) => {
              const SIcon = severityIcon(evt.severity, evt.result);
              const KIcon = kindIcon(evt.kind);
              const isErr = evt.severity === "warning" || evt.severity === "critical" || evt.result === "failed";
              return (
                <li
                  key={evt.id}
                  className="px-3 py-2 flex items-start gap-2 hover:bg-muted/30"
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                      isErr ? "bg-red-500/15" : "bg-amber-500/15"
                    }`}
                  >
                    <KIcon
                      size={11}
                      className={isErr ? "text-red-400" : "text-amber-400"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">
                      {evt.message ||
                        `${evt.action || "command"} ${evt.zoneName || evt.zoneHref || ""}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {evt.action && <span className="font-mono">{evt.action}</span>}
                      {evt.level != null && (
                        <span className="ml-1">· {evt.level}%</span>
                      )}
                      {evt.zoneHref && (
                        <span className="ml-1 font-mono opacity-80">· {evt.zoneHref}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span
                      className="text-[10px] text-muted-foreground tabular-nums"
                      title={evt.ts}
                    >
                      {timeAgo(evt.ts)}
                    </span>
                    <SIcon
                      size={11}
                      className={isErr ? "text-red-400" : "text-emerald-400"}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
