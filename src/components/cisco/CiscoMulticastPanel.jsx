import { ShieldCheck, ShieldAlert, Radio } from "lucide-react";
import { classifyGroup, STREAM_TYPES } from "@/lib/av/avFlowModel";

/** IGMP snooping, querier and joined groups — why AV multicast does or doesn't flood. */
export default function CiscoMulticastPanel({ snapshot, portLabel }) {
  const mc = snapshot?.multicast;
  if (!mc) {
    return <p className="text-sm text-muted-foreground">No multicast data yet. Refresh the switch — WaveGuard reads <span className="font-mono">show ip igmp snooping</span> on each poll.</p>;
  }
  const on = mc.snoopingEnabled !== false;
  const groups = mc.groups || [];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-3 ${on ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/10"}`}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{on ? <ShieldCheck size={13} className="text-emerald-400" /> : <ShieldAlert size={13} className="text-red-400" />} IGMP snooping</div>
          <div className={`text-lg font-bold ${on ? "text-emerald-400" : "text-red-400"}`}>{mc.snoopingEnabled == null ? "Unknown" : on ? "On" : "Off"}</div>
          {!on && <div className="text-[11px] text-red-300">NVX and Dante multicast is flooding every port.</div>}
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-xs text-muted-foreground">Querier</div>
          <div className="text-sm font-semibold mt-1">{(mc.queriers || []).length ? mc.queriers.map((q) => `VLAN ${q.vlan}: ${q.address}`).join(" · ") : mc.querierChecked ? <span className="text-amber-400">None seen</span> : "—"}</div>
          {mc.querierChecked && !(mc.queriers || []).length && <div className="text-[11px] text-amber-300">Streams may stop every ~4 minutes without one.</div>}
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-xs text-muted-foreground">Multicast groups</div>
          <div className="text-lg font-bold">{groups.length}</div>
        </div>
      </div>
      {(mc.vlans || []).length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {mc.vlans.map((v) => (
            <span key={v.vlan} className={`px-2 py-1 rounded-md border ${v.snooping === false ? "border-red-500/40 text-red-400" : "border-border text-muted-foreground"}`}>VLAN {v.vlan}: snooping {v.snooping === false ? "off" : "on"}{v.immediateLeave ? " · fast leave" : ""}</span>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/30"><th className="px-3 py-2">Group</th><th className="px-3 py-2">Looks like</th><th className="px-3 py-2">VLAN</th><th className="px-3 py-2">Ports receiving</th></tr></thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">No groups joined on this switch.</td></tr>}
            {groups.map((g, i) => {
              const t = classifyGroup(g.group) || "other";
              return (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs"><Radio size={11} className="inline mr-1.5" style={{ color: STREAM_TYPES[t]?.color }} />{g.group}</td>
                  <td className="px-3 py-2 text-xs">{t === "other" ? "Video / other (NVX uses 239.x)" : STREAM_TYPES[t]?.label}</td>
                  <td className="px-3 py-2 text-xs">{g.vlan}</td>
                  <td className="px-3 py-2 text-xs">{g.ports.map((p) => portLabel?.(p) || p).join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">NVX encoders are matched by name on the AV Flow page. Groups 239.255.x.x are Dante multicast flows, 224.0.1.129 is the PTP clock.</p>
    </div>
  );
}
