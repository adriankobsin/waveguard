import { Wifi, Radio, Users, Globe } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, tone = "default" }) {
  const tones = {
    default: "border-border bg-card/60",
    success: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-violet-500/30 bg-violet-500/5",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.default}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon size={14} />
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function CiscoWirelessOverview({ snapshot, controller }) {
  const summary = snapshot?.summary || {};
  const polledAt = snapshot?.controller?.polledAt || controller?.polledAt;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Radio}
          label="Access points"
          value={summary.apTotal ?? "—"}
          sub={`${summary.apOnline ?? 0} online · ${summary.apOffline ?? 0} offline`}
          tone={summary.apOffline > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={Wifi}
          label="SSIDs / WLANs"
          value={summary.wlanCount ?? "—"}
          sub="Configured wireless networks"
          tone="info"
        />
        <StatCard
          icon={Users}
          label="Clients"
          value={summary.clientCount ?? "—"}
          sub="Associated stations (radio load)"
          tone="default"
        />
        <StatCard
          icon={Globe}
          label="Controller"
          value={snapshot?.controller?.model?.split(" ")?.[0] || "C9800"}
          sub={
            polledAt
              ? `Last poll ${new Date(polledAt).toLocaleString()}`
              : "Not polled yet"
          }
          tone="default"
        />
      </div>
      {snapshot?.controller?.swVersion && (
        <p className="text-xs text-muted-foreground">
          IOS-XE {snapshot.controller.swVersion} · RESTCONF · {snapshot.controller.host}
        </p>
      )}
    </div>
  );
}
