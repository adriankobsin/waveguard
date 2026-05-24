import { CheckCircle2, AlertCircle, Cpu, KeyRound } from "lucide-react";

export default function CiscoSwitchList({
  switches,
  activeId,
  onSelect,
  onEdit,
}) {
  return (
    <aside className="w-72 flex-shrink-0 border-r border-border bg-card/40 flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Switches
        </p>
        <p className="text-sm font-semibold text-foreground">
          {switches.length} {switches.length === 1 ? "switch" : "switches"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {switches.length === 0 ? (
          <div className="p-4 text-center">
            <Cpu size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              No Cisco switches configured.
            </p>
          </div>
        ) : (
          switches.map((sw) => {
            const isActive = sw.id === activeId;
            const ok = !!(sw.lastConnectedAt && !sw.lastError);
            return (
              <button
                key={sw.id}
                onClick={() => onSelect?.(sw.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  isActive
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-transparent hover:border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Cpu
                    size={13}
                    className={isActive ? "text-sky-400" : "text-muted-foreground"}
                  />
                  <span
                    className={`text-xs font-semibold truncate ${
                      isActive ? "text-foreground" : "text-foreground/90"
                    }`}
                  >
                    {sw.label || sw.system?.hostname || sw.host}
                  </span>
                  {sw.enabled ? (
                    ok ? (
                      <CheckCircle2
                        size={11}
                        className="text-emerald-400 flex-shrink-0 ml-auto"
                      />
                    ) : (
                      <AlertCircle
                        size={11}
                        className="text-amber-400 flex-shrink-0 ml-auto"
                      />
                    )
                  ) : (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      off
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  <span>{sw.host}</span>
                  {sw.system?.model && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-foreground/70">
                      {sw.system.model}
                    </span>
                  )}
                </div>
                {onEdit && isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(sw);
                    }}
                    className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <KeyRound size={10} />
                    Credentials
                  </button>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
