import { Cpu, Clock, Zap, Hash, Server, Network } from "lucide-react";

function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
        <Icon size={11} className={accent || "text-foreground/60"} />
        {label}
      </div>
      <p className={`mt-1 text-base font-bold ${accent || "text-foreground"} font-mono`}>
        {value || "—"}
      </p>
    </div>
  );
}

export default function CiscoSystemInfoCard({ switchRecord, snapshot }) {
  const sys = snapshot?.system || switchRecord?.system || {};
  const interfaces = snapshot?.interfaces || [];
  const upCount = interfaces.filter((p) => p.status === "up").length;
  const totalCount = interfaces.length;
  const poeUsed = interfaces.reduce((s, p) => s + (p.poeWatts || 0), 0);
  const poeBudget = sys.poeBudgetW || 0;
  const macCount = (snapshot?.macs || []).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 ring-1 ring-sky-500/25 flex items-center justify-center">
            <Cpu size={22} className="text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-foreground truncate">
              {sys.hostname || switchRecord?.label || switchRecord?.host}
            </p>
            <p className="text-xs text-muted-foreground">
              {sys.description || "Cisco Catalyst 1300"}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Model</dt>
            <dd className="font-mono font-semibold text-foreground">
              {sys.model || "unknown"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Firmware</dt>
            <dd className="font-mono font-semibold text-foreground">
              {sys.firmware || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Serial</dt>
            <dd className="font-mono font-semibold text-foreground">
              {sys.serial || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">MAC</dt>
            <dd className="font-mono font-semibold text-foreground">
              {sys.mac || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">IP</dt>
            <dd className="font-mono font-semibold text-foreground">
              {switchRecord?.host}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Uptime</dt>
            <dd className="font-mono font-semibold text-foreground">
              {sys.uptime || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Kpi
          icon={Server}
          label="Ports up"
          value={`${upCount}/${totalCount}`}
          accent="text-emerald-400"
        />
        <Kpi
          icon={Zap}
          label="PoE used"
          value={poeBudget > 0 ? `${poeUsed.toFixed(1)} / ${poeBudget}W` : `${poeUsed.toFixed(1)}W`}
          accent="text-amber-400"
        />
        <Kpi
          icon={Network}
          label="MAC entries"
          value={macCount}
          accent="text-sky-400"
        />
        <Kpi
          icon={Hash}
          label="Serial"
          value={sys.serial ? sys.serial.slice(-6) : "—"}
        />
        <Kpi
          icon={Clock}
          label="Last poll"
          value={
            snapshot?.polledAt
              ? new Date(snapshot.polledAt).toLocaleTimeString()
              : switchRecord?.lastConnectedAt
              ? new Date(switchRecord.lastConnectedAt).toLocaleTimeString()
              : "—"
          }
        />
      </div>
    </div>
  );
}
