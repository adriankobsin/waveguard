import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  X, MapPin, Hash, Tag, FileText, Cpu, Wifi, WifiOff,
  AlertTriangle, CheckCircle2, Clock, Zap, RefreshCw,
  Power, RotateCcw, Activity, Calendar, Wrench,
  ChevronRight, Shield, Info, Radio
} from "lucide-react";
import { requestWiresharkCapture } from "@/components/diagnostics/WiresharkToolsPanel";
import { toast } from "sonner";

const STATUS_CONFIG = {
  online:  { label: "Online",  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400", icon: CheckCircle2 },
  offline: { label: "Offline", color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",         dot: "bg-red-400",     icon: WifiOff },
  warning: { label: "Warning", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",     dot: "bg-amber-400",   icon: AlertTriangle },
  unknown: { label: "Unknown", color: "text-slate-400",   bg: "bg-slate-500/15 border-slate-500/30",     dot: "bg-slate-400",   icon: Radio },
};

const CONDITION_COLORS = {
  Excellent: "text-emerald-400",
  Good:      "text-cyan-400",
  Fair:      "text-amber-400",
  Poor:      "text-red-400",
  Decommissioned: "text-slate-400",
};

// Mock manufacturer data keyed by model substring
const MANUFACTURER_DB = {
  "Cisco":     { vendor: "Cisco Systems", country: "USA",    support: "cisco.com/support",    warranty: "2027-06-01" },
  "Dahua":     { vendor: "Dahua Technology", country: "China", support: "dahuasecurity.com",  warranty: "2025-12-15" },
  "Crestron":  { vendor: "Crestron Electronics", country: "USA", support: "crestron.com",     warranty: "2026-03-20" },
  "APC":       { vendor: "APC by Schneider Electric", country: "France", support: "apc.com",  warranty: "2025-08-30" },
  "MikroTik":  { vendor: "MikroTik", country: "Latvia", support: "mikrotik.com",              warranty: "2028-01-10" },
};

// Mock maintenance history per device name
const MAINTENANCE_HISTORY = {
  "SW-Bridge":      [{ date: "2026-04-12", type: "Firmware Update", by: "J. Martin", note: "Updated to 3.2.1" }, { date: "2026-01-05", type: "Port Inspection", by: "J. Martin", note: "All ports nominal" }],
  "SW-Saloon":      [{ date: "2026-03-18", type: "Config Backup", by: "A. Torres", note: "Monthly snapshot" }],
  "Cam-Bridge-01":  [{ date: "2026-05-01", type: "Lens Clean", by: "A. Torres", note: "Visibility improved" }, { date: "2026-02-14", type: "Firmware Update", by: "J. Martin", note: "Security patch" }],
  "AV-Proc-Saloon": [{ date: "2026-04-28", type: "Cable Check", by: "J. Martin", note: "HDMI replaced" }],
  "UPS-Main":       [{ date: "2026-05-10", type: "Battery Test", by: "A. Torres", note: "Capacity at 42%" }, { date: "2025-11-20", type: "Battery Replace", by: "Service Co.", note: "Full replacement" }],
  "Router-WAN":     [{ date: "2026-04-01", type: "Firmware Update", by: "J. Martin", note: "RouterOS 7.14" }],
};

function getManufacturer(model = "") {
  for (const [key, val] of Object.entries(MANUFACTURER_DB)) {
    if (model.includes(key)) return val;
  }
  return null;
}

function ActionButton({ icon: Icon, label, variant = "default", onClick, loading }) {
  const base = "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border";
  const styles = {
    default:     "border-white/10 text-slate-300 hover:bg-white/6 hover:text-white",
    danger:      "border-red-500/30 text-red-400 hover:bg-red-500/15",
    warning:     "border-amber-500/30 text-amber-400 hover:bg-amber-500/15",
    primary:     "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/15",
  };
  return (
    <button onClick={onClick} disabled={loading} className={`${base} ${styles[variant]} disabled:opacity-50`}>
      {loading ? <RefreshCw size={12} className="animate-spin" /> : <Icon size={12} />}
      {label}
    </button>
  );
}

export default function NodeSidePanel({ node, cables, onClose }) {
  const [activeTab, setActiveTab] = useState("status");
  const [actionLoading, setActionLoading] = useState(null);
  const [actionLog, setActionLog] = useState([]);

  if (!node) return null;

  const status = node.status || "unknown";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const StatusIcon = cfg.icon;
  const mfr = getManufacturer(node.model || "");
  const history = MAINTENANCE_HISTORY[node.name] || [];

  const connectedCables = cables.filter(c => {
    const from = (c.from || "").split(" (")[0];
    const to   = (c.to   || "").split(" (")[0];
    return from === node.name || to === node.name;
  });

  const runAction = (actionName, durationMs = 2000) => {
    if (actionName === "Capture Traffic") {
      setActionLoading(actionName);
      const ip = node.ip || node.management_ip;
      if (ip) {
        requestWiresharkCapture({ hostIp: ip, durationSec: 15 });
        toast.success(`Packet capture started for ${node.name} — see Diagnoses page`);
      } else {
        toast.error("No IP address on this device for capture filter");
      }
      setActionLoading(null);
      setActionLog((prev) => [{
        action: actionName,
        time: new Date().toLocaleTimeString(),
        result: ip ? "Started" : "No IP",
      }, ...prev.slice(0, 4)]);
      return;
    }
    setActionLoading(actionName);
    setTimeout(() => {
      setActionLoading(null);
      setActionLog(prev => [{
        action: actionName,
        time: new Date().toLocaleTimeString(),
        result: "Success"
      }, ...prev.slice(0, 4)]);
    }, durationMs);
  };

  const TABS = [
    { id: "status", label: "Status", icon: Activity },
    { id: "mfr",    label: "Info",   icon: Info },
    { id: "history",label: "History",icon: Calendar },
    { id: "actions",label: "Actions",icon: Zap },
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="side-panel"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="absolute top-0 right-0 bottom-0 w-80 z-20 pointer-events-auto flex flex-col"
      >
        <div className="flex flex-col h-full rounded-l-2xl border-l border-y border-white/10 bg-[#08101e]/95 backdrop-blur-xl shadow-2xl overflow-hidden">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot} ${status === "online" ? "animate-pulse" : ""}`} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-none truncate">{node.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{node.model || node.category}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          {/* ── Status badge ────────────────────────────────────────────── */}
          <div className="px-4 pt-3 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
              <StatusIcon size={11} />
              {cfg.label}
            </span>
          </div>

          {/* ── Tabs ────────────────────────────────────────────────────── */}
          <div className="flex gap-0.5 px-3 pt-3 pb-0 flex-shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-xs font-medium transition-all border-b-2 ${
                  activeTab === tab.id
                    ? "text-cyan-400 border-cyan-400 bg-cyan-500/8"
                    : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/4"
                }`}
              >
                <tab.icon size={10} />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="h-px bg-white/8 mx-3 flex-shrink-0" />

          {/* ── Tab content ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

            {/* STATUS TAB */}
            {activeTab === "status" && (
              <>
                <Section title="Device Details">
                  {node.ip       && <Row icon={Hash}   label="IP Address" value={node.ip}       mono />}
                  {node.category && <Row icon={Cpu}    label="Category"   value={node.category} />}
                  {node.location && <Row icon={MapPin} label="Location"   value={node.location} />}
                  {node.serial   && <Row icon={Tag}    label="Serial No." value={node.serial}   mono />}
                  {node.condition && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 flex items-center gap-1"><Shield size={10} />Condition</span>
                      <span className={`text-xs font-semibold ${CONDITION_COLORS[node.condition] || "text-slate-400"}`}>{node.condition}</span>
                    </div>
                  )}
                </Section>

                {node.notes && (
                  <Section title="Notes">
                    <p className="text-xs text-slate-300 leading-relaxed">{node.notes}</p>
                  </Section>
                )}

                {connectedCables.length > 0 && (
                  <Section title={`Connections (${connectedCables.length})`}>
                    {connectedCables.map(c => {
                      const peer = (c.from || "").split(" (")[0] === node.name ? c.to : c.from;
                      return (
                        <div key={c.id} className="flex items-center justify-between py-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronRight size={10} className="text-cyan-400 flex-shrink-0" />
                            <span className="text-xs text-slate-300 truncate">{peer}</span>
                          </div>
                          <span className="text-xs text-cyan-400/70 font-mono flex-shrink-0 ml-2">{c.type}</span>
                        </div>
                      );
                    })}
                  </Section>
                )}

                {/* Live metrics mock */}
                <Section title="Live Metrics">
                  {[
                    { label: "Uptime",       value: "14d 6h",  good: true },
                    { label: "CPU Load",     value: "18%",     good: true },
                    { label: "Temp",         value: "42 °C",   good: true },
                    { label: "Last Seen",    value: "2m ago",  good: true },
                  ].map(m => (
                    <div key={m.label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{m.label}</span>
                      <span className={m.good ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>{m.value}</span>
                    </div>
                  ))}
                </Section>
              </>
            )}

            {/* MANUFACTURER TAB */}
            {activeTab === "mfr" && (
              <>
                {mfr ? (
                  <Section title="Manufacturer">
                    <Row icon={Tag}      label="Vendor"    value={mfr.vendor} />
                    <Row icon={MapPin}   label="Country"   value={mfr.country} />
                    <Row icon={Shield}   label="Support"   value={mfr.support} mono />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={10} />Warranty Until</span>
                      <span className={`text-xs font-semibold ${new Date(mfr.warranty) > new Date() ? "text-emerald-400" : "text-red-400"}`}>
                        {mfr.warranty}
                      </span>
                    </div>
                  </Section>
                ) : (
                  <EmptyState icon={Info} message="No manufacturer data available" />
                )}

                {node.model && (
                  <Section title="Hardware">
                    <Row icon={Cpu}  label="Model"    value={node.model} />
                    {node.serial && <Row icon={Hash} label="Serial"   value={node.serial} mono />}
                    {node.category && <Row icon={Tag} label="Category" value={node.category} />}
                  </Section>
                )}

                <Section title="Firmware">
                  {[
                    { label: "Current",   value: "3.2.1" },
                    { label: "Released",  value: "2026-02-10" },
                    { label: "Available", value: "3.3.0 ✦" },
                  ].map(f => (
                    <div key={f.label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{f.label}</span>
                      <span className={f.label === "Available" ? "text-amber-400 font-medium" : "text-slate-200"}>{f.value}</span>
                    </div>
                  ))}
                </Section>
              </>
            )}

            {/* HISTORY TAB */}
            {activeTab === "history" && (
              <>
                {history.length > 0 ? (
                  <Section title={`Maintenance Records (${history.length})`}>
                    <div className="space-y-3 mt-1">
                      {history.map((h, i) => (
                        <div key={i} className="relative pl-4 border-l-2 border-cyan-500/20">
                          <span className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-cyan-500/60" />
                          <p className="text-xs font-semibold text-white leading-none">{h.type}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{h.note}</p>
                          <div className="flex gap-3 mt-1 text-[10px] text-slate-600">
                            <span className="flex items-center gap-0.5"><Calendar size={9} />{h.date}</span>
                            <span className="flex items-center gap-0.5"><Shield size={9} />{h.by}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : (
                  <EmptyState icon={Calendar} message="No maintenance history recorded" />
                )}

                <Section title="Next Scheduled">
                  <div className="flex items-center gap-2 py-1">
                    <Wrench size={12} className="text-cyan-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-200 font-medium">Annual Inspection</p>
                      <p className="text-xs text-slate-500 mt-0.5">2026-09-01</p>
                    </div>
                  </div>
                </Section>
              </>
            )}

            {/* ACTIONS TAB */}
            {activeTab === "actions" && (
              <>
                <Section title="Power Control">
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <ActionButton icon={Power}     label="Power Cycle" variant="danger"   onClick={() => runAction("Power Cycle")}   loading={actionLoading === "Power Cycle"} />
                    <ActionButton icon={RotateCcw} label="Restart"     variant="warning"  onClick={() => runAction("Restart")}       loading={actionLoading === "Restart"} />
                    <ActionButton icon={Zap}       label="Wake On LAN" variant="primary"  onClick={() => runAction("Wake On LAN")}   loading={actionLoading === "Wake On LAN"} />
                    <ActionButton icon={Wifi}      label="Port Bounce" variant="default"  onClick={() => runAction("Port Bounce")}   loading={actionLoading === "Port Bounce"} />
                  </div>
                </Section>

                <Section title="Diagnostics">
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <ActionButton icon={Activity}   label="Ping Test"      variant="primary" onClick={() => runAction("Ping Test", 1500)}     loading={actionLoading === "Ping Test"} />
                    <ActionButton icon={RefreshCw}  label="SNMP Poll"      variant="default" onClick={() => runAction("SNMP Poll", 2500)}     loading={actionLoading === "SNMP Poll"} />
                    <ActionButton icon={FileText}   label="Capture Traffic" variant="default" onClick={() => runAction("Capture Traffic", 3000)} loading={actionLoading === "Capture Traffic"} />
                    <ActionButton icon={Shield}     label="Check Config"   variant="default" onClick={() => runAction("Check Config", 1800)} loading={actionLoading === "Check Config"} />
                  </div>
                </Section>

                {actionLog.length > 0 && (
                  <Section title="Action Log">
                    <div className="space-y-1.5">
                      {actionLog.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-slate-300">{entry.action}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-medium">{entry.result}</span>
                            <span className="text-slate-600 flex items-center gap-0.5"><Clock size={9} />{entry.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-2">{title}</p>
      <div className="bg-white/3 border border-white/6 rounded-xl px-3 py-2.5 space-y-2">
        {children}
      </div>
    </div>
  );
}

function Row({ icon: RowIcon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 flex items-center gap-1"><RowIcon size={10} />{label}</span>
      <span className={`text-xs text-slate-200 truncate max-w-[150px] text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-600">
      <Icon size={24} className="mb-2 opacity-40" />
      <p className="text-xs text-center">{message}</p>
    </div>
  );
}