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
  { label: "Network", icon: Wifi, count: 18, online: 16, color: "#C9A84C" },
  { label: "Cameras", icon: Camera, count: 14, online: 13, color: "#a78bfa" },
  { label: "AV Systems", icon: Monitor, count: 9, online: 8, color: "#60a5fa" },
  { label: "Power", icon: Zap, count: 6, online: 6, color: "#2dd4bf" },
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

// ─── Luxury Card Wrapper ──────────────────────────────────────────────────────
function LuxCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl h-full relative overflow-hidden card-gold-edge ${className}`}
      style={{
        background: "linear-gradient(145deg, hsl(24 12% 8%), hsl(24 10% 5%))",
        border: "1px solid hsl(42 25% 13% / 0.9)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-2xl"
      style={{ background: "hsl(24 14% 7%)", border: "1px solid hsl(42 40% 20% / 0.6)" }}>
      <p className="mb-1" style={{ color: "hsl(42 20% 45%)" }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}{p.unit || ""}</p>
      ))}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconColor, iconBg, glowColor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl px-4 py-3 flex items-center gap-3 card-gold-edge"
      style={{ background: "linear-gradient(135deg, hsl(24 12% 8%), hsl(24 10% 6%))", border: "1px solid hsl(42 25% 13% / 0.9)" }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, border: `1px solid ${iconColor}28` }}>
        <Icon size={15} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tracking-tight"
          style={{ color: "hsl(42 50% 88%)", fontFamily: "'Playfair Display', serif" }}>{value}</p>
        <p className="text-[9px] mt-1 font-medium uppercase tracking-[0.15em] truncate"
          style={{ color: "hsl(42 20% 42%)" }}>{label}</p>
      </div>
      <div className="absolute bottom-0 left-4 right-4 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${glowColor}45, transparent)` }} />
    </motion.div>
  );
}

// ─── Widget Components ────────────────────────────────────────────────────────
export function StatsGridWidget() {
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <StatCard label="Online" value={STATS.online} icon={CheckCircle2} iconColor="#4ade80" iconBg="hsl(145 55% 10%)" glowColor="#4ade80" />
      <StatCard label="Offline" value={STATS.offline} icon={WifiOff} iconColor="#f87171" iconBg="hsl(0 72% 10%)" glowColor="#f87171" />
      <StatCard label="Warnings" value={STATS.warning} icon={AlertTriangle} iconColor="#fbbf24" iconBg="hsl(38 90% 10%)" glowColor="#fbbf24" />
      <StatCard label="Open Alarms" value={STATS.alarms} icon={Activity} iconColor="hsl(42,65%,58%)" iconBg="hsl(42 50% 9%)" glowColor="hsl(42,65%,52%)" />
    </div>
  );
}

export function AlarmsWidget() {
  return (
    <LuxCard>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold mb-4 flex items-center gap-2 uppercase tracking-[0.12em]"
          style={{ color: "hsl(42 50% 70%)", fontFamily: "'Inter', sans-serif" }}>
          <AlertTriangle size={12} style={{ color: "#fbbf24" }} />
          Active Alarms
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: "hsl(38 90% 50% / 0.12)", color: "hsl(38 90% 60%)", border: "1px solid hsl(38 90% 50% / 0.2)" }}>
            {ALARMS.length}
          </span>
        </h3>
        <div className="space-y-3 flex-1">
          {ALARMS.map(alarm => (
            <div key={alarm.id} className="flex items-start gap-3">
              <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0"
                style={{ background: alarm.severity === "critical" ? "#f87171" : "#fbbf24" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-snug" style={{ color: "hsl(42 30% 80%)" }}>{alarm.title}</p>
                <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "hsl(42 15% 38%)" }}>
                  <Clock size={8} />{alarm.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LuxCard>
  );
}

export function CategoriesWidget() {
  return (
    <LuxCard>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold mb-4 uppercase tracking-[0.12em] flex items-center gap-2"
          style={{ color: "hsl(42 50% 70%)" }}>
          <Server size={12} style={{ color: "hsl(42 65% 52%)" }} />
          System Categories
        </h3>
        <div className="space-y-4 flex-1">
          {CATEGORIES.map(cat => (
            <div key={cat.label} className="flex items-center gap-3">
              <cat.icon size={13} style={{ color: cat.color, flexShrink: 0 }} />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span style={{ color: "hsl(42 25% 68%)" }}>{cat.label}</span>
                  <span style={{ color: "hsl(42 15% 40%)" }}>{cat.online}/{cat.count}</span>
                </div>
                <div className="h-px rounded-full overflow-hidden" style={{ background: "hsl(42 15% 12%)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.online / cat.count) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${cat.color}90, ${cat.color})` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LuxCard>
  );
}

export function WanStatusWidget() {
  return (
    <LuxCard>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold mb-4 uppercase tracking-[0.12em] flex items-center gap-2"
          style={{ color: "hsl(42 50% 70%)" }}>
          <Globe size={12} style={{ color: "hsl(42 65% 52%)" }} />
          WAN Connection
          <StatusPulse status="online" />
        </h3>
        <div className="space-y-2.5 mb-4 flex-1">
          {[
            { label: "Provider", value: "Starlink VSAT" },
            { label: "Public IP", value: "185.234.10.91", mono: true },
            { label: "Latency", value: "38 ms", good: true },
            { label: "Packet Loss", value: "0.1%", good: true },
            { label: "Uptime", value: "99.7%" },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-xs">
              <span style={{ color: "hsl(42 15% 38%)" }}>{r.label}</span>
              <span style={{
                fontFamily: r.mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
                color: r.good ? "#4ade80" : "hsl(42 30% 78%)",
                fontWeight: 500,
              }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-3 text-center"
            style={{ background: "hsl(42 50% 9%)", border: "1px solid hsl(42 40% 18% / 0.5)" }}>
            <ArrowDownToLine size={11} style={{ color: "hsl(42 65% 55%)", margin: "0 auto 4px" }} />
            <p className="text-base font-bold" style={{ color: "hsl(42 65% 62%)", fontFamily: "'Playfair Display', serif" }}>47.2</p>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(42 20% 38%)" }}>Mbps ↓</p>
          </div>
          <div className="rounded-lg p-3 text-center"
            style={{ background: "hsl(172 50% 8%)", border: "1px solid hsl(172 40% 18% / 0.5)" }}>
            <ArrowUpFromLine size={11} style={{ color: "#2dd4bf", margin: "0 auto 4px" }} />
            <p className="text-base font-bold" style={{ color: "#2dd4bf", fontFamily: "'Playfair Display', serif" }}>18.6</p>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(172 20% 38%)" }}>Mbps ↑</p>
          </div>
        </div>
      </div>
    </LuxCard>
  );
}

export function TrafficChartWidget() {
  return (
    <LuxCard>
      <div className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] flex items-center gap-2"
            style={{ color: "hsl(42 50% 70%)" }}>
            <BarChart3 size={12} style={{ color: "hsl(42 65% 52%)" }} />
            Network Traffic (24h)
          </h3>
          <div className="flex gap-3 text-[10px]" style={{ color: "hsl(42 15% 40%)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(42 65% 52%)" }} />In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />Out
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={TRAFFIC} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(42 15% 12% / 0.8)" />
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: "hsl(42 15% 35%)" }} interval={7} />
              <YAxis tick={{ fontSize: 8, fill: "hsl(42 15% 35%)" }} unit="M" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="inMbps" stroke="#C9A84C" fill="url(#gGold)" strokeWidth={1.5} name="In" unit=" Mbps" dot={false} />
              <Area type="monotone" dataKey="outMbps" stroke="#2dd4bf" fill="url(#gTeal)" strokeWidth={1.5} name="Out" unit=" Mbps" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </LuxCard>
  );
}

export function WanLatencyWidget() {
  return (
    <LuxCard>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] flex items-center gap-2 mb-4"
          style={{ color: "hsl(42 50% 70%)" }}>
          <Radio size={12} style={{ color: "#fbbf24" }} />
          WAN Latency (24h)
        </h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WAN_LATENCY} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barSize={5}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(42 15% 12% / 0.8)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "hsl(42 15% 35%)" }} interval={5} />
              <YAxis tick={{ fontSize: 8, fill: "hsl(42 15% 35%)" }} unit="ms" />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={100} stroke="#fbbf24" strokeDasharray="4 2" strokeWidth={1} opacity={0.5} />
              <Bar dataKey="latency" radius={[2, 2, 0, 0]} name="Latency" unit="ms"
                shape={props => {
                  const { x, y, width, height, value } = props;
                  return <rect x={x} y={y} width={width} height={height} rx={2} ry={2}
                    fill={value > 100 ? "#f87171" : "#C9A84C"} opacity={0.8} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </LuxCard>
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