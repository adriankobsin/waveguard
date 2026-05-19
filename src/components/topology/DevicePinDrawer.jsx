import { motion } from "framer-motion";
import { X, FileText, AlertTriangle, CheckCircle2, Info, Clock, Download, ExternalLink, MapPin, Trash2, Cpu } from "lucide-react";

const STATUS_CFG = {
  online:  { label: "Online",  color: "text-emerald-400", badge: "bg-emerald-500/12 border-emerald-500/30", dot: "bg-emerald-400", bar: "bg-emerald-500" },
  offline: { label: "Offline", color: "text-red-400",     badge: "bg-red-500/12 border-red-500/30",         dot: "bg-red-400",     bar: "bg-red-500" },
  warning: { label: "Warning", color: "text-amber-400",   badge: "bg-amber-500/12 border-amber-500/30",     dot: "bg-amber-400",   bar: "bg-amber-500" },
  unknown: { label: "Unknown", color: "text-slate-400",   badge: "bg-slate-500/12 border-slate-500/30",     dot: "bg-slate-400",   bar: "bg-slate-500" },
};

const SEVERITY_ICONS = {
  critical: <AlertTriangle size={12} className="text-red-400" />,
  warning:  <AlertTriangle size={12} className="text-amber-400" />,
  info:     <Info size={12} className="text-cyan-400" />,
  success:  <CheckCircle2 size={12} className="text-emerald-400" />,
};

const DOC_TYPE_COLORS = {
  PDF:  "bg-red-500/15 text-red-400 border-red-500/25",
  XLSX: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  DOCX: "bg-blue-500/15 text-blue-400 border-blue-500/25",
};

const CONDITION_COLORS = {
  Excellent: "text-emerald-400", Good: "text-cyan-400",
  Fair: "text-amber-400", Poor: "text-red-400",
};

// Mock health metrics per device
const HEALTH_METRICS = {
  "router-wan":  { cpu: 18, mem: 34, uptime: "47d 12h", latency: "12ms" },
  "sw-bridge":   { cpu: 31, mem: 52, uptime: "47d 12h", latency: "1ms"  },
  "sw-deck":     { cpu: 84, mem: 61, uptime: "12d 3h",  latency: "2ms"  },
  "cam-bridge":  { cpu: null, mem: null, uptime: "Offline", latency: "—" },
  "ups-main":    { cpu: null, mem: null, uptime: "47d 12h", battery: "42%", load: "61%" },
  "av-proc":     { cpu: 22, mem: 44, uptime: "32d 8h",  latency: "3ms"  },
  "qsys-core":   { cpu: 15, mem: 38, uptime: "32d 8h",  latency: "4ms"  },
};

function MetricBar({ label, value, max = 100, color = "bg-cyan-500" }) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : color;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-300 font-medium">{value}%</span>
      </div>
      <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DevicePinDrawer({ pin, status, events, docs, onClose, onRemovePin }) {
  const { device } = pin;
  const scfg = STATUS_CFG[status] || STATUS_CFG.unknown;
  const metrics = HEALTH_METRICS[device.id];

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="w-80 flex-shrink-0 border-l border-white/8 bg-[#070b13]/98 backdrop-blur-xl flex flex-col shadow-2xl overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-white/8">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${scfg.badge} ${scfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
              {scfg.label}
            </span>
            <span className="text-xs text-slate-600">{device.category}</span>
          </div>
          <p className="text-base font-bold text-white truncate">{device.name}</p>
          <p className="text-xs text-slate-500 truncate">{device.model}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Device info ── */}
        <div className="px-5 py-4 border-b border-white/6 space-y-2">
          {[
            { label: "IP Address", value: device.ip, mono: true },
            { label: "Location",   value: device.location },
            { label: "Serial",     value: device.serial, mono: true },
            { label: "Condition",  value: device.condition, colorClass: CONDITION_COLORS[device.condition] },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{r.label}</span>
              <span className={`text-xs font-medium ${r.colorClass || "text-slate-200"} ${r.mono ? "font-mono" : ""}`}>{r.value}</span>
            </div>
          ))}
          {device.notes && (
            <p className="text-xs text-slate-400 pt-1 border-t border-white/5 leading-relaxed">{device.notes}</p>
          )}
        </div>

        {/* ── Health metrics ── */}
        {metrics && (
          <div className="px-5 py-4 border-b border-white/6">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-1.5">
              <Cpu size={10} /> Health
            </p>
            <div className="space-y-2.5">
              {metrics.cpu != null && <MetricBar label="CPU" value={metrics.cpu} />}
              {metrics.mem != null && <MetricBar label="Memory" value={metrics.mem} />}
              {metrics.battery && <MetricBar label="Battery" value={parseInt(metrics.battery)} color="bg-amber-500" />}
              {metrics.load && <MetricBar label="Load" value={parseInt(metrics.load)} />}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-white/3 border border-white/6 px-2.5 py-2 text-center">
                <p className="text-[10px] text-slate-600 mb-0.5">Uptime</p>
                <p className="text-xs font-semibold text-slate-200">{metrics.uptime}</p>
              </div>
              <div className="rounded-lg bg-white/3 border border-white/6 px-2.5 py-2 text-center">
                <p className="text-[10px] text-slate-600 mb-0.5">Latency</p>
                <p className="text-xs font-semibold text-slate-200">{metrics.latency}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Recent events ── */}
        <div className="px-5 py-4 border-b border-white/6">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-1.5">
            <Clock size={10} /> Recent Events
          </p>
          {events.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No recent events</p>
          ) : (
            <div className="space-y-2.5">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0">{SEVERITY_ICONS[ev.severity] || SEVERITY_ICONS.info}</div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 leading-snug">{ev.message}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Documents ── */}
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-1.5">
            <FileText size={10} /> Schematics & Manuals
          </p>
          {docs.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No documents linked</p>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/7 hover:bg-white/6 hover:border-white/12 transition-colors group cursor-pointer">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${DOC_TYPE_COLORS[doc.type] || "bg-slate-500/15 text-slate-400 border-slate-500/25"}`}>
                    {doc.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition-colors">{doc.name}</p>
                    <p className="text-[10px] text-slate-600">{doc.category} · {doc.size}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Open">
                      <ExternalLink size={11} />
                    </button>
                    <button className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Download">
                      <Download size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="px-5 py-4 border-t border-white/8 flex gap-2">
        <button className="flex-1 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/25 transition-colors flex items-center justify-center gap-1.5">
          <MapPin size={12} /> View Full Details
        </button>
        <button
          onClick={onRemovePin}
          className="w-10 h-9 flex items-center justify-center rounded-xl border border-white/10 text-slate-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/8 transition-colors"
          title="Remove pin"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}