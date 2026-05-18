import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Hash, Tag, FileText } from "lucide-react";

const STATUS_CONFIG = {
  online: { label: "Online", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400" },
  offline: { label: "Offline", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", dot: "bg-red-400" },
  warning: { label: "Warning", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", dot: "bg-amber-400" },
  unknown: { label: "Unknown", color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30", dot: "bg-slate-400" },
};

const CONDITION_COLORS = {
  Excellent: "text-emerald-400",
  Good: "text-cyan-400",
  Fair: "text-amber-400",
  Poor: "text-red-400",
  Decommissioned: "text-slate-400",
};

export default function NodeDetailPanel({ node, cables, onClose }) {
  if (!node) return null;
  const status = node.status || "unknown";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;

  const connectedCables = cables.filter(c => {
    const from = c.from.split(" (")[0];
    const to = c.to.split(" (")[0];
    return from === node.name || to === node.name;
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="absolute top-4 right-4 w-72 z-20 pointer-events-auto"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0a0f1c]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full animate-pulse ${cfg.dot}`} />
              <p className="text-sm font-semibold text-white">{node.name}</p>
            </div>
            <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>

          {/* Status badge */}
          <div className="px-4 pt-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>

          {/* Details */}
          <div className="px-4 py-3 space-y-2.5">
            {node.model && (
              <Row icon={Tag} label="Model" value={node.model} />
            )}
            {node.ip && (
              <Row icon={Hash} label="IP" value={node.ip} mono />
            )}
            {node.location && (
              <Row icon={MapPin} label="Location" value={node.location} />
            )}
            {node.serial && (
              <Row icon={Hash} label="Serial" value={node.serial} mono />
            )}
            {node.condition && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Condition</span>
                <span className={`text-xs font-medium ${CONDITION_COLORS[node.condition] || "text-slate-400"}`}>
                  {node.condition}
                </span>
              </div>
            )}
            {node.notes && (
              <div className="pt-1 border-t border-white/6">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><FileText size={10} /> Notes</p>
                <p className="text-xs text-slate-300 leading-relaxed">{node.notes}</p>
              </div>
            )}
          </div>

          {/* Connected cables */}
          {connectedCables.length > 0 && (
            <div className="px-4 pb-4 border-t border-white/6 pt-3">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Connections ({connectedCables.length})</p>
              <div className="space-y-1.5">
                {connectedCables.map(c => {
                  const peer = c.from.split(" (")[0] === node.name ? c.to : c.from;
                  return (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 truncate max-w-[140px]">{peer}</span>
                      <span className="text-cyan-400/70 font-mono text-[10px] ml-2 flex-shrink-0">{c.type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ icon: RowIcon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 flex items-center gap-1"><RowIcon size={10} />{label}</span>
      <span className={`text-xs text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}