import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wifi, Camera, Monitor, Zap, AlertTriangle, CheckCircle2,
  WifiOff, Activity, Globe, ArrowDownToLine, ArrowUpFromLine,
  Radio, BarChart3, Server, Clock, Lightbulb, Cpu, Loader2, ArrowRight,
  MapPin, RefreshCw, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Sun,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import StatusPulse from "../../StatusPulse";
import { useSystemData } from "@/contexts/SystemDataContext";
import SystemLocationMap from "../SystemLocationMap";
import { formatLocationLine, useSystemLocation } from "@/hooks/useSystemLocation";
import { useLiveWeather } from "@/hooks/useLiveWeather";

const CATEGORY_WIDGETS = [
  { key: "network", label: "Network", icon: Wifi, color: "#06b6d4" },
  { key: "cctv", label: "Cameras", icon: Camera, color: "#a78bfa" },
  { key: "av", label: "AV Systems", icon: Monitor, color: "#60a5fa" },
  { key: "power", label: "Power", icon: Zap, color: "#34d399" },
];

function emptyTrafficSeries() {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${String(i).padStart(2, "0")}:00`,
    inMbps: 0,
    outMbps: 0,
  }));
}

function emptyWanLatencySeries() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    latency: 0,
  }));
}

function buildWanLatencySeries(wan) {
  const latency = wan?.selected?.latencyMs ?? 0;
  if (!wan?.configured && !latency) return emptyWanLatencySeries();
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    latency,
  }));
}

function computeStats(snapshot) {
  if (!snapshot) return { online: 0, offline: 0, warning: 0, alarms: 0 };
  const cats = Object.values(snapshot.categories || {});
  return {
    online: cats.reduce((sum, cat) => sum + (cat.online || 0), 0),
    offline: cats.reduce((sum, cat) => sum + (cat.offline || 0), 0),
    warning: cats.reduce((sum, cat) => sum + (cat.warning || 0), 0),
    alarms:
      (snapshot.criticalAlarms?.length || 0) + (snapshot.warningAlarms?.length || 0),
  };
}

function buildAlarmList(snapshot) {
  if (!snapshot) return [];
  return [
    ...(snapshot.criticalAlarms || []).map((alarm) => ({ ...alarm, severity: "critical" })),
    ...(snapshot.warningAlarms || []).map((alarm) => ({ ...alarm, severity: "warning" })),
  ];
}

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
  lutron_lights: {
    id: "lutron_lights",
    name: "Lutron lights",
    description: "Lutron processor connection and live light status",
    icon: Lightbulb,
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 2, h: 3 },
  },
  cisco_switches: {
    id: "cisco_switches",
    name: "Cisco switches",
    description: "Catalyst / CBS350 SSH switch fleet status",
    icon: Cpu,
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 2, h: 3 },
  },
  system_location: {
    id: "system_location",
    name: "System location",
    description: "Approximate geolocation from public IP on an interactive map",
    icon: MapPin,
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 4, h: 4 },
  },
  live_weather: {
    id: "live_weather",
    name: "Live weather",
    description: "Current conditions from Open-Meteo at the system location",
    icon: Cloud,
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 4, h: 3 },
  },
};

// ─── Base Card ────────────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl h-full bg-card border border-border overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-2xl bg-card border border-border">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}{p.unit || ""}
        </p>
      ))}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconColor, iconBg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl px-4 py-3 flex items-center gap-3 bg-card border border-border"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}>
        <Icon size={15} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none tracking-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-widest truncate">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── Widget Components ────────────────────────────────────────────────────────
export function StatsGridWidget() {
  const { snapshot } = useSystemData();
  const stats = computeStats(snapshot);

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <StatCard label="Online" value={stats.online} icon={CheckCircle2} iconColor="#4ade80" iconBg="rgba(74,222,128,0.1)" />
      <StatCard label="Offline" value={stats.offline} icon={WifiOff} iconColor="#f87171" iconBg="rgba(248,113,113,0.1)" />
      <StatCard label="Warnings" value={stats.warning} icon={AlertTriangle} iconColor="#fbbf24" iconBg="rgba(251,191,36,0.1)" />
      <StatCard label="Open Alarms" value={stats.alarms} icon={Activity} iconColor="#22d3ee" iconBg="rgba(34,211,238,0.1)" />
    </div>
  );
}

export function AlarmsWidget() {
  const { snapshot } = useSystemData();
  const alarms = buildAlarmList(snapshot);

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-4 flex items-center gap-2 uppercase tracking-widest">
          <AlertTriangle size={12} className="text-yellow-400" />
          Active Alarms
          {alarms.length > 0 && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
              {alarms.length}
            </span>
          )}
        </h3>
        {alarms.length === 0 ? (
          <p className="text-xs text-muted-foreground flex-1">No active alarms.</p>
        ) : (
          <div className="space-y-3 flex-1">
            {alarms.map((alarm) => (
              <div key={alarm.id} className="flex items-start gap-3">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alarm.severity === "critical" ? "bg-red-400" : "bg-yellow-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-snug">{alarm.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock size={8} />{alarm.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function CategoriesWidget() {
  const { snapshot } = useSystemData();
  const categories = CATEGORY_WIDGETS.map(({ key, label, icon, color }) => {
    const cat = snapshot?.categories?.[key] || { online: 0, total: 0 };
    return {
      label,
      icon,
      color,
      online: cat.online || 0,
      count: cat.total || 0,
    };
  });

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
          <Server size={12} className="text-primary" />
          System Categories
        </h3>
        <div className="space-y-4 flex-1">
          {categories.map((cat) => (
            <div key={cat.label} className="flex items-center gap-3">
              <cat.icon size={13} style={{ color: cat.color, flexShrink: 0 }} />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-foreground">{cat.label}</span>
                  <span className="text-muted-foreground">{cat.online}/{cat.count}</span>
                </div>
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.count ? (cat.online / cat.count) * 100 : 0}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: cat.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function WanStatusWidget() {
  const { snapshot } = useSystemData();
  const wan = snapshot?.wan;
  const configured = !!wan?.configured;
  const pulseStatus = configured ? (wan.status || "offline") : "offline";
  const downloadMbps = configured ? (wan.downloadMbps ?? 0) : 0;
  const uploadMbps = configured ? (wan.uploadMbps ?? 0) : 0;
  const latencyMs = wan?.selected?.latencyMs ?? null;

  const rows = configured
    ? [
        { label: "Provider", value: wan.isp || wan.selected?.isp || "—" },
        { label: "Public IP", value: wan.publicIp || wan.selected?.publicIp || "—", mono: true },
        {
          label: "Latency",
          value: latencyMs != null ? `${latencyMs} ms` : "—",
          good: latencyMs != null && latencyMs < 100,
        },
        { label: "Link", value: wan.name || wan.selected?.name || "—" },
        { label: "Router", value: wan.routerName || wan.selected?.routerName || "—" },
      ]
    : [
        { label: "Provider", value: "Not configured" },
        { label: "Public IP", value: "—", mono: true },
        { label: "Latency", value: "—" },
        { label: "Status", value: "No WAN link configured" },
      ];

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
          <Globe size={12} className="text-primary" />
          WAN Connection
          <StatusPulse status={pulseStatus} />
        </h3>
        <div className="space-y-2.5 mb-4 flex-1">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-medium ${r.mono ? "font-mono" : ""} ${r.good ? "text-green-400" : "text-foreground"}`}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-3 text-center bg-primary/10 border border-primary/20">
            <ArrowDownToLine size={11} className="text-primary mx-auto mb-1" />
            <p className="text-base font-bold text-primary">{downloadMbps.toFixed(1)}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Mbps ↓</p>
          </div>
          <div className="rounded-lg p-3 text-center bg-cyan-500/10 border border-cyan-500/20">
            <ArrowUpFromLine size={11} className="text-cyan-400 mx-auto mb-1" />
            <p className="text-base font-bold text-cyan-400">{uploadMbps.toFixed(1)}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Mbps ↑</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TrafficChartWidget() {
  const { snapshot } = useSystemData();
  const traffic =
    snapshot?.monitoredCount > 0 && snapshot?.traffic?.length
      ? snapshot.traffic
      : emptyTrafficSeries();

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={12} className="text-primary" />
            Network Traffic (24h)
          </h3>
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />Out
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={traffic} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17% / 0.8)" />
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: "hsl(215 20% 45%)" }} interval={7} />
              <YAxis tick={{ fontSize: 8, fill: "hsl(215 20% 45%)" }} unit="M" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="inMbps" stroke="#06b6d4" fill="url(#gCyan)" strokeWidth={1.5} name="In" unit=" Mbps" dot={false} />
              <Area type="monotone" dataKey="outMbps" stroke="#22d3ee" fill="url(#gTeal)" strokeWidth={1.5} name="Out" unit=" Mbps" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

export function WanLatencyWidget() {
  const { snapshot } = useSystemData();
  const wanLatency = buildWanLatencySeries(snapshot?.wan);

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
          <Radio size={12} className="text-yellow-400" />
          WAN Latency (24h)
        </h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wanLatency} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barSize={5}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17% / 0.8)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "hsl(215 20% 45%)" }} interval={5} />
              <YAxis tick={{ fontSize: 8, fill: "hsl(215 20% 45%)" }} unit="ms" />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={100} stroke="#fbbf24" strokeDasharray="4 2" strokeWidth={1} opacity={0.5} />
              <Bar dataKey="latency" radius={[2, 2, 0, 0]} name="Latency" unit="ms"
                shape={props => {
                  const { x, y, width, height, value } = props;
                  return <rect x={x} y={y} width={width} height={height} rx={2} ry={2}
                    fill={value > 100 ? "#f87171" : "#06b6d4"} opacity={0.8} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function StatRow({ label, value, valueClass = "text-foreground" }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

export function LutronLightsWidget() {
  const {
    loading,
    lutronConnection,
    lightingProbe,
    lightingStats,
    lightingHouse,
  } = useSystemData();

  const hasHouse = (lightingHouse?.zones?.length || 0) > 0;
  const conn = lutronConnection;
  const probe = lightingProbe;
  const configured = !!(conn?.host);
  const liveEnabled = conn?.enabled !== false;

  let processorLabel = "Not configured";
  let processorDetail = "Add credentials in Lights and Shades.";
  let pulseStatus = "warning";

  if (configured && !liveEnabled) {
    processorLabel = "Mock / demo";
    processorDetail = `${conn.protocol === "leap" ? "LEAP" : "Telnet"} · ${conn.host}:${conn.port}`;
    pulseStatus = "warning";
  } else if (configured && probe?.success) {
    processorLabel = "Connected";
    processorDetail = probe.message || `${conn.host}:${conn.port}`;
    pulseStatus = "online";
  } else if (configured && probe) {
    processorLabel = "Offline";
    processorDetail = probe.message || probe.error || "Connection failed";
    pulseStatus = "offline";
  } else if (configured) {
    processorLabel = "Checking…";
    processorDetail = `${conn.host}:${conn.port}`;
  }

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
          <Lightbulb size={12} className="text-amber-400" />
          Lutron lights
          <StatusPulse status={pulseStatus} />
        </h3>
        {loading && !lutronConnection ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground text-xs gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-3 flex-1 text-xs">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Processor
              </p>
              <p className={`font-semibold ${pulseStatus === "online" ? "text-emerald-400" : pulseStatus === "offline" ? "text-red-400" : "text-foreground"}`}>
                {processorLabel}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{processorDetail}</p>
            </div>
            <div className="rounded-lg bg-secondary/60 border border-border/60 p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Lights
              </p>
              {hasHouse ? (
                <>
                  <StatRow label="On / total" value={`${lightingStats.on}/${lightingStats.total}`} valueClass="text-amber-400 font-bold" />
                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: lightingStats.total ? `${(lightingStats.on / lightingStats.total) * 100}%` : "0%" }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground leading-relaxed">
                  Import a Lutron Integration Report to track zones.
                </p>
              )}
            </div>
            <Link to="/lighting" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              Lights and Shades <ArrowRight size={10} />
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

export function CiscoSwitchesWidget() {
  const { loading, ciscoSwitches, ciscoProbes, ciscoStats } = useSystemData();

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
          <Cpu size={12} className="text-sky-400" />
          Cisco switches
          {ciscoStats.total > 0 && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {ciscoStats.online}/{ciscoStats.total}
            </span>
          )}
        </h3>
        {loading && !ciscoSwitches.length ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground text-xs gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        ) : !ciscoSwitches.length ? (
          <div className="flex-1 text-xs text-muted-foreground">
            <p>No Cisco switches configured.</p>
            <Link to="/snmp?tab=cisco" className="mt-3 inline-flex items-center gap-1 text-primary hover:underline">
              Core Network → Cisco Switches <ArrowRight size={10} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3 flex-1 text-xs min-h-0">
            <StatRow label="Online" value={ciscoStats.online} valueClass="text-emerald-400" />
            <StatRow label="Offline" value={ciscoStats.offline} valueClass={ciscoStats.offline > 0 ? "text-amber-400" : "text-foreground"} />
            <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
              {ciscoSwitches.map((sw) => {
                const probe = ciscoProbes[sw.host];
                const online = probe?.success || !!(sw.enabled && sw.lastConnectedAt && !sw.lastError);
                return (
                  <Link
                    key={sw.id}
                    to="/snmp?tab=cisco"
                    className="flex items-center gap-2 py-1 rounded-lg hover:bg-secondary/40 px-1 -mx-1 transition-colors group"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${!sw.enabled ? "bg-muted-foreground/50" : online ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="text-foreground truncate flex-1 group-hover:text-primary">
                      {sw.label || sw.system?.hostname || sw.host}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px] shrink-0">{sw.host}</span>
                  </Link>
                );
              })}
            </div>
            <Link to="/snmp?tab=cisco" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              Manage switches <ArrowRight size={10} />
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

export function SystemLocationWidget() {
  const { publicIp, location, loading, error, refresh, hasCoords, mapCenter } = useSystemLocation({
    refreshIntervalMs: 15 * 60 * 1000,
  });

  return (
    <Card className="widget-no-drag">
      <div className="p-4 h-full flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-2">
            <MapPin size={12} className="text-sky-400" />
            System location
          </h3>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
            title="Refresh location"
          >
            {loading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Refresh
          </button>
        </div>

        {loading && !location ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground text-xs gap-2 min-h-[160px]">
            <Loader2 size={14} className="animate-spin" />
            Resolving location…
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-foreground truncate">
              {formatLocationLine(location)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 mb-1 truncate">
              IP: {location?.ip || publicIp || "auto-detect"}
              {location?.isp ? ` · ${location.isp}` : ""}
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">
              Approximate location from public IP
            </p>
            {error && !loading && (
              <p className="text-[10px] text-red-400 mb-2">{error}</p>
            )}
            <div className="flex-1 min-h-[160px] rounded-lg overflow-hidden border border-border">
              <SystemLocationMap
                latitude={location?.latitude}
                longitude={location?.longitude}
                hasCoords={hasCoords}
                center={mapCenter}
                compact
                zoom={10}
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function weatherIconForCode(code) {
  const n = Number(code);
  if (n === 0 || n === 1) return Sun;
  if (n === 2 || n === 3) return Cloud;
  if (n === 45 || n === 48) return CloudFog;
  if (n >= 71 && n <= 77) return CloudSnow;
  if (n >= 85 && n <= 86) return CloudSnow;
  if (n >= 95 && n <= 99) return CloudLightning;
  if (n >= 51 && n <= 67) return CloudRain;
  if (n >= 80 && n <= 82) return CloudRain;
  return Cloud;
}

function formatTemp(c) {
  if (c == null || !Number.isFinite(Number(c))) return "—";
  return `${Math.round(Number(c))}°C`;
}

export function LiveWeatherWidget() {
  const { location, weather, loading, error, refresh } = useLiveWeather();
  const WeatherIcon = weatherIconForCode(weather?.weatherCode);

  return (
    <Card className="widget-no-drag">
      <div className="p-4 h-full flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-2">
            <Cloud size={12} className="text-sky-400" />
            Live weather
          </h3>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
            title="Refresh weather"
          >
            {loading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Refresh
          </button>
        </div>

        {loading && !weather ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground text-xs gap-2 min-h-[120px]">
            <Loader2 size={14} className="animate-spin" />
            Loading weather…
          </div>
        ) : weather?.success ? (
          <>
            <p className="text-[10px] text-muted-foreground truncate mb-2">
              {formatLocationLine(location)}
            </p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 ring-1 ring-sky-500/20 flex items-center justify-center flex-shrink-0">
                <WeatherIcon size={24} className="text-sky-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">
                  {formatTemp(weather.temperatureC)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {weather.weatherLabel}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground flex-1">
              <div className="rounded-lg bg-muted/40 border border-border px-2 py-1.5">
                <span className="block text-[9px] uppercase tracking-wide">Feels like</span>
                <span className="text-foreground font-medium">
                  {formatTemp(weather.apparentTemperatureC)}
                </span>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border px-2 py-1.5">
                <span className="block text-[9px] uppercase tracking-wide">Humidity</span>
                <span className="text-foreground font-medium">
                  {weather.humidityPct != null ? `${Math.round(weather.humidityPct)}%` : "—"}
                </span>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border px-2 py-1.5">
                <span className="block text-[9px] uppercase tracking-wide">Wind</span>
                <span className="text-foreground font-medium">
                  {weather.windSpeedKmh != null
                    ? `${Math.round(weather.windSpeedKmh)} km/h`
                    : "—"}
                </span>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border px-2 py-1.5">
                <span className="block text-[9px] uppercase tracking-wide">Today</span>
                <span className="text-foreground font-medium">
                  {formatTemp(weather.dailyHighC)} / {formatTemp(weather.dailyLowC)}
                </span>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-border">
              Data by{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Open-Meteo
              </a>
            </p>
          </>
        ) : (
          <div className="flex-1 text-xs text-muted-foreground min-h-[120px]">
            <p>{error || weather?.error || "Weather unavailable"}</p>
            <p className="mt-2 text-[10px]">
              Weather uses coordinates from the system location (public IP).
            </p>
          </div>
        )}
      </div>
    </Card>
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
  lutron_lights: LutronLightsWidget,
  cisco_switches: CiscoSwitchesWidget,
  system_location: SystemLocationWidget,
  live_weather: LiveWeatherWidget,
};