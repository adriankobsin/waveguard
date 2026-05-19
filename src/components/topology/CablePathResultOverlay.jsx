import { motion } from "framer-motion";
import { X, Activity, Wifi, Loader2, ArrowRight, Zap } from "lucide-react";

const HEALTH_CONFIG = {
  good:        { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400", label: "Good" },
  fair:        { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25",   dot: "bg-amber-400",   label: "Fair" },
  degraded:    { color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/25",  dot: "bg-orange-400",  label: "Degraded" },
  unreachable: { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/25",        dot: "bg-red-400",     label: "Unreachable" },
};

function HopRow({ hop }) {
  const isOk = hop.status === "ok";
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-4 text-slate-600 text-right flex-shrink-0">{hop.hop}</span>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOk ? "bg-emerald-400" : "bg-red-400"}`} />
      <span className="text-slate-400 font-mono flex-1 truncate">{hop.ip}</span>
      {hop.hostname && <span className="text-slate-500 truncate max-w-[80px]">{hop.hostname}</span>}
      <span className={`font-mono flex-shrink-0 ${isOk ? "text-cyan-400" : "text-red-400"}`}>
        {isOk ? `${hop.latencyMs}ms` : "*"}
      </span>
    </div>
  );
}

export default function CablePathResultOverlay({ cable, devices, result, loading, onClose, onRetest }) {
  const fromDevice = devices?.find(d => d.id === cable?.fromDeviceId);
  const toDevice   = devices?.find(d => d.id === cable?.toDeviceId);
  const health = result?.health;
  const cfg = health ? HEALTH_CONFIG[health] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[480px] max-w-[92vw] pointer-events-auto"
    >
      <div className="rounded-2xl border border-white/12 bg-[#070b13]/98 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-cyan-400" />
            <span className="text-xs font-semibold text-white">Path Diagnostic</span>
            {cable?.label && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-xs font-mono text-cyan-300">{cable.label}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!loading && (
              <button
                onClick={onRetest}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
              >
                <Zap size={9} /> Re-test
              </button>
            )}
            <button onClick={onClose} className="w-5 h-5 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
              <X size={11} />
            </button>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6 bg-white/2">
          <span className="text-xs text-slate-300 font-medium truncate max-w-[130px]">{fromDevice?.name || "?"}</span>
          <ArrowRight size={11} className="text-slate-600 flex-shrink-0" />
          <span className="text-xs text-slate-300 font-medium truncate max-w-[130px]">{toDevice?.name || "?"}</span>
          {fromDevice?.ip && <span className="text-[10px] text-slate-600 font-mono ml-auto">{fromDevice.ip} → {toDevice?.ip || "?"}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
            <Loader2 size={16} className="animate-spin text-cyan-400" />
            <span className="text-sm">Running diagnostics…</span>
          </div>
        ) : result ? (
          <div className="p-4 space-y-3">
            {/* Health badge */}
            {cfg && (
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${cfg.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-sm font-semibold ${cfg.color}`}>Path {cfg.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {result.ping?.avgMs != null && (
                    <span className="text-slate-400">Avg <span className={`font-mono font-bold ${cfg.color}`}>{result.ping.avgMs}ms</span></span>
                  )}
                  {result.endToEndLatencyMs != null && (
                    <span className="text-slate-400">E2E <span className="font-mono font-bold text-slate-300">{result.endToEndLatencyMs}ms</span></span>
                  )}
                  {result.totalHops != null && (
                    <span className="text-slate-400">{result.totalHops} hop{result.totalHops !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Ping results */}
              {result.ping && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1"><Wifi size={9} /> Ping</p>
                  <div className="space-y-1">
                    {[
                      { label: "Sent",     value: result.ping.transmitted },
                      { label: "Received", value: result.ping.received },
                      { label: "Loss",     value: `${result.ping.packetLossPct}%`,  warn: result.ping.packetLossPct > 0 },
                      { label: "Min",      value: result.ping.minMs != null ? `${result.ping.minMs}ms` : "–" },
                      { label: "Max",      value: result.ping.maxMs != null ? `${result.ping.maxMs}ms` : "–" },
                      { label: "Avg",      value: result.ping.avgMs != null ? `${result.ping.avgMs}ms` : "–", bold: true },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-[11px]">
                        <span className="text-slate-500">{row.label}</span>
                        <span className={`font-mono ${row.bold ? "font-bold text-white" : row.warn ? "text-amber-400" : "text-slate-300"}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Traceroute */}
              {result.traceroute && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1"><Activity size={9} /> Traceroute</p>
                  <div className="space-y-1">
                    {result.traceroute.map(hop => <HopRow key={hop.hop} hop={hop} />)}
                  </div>
                </div>
              )}
            </div>

            {result.note && (
              <p className="text-[10px] text-amber-400/80 bg-amber-500/8 border border-amber-500/15 px-2.5 py-1.5 rounded-lg">{result.note}</p>
            )}

            <p className="text-[10px] text-slate-600">
              Tested {new Date(result.testedAt).toLocaleTimeString()}
            </p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
