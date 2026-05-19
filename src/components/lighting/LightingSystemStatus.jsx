import { Wifi, AlertTriangle, CheckCircle2 } from "lucide-react";

const PROTOCOL_COLORS = {
  DMX:    "text-purple-400",
  DALI:   "text-blue-400",
  KNX:    "text-orange-400",
  Lutron: "text-cyan-400",
};

export default function LightingSystemStatus({ gateways, zones }) {
  const totalZones = zones.length;
  const onZones = zones.filter(z => z.on).length;
  const faultZones = zones.filter(z => z.fault).length;

  return (
    <div className="flex-1 px-4 pt-4 pb-4 space-y-4">
      {/* Summary */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">System Summary</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "Zones",    value: totalZones, color: "text-white" },
            { label: "Active",   value: onZones,    color: "text-amber-400" },
            { label: "Faults",   value: faultZones, color: faultZones > 0 ? "text-red-400" : "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-white/3 border border-white/6 p-2 text-center">
              <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Gateway status */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Gateways</p>
        <div className="space-y-1.5">
          {gateways.map(gw => (
            <div key={gw.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/2 border border-white/5">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                gw.status === "online" ? "bg-emerald-500/15" : gw.status === "warning" ? "bg-amber-500/15" : "bg-red-500/15"
              }`}>
                {gw.status === "online"
                  ? <CheckCircle2 size={11} className="text-emerald-400" />
                  : gw.status === "warning"
                  ? <AlertTriangle size={11} className="text-amber-400" />
                  : <Wifi size={11} className="text-red-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wide ${PROTOCOL_COLORS[gw.protocol] || "text-slate-400"}`}>{gw.protocol}</p>
                <p className="text-[10px] text-slate-500 truncate">{gw.label}</p>
              </div>
              {gw.notes && <AlertTriangle size={9} className="text-amber-400 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}