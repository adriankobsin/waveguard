import { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wifi, WifiOff, AlertTriangle, CheckCircle2, Activity,
  Server, Camera, Monitor, Zap, ArrowRight, Clock, TrendingUp,
  Globe, ArrowDownToLine, ArrowUpFromLine, Gauge, Radio, BarChart3,
  Bot, Package, Cable, Layers
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import StatusPulse from "../components/StatusPulse";
import NetworkGraph from "../components/NetworkGraph";
import NodeDetailPanel from "../components/NodeDetailPanel";

// ─── shared mock data (mirrors InventoryPage & CablesPage) ───────────────────
const EQUIPMENT = [
  { id: "1", name: "SW-Bridge", model: "Cisco CBS350-24T", category: "Network", ip: "192.168.10.1", condition: "Good", location: "Bridge Rack", serial: "FOC2241X0AB", notes: "Primary distribution switch" },
  { id: "2", name: "SW-Saloon", model: "Cisco CBS350-16T", category: "Network", ip: "192.168.10.2", condition: "Good", location: "Saloon Cabinet", serial: "FOC2241X0CD", notes: "" },
  { id: "3", name: "Cam-Bridge-01", model: "Dahua IPC-HDW3849H", category: "Camera", ip: "192.168.10.51", condition: "Fair", location: "Bridge Exterior", serial: "DH2023051201", notes: "PoE — requires port bounce" },
  { id: "4", name: "AV-Proc-Saloon", model: "Crestron NVX-350", category: "AV", ip: "192.168.10.22", condition: "Good", location: "Saloon AV Rack", serial: "CRE7462183", notes: "4K HDR matrix" },
  { id: "5", name: "UPS-Main", model: "APC Smart-UPS 3000VA", category: "Power", ip: "192.168.10.80", condition: "Good", location: "Engine Room", serial: "AS1720140893", notes: "Battery at 42%" },
  { id: "6", name: "Router-WAN", model: "MikroTik CCR2004-1G", category: "Network", ip: "192.168.1.1", condition: "Excellent", location: "Bridge Rack", serial: "MT220B0041", notes: "BGP + failover configured" },
];

const CABLES = [
  { id: "1", label: "C-001", from: "SW-Bridge (Port 1)", to: "Router-WAN", type: "Cat6A", notes: "Primary uplink" },
  { id: "2", label: "C-002", from: "SW-Bridge (Port 12)", to: "Cam-Bridge-01", type: "Cat6", notes: "PoE camera" },
  { id: "3", label: "C-003", from: "AV-Proc-Saloon", to: "SW-Saloon", type: "Cat6A", notes: "" },
  { id: "4", label: "C-004", from: "SW-Saloon (Port 4)", to: "UPS-Main", type: "Cat6", notes: "" },
  { id: "5", label: "C-005", from: "UPS-Main", to: "SW-Bridge", type: "Power IEC", notes: "Protected feed" },
  { id: "6", label: "C-006", from: "Router-WAN", to: "SW-Bridge", type: "Cat6A", notes: "" },
];

const STATS = { online: 47, offline: 3, warning: 5, alarms: 8 };

const ALARMS = [
  { id: "a1", title: "Cam-Bridge-01 offline", severity: "critical", time: "14m ago" },
  { id: "a2", title: "SW-Deck-Lower CPU >80%", severity: "warning", time: "3h ago" },
  { id: "a3", title: "WAN speed degraded (12 Mbps)", severity: "warning", time: "6h ago" },
  { id: "a4", title: "UPS battery at 42%", severity: "warning", time: "1d ago" },
];

const TRAFFIC = Array.from({ length: 48 }, (_, i) => ({
  time: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
  inMbps: Math.round((Math.random() * 45 + 8) * 10) / 10,
  outMbps: Math.round((Math.random() * 30 + 5) * 10) / 10,
}));

const WAN_LATENCY = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  latency: Math.round(Math.random() * 60 + 8),
}));
WAN_LATENCY[18].latency = 210;

const CATEGORIES = [
  { label: "Network", icon: Wifi, count: 18, online: 16, color: "text-cyan-400" },
  { label: "Cameras", icon: Camera, count: 14, online: 13, color: "text-purple-400" },
  { label: "AV Systems", icon: Monitor, count: 9, online: 8, color: "text-blue-400" },
  { label: "Power", icon: Zap, count: 6, online: 6, color: "text-amber-400" },
];

// ─── Luxury stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5 shadow-xl"
    >
      <div className={`absolute inset-0 opacity-[0.04] ${bg}`} />
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${bg} bg-opacity-20`}>
        <Icon size={18} className={color} />
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-widest">{label}</p>
      <div className={`absolute bottom-0 left-0 h-0.5 w-1/3 ${bg.replace("bg-", "bg-")}`} style={{ background: `hsl(var(--primary))`, opacity: 0.5 }} />
    </motion.div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1321] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}{p.unit || ""}</p>
      ))}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div className="min-h-screen bg-[#060912] p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Layers size={16} className="text-cyan-400" />
            </span>
            Guardian AI
          </h1>
          <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
            <StatusPulse status="online" />
            M/Y Horizon · Last scan 2 min ago
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/mobile" className="text-xs text-slate-400 hover:text-cyan-400 transition-colors border border-white/10 rounded-xl px-3 py-2 hover:border-cyan-500/40">
            Mobile View
          </Link>
          <Link to="/setup" className="text-xs bg-cyan-500 text-black font-semibold rounded-xl px-4 py-2 hover:bg-cyan-400 transition-colors">
            Run Discovery
          </Link>
        </div>
      </motion.div>

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Online" value={STATS.online} icon={CheckCircle2} color="text-emerald-400" bg="bg-emerald-500" delay={0} />
        <StatCard label="Offline" value={STATS.offline} icon={WifiOff} color="text-red-400" bg="bg-red-500" delay={0.05} />
        <StatCard label="Warnings" value={STATS.warning} icon={AlertTriangle} color="text-amber-400" bg="bg-amber-500" delay={0.1} />
        <StatCard label="Open Alarms" value={STATS.alarms} icon={Activity} color="text-cyan-400" bg="bg-cyan-500" delay={0.15} />
      </div>

      {/* ── Network Graph (hero) ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="relative rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#07090f] overflow-hidden"
        style={{ height: 460 }}
      >
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        {/* Title overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
            <Activity size={13} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Live Network Graph</p>
            <p className="text-xs text-slate-500 mt-0.5">{EQUIPMENT.length} devices · {CABLES.length} connections</p>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-3">
          {[
            { label: "Network", color: "#06b6d4" },
            { label: "Camera", color: "#a78bfa" },
            { label: "AV", color: "#60a5fa" },
            { label: "Power", color: "#fbbf24" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Graph */}
        <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading graph…</div>}>
          <NetworkGraph
            equipment={EQUIPMENT}
            cables={CABLES}
            onNodeClick={node => setSelectedNode(prev => prev?.id === node.id ? null : node)}
            selectedNode={selectedNode}
          />
        </Suspense>

        {/* Node detail panel */}
        <NodeDetailPanel
          node={selectedNode}
          cables={CABLES}
          onClose={() => setSelectedNode(null)}
        />
      </motion.div>

      {/* ── Lower grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Active Alarms */}
        <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            Active Alarms
            <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{ALARMS.length}</span>
          </h3>
          <div className="space-y-3">
            {ALARMS.map(alarm => (
              <div key={alarm.id} className="flex items-start gap-3 group">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alarm.severity === "critical" ? "bg-red-400" : "bg-amber-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 leading-snug">{alarm.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <Clock size={9} />{alarm.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Categories */}
        <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Server size={14} className="text-cyan-400" />
            System Categories
          </h3>
          <div className="space-y-4">
            {CATEGORIES.map(cat => (
              <div key={cat.label} className="flex items-center gap-3">
                <cat.icon size={15} className={cat.color} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">{cat.label}</span>
                    <span className="text-slate-500">{cat.online}/{cat.count}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.online / cat.count) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WAN Status */}
        <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Globe size={14} className="text-cyan-400" />
            WAN Connection
            <StatusPulse status="online" />
          </h3>
          <div className="space-y-3 mb-4">
            {[
              { label: "Provider", value: "Starlink VSAT" },
              { label: "Public IP", value: "185.234.10.91", mono: true },
              { label: "Latency", value: "38 ms", good: true },
              { label: "Packet Loss", value: "0.1%", good: true },
              { label: "Uptime", value: "99.7%" },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-xs">
                <span className="text-slate-500">{r.label}</span>
                <span className={`${r.mono ? "font-mono" : "font-medium"} ${r.good ? "text-emerald-400" : "text-slate-200"}`}>{r.value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-cyan-500/8 border border-cyan-500/15 p-3 text-center">
              <ArrowDownToLine size={12} className="text-cyan-400 mx-auto mb-1" />
              <p className="text-base font-bold text-cyan-400">47.2</p>
              <p className="text-xs text-slate-500">Mbps ↓</p>
            </div>
            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 p-3 text-center">
              <ArrowUpFromLine size={12} className="text-emerald-400 mx-auto mb-1" />
              <p className="text-base font-bold text-emerald-400">18.6</p>
              <p className="text-xs text-slate-500">Mbps ↑</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Traffic */}
        <div className="lg:col-span-3 rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 size={14} className="text-cyan-400" /> Network Traffic (24h)
            </h3>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" />In</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Out</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={TRAFFIC} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#475569" }} interval={7} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} unit="M" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="inMbps" stroke="#06b6d4" fill="url(#gIn)" strokeWidth={1.5} name="In" unit=" Mbps" dot={false} />
              <Area type="monotone" dataKey="outMbps" stroke="#34d399" fill="url(#gOut)" strokeWidth={1.5} name="Out" unit=" Mbps" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* WAN Latency */}
        <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Radio size={14} className="text-amber-400" /> WAN Latency (24h)
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={WAN_LATENCY} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barSize={5}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "#475569" }} interval={5} />
              <YAxis tick={{ fontSize: 8, fill: "#475569" }} unit="ms" />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
              <Bar dataKey="latency" radius={[2, 2, 0, 0]} name="Latency" unit="ms"
                shape={props => {
                  const { x, y, width, height, value } = props;
                  return <rect x={x} y={y} width={width} height={height} rx={2} ry={2}
                    fill={value > 100 ? "#ef4444" : "#06b6d4"} opacity={0.85} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: "/assistant", icon: Bot, label: "AI Assistant", sub: "Ask Guardian AI", color: "text-purple-400", border: "hover:border-purple-500/40" },
          { to: "/inventory", icon: Package, label: "Inventory", sub: `${EQUIPMENT.length} devices`, color: "text-cyan-400", border: "hover:border-cyan-500/40" },
          { to: "/cables", icon: Cable, label: "Cables", sub: `${CABLES.length} registered`, color: "text-green-400", border: "hover:border-green-500/40" },
          { to: "/diagnoses", icon: Activity, label: "Diagnoses", sub: "2 active", color: "text-amber-400", border: "hover:border-amber-500/40" },
        ].map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.05 }}
          >
            <Link to={item.to}
              className={`flex items-center gap-3 p-4 rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] hover:bg-[#0f1528] transition-all group ${item.border}`}
            >
              <item.icon size={18} className={item.color} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-white transition-colors">{item.label}</p>
                <p className="text-xs text-slate-500">{item.sub}</p>
              </div>
              <ArrowRight size={13} className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
            </Link>
          </motion.div>
        ))}
      </div>

    </div>
  );
}