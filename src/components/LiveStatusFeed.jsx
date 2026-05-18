import { useState, useEffect, useRef } from "react";
import { Activity, Wifi, Camera, Monitor, Zap, Server, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";

const EVENT_TYPES = {
  DEVICE_UP:        { label: "DEVICE_UP",        color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40", dot: "bg-emerald-400" },
  DEVICE_DOWN:      { label: "DEVICE_DOWN",       color: "bg-red-500/20 text-red-400 border border-red-500/40",           dot: "bg-red-400" },
  ALARM_CRITICAL:   { label: "ALARM_CRITICAL",    color: "bg-red-500/20 text-red-400 border border-red-500/40",           dot: "bg-red-400" },
  ALARM_WARNING:    { label: "ALARM_WARNING",     color: "bg-amber-500/20 text-amber-400 border border-amber-500/40",     dot: "bg-amber-400" },
  PORT_UP:          { label: "PORT_UP",           color: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40",        dot: "bg-cyan-400" },
  FIRMWARE_UPDATE:  { label: "FIRMWARE_UPDATE",   color: "bg-blue-500/20 text-blue-400 border border-blue-500/40",       dot: "bg-blue-400" },
  SYSTEM_BOOT:      { label: "SYSTEM_BOOT",       color: "bg-purple-500/20 text-purple-400 border border-purple-500/40", dot: "bg-purple-400" },
};

const INITIAL_EVENTS = [
  { id: 1, time: "14:32:05", type: "DEVICE_UP",       message: "IP Camera 3 reconnected",    detail: "Network Camera" },
  { id: 2, time: "14:31:50", type: "ALARM_CRITICAL",  message: "AV Server 1 high CPU usage", detail: "AV Server" },
  { id: 3, time: "14:30:12", type: "PORT_UP",         message: "Port 7 link active",         detail: "Power IEC" },
  { id: 4, time: "14:29:48", type: "FIRMWARE_UPDATE", message: "Camera 5 firmware update started", detail: "Network Camera" },
  { id: 5, time: "14:28:10", type: "DEVICE_DOWN",     message: "IP Camera 2 disconnected",   detail: "Network Camera" },
  { id: 6, time: "14:27:35", type: "ALARM_WARNING",   message: "Power PDU temp high",        detail: "Power" },
  { id: 7, time: "14:26:01", type: "SYSTEM_BOOT",     message: "Network Monitor node 1 online", detail: "System" },
  { id: 8, time: "14:25:44", type: "PORT_UP",         message: "SW-Bridge port 3 link up",   detail: "Network" },
  { id: 9, time: "14:24:18", type: "DEVICE_UP",       message: "NAS-Synology back online",   detail: "Server" },
  { id: 10, time: "14:23:02", type: "ALARM_WARNING",  message: "UPS battery below 45%",      detail: "Power" },
];

const NEW_EVENTS = [
  { type: "DEVICE_UP",      message: "AP-Deck-Aft reconnected",    detail: "Network" },
  { type: "PORT_UP",        message: "SW-Saloon port 9 link up",   detail: "Network" },
  { type: "ALARM_WARNING",  message: "SW-Deck CPU spike 82%",      detail: "Network" },
  { type: "DEVICE_DOWN",    message: "Cam-Bridge-01 offline",      detail: "Network Camera" },
  { type: "FIRMWARE_UPDATE",message: "Router-WAN update available",detail: "Network" },
];

function pad(n) { return String(n).padStart(2, "0"); }
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function LiveStatusFeed() {
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const feedRef = useRef(null);
  const counterRef = useRef(11);
  const newEvtIdx = useRef(0);

  // Simulate new events every ~6s
  useEffect(() => {
    const t = setInterval(() => {
      const template = NEW_EVENTS[newEvtIdx.current % NEW_EVENTS.length];
      newEvtIdx.current++;
      const newEvent = { id: counterRef.current++, time: nowTime(), ...template };
      setEvents(prev => [newEvent, ...prev.slice(0, 19)]);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const metrics = [
    { label: "Online", value: "44", sub: "of 47 devices", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Offline", value: "3", sub: "devices down", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
    { label: "Alarms", value: "8", sub: "active alerts", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "WAN ↓", value: "47.2", sub: "Mbps download", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: "WAN ↑", value: "18.6", sub: "Mbps upload", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: "Latency", value: "38ms", sub: "WAN avg", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  ];

  const categoryStatus = [
    { label: "Network", icon: Wifi,    color: "text-cyan-400",   online: 16, total: 18 },
    { label: "Camera",  icon: Camera,  color: "text-purple-400", online: 13, total: 14 },
    { label: "AV",      icon: Monitor, color: "text-blue-400",   online: 8,  total: 9  },
    { label: "Power",   icon: Zap,     color: "text-amber-400",  online: 6,  total: 6  },
    { label: "Server",  icon: Server,  color: "text-emerald-400",online: 1,  total: 1  },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0 overflow-hidden rounded-2xl border border-white/8">
      {/* ── Left: Event Log ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:w-[340px] flex-shrink-0 bg-[#080d18] border-r border-white/6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-bold text-white uppercase tracking-widest">Event Log</p>
        </div>

        {/* Column labels */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/4">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest w-14 flex-shrink-0">Timestamp</p>
          <p className="text-[10px] text-slate-600 uppercase tracking-widest">Event Type</p>
        </div>

        {/* Feed */}
        <div ref={feedRef} className="flex-1 overflow-y-auto">
          {events.map((evt, i) => {
            const cfg = EVENT_TYPES[evt.type] || EVENT_TYPES.SYSTEM_BOOT;
            const isNew = i === 0;
            return (
              <div
                key={evt.id}
                className={`flex gap-3 px-4 py-3 border-b border-white/4 transition-all ${isNew ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-slate-500 w-14 flex-shrink-0">{evt.time}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.color}`}>[{cfg.label}]</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">{evt.message}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">({evt.detail})</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Metrics ──────────────────────────────────────────────── */}
      <div className="flex-1 bg-[#060912] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/6">
          <Activity size={13} className="text-cyan-400" />
          <p className="text-xs font-bold text-white uppercase tracking-widest">System Status</p>
          <span className="ml-auto text-[10px] text-slate-600 font-mono">M/Y Horizon</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {metrics.map(m => (
              <div key={m.label} className={`rounded-xl border p-3 ${m.bg}`}>
                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">{m.label}</p>
                <p className="text-[10px] text-slate-600">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Category health */}
          <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Category Health</p>
            <div className="space-y-2.5">
              {categoryStatus.map(cat => {
                const pct = Math.round((cat.online / cat.total) * 100);
                return (
                  <div key={cat.label} className="flex items-center gap-3">
                    <cat.icon size={13} className={cat.color} />
                    <span className="text-xs text-slate-400 w-16 flex-shrink-0">{cat.label}</span>
                    <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 w-12 text-right">{cat.online}/{cat.total}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WAN */}
          <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">WAN · Starlink VSAT</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <ArrowDownToLine size={12} className="text-cyan-400" />
                <div>
                  <p className="text-sm font-bold text-cyan-400">47.2 <span className="text-xs font-normal text-slate-500">Mbps</span></p>
                  <p className="text-[10px] text-slate-600">Download</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpFromLine size={12} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-emerald-400">18.6 <span className="text-xs font-normal text-slate-500">Mbps</span></p>
                  <p className="text-[10px] text-slate-600">Upload</p>
                </div>
              </div>
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-600 border-t border-white/4 pt-2">
              <span>Latency <span className="text-emerald-400 font-mono">38ms</span></span>
              <span>Loss <span className="text-emerald-400 font-mono">0.1%</span></span>
              <span>Uptime <span className="text-slate-300 font-mono">99.7%</span></span>
            </div>
          </div>

          {/* Active alarms summary */}
          <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <AlertTriangle size={10} className="text-amber-400" /> Active Alarms
            </p>
            <div className="space-y-1.5">
              {[
                { title: "Cam-Bridge-01 offline", sev: "critical" },
                { title: "SW-Deck-Lower CPU >80%", sev: "warning" },
                { title: "WAN speed degraded", sev: "warning" },
                { title: "UPS battery at 42%", sev: "warning" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.sev === "critical" ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className="text-slate-400 truncate">{a.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}