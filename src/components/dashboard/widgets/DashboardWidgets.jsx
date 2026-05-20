import {
  Wifi, Camera, Monitor, Zap, AlertTriangle,
  WifiOff, Globe, BarChart3, Clock, Bot,
  Sliders, Lightbulb
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import StatusPulse from "../../StatusPulse";

const TRAFFIC = Array.from({ length: 48 }, (_, i) => ({
  time: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
  inMbps: Math.round((Math.random() * 45 + 8) * 10) / 10,
  outMbps: Math.round((Math.random() * 30 + 5) * 10) / 10,
}));

const CRITICAL_ALARMS = [
  { id: "c1", title: "Cam-Bridge-01 offline", time: "14m ago" },
  { id: "c2", title: "Core switch unreachable", time: "22m ago" },
];

const WARNING_ALARMS = [
  { id: "w1", title: "SW-Deck-Lower CPU >80%", time: "3h ago" },
  { id: "w2", title: "WAN speed degraded (12 Mbps)", time: "6h ago" },
  { id: "w3", title: "UPS battery at 42%", time: "1d ago" },
];

const RECENT_EVENTS = [
  { id: "e1", text: "User Tech logged in", time: "2m ago" },
  { id: "e2", text: "SNMP poll completed", time: "15m ago" },
  { id: "e3", text: "Backup scheduled", time: "1h ago" },
];

const AI_RECOMMENDATIONS = [
  { id: "r1", text: "Replace UPS battery — below 45% for 6h", priority: "high" },
  { id: "r2", text: "Update Crestron firmware on CP4-Deck", priority: "medium" },
];

const OFFLINE_DEVICES = [
  { name: "Cam-Bridge-01", ip: "192.168.10.41" },
  { name: "AP-Guest-03", ip: "192.168.10.88" },
  { name: "DMX-Node-02", ip: "192.168.10.202" },
];

function WidgetShell({ title, icon: Icon, iconClass = "text-cyan-400", badge, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 h-full flex flex-col shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2 shrink-0">
        {Icon && <Icon size={14} className={iconClass} />}
        {title}
        {badge != null && (
          <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </h3>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
          {p.unit || ""}
        </p>
      ))}
    </div>
  );
};

export const WIDGET_TYPES = {
  network_traffic: {
    id: "network_traffic",
    name: "Network traffic",
    description: "24-hour inbound and outbound traffic",
    icon: BarChart3,
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 6 },
    defaultSize: { w: 6, h: 4 },
  },
  critical_alarms: {
    id: "critical_alarms",
    name: "Critical alarms",
    description: "Active critical severity alarms",
    icon: AlertTriangle,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 6 },
    defaultSize: { w: 3, h: 3 },
  },
  warning_alarms: {
    id: "warning_alarms",
    name: "Warning alarms",
    description: "Active warning severity alarms",
    icon: AlertTriangle,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 6 },
    defaultSize: { w: 3, h: 3 },
  },
  network: {
    id: "network",
    name: "Network",
    description: "Network device health summary",
    icon: Wifi,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    defaultSize: { w: 3, h: 3 },
  },
  av: {
    id: "av",
    name: "AV",
    description: "AV systems online status",
    icon: Monitor,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    defaultSize: { w: 3, h: 3 },
  },
  control: {
    id: "control",
    name: "Control",
    description: "Control processors and touch panels",
    icon: Sliders,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    defaultSize: { w: 3, h: 3 },
  },
  lighting: {
    id: "lighting",
    name: "Lighting",
    description: "Lighting zones and scenes",
    icon: Lightbulb,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    defaultSize: { w: 3, h: 3 },
  },
  cctv: {
    id: "cctv",
    name: "CCTV",
    description: "Camera online counts",
    icon: Camera,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    defaultSize: { w: 3, h: 3 },
  },
  ups_power: {
    id: "ups_power",
    name: "UPS / power",
    description: "UPS and power distribution status",
    icon: Zap,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    defaultSize: { w: 3, h: 3 },
  },
  wan_internet: {
    id: "wan_internet",
    name: "WAN / internet",
    description: "WAN link status and throughput",
    icon: Globe,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    defaultSize: { w: 3, h: 3 },
  },
  offline_devices: {
    id: "offline_devices",
    name: "Offline devices",
    description: "Devices currently unreachable",
    icon: WifiOff,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 5 },
    defaultSize: { w: 3, h: 3 },
  },
  recent_events: {
    id: "recent_events",
    name: "Recent events",
    description: "Latest platform events",
    icon: Clock,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 5 },
    defaultSize: { w: 3, h: 3 },
  },
  ai_recommendations: {
    id: "ai_recommendations",
    name: "AI recommendations",
    description: "Suggested actions from AI analysis",
    icon: Bot,
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 5 },
    defaultSize: { w: 3, h: 3 },
  },
};

function CategoryWidget({ label, online, total, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={15} className={color} />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-foreground font-medium">{label}</span>
          <span className="text-muted-foreground">{online}/{total}</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${(online / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function NetworkTrafficWidget() {
  return (
    <WidgetShell title="Network traffic" icon={BarChart3}>
      <ResponsiveContainer width="100%" height="100%" minHeight={160}>
        <AreaChart data={TRAFFIC} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={7} />
          <YAxis tick={{ fontSize: 9 }} unit="M" />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="inMbps" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="In" unit=" Mbps" dot={false} />
          <Area type="monotone" dataKey="outMbps" stroke="hsl(var(--status-online))" fill="hsl(var(--status-online) / 0.15)" name="Out" unit=" Mbps" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </WidgetShell>
  );
}

function AlarmListWidget({ title, alarms, severity }) {
  const iconClass = severity === "critical" ? "text-red-400" : "text-amber-400";
  return (
    <WidgetShell title={title} icon={AlertTriangle} iconClass={iconClass} badge={alarms.length}>
      <div className="space-y-3">
        {alarms.map((a) => (
          <div key={a.id} className="flex items-start gap-2">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${severity === "critical" ? "bg-red-400" : "bg-amber-400"}`} />
            <div>
              <p className="text-xs font-medium text-foreground">{a.title}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock size={9} /> {a.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function CriticalAlarmsWidget() {
  return <AlarmListWidget title="Critical alarms" alarms={CRITICAL_ALARMS} severity="critical" />;
}

export function WarningAlarmsWidget() {
  return <AlarmListWidget title="Warning alarms" alarms={WARNING_ALARMS} severity="warning" />;
}

export function NetworkWidget() {
  return (
    <WidgetShell title="Network" icon={Wifi}>
      <CategoryWidget label="Switches & routers" online={16} total={18} icon={Wifi} color="text-cyan-400" />
    </WidgetShell>
  );
}

export function AvWidget() {
  return (
    <WidgetShell title="AV" icon={Monitor}>
      <CategoryWidget label="AV Systems" online={8} total={9} icon={Monitor} color="text-blue-400" />
    </WidgetShell>
  );
}

export function ControlWidget() {
  return (
    <WidgetShell title="Control" icon={Sliders}>
      <CategoryWidget label="Control processors" online={4} total={4} icon={Sliders} color="text-purple-400" />
    </WidgetShell>
  );
}

export function LightingWidget() {
  return (
    <WidgetShell title="Lighting" icon={Lightbulb}>
      <CategoryWidget label="Lighting zones" online={12} total={12} icon={Lightbulb} color="text-amber-400" />
    </WidgetShell>
  );
}

export function CctvWidget() {
  return (
    <WidgetShell title="CCTV" icon={Camera}>
      <CategoryWidget label="Cameras" online={13} total={14} icon={Camera} color="text-purple-400" />
    </WidgetShell>
  );
}

export function UpsPowerWidget() {
  return (
    <WidgetShell title="UPS / power" icon={Zap} iconClass="text-amber-400">
      <div className="space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Main UPS</span><span className="text-emerald-400 font-medium">Online</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Battery</span><span className="text-amber-400 font-medium">42%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Load</span><span className="text-foreground font-medium">38%</span></div>
      </div>
    </WidgetShell>
  );
}

export function WanInternetWidget() {
  return (
    <WidgetShell title="WAN / internet" icon={Globe}>
      <div className="space-y-2 text-xs mb-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Status</span>
          <StatusPulse status="online" />
        </div>
        <div className="flex justify-between"><span className="text-muted-foreground">↓ Down</span><span className="text-primary font-bold">47.2 Mbps</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">↑ Up</span><span className="text-emerald-500 font-bold">18.6 Mbps</span></div>
      </div>
    </WidgetShell>
  );
}

export function OfflineDevicesWidget() {
  return (
    <WidgetShell title="Offline devices" icon={WifiOff} iconClass="text-red-400" badge={OFFLINE_DEVICES.length}>
      <div className="space-y-2">
        {OFFLINE_DEVICES.map((d) => (
          <div key={d.ip} className="flex justify-between text-xs py-1 border-b border-border/50 last:border-0">
            <span className="text-foreground">{d.name}</span>
            <span className="text-muted-foreground font-mono">{d.ip}</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function RecentEventsWidget() {
  return (
    <WidgetShell title="Recent events" icon={Clock}>
      <div className="space-y-2">
        {RECENT_EVENTS.map((e) => (
          <div key={e.id} className="text-xs">
            <p className="text-foreground">{e.text}</p>
            <p className="text-muted-foreground text-[10px]">{e.time}</p>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function AiRecommendationsWidget() {
  return (
    <WidgetShell title="AI recommendations" icon={Bot} iconClass="text-primary">
      <div className="space-y-2">
        {AI_RECOMMENDATIONS.map((r) => (
          <div key={r.id} className="p-2 rounded-lg bg-secondary border border-border text-xs">
            <span className={`text-[10px] uppercase font-semibold ${r.priority === "high" ? "text-red-400" : "text-amber-400"}`}>{r.priority}</span>
            <p className="text-foreground mt-1">{r.text}</p>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export const WIDGET_COMPONENTS = {
  network_traffic: NetworkTrafficWidget,
  critical_alarms: CriticalAlarmsWidget,
  warning_alarms: WarningAlarmsWidget,
  network: NetworkWidget,
  av: AvWidget,
  control: ControlWidget,
  lighting: LightingWidget,
  cctv: CctvWidget,
  ups_power: UpsPowerWidget,
  wan_internet: WanInternetWidget,
  offline_devices: OfflineDevicesWidget,
  recent_events: RecentEventsWidget,
  ai_recommendations: AiRecommendationsWidget,
};
