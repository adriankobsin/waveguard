import { CheckCircle2, AlertCircle, Radio, KeyRound } from "lucide-react";

export default function CiscoWlcList({ controllers, activeId, onSelect, onEdit }) {
  return (
    <aside className="w-72 flex-shrink-0 border-r border-border bg-card/40 flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Controllers
        </p>
        <p className="text-sm font-semibold text-foreground">
          {controllers.length}{" "}
          {controllers.length === 1 ? "controller" : "controllers"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {controllers.length === 0 ? (
          <div className="p-4 text-center">
            <Radio size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No WLC configured.</p>
          </div>
        ) : (
          controllers.map((ctrl) => {
            const isActive = ctrl.id === activeId;
            const ok = !!(ctrl.lastConnectedAt && !ctrl.lastError);
            const apOnline = ctrl.lastSnapshot?.summary?.apOnline;
            return (
              <button
                key={ctrl.id}
                onClick={() => onSelect?.(ctrl.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  isActive
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-transparent hover:border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Radio
                    size={13}
                    className={isActive ? "text-violet-400" : "text-muted-foreground"}
                  />
                  <span
                    className={`text-xs font-semibold truncate ${
                      isActive ? "text-foreground" : "text-foreground/90"
                    }`}
                  >
                    {ctrl.label || ctrl.controller?.model || ctrl.host}
                  </span>
                  {ctrl.enabled ? (
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
                    <span className="ml-auto text-[10px] text-muted-foreground">off</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  <span>{ctrl.host}</span>
                  {apOnline != null && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-foreground/70">
                      {apOnline} APs online
                    </span>
                  )}
                </div>
                {onEdit && isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(ctrl);
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
