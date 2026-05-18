import { motion } from "framer-motion";
import { AlertTriangle, Lightbulb } from "lucide-react";

const PROTOCOL_COLORS = {
  DMX:    "text-purple-400 bg-purple-500/10 border-purple-500/20",
  DALI:   "text-blue-400 bg-blue-500/10 border-blue-500/20",
  KNX:    "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Lutron: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

export default function LightingZoneList({ zones, selectedZone, onSelectZone, onUpdateZone }) {
  return (
    <div className="space-y-2 max-w-3xl mx-auto">
      {zones.map((zone, i) => {
        const isSelected = selectedZone === zone.id;
        const pcls = PROTOCOL_COLORS[zone.protocol] || "text-slate-400 bg-slate-500/10 border-slate-500/20";

        return (
          <motion.div
            key={zone.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelectZone(isSelected ? null : zone.id)}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
              isSelected
                ? "border-amber-500/40 bg-amber-500/8"
                : zone.fault
                ? "border-red-500/25 bg-red-500/5 hover:bg-red-500/8"
                : "border-white/6 bg-white/2 hover:bg-white/5 hover:border-white/12"
            }`}
          >
            {/* Status indicator */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              zone.fault ? "bg-red-500/15" : zone.on ? "bg-amber-500/15" : "bg-white/5"
            }`}>
              {zone.fault
                ? <AlertTriangle size={16} className="text-red-400" />
                : <Lightbulb size={16} className={zone.on ? "text-amber-400" : "text-slate-600"} />
              }
            </div>

            {/* Name + location */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-white truncate">{zone.name}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${pcls}`}>
                  {zone.protocol}
                </span>
                {zone.fault && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/12 text-red-400 flex-shrink-0">
                    FAULT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">{zone.location} · {zone.fixtures} fixtures · Ch {zone.channel}</p>
            </div>

            {/* Dimmer slider */}
            <div className="w-32 flex-shrink-0 hidden sm:block" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-600">Level</span>
                <span className={zone.on ? "text-amber-400 font-bold" : "text-slate-600"}>{zone.on ? `${zone.level}%` : "Off"}</span>
              </div>
              <input
                type="range" min={0} max={100} value={zone.level}
                onChange={e => onUpdateZone(zone.id, { level: +e.target.value, on: +e.target.value > 0 })}
                className="w-full h-1.5 cursor-pointer"
                style={{ accentColor: "#f59e0b" }}
              />
            </div>

            {/* Toggle */}
            <button
              onClick={e => { e.stopPropagation(); onUpdateZone(zone.id, { on: !zone.on }); }}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${zone.on ? "bg-amber-500" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${zone.on ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}