import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Wifi, Camera, Monitor, Zap, AlertTriangle, CheckCircle2,
  WifiOff, Activity, Globe, ArrowDownToLine, ArrowUpFromLine,
  Radio, BarChart3, Server, Clock, X
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import StatusPulse from "../../StatusPulse";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const STATS = { online: 47, offline: 3, warning: 5, alarms: 8 };

const ALARMS = [
  { id: "a1", title: "Cam-Bridge-01 offline", severity: "critical", time: "14m ago" },
  { id: "a2", title: "SW-Deck-Lower CPU >80%", severity: "warning", time: "3h ago" },
  { id: "a3", title: "WAN speed degraded (12 Mbps)", severity: "warning", time: "6h ago" },
  { id: "a4", title: "UPS battery at 42%", severity: "warning", time: "1d ago" },
];

const CATEGORIES = [
  { label: "Network", icon: Wifi, count: 18, online: 16, color: "text-cyan-400" },
  { label: "Cameras", icon: Camera, count: 14, online: 13, color: "text-purple-400" },
  { label: "AV Systems", icon: Monitor, count: 9, online: 8, color: "text-blue-400" },
  { label: "Power", icon: Zap, count: 6, online: 6, color: "text-amber-400" },
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

// ─── Widget Types ─────────────────────────────────────────────────────────────
export const WIDGET_TYPES = {
  stats_grid: {
    id: "stats_grid",
    name: "System Stats",
    description: "Online, offline, warnings, and alarms overview",
    icon: Activity,
    minSize: { w: 2, h: 1 },
    defaultSize: { w: 4, h: 1 },
  },
  alarms: {
    id: "alarms",
    name: "Active Alarms",
    description: "List of current system alarms",
    icon: AlertTriangle,
    minSize: { w: 1, h: 1 },
    defaultSize: { w: 1, h: 2 },
  },
  categories: {
    id: "categories",
    name: "System Categories",
    description: "Device categories with online counts",
    icon: Server,
    minSize: { w: 1, h: 1 },
    defaultSize: { w: 1, h: 2 },
  },
  wan_status: {
    id: "wan_status",
    name: "WAN Connection",
    description: "WAN status and bandwidth metrics",
    icon: Globe,
    minSize: { w: 1, h: 1 },
    defaultSize: { w: 1, h: 2 },
  },
  traffic_chart: {
    id: "traffic_chart",
    name: "Network Traffic",
    description: "24-hour network traffic visualization",
    icon: BarChart3,
    minSize: { w: 2, h: 1 },
    defaultSize: { w: 3, h: 2 },
  },
  wan_latency: {
    id: "wan_latency",
    name: "WAN Latency",
    description: "24-hour WAN latency chart",
    icon: Radio,
    minSize: { w: 2, h: 1 },
    defaultSize: { w: 2, h: 2 },
  },
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
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

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
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

// ─── Widget Components ────────────────────────────────────────────────────────
export function StatsGridWidget() {
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <StatCard label="Online" value={STATS.online} icon={CheckCircle2} color="text-emerald-400" bg="bg-emerald-500" />
      <StatCard label="Offline" value={STATS.offline} icon={WifiOff} color="text-red-400" bg="bg-red-500" />
      <StatCard label="Warnings" value={STATS.warning} icon={AlertTriangle} color="text-amber-400" bg="bg-amber-500" />
      <StatCard label="Open Alarms" value={STATS.alarms} icon={Activity} color="text-cyan-400" bg="bg-cyan-500" />
    </div>
  );
}

export function AlarmsWidget() {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5 h-full">
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
  );
}

export function CategoriesWidget() {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5 h-full">
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
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WanStatusWidget() {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5 h-full">
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
  );
}

export function TrafficChartWidget() {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart3 size={14} className="text-cyan-400" /> Network Traffic (24h)
        </h3>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" />In</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Out</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
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
    </div>
  );
}

export function WanLatencyWidget() {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#0d1321] to-[#080c14] p-5 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Radio size={14} className="text-amber-400" /> WAN Latency (24h)
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
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
  );
}

// Map widget IDs to components
export const WIDGET_COMPONENTS = {
  stats_grid: StatsGridWidget,
  alarms: AlarmsWidget,
  categories: CategoriesWidget,
  wan_status: WanStatusWidget,
  traffic_chart: TrafficChartWidget,
  wan_latency: WanLatencyWidget,
};