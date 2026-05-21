import { Link } from "react-router-dom";
import {
  Wifi, Camera, Monitor, Zap, AlertTriangle, CheckCircle2,
  WifiOff, Activity, Globe, BarChart3, Server, Clock, Bot,
  Sliders, Lightbulb, Radio, Loader2, Cable, Unplug, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import StatusPulse from "../../StatusPulse";
import { useSystemData } from "@/contexts/SystemDataContext";

function WidgetLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px] text-muted-foreground text-xs gap-2">
      <Loader2 size={14} className="animate-spin" />
      Loading…
    </div>
  );
}

function WidgetEmpty({ message = "No data" }) {
  return (
    <p className="text-xs text-muted-foreground text-center py-4">{message}</p>
  );
}

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
    description: "Equipment health and SNMP switch fleet status",
    icon: Wifi,
    minSize: { w: 2, h: 3 },
    maxSize: { w: 6, h: 6 },
    defaultSize: { w: 3, h: 4 },
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
  const pct = total > 0 ? (online / total) * 100 : 0;
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
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function NetworkTrafficWidget() {
  const { snapshot, loading } = useSystemData();
  const traffic = snapshot?.traffic || [];
  if (loading && !snapshot) return <WidgetShell title="Network traffic" icon={BarChart3}><WidgetLoading /></WidgetShell>;
  return (
    <WidgetShell title="Network traffic" icon={BarChart3}>
      <ResponsiveContainer width="100%" height="100%" minHeight={160}>
        <AreaChart data={traffic} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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

function AlarmListWidget({ title, alarms, severity, emptyMessage }) {
  const iconClass = severity === "critical" ? "text-red-400" : "text-amber-400";
  return (
    <WidgetShell title={title} icon={AlertTriangle} iconClass={iconClass} badge={alarms.length || undefined}>
      <div className="space-y-3">
        {alarms.length === 0 && <WidgetEmpty message={emptyMessage} />}
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
  const { snapshot, loading } = useSystemData();
  if (loading && !snapshot) return <WidgetShell title="Critical alarms" icon={AlertTriangle} iconClass="text-red-400"><WidgetLoading /></WidgetShell>;
  return (
    <AlarmListWidget
      title="Critical alarms"
      alarms={snapshot?.criticalAlarms || []}
      severity="critical"
      emptyMessage="No critical alarms"
    />
  );
}

export function WarningAlarmsWidget() {
  const { snapshot, loading } = useSystemData();
  if (loading && !snapshot) return <WidgetShell title="Warning alarms" icon={AlertTriangle} iconClass="text-amber-400"><WidgetLoading /></WidgetShell>;
  return (
    <AlarmListWidget
      title="Warning alarms"
      alarms={snapshot?.warningAlarms || []}
      severity="warning"
      emptyMessage="No warnings"
    />
  );
}

function CategoryStatusWidget({ title, icon, categoryKey, iconColor }) {
  const { snapshot, loading } = useSystemData();
  const cat = snapshot?.categories?.[categoryKey];
  if (loading && !snapshot) return <WidgetShell title={title} icon={icon}><WidgetLoading /></WidgetShell>;
  if (!cat?.total) return <WidgetShell title={title} icon={icon}><WidgetEmpty message="No devices in this category" /></WidgetShell>;
  return (
    <WidgetShell title={title} icon={icon}>
      <CategoryWidget label={cat.label} online={cat.online} total={cat.total} icon={icon} color={iconColor} />
    </WidgetShell>
  );
}

const HEALTH_DOT = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  unknown: "bg-muted-foreground",
  disabled: "bg-muted-foreground/50",
};

function SnmpStat({ label, value, valueClass = "text-foreground" }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

export function NetworkWidget() {
  const { snapshot, loading } = useSystemData();
  const cat = snapshot?.categories?.network;
  const snmp = snapshot?.snmpFleet;
  const hasEquipment = (cat?.total || 0) > 0;
  const hasSnmp = (snmp?.registered || 0) > 0;

  if (loading && !snapshot) {
    return (
      <WidgetShell title="Network" icon={Wifi}>
        <WidgetLoading />
      </WidgetShell>
    );
  }

  if (!hasEquipment && !hasSnmp) {
    return (
      <WidgetShell title="Network" icon={Wifi}>
        <WidgetEmpty message="No network devices or SNMP switches" />
        <Link
          to="/snmp"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Switch Management <ArrowRight size={11} />
        </Link>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      title="Network"
      icon={Wifi}
      badge={hasSnmp ? `${snmp.registered} SW` : undefined}
    >
      <div className="space-y-3">
        {hasEquipment && (
          <CategoryWidget
            label={cat.label}
            online={cat.online}
            total={cat.total}
            icon={Wifi}
            color="text-cyan-400"
          />
        )}

        {hasSnmp ? (
          <div className={hasEquipment ? "border-t border-border/60 pt-3" : ""}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Server size={10} className="text-primary" />
              SNMP switch fleet
            </p>
            <div className="space-y-1 mb-2">
              <SnmpStat label="Registered" value={snmp.registered} />
              <SnmpStat
                label="Polled"
                value={`${snmp.polledCount}/${snmp.registered}`}
                valueClass={snmp.polledCount < snmp.registered ? "text-amber-500" : "text-foreground"}
              />
              <SnmpStat
                label="Ports up / down"
                value={`${snmp.portsUp} / ${snmp.portsDown}`}
                valueClass={snmp.portsDown > 0 ? "text-amber-500" : "text-emerald-500"}
              />
              <SnmpStat
                label="Active links"
                value={snmp.activeConnections}
                valueClass="text-emerald-500"
              />
              <SnmpStat
                label="Cable faults"
                value={snmp.cableFaults}
                valueClass={snmp.cableFaults > 0 ? "text-red-500 font-semibold" : "text-foreground"}
              />
              {(snmp.trafficInMbps > 0 || snmp.trafficOutMbps > 0) && (
                <SnmpStat
                  label="Switch traffic"
                  value={`↓${snmp.trafficInMbps} ↑${snmp.trafficOutMbps} Mbps`}
                />
              )}
              {snmp.poeWatts > 0 && (
                <SnmpStat label="PoE load" value={`${snmp.poeWatts} W`} valueClass="text-amber-500" />
              )}
            </div>

            {snmp.lastPollRelative && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-2">
                <Clock size={9} />
                Last SNMP poll {snmp.lastPollRelative}
              </p>
            )}

            <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
              {snmp.switches.map((sw) => (
                <Link
                  key={sw.id}
                  to="/snmp"
                  className="flex items-center gap-2 text-xs py-1 rounded-lg hover:bg-secondary/40 px-1 -mx-1 transition-colors group"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${HEALTH_DOT[sw.healthStatus] || HEALTH_DOT.unknown}`}
                    title={sw.healthLabel}
                  />
                  <span className="text-foreground truncate flex-1 group-hover:text-primary">
                    {sw.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {sw.lastPollAt
                      ? sw.portsTotal > 0
                        ? `${sw.portsUp}/${sw.portsTotal}`
                        : "—"
                      : "—"}
                  </span>
                  {sw.cableFaults > 0 && (
                    <Unplug size={10} className="text-red-500 shrink-0" title={`${sw.cableFaults} fault(s)`} />
                  )}
                </Link>
              ))}
            </div>

            {snmp.topFaults?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
                {snmp.topFaults.map((f, i) => (
                  <p key={i} className="text-[10px] text-red-500/90 truncate">
                    {f.switchName} P{f.portIndex} → {f.connectedDevice || "unknown"}
                  </p>
                ))}
              </div>
            )}

            <Link
              to="/snmp"
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Cable size={10} />
              Connections & poll
              <ArrowRight size={10} />
            </Link>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Register switches in{" "}
            <Link to="/snmp" className="text-primary hover:underline">
              Switch Management
            </Link>{" "}
            for port and cable monitoring.
          </p>
        )}
      </div>
    </WidgetShell>
  );
}

export function AvWidget() {
  return <CategoryStatusWidget title="AV" icon={Monitor} categoryKey="av" iconColor="text-blue-400" />;
}

export function ControlWidget() {
  return <CategoryStatusWidget title="Control" icon={Sliders} categoryKey="control" iconColor="text-purple-400" />;
}

export function LightingWidget() {
  return <CategoryStatusWidget title="Lighting" icon={Lightbulb} categoryKey="lighting" iconColor="text-amber-400" />;
}

export function CctvWidget() {
  return <CategoryStatusWidget title="CCTV" icon={Camera} categoryKey="cctv" iconColor="text-purple-400" />;
}

export function UpsPowerWidget() {
  const { snapshot, loading } = useSystemData();
  const ups = snapshot?.ups;
  if (loading && !snapshot) return <WidgetShell title="UPS / power" icon={Zap} iconClass="text-amber-400"><WidgetLoading /></WidgetShell>;
  if (!ups) return <WidgetShell title="UPS / power" icon={Zap} iconClass="text-amber-400"><WidgetEmpty message="No UPS equipment registered" /></WidgetShell>;
  return (
    <WidgetShell title="UPS / power" icon={Zap} iconClass="text-amber-400">
      <div className="space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">{ups.name}</span><span className="text-emerald-400 font-medium">{ups.status}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Battery</span><span className={ups.battery < 50 ? "text-amber-400" : "text-foreground"} font-medium>{ups.battery}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Load</span><span className="text-foreground font-medium">{ups.load}%</span></div>
      </div>
    </WidgetShell>
  );
}

export function WanInternetWidget() {
  const { snapshot, loading } = useSystemData();
  const wan = snapshot?.wan;
  if (loading && !snapshot) return <WidgetShell title="WAN / internet" icon={Globe}><WidgetLoading /></WidgetShell>;
  const pulseStatus = wan?.status === "online" ? "online" : wan?.status === "offline" ? "offline" : "warning";
  return (
    <WidgetShell title="WAN / internet" icon={Globe}>
      <div className="space-y-2 text-xs mb-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{wan?.name || "WAN"}</span>
          <StatusPulse status={pulseStatus} />
        </div>
        <div className="flex justify-between"><span className="text-muted-foreground">↓ Down</span><span className="text-primary font-bold">{wan?.downloadMbps ?? 0} Mbps</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">↑ Up</span><span className="text-emerald-500 font-bold">{wan?.uploadMbps ?? 0} Mbps</span></div>
      </div>
    </WidgetShell>
  );
}

export function OfflineDevicesWidget() {
  const { snapshot, loading } = useSystemData();
  const offline = snapshot?.offlineDevices || [];
  if (loading && !snapshot) return <WidgetShell title="Offline devices" icon={WifiOff} iconClass="text-red-400"><WidgetLoading /></WidgetShell>;
  return (
    <WidgetShell title="Offline devices" icon={WifiOff} iconClass="text-red-400" badge={offline.length || undefined}>
      <div className="space-y-2">
        {offline.length === 0 && <WidgetEmpty message="All monitored devices online" />}
        {offline.map((d) => (
          <div key={d.id || d.ip} className="flex justify-between text-xs py-1 border-b border-border/50 last:border-0">
            <span className="text-foreground">{d.name}</span>
            <span className="text-muted-foreground font-mono">{d.ip}</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function RecentEventsWidget() {
  const { snapshot, loading } = useSystemData();
  const events = snapshot?.recentEvents || [];
  if (loading && !snapshot) return <WidgetShell title="Recent events" icon={Clock}><WidgetLoading /></WidgetShell>;
  return (
    <WidgetShell title="Recent events" icon={Clock}>
      <div className="space-y-2">
        {events.length === 0 && <WidgetEmpty message="No recent events" />}
        {events.map((e) => (
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
  const { snapshot, loading } = useSystemData();
  const recs = snapshot?.recommendations || [];
  if (loading && !snapshot) return <WidgetShell title="AI recommendations" icon={Bot} iconClass="text-primary"><WidgetLoading /></WidgetShell>;
  return (
    <WidgetShell title="AI recommendations" icon={Bot} iconClass="text-primary">
      <div className="space-y-2">
        {recs.length === 0 && <WidgetEmpty message="No recommendations — system healthy" />}
        {recs.map((r) => (
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
