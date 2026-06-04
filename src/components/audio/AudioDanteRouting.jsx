import { Wifi, Activity } from "lucide-react";

export default function AudioDanteRouting({ danteFlows = [], systems = [] }) {
  const allFlows = danteFlows?.length
    ? danteFlows
    : systems.flatMap((s) => s.danteFlows || []);

  if (!allFlows.length) {
    return (
      <div className="flex-1 p-4">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <Wifi size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No Dante/AES67 flows detected</p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Flows will appear when configured on your DSP systems
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Dante / AES67 Flows ({allFlows.length})
      </p>

      <div className="space-y-3">
        {allFlows.map((flow) => (
          <div
            key={flow.id}
            className="rounded-lg border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    flow.active
                      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                      : "bg-muted-foreground/30"
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">{flow.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {flow.format} · {flow.sampleRate / 1000}kHz · {flow.bitDepth}-bit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {flow.aes67Mode && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    AES67
                  </span>
                )}
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    flow.active
                      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      : "text-muted-foreground border-border bg-muted"
                  }`}
                >
                  {flow.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-muted-foreground">Source: </span>
                <span className="text-foreground">
                  {flow.sourceDevice} · Ch {flow.sourceChannel}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Multicast: </span>
                <span className="text-foreground font-mono">{flow.multicastAddress}</span>
              </div>
            </div>

            {flow.subscriptions?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Subscriptions
                </p>
                {flow.subscriptions.map((sub, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[10px] text-foreground"
                  >
                    <Activity size={10} className="text-muted-foreground" />
                    <span>
                      {sub.device} · Ch {sub.channel}
                    </span>
                    <span
                      className={`ml-auto ${
                        sub.status === "active"
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
