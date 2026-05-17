import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wifi, WifiOff, AlertTriangle, CheckCircle2, Activity,
  Server, Camera, Monitor, Zap, ArrowRight, Clock, TrendingUp
} from "lucide-react";
import DiagnosisCard from "../components/DiagnosisCard";
import StatusPulse from "../components/StatusPulse";
import MetricSparkline from "../components/MetricSparkline";

const MOCK_STATS = {
  online: 47,
  offline: 3,
  warning: 5,
  alarms: 8,
  uptime: "99.2%",
  lastScan: "2 min ago",
};

const MOCK_OFFLINE = [
  { id: "1", name: "Cam-Bridge-01", ip: "192.168.10.51", type: "camera", since: "14m ago" },
  { id: "2", name: "AV-Proc-Saloon", ip: "192.168.10.22", type: "av", since: "2h ago" },
  { id: "3", name: "SW-Deck-Lower", ip: "192.168.10.5", type: "switch", since: "5m ago" },
];

const MOCK_DIAGNOSES = [
  {
    id: "d1", equipmentName: "Cam-Bridge-01", severity: "critical",
    summary: "Camera unreachable — possible PoE failure",
    likelyCause: "The switch port supplying PoE power may have exceeded its wattage budget or the port has been disabled after a fault condition.",
    steps: ["Check PoE budget on SW-Bridge (port 12)", "Verify cable continuity", "Power cycle the switch port via SNMP"],
    suggestedAction: "snmp_port_bounce", requiresApproval: true, resolvedAt: null,
    relatedDocuments: [{ id: "doc1", name: "Dahua IP Camera PoE Guide", page: 14 }]
  },
  {
    id: "d2", equipmentName: "SW-Deck-Lower", severity: "warning",
    summary: "High CPU load on deck switch (87%)",
    likelyCause: "Broadcast storm detected on VLAN 20. Possibly a loop caused by a newly connected device without STP.",
    steps: ["Check STP topology via SNMP", "Identify high-traffic MAC on VLAN 20", "Isolate the offending port"],
    suggestedAction: "check_config", requiresApproval: false, resolvedAt: null,
    relatedDocuments: []
  },
];

const MOCK_ALARMS = [
  { id: "a1", title: "Cam-Bridge-01 offline", severity: "critical", time: "14m ago" },
  { id: "a2", title: "SW-Deck-Lower CPU >80%", severity: "warning", time: "3h ago" },
  { id: "a3", title: "WAN speed degraded (12 Mbps)", severity: "warning", time: "6h ago" },
  { id: "a4", title: "UPS battery at 42%", severity: "warning", time: "1d ago" },
];

const categories = [
  { label: "Network", icon: Wifi, count: 18, online: 16, color: "text-cyan-400" },
  { label: "Cameras", icon: Camera, count: 14, online: 13, color: "text-purple-400" },
  { label: "AV Systems", icon: Monitor, count: 9, online: 8, color: "text-blue-400" },
  { label: "Power", icon: Zap, count: 6, online: 6, color: "text-yellow-400" },
];

export default function Dashboard() {
  const [diagnosisFilter, setDiagnosisFilter] = useState("all");

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Guardian AI</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
            <StatusPulse status="online" />
            M/Y Horizon · Last scan {MOCK_STATS.lastScan}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/mobile" className="text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded-md px-3 py-1.5">
            Mobile View
          </Link>
          <Link to="/setup" className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 transition-opacity">
            Run Discovery
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Online", value: MOCK_STATS.online, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Offline", value: MOCK_STATS.offline, icon: WifiOff, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Warnings", value: MOCK_STATS.warning, icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          { label: "Open Alarms", value: MOCK_STATS.alarms, icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4"
          >
            <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} size={18} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Active Diagnoses */}
      {MOCK_DIAGNOSES.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400" />
              AI Diagnoses
              <span className="bg-yellow-500/20 text-yellow-400 text-xs px-1.5 py-0.5 rounded-full">{MOCK_DIAGNOSES.length}</span>
            </h2>
            <Link to="/diagnoses" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {MOCK_DIAGNOSES.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                <DiagnosisCard diagnosis={d} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Offline Devices */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <WifiOff size={14} className="text-red-400" />
            Offline Devices
          </h3>
          <div className="space-y-2">
            {MOCK_OFFLINE.map(dev => (
              <div key={dev.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{dev.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{dev.ip}</p>
                </div>
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <Clock size={10} />
                  {dev.since}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alarms */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400" />
            Active Alarms
          </h3>
          <div className="space-y-2">
            {MOCK_ALARMS.map(alarm => (
              <div key={alarm.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alarm.severity === "critical" ? "bg-red-500" : "bg-yellow-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-snug">{alarm.title}</p>
                  <p className="text-xs text-muted-foreground">{alarm.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Grid */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Server size={14} className="text-cyan-400" />
            System Categories
          </h3>
          <div className="space-y-3">
            {categories.map(cat => (
              <div key={cat.label} className="flex items-center gap-3">
                <cat.icon size={16} className={cat.color} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground font-medium">{cat.label}</span>
                    <span className="text-muted-foreground">{cat.online}/{cat.count}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(cat.online / cat.count) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Network sparkline */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-cyan-400" />
          Network Activity (24h)
        </h3>
        <MetricSparkline />
      </div>
    </div>
  );
}