import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Eraser,
  Info,
  AlertTriangle,
} from "lucide-react";
import {
  loadCiscoEvents,
  clearCiscoEvents,
} from "@/lib/integrations/cisco/ciscoEventLog";
import { NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT } from "@/lib/network/ciscoSwitchSettings";

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
};
const SEVERITY_COLORS = {
  info: "text-sky-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

export default function CiscoEventLogPanel({ host }) {
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const log = await loadCiscoEvents();
      if (!active) return;
      setEvents(log.events || []);
    })();
    const onChange = (e) => {
      if (e?.detail?.events) setEvents(e.detail.events);
    };
    window.addEventListener(NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT, onChange);
    };
  }, []);

  const filtered = host
    ? events.filter((e) => !e.host || e.host === host)
    : events;
  const sorted = [...filtered].reverse();

  async function handleClear() {
    if (!confirm("Clear the Cisco event log? This cannot be undone.")) return;
    setBusy(true);
    try {
      await clearCiscoEvents();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-sky-400" />
          <p className="text-sm font-semibold text-foreground">Recent activity</p>
          <span className="text-[10px] text-muted-foreground">
            {sorted.length} event{sorted.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={handleClear}
          disabled={busy || sorted.length === 0}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Eraser size={11} />
          Clear
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-8 text-center">
            <Activity size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              No Cisco activity yet — commands and port changes will show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((evt) => {
              const Icon = SEVERITY_ICONS[evt.severity] || Info;
              const color = SEVERITY_COLORS[evt.severity] || "text-muted-foreground";
              const isSuccess = evt.result === "success";
              return (
                <li key={evt.id} className="px-4 py-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <Icon size={12} className={`${color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-foreground">
                          {evt.action || evt.kind}
                        </span>
                        {evt.host && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {evt.host}
                          </span>
                        )}
                        {isSuccess ? (
                          <CheckCircle2 size={10} className="text-emerald-400" />
                        ) : (
                          <AlertCircle size={10} className="text-red-400" />
                        )}
                      </div>
                      {evt.message && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {evt.message}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 font-mono flex-shrink-0">
                      {new Date(evt.ts).toLocaleTimeString()}
                    </span>
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
