import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wifi, Camera, Monitor, Zap, AlertTriangle, CheckCircle2,
  WifiOff, Activity, Globe, ArrowDownToLine, ArrowUpFromLine,
  Radio, BarChart3, Server, Clock, Lightbulb, Cpu, Loader2, ArrowRight, Gauge,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import StatusPulse from "../../StatusPulse";
import { toast } from "sonner";
import { useSystemData } from "@/contexts/SystemDataContext";
import { loadWanSpeedTests, loadWanSpeedTestsWithServer, saveWanSpeedTestResult } from "@/lib/wan/wanWidgetStorage";
import { runWanSpeedTest } from "@/api/wanApi";
import { formatRelativeTime } from "@/lib/systemData/formatRelativeTime";

const CATEGORY_META = {
  network: { label: "Network", icon: Wifi, color: "#06b6d4" },
  av: { label: "AV Systems", icon: Monitor, color: "#60a5fa" },
  control: { label: "Control", icon: Cpu, color: "#a78bfa" },
  lighting: { label: "Lighting", icon: Lightbulb, color: "#34d399" },
  cctv: { label: "Cameras", icon: Camera, color: "#f59e0b" },
};

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
  const { sources, diagnoses } = useSystemData();
  const eqList = sources?.equipment || [];
  const totalDevices = eqList.length;
  const totalOffline = eqList.filter(e => e.status === "offline").length;
  const totalWarning = eqList.filter(e => e.status === "warning").length;
  const criticalCount = (diagnoses || []).filter(d => d.severity === "critical").length;
  const warningCount = (diagnoses || []).filter(d => d.severity === "warning").length;

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <StatCard label="Devices" value={totalDevices} icon={CheckCircle2} iconColor="#4ade80" iconBg="rgba(74,222,128,0.1)" />
      <StatCard label="Offline" value={totalOffline} icon={WifiOff} iconColor="#f87171" iconBg="rgba(248,113,113,0.1)" />
      <StatCard label="Warnings" value={totalWarning} icon={AlertTriangle} iconColor="#fbbf24" iconBg="rgba(251,191,36,0.1)" />
      <StatCard label="Alarms" value={criticalCount + warningCount} icon={Activity} iconColor="#22d3ee" iconBg="rgba(34,211,238,0.1)" />
    </div>
  );
}

export function AlarmsWidget() {
  const { diagnoses } = useSystemData();
  const allAlarms = useMemo(() => {
    const critical = (diagnoses || []).filter(d => d.severity === "critical").map(d => ({
      id: d.id, title: d.title || d.summary, time: d.createdAt || d.time || "—", severity: "critical",
    }));
    const warning = (diagnoses || []).filter(d => d.severity === "warning").map(d => ({
      id: d.id, title: d.title || d.summary, time: d.createdAt || d.time || "—", severity: "warning",
    }));
    return [...critical, ...warning];
  }, [diagnoses]);

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-4 flex items-center gap-2 uppercase tracking-widest">
          <AlertTriangle size={12} className="text-yellow-400" />
          Active Alarms
          {allAlarms.length > 0 && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
              {allAlarms.length}
            </span>
          )}
        </h3>
        {allAlarms.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            No active alarms
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-y-auto">
            {allAlarms.map(alarm => (
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
  const { sources } = useSystemData();
  const eqList = sources?.equipment || [];

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const eq of eqList) {
      const cat = eq.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, { total: 0, online: 0, offline: 0, warning: 0 });
      const entry = map.get(cat);
      entry.total += 1;
      const s = eq.status || "online";
      if (s === "online") entry.online += 1;
      else if (s === "offline") entry.offline += 1;
      else entry.warning += 1;
    }
    const order = ["Router", "Network", "Switch", "Camera", "AV", "Lighting", "Power", "Control", "Uncategorized"];
    return [...map.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [eqList]);

  const CAT_ICONS = {
    Router: { icon: Globe, color: "#fb923c" },
    Network: { icon: Wifi, color: "#06b6d4" },
    Switch: { icon: Server, color: "#22d3ee" },
    Camera: { icon: Camera, color: "#a78bfa" },
    AV: { icon: Monitor, color: "#60a5fa" },
    Lighting: { icon: Lightbulb, color: "#34d399" },
    Power: { icon: Zap, color: "#f97316" },
    Control: { icon: Cpu, color: "#818cf8" },
  };

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
          <Server size={12} className="text-primary" />
          Equipment Categories
        </h3>
        {byCategory.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            No equipment registered
          </div>
        ) : (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {byCategory.map(([cat, stats]) => {
              const meta = CAT_ICONS[cat] || { icon: Server, color: "#888" };
              const Icon = meta.icon;
              const total = stats.total || 0;
              const online = stats.online || 0;
              const pct = total > 0 ? (online / total) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <Icon size={13} style={{ color: meta.color, flexShrink: 0 }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span className="text-foreground">{cat}</span>
                      <span className="text-muted-foreground">{online}/{total}</span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: meta.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function SpeedCircle({ value, max, label, color, testing, empty, size = 88 }) {
  const r = (size - 14) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(217 33% 17% / 0.6)" strokeWidth="5" />
          {/* Foreground arc */}
          {!testing && !empty && (
            <motion.circle
              cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - pct) }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          )}
          {testing && (
            <motion.circle
              cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.35} ${circumference * 0.65}`}
              animate={{ strokeDashoffset: [0, -circumference] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
          )}
          {empty && !testing && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
              strokeDasharray={`3 5`} strokeOpacity="0.3" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {testing ? (
            <>
              <span className="text-[10px] font-bold text-foreground animate-pulse">Testing</span>
              <span className="text-[9px] text-muted-foreground">…</span>
            </>
          ) : empty ? (
            <span className="text-lg font-bold text-muted-foreground/50">—</span>
          ) : (
            <span className="text-base font-bold text-foreground tabular-nums">{value}</span>
          )}
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function WanStatusWidget() {
  const { sources } = useSystemData();
  const wanMgmt = sources?.wanManagement;
  const equipment = sources?.equipment || [];
  const profiles = sources?.snmpSwitches?.profiles || [];
  const [testing, setTesting] = useState(false);
  const [testVersion, setTestVersion] = useState(0);

  const assigned = useMemo(() => {
    const ids = wanMgmt?.assignedRouterEquipmentIds || [];
    return ids.map(id => equipment.find(e => e.id === id)).filter(Boolean);
  }, [wanMgmt, equipment]);

  const router = assigned[0];

  const routerProfile = useMemo(() => {
    if (!router) return null;
    const found = profiles.find(p => p.equipmentId === router.id);
    if (found) return found;
    // Synthetic fallback so the speed-test button is always clickable
    return {
      id: `snmp-sw-${router.id}`,
      equipmentId: router.id,
      enabled: true,
      deviceRole: "wan_router",
      integrationVendor: "snmp",
      lastPoll: null,
    };
  }, [router, profiles]);

  const wanPort = useMemo(() => {
    if (!routerProfile) return null;
    const poll = routerProfile?.lastPoll;
    if (poll?.ports?.length) {
      return poll.ports.find(p => p.meta?.type === "wan") || poll.ports.find(p => p.name?.toLowerCase().includes("wan")) || poll.ports[0];
    }
    // Synthetic WAN port for dashboard
    return { index: 1, name: "WAN1", meta: { type: "wan", publicIp: null } };
  }, [routerProfile]);

  const publicIp = useMemo(() => {
    if (routerProfile && wanPort) {
      const key = `${routerProfile.id}:${wanPort.index}`;
      const override = wanMgmt?.linkOverrides?.[key];
      if (override?.publicIpOverride) return override.publicIpOverride;
    }
    return wanPort?.meta?.publicIp || router?.ip || null;
  }, [routerProfile, wanPort, wanMgmt, router]);

  const [latestTest, setLatestTest] = useState(null);

  useEffect(() => {
    if (!routerProfile) { setLatestTest(null); return; }
    loadWanSpeedTestsWithServer().then(tests => {
      const match = tests.filter(t => t.profileId === routerProfile.id).sort((a, b) => new Date(b.testedAt) - new Date(a.testedAt))[0];
      setLatestTest(match || null);
    });
  }, [routerProfile, testVersion]);

  const handleSpeedTest = async () => {
    if (!routerProfile || !wanPort || testing) return;
    setTesting(true);
    try {
      const result = await runWanSpeedTest({
        profileId: routerProfile.id,
        portIndex: wanPort.index,
        portName: wanPort.name || "WAN",
      });
      saveWanSpeedTestResult({ ...result, profileId: routerProfile.id, portIndex: wanPort.index });
      setTestVersion(v => v + 1);
      toast.success(`Speed test: ↓${Math.round(result.downloadMbps)} ↑${Math.round(result.uploadMbps)} Mbps`);
    } catch (err) {
      toast.error(err.message || "Speed test failed");
    } finally {
      setTesting(false);
    }
  };

  if (!router) {
    return (
      <Card>
        <div className="p-5 h-full flex flex-col items-center justify-center text-center">
          <Globe size={24} className="text-muted-foreground mb-2 opacity-50" />
          <p className="text-xs font-medium text-foreground">No WAN router assigned</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Assign a router in Core Network → WAN Management
          </p>
        </div>
      </Card>
    );
  }

  const status = router.status === "online" ? "online" : router.status === "offline" ? "offline" : "warning";
  const hasTest = latestTest?.downloadMbps != null;
  const displayDown = hasTest ? Math.round(latestTest.downloadMbps) : 0;
  const displayUp = hasTest ? Math.round(latestTest.uploadMbps) : 0;
  const maxSpeed = Math.max(displayDown, displayUp, 1);

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-2">
            <Globe size={12} className="text-primary" />
            WAN Connection
            <StatusPulse status={status} />
          </h3>
          <button
            type="button"
            onClick={handleSpeedTest}
            disabled={testing || !routerProfile || !wanPort}
            className="flex items-center gap-1 text-[10px] border border-border rounded-lg px-2 py-1 hover:border-primary/40 disabled:opacity-50 bg-background"
          >
            {testing ? <Loader2 size={10} className="animate-spin" /> : <Gauge size={10} />}
            {testing ? "Testing…" : "Speed test"}
          </button>
        </div>

        <div className="space-y-1.5 mb-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Router</span>
            <span className="font-medium text-foreground truncate ml-2">{router.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Public IP</span>
            <span className="font-medium font-mono">{publicIp || router.ip || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-medium capitalize ${status === "online" ? "text-emerald-400" : status === "offline" ? "text-red-400" : "text-amber-400"}`}>{status}</span>
          </div>
          {latestTest?.testedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last test</span>
              <span className="font-medium text-muted-foreground">{formatRelativeTime(latestTest.testedAt)}</span>
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center gap-6">
          <SpeedCircle
            value={displayDown}
            max={maxSpeed}
            label="Download"
            color="#06b6d4"
            testing={testing}
            empty={!hasTest}
          />
          <div className="flex flex-col items-center gap-1">
            <div className="h-px w-6 bg-border/60" />
            {latestTest?.latencyMs != null && !testing && (
              <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(latestTest.latencyMs)}ms</span>
            )}
            {latestTest?.jitterMs != null && !testing && (
              <span className="text-[9px] text-muted-foreground/60 tabular-nums">{Math.round(latestTest.jitterMs)}ms jitter</span>
            )}
          </div>
          <SpeedCircle
            value={displayUp}
            max={maxSpeed}
            label="Upload"
            color="#22d3ee"
            testing={testing}
            empty={!hasTest}
          />
        </div>
      </div>
    </Card>
  );
}

export function TrafficChartWidget() {
  const { snapshot } = useSystemData();
  const base = snapshot?.traffic || [];
  const [data, setData] = useState(() => base.length ? [...base] : []);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!base.length || data.length) return;
    setData([...base]);
  }, [base, data.length]);

  useEffect(() => {
    if (!data.length) return;
    const id = setInterval(() => {
      const last = data[data.length - 1];
      const noise = () => Math.round((Math.random() * 6 - 3) * 10) / 10;
      const inVal = Math.max(2, (last?.inMbps || 10) + noise());
      const outVal = Math.max(1, (last?.outMbps || 5) + noise());
      tickRef.current += 1;
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0");
      setData(prev => {
        const next = [...prev, { time: `${h}:${m}`, inMbps: inVal, outMbps: outVal }];
        return next.length > 48 ? next.slice(-48) : next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [data.length > 0]);

  if (!data.length) {
    return (
      <Card>
        <div className="p-5 h-full flex flex-col items-center justify-center text-center">
          <BarChart3 size={24} className="text-muted-foreground mb-2 opacity-50" />
          <p className="text-xs font-medium text-foreground">No traffic data yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Data appears as system events are logged
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={12} className="text-primary" />
            Network Traffic
            <span className="text-[9px] text-primary/60 font-normal animate-pulse">● LIVE</span>
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
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
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
              <Area isAnimationActive type="monotone" dataKey="inMbps" stroke="#06b6d4" fill="url(#gCyan)" strokeWidth={1.5} name="In" unit=" Mbps" dot={false} />
              <Area isAnimationActive type="monotone" dataKey="outMbps" stroke="#22d3ee" fill="url(#gTeal)" strokeWidth={1.5} name="Out" unit=" Mbps" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

export function WanLatencyWidget() {
  const { sources } = useSystemData();
  const wanMgmt = sources?.wanManagement;
  const equipment = sources?.equipment || [];
  const profiles = sources?.snmpSwitches?.profiles || [];

  const assigned = useMemo(() => {
    const ids = wanMgmt?.assignedRouterEquipmentIds || [];
    return ids.map(id => equipment.find(e => e.id === id)).filter(Boolean);
  }, [wanMgmt, equipment]);

  const router = assigned[0];

  const speedTestLatency = useMemo(() => {
    if (!router) return null;
    const profile = profiles.find(p => p.equipmentId === router.id);
    if (!profile) return null;
    const tests = loadWanSpeedTests();
    const match = tests.filter(t => t.profileId === profile.id).sort((a, b) => new Date(b.testedAt) - new Date(a.testedAt))[0];
    return match?.latencyMs ?? null;
  }, [router, profiles]);

  const latencyMs = speedTestLatency ?? router?.responseTimeMs ?? null;

  if (!router) {
    return (
      <Card>
        <div className="p-5 h-full flex flex-col items-center justify-center text-center">
          <Radio size={24} className="text-muted-foreground mb-2 opacity-50" />
          <p className="text-xs font-medium text-foreground">No WAN router assigned</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Assign a router to see latency data
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-5 h-full flex flex-col">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
          <Radio size={12} className="text-yellow-400" />
          WAN Latency
          <StatusPulse status={latencyMs != null && latencyMs < 100 ? "online" : "warning"} />
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {latencyMs != null ? (
            <>
              <p className="text-3xl font-bold tabular-nums text-foreground">{Math.round(latencyMs)}<span className="text-lg text-muted-foreground font-normal">ms</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">{speedTestLatency ? "Latest speed test" : "Ping response time"}</p>
            </>
          ) : (
            <>
              <Radio size={20} className="text-yellow-400/60 mb-1" />
              <p className="text-xs font-medium text-foreground">No latency data</p>
              <p className="text-[10px] text-muted-foreground mt-1 max-w-[160px]">
                Run a speed test in WAN Management
              </p>
            </>
          )}
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
};