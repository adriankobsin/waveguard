import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wifi, WifiOff, AlertTriangle, CheckCircle2, Activity,
  Server, Camera, Monitor, Zap, ArrowRight, Clock, TrendingUp,
  Globe, ArrowDownToLine, ArrowUpFromLine, Gauge, Radio, BarChart3
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import DiagnosisCard from "../components/DiagnosisCard";
import StatusPulse from "../components/StatusPulse";

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

// 24h network traffic — 30-min buckets
const TRAFFIC_DATA = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return {
    time: `${String(h).padStart(2, "0")}:${m}`,
    inMbps: Math.round((Math.random() * 45 + 8) * 10) / 10,
    outMbps: Math.round((Math.random() * 30 + 5) * 10) / 10,
  };
});

// WAN latency — last 24h hourly
const WAN_LATENCY = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  latency: Math.round(Math.random() * 60 + 8),
  packetLoss: parseFloat((Math.random() * 1.5).toFixed(2)),
}));
// inject a degradation spike
WAN_LATENCY[18].latency = 210;
WAN_LATENCY[18].packetLoss = 4.2;

const WAN_STATUS = {
  provider: "Starlink VSAT",
  ip: "185.234.10.91",
  speedDown: 47.2,
  speedUp: 18.6,
  latency: 38,
  packetLoss: 0.1,
  uptime: "99.7%",
  status: "online",
};

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

      {/* Network Monitor + WAN — full-width 2-col on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── LAN Traffic Chart (3 cols) ── */}
        <div className="glass rounded-xl p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 size={14} className="text-cyan-400" />
              Network Traffic (24h)
            </h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Inbound</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Outbound</span>
            </div>
          </div>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Peak In", value: `${Math.max(...TRAFFIC_DATA.map(d => d.inMbps))} Mbps`, color: "text-cyan-400" },
              { label: "Peak Out", value: `${Math.max(...TRAFFIC_DATA.map(d => d.outMbps))} Mbps`, color: "text-green-400" },
              { label: "Avg In", value: `${(TRAFFIC_DATA.reduce((s,d)=>s+d.inMbps,0)/TRAFFIC_DATA.length).toFixed(1)} Mbps`, color: "text-cyan-300" },
            ].map(kpi => (
              <div key={kpi.label} className="bg-secondary/50 rounded-lg px-3 py-2">
                <p className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={TRAFFIC_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(192,100%,48%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(192,100%,48%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(145,65%,45%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(145,65%,45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,14%)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(210,15%,45%)" }} interval={7} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(210,15%,45%)" }} unit="M" />
              <Tooltip
                contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,15%,16%)", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "hsl(210,20%,92%)" }}
              />
              <Area type="monotone" dataKey="inMbps" stroke="hsl(192,100%,48%)" fill="url(#gIn)" strokeWidth={1.5} name="In (Mbps)" dot={false} />
              <Area type="monotone" dataKey="outMbps" stroke="hsl(145,65%,45%)" fill="url(#gOut)" strokeWidth={1.5} name="Out (Mbps)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── WAN Panel (2 cols) ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* WAN Status Card */}
          <div className="glass rounded-xl p-4 flex-1">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Globe size={14} className="text-cyan-400" />
              WAN Connection
              <StatusPulse status={WAN_STATUS.status} />
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Provider</span>
                <span className="text-foreground font-medium">{WAN_STATUS.provider}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Public IP</span>
                <span className="text-foreground font-mono">{WAN_STATUS.ip}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Gauge size={10} /> Latency</span>
                <span className="text-green-400 font-medium">{WAN_STATUS.latency} ms</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Packet Loss</span>
                <span className="text-green-400 font-medium">{WAN_STATUS.packetLoss}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Uptime</span>
                <span className="text-foreground font-medium">{WAN_STATUS.uptime}</span>
              </div>
            </div>
            {/* Speed pills */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2.5 text-center">
                <ArrowDownToLine size={12} className="text-cyan-400 mx-auto mb-1" />
                <p className="text-base font-bold text-cyan-400">{WAN_STATUS.speedDown}</p>
                <p className="text-xs text-muted-foreground">Mbps ↓</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 text-center">
                <ArrowUpFromLine size={12} className="text-green-400 mx-auto mb-1" />
                <p className="text-base font-bold text-green-400">{WAN_STATUS.speedUp}</p>
                <p className="text-xs text-muted-foreground">Mbps ↑</p>
              </div>
            </div>
          </div>

          {/* WAN Latency Bar Chart */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Radio size={14} className="text-yellow-400" />
              WAN Latency (24h)
            </h3>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={WAN_LATENCY} margin={{ top: 2, right: 4, bottom: 0, left: -24 }} barSize={5}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,14%)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "hsl(210,15%,45%)" }} interval={5} />
                <YAxis tick={{ fontSize: 8, fill: "hsl(210,15%,45%)" }} unit="ms" />
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,15%,16%)", borderRadius: 8, fontSize: 10 }}
                  labelStyle={{ color: "hsl(210,20%,92%)" }}
                  formatter={(v, n) => [n === "latency" ? `${v} ms` : `${v}%`, n === "latency" ? "Latency" : "Pkt Loss"]}
                />
                <ReferenceLine y={100} stroke="hsl(38,92%,50%)" strokeDasharray="4 2" strokeWidth={1} />
                <Bar dataKey="latency" fill="hsl(192,100%,48%)" radius={[2,2,0,0]}
                  label={false}
                  // colour spikes red
                  shape={(props) => {
                    const { x, y, width, height, value } = props;
                    return <rect x={x} y={y} width={width} height={height} rx={2} ry={2}
                      fill={value > 100 ? "hsl(0,75%,55%)" : "hsl(192,100%,48%)"} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}