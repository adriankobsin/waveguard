import { HardDrive, Radio, Cpu, Thermometer } from "lucide-react";

export default function AudioSystemStatus({ systems }) {
  if (!systems?.length) {
    return (
      <div className="flex-1 p-4">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <Radio size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No audio systems configured</p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Add a system in Settings to begin monitoring
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        DSP Systems ({systems.length})
      </p>

      {systems.map((sys) => {
        const online = sys.status === "online";
        const zoneCount = sys.zones?.length || 0;
        const ampCount = sys.amplifiers?.length || 0;
        const ioCount = (sys.inputs?.length || 0) + (sys.outputs?.length || 0);

        return (
          <div
            key={sys.id}
            className="rounded-lg border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    online ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-red-500"
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">{sys.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {sys.type.toUpperCase()} · {sys.host}:{sys.port}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  online
                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    : "text-red-400 border-red-500/30 bg-red-500/10"
                }`}
              >
                {online ? "Online" : "Offline"}
              </span>
            </div>

            {sys.designName && (
              <p className="text-[11px] text-muted-foreground/70">
                Design: {sys.designName}
              </p>
            )}

            <div className="grid grid-cols-4 gap-2">
              <StatCard icon={HardDrive} label="Zones" value={zoneCount} />
              <StatCard icon={Radio} label="I/O" value={ioCount} />
              <StatCard icon={Cpu} label="Amps" value={ampCount} />
              <StatCard
                icon={Thermometer}
                label="Snapshots"
                value={sys.snapshots?.length || 0}
              />
            </div>

            {online && sys.lastPolled && (
              <p className="text-[9px] text-muted-foreground/40">
                Last polled: {new Date(sys.lastPolled).toLocaleString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-muted border border-border p-2.5 text-center">
      <Icon size={13} className="mx-auto text-muted-foreground mb-1" />
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
