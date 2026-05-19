import { useState } from "react";
import { motion } from "framer-motion";
import { Cable, X, ArrowRight, Check } from "lucide-react";

const CATEGORIES = ["Network", "AV", "CCTV", "Power", "Other"];
const STATUSES = ["installed", "planned", "spare"];

export default function CablePathDrawer({ fromDevice, toDevice, onSave, onClose }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Network");
  const [cableType, setCableType] = useState("");
  const [status, setStatus] = useState("installed");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    onSave({
      label: label || `${fromDevice?.name} → ${toDevice?.name}`,
      fromDeviceId: fromDevice?.id,
      toDeviceId: toDevice?.id,
      category,
      type: cableType,
      status,
      notes,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="w-80 flex-shrink-0 border-l border-white/8 bg-[#070b13]/95 backdrop-blur-xl flex flex-col overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Cable size={14} className="text-orange-400" />
          <p className="text-sm font-semibold text-white">New Cable Path</p>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Route preview */}
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-300 truncate max-w-[100px]">{fromDevice?.name || "?"}</span>
        <ArrowRight size={12} className="text-orange-400 flex-shrink-0" />
        <span className="text-xs font-medium text-slate-300 truncate max-w-[100px]">{toDevice?.name || "?"}</span>
      </div>

      {/* Form */}
      <div className="px-4 py-4 space-y-4 flex-1">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Cable Label</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={`e.g. C-001`}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 font-mono"
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  category === cat
                    ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Cable Type</label>
          <input
            value={cableType}
            onChange={e => setCableType(e.target.value)}
            placeholder="e.g. Cat6A, Fibre OM3, HDMI 2.0"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Status</label>
          <div className="flex gap-1.5">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${
                  status === s
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 text-sm font-medium transition-all"
        >
          <Check size={14} />
          Add Cable Path
        </button>
      </div>
    </motion.div>
  );
}