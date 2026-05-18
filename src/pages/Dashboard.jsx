import { useState } from "react";
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
import LiveStatusFeed from "../components/LiveStatusFeed";

// ─── Full device + cable dataset (mirrors TopologyPage) ──────────────────────
const EQUIPMENT = [
  { id: "router-wan", name: "Router-WAN",      category: "Network", model: "MikroTik CCR2004-1G",  ip: "192.168.1.1",   location: "Bridge Rack",    condition: "Excellent", notes: "BGP + failover configured" },
  { id: "sw-bridge",  name: "SW-Bridge",        category: "Network", model: "Cisco CBS350-24T",     ip: "192.168.10.1",  location: "Bridge Rack",    condition: "Good",      notes: "Primary distribution switch" },
  { id: "sw-saloon",  name: "SW-Saloon",        category: "Network", model: "Cisco CBS350-16T",     ip: "192.168.10.2",  location: "Saloon Cabinet", condition: "Good",      notes: "" },
  { id: "sw-deck",    name: "SW-Deck-Lower",    category: "Network", model: "Cisco SG250-18",       ip: "192.168.10.5",  location: "Deck Cabinet",   condition: "Fair",      notes: "CPU spikes noted" },
  { id: "sw-engine",  name: "SW-Engine",        category: "Network", model: "Cisco SG250-18",       ip: "192.168.10.6",  location: "Engine Room",    condition: "Good",      notes: "" },
  { id: "ap-bridge",  name: "AP-Bridge",        category: "Network", model: "Ubiquiti UAP-AC-Pro",  ip: "192.168.10.20", location: "Bridge Mast",    condition: "Good",      notes: "" },
  { id: "ap-deck",    name: "AP-Deck-Aft",      category: "Network", model: "Ubiquiti UAP-AC-Pro",  ip: "192.168.10.21", location: "Aft Deck",       condition: "Good",      notes: "" },
  { id: "cam-bridge", name: "Cam-Bridge-01",    category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.51", location: "Bridge Ext.",    condition: "Fair",      notes: "PoE — requires port bounce" },
  { id: "cam-saloon", name: "Cam-Saloon-01",    category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.52", location: "Saloon",         condition: "Good",      notes: "" },
  { id: "cam-deck1",  name: "Cam-Deck-01",      category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.53", location: "Fore Deck",      condition: "Good",      notes: "" },
  { id: "cam-deck2",  name: "Cam-Deck-02",      category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.54", location: "Aft Deck",       condition: "Good",      notes: "" },
  { id: "av-proc",    name: "AV-Proc-Saloon",   category: "AV",      model: "Crestron NVX-350",     ip: "192.168.10.22", location: "Saloon AV Rack", condition: "Good",      notes: "4K HDR matrix" },
  { id: "av-matrix",  name: "AV-Matrix-Saloon", category: "AV",      model: "Kramer VS-88H",        ip: "192.168.10.23", location: "Saloon AV Rack", condition: "Good",      notes: "" },
  { id: "qsys-core",  name: "Q-SYS Core",       category: "AV",      model: "Q-SYS Core 110f",      ip: "192.168.10.30", location: "Bridge Rack",    condition: "Good",      notes: "Audio DSP main" },
  { id: "nas",        name: "NAS-Synology",      category: "Server",  model: "Synology DS1522+",     ip: "192.168.10.80", location: "Engine Room",    condition: "Good",      notes: "" },
  { id: "ups-main",   name: "UPS-Main",          category: "Power",   model: "APC Smart-UPS 3000VA", ip: "192.168.10.90", location: "Engine Room",    condition: "Good",      notes: "Battery at 42%" },
  { id: "ups-av",     name: "UPS-AV",            category: "Power",   model: "APC Smart-UPS 750VA",  ip: "192.168.10.91", location: "Saloon AV Rack", condition: "Good",      notes: "" },
];

const CABLES = [
  { id: "c01", label: "C-001", from: "Router-WAN",      to: "SW-Bridge",        source: "router-wan", target: "sw-bridge",  type: "Cat6A",     notes: "Primary WAN uplink" },
  { id: "c02", label: "C-002", from: "SW-Bridge",       to: "SW-Saloon",        source: "sw-bridge",  target: "sw-saloon",  type: "Cat6A",     notes: "Trunk" },
  { id: "c03", label: "C-003", from: "SW-Bridge",       to: "SW-Deck-Lower",    source: "sw-bridge",  target: "sw-deck",    type: "Cat6A",     notes: "Trunk" },
  { id: "c04", label: "C-004", from: "SW-Bridge",       to: "SW-Engine",        source: "sw-bridge",  target: "sw-engine",  type: "Cat6A",     notes: "Trunk" },
  { id: "c05", label: "C-005", from: "SW-Bridge",       to: "AP-Bridge",        source: "sw-bridge",  target: "ap-bridge",  type: "Cat6",      notes: "PoE" },
  { id: "c06", label: "C-006", from: "SW-Bridge",       to: "Cam-Bridge-01",    source: "sw-bridge",  target: "cam-bridge", type: "Cat6",      notes: "PoE camera" },
  { id: "c07", label: "C-007", from: "SW-Bridge",       to: "Q-SYS Core",       source: "sw-bridge",  target: "qsys-core",  type: "Cat6A",     notes: "" },
  { id: "c08", label: "C-008", from: "SW-Bridge",       to: "NAS-Synology",     source: "sw-bridge",  target: "nas",        type: "Cat6A",     notes: "" },
  { id: "c09", label: "C-009", from: "SW-Saloon",       to: "AP-Deck-Aft",      source: "sw-saloon",  target: "ap-deck",    type: "Cat6",      notes: "PoE" },
  { id: "c10", label: "C-010", from: "SW-Saloon",       to: "Cam-Saloon-01",    source: "sw-saloon",  target: "cam-saloon", type: "Cat6",      notes: "PoE camera" },
  { id: "c11", label: "C-011", from: "SW-Saloon",       to: "AV-Proc-Saloon",   source: "sw-saloon",  target: "av-proc",    type: "Cat6A",     notes: "" },
  { id: "c12", label: "C-012", from: "SW-Saloon",       to: "AV-Matrix-Saloon", source: "sw-saloon",  target: "av-matrix",  type: "Cat6A",     notes: "" },
  { id: "c13", label: "C-013", from: "SW-Saloon",       to: "UPS-AV",           source: "sw-saloon",  target: "ups-av",     type: "Cat6",      notes: "SNMP monitoring" },
  { id: "c14", label: "C-014", from: "SW-Deck-Lower",   to: "Cam-Deck-01",      source: "sw-deck",    target: "cam-deck1",  type: "Cat6",      notes: "PoE camera" },
  { id: "c15", label: "C-015", from: "SW-Deck-Lower",   to: "Cam-Deck-02",      source: "sw-deck",    target: "cam-deck2",  type: "Cat6",      notes: "PoE camera" },
  { id: "c16", label: "C-016", from: "UPS-Main",        to: "SW-Bridge",        source: "ups-main",   target: "sw-bridge",  type: "Power IEC", notes: "Protected feed" },
  { id: "c17", label: "C-017", from: "UPS-Main",        to: "Router-WAN",       source: "ups-main",   target: "router-wan", type: "Power IEC", notes: "Protected feed" },
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
          <Link to="/discovery" className="text-xs bg-cyan-500 text-black font-semibold rounded-xl px-4 py-2 hover:bg-cyan-400 transition-colors">
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

      {/* ── Live Status Feed (hero) ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        style={{ height: 460 }}
      >
        <LiveStatusFeed />
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