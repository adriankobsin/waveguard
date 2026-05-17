import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Network, Wifi, Camera, Monitor, Zap, Server,
  Router as RouterIcon, Smartphone, Activity, CheckCircle2,
  AlertTriangle, WifiOff, Clock, BarChart2, Wrench, ChevronRight
} from "lucide-react";
import MetricSparkline from "@/components/MetricSparkline";

// Re-use same mock node list (in real app would be fetched by id)
const NODES = [
  { id: "core-sw",    label: "Core Switch",     type: "switch",  ip: "192.168.10.1",  status: "online",  vendor: "Cisco",     ports: 48, model: "Catalyst 2960X",   mac: "A8:4F:B1:02:11:AA", uptime: "47d 3h" },
  { id: "sw-bridge",  label: "SW-Bridge",       type: "switch",  ip: "192.168.10.2",  status: "online",  vendor: "Cisco",     ports: 24, model: "SG350-28",          mac: "A8:4F:B1:02:22:BB", uptime: "47d 3h" },
  { id: "sw-saloon",  label: "SW-Saloon",       type: "switch",  ip: "192.168.10.3",  status: "online",  vendor: "Cisco",     ports: 24, model: "SG350-28",          mac: "A8:4F:B1:02:33:CC", uptime: "47d 3h" },
  { id: "sw-deck",    label: "SW-Deck-Lower",   type: "switch",  ip: "192.168.10.5",  status: "warning", vendor: "Cisco",     ports: 16, model: "SG250-18",          mac: "A8:4F:B1:02:44:DD", uptime: "12d 7h" },
  { id: "sw-engine",  label: "SW-Engine",       type: "switch",  ip: "192.168.10.6",  status: "online",  vendor: "Cisco",     ports: 16, model: "SG250-18",          mac: "A8:4F:B1:02:55:EE", uptime: "47d 3h" },
  { id: "ap-bridge",  label: "AP-Bridge",       type: "ap",      ip: "192.168.10.20", status: "online",  vendor: "Ubiquiti",  model: "UAP-AC-Pro",        mac: "78:8A:20:4C:AA:01", uptime: "22d 14h" },
  { id: "ap-deck",    label: "AP-Deck",         type: "ap",      ip: "192.168.10.21", status: "online",  vendor: "Ubiquiti",  model: "UAP-AC-Pro",        mac: "78:8A:20:4C:AA:02", uptime: "22d 14h" },
  { id: "qsys-core",  label: "Q-SYS Core",      type: "av",      ip: "192.168.10.30", status: "online",  vendor: "Q-SYS",     model: "Core 110f",         mac: "00:60:E1:01:AA:10", uptime: "47d 3h" },
  { id: "qsys-amp",   label: "Q-SYS Amp",       type: "av",      ip: "192.168.10.31", status: "online",  vendor: "Q-SYS",     model: "CX-Q 4K8",          mac: "00:60:E1:01:AA:11", uptime: "47d 3h" },
  { id: "cam-bridge", label: "Cam-Bridge-01",   type: "camera",  ip: "192.168.10.51", status: "offline", vendor: "Dahua",     model: "SD49425XB-HNR",     mac: "E0:50:8B:01:BB:01", uptime: "—" },
  { id: "cam-saloon", label: "Cam-Saloon-01",   type: "camera",  ip: "192.168.10.52", status: "online",  vendor: "Dahua",     model: "IPC-HDW3849H",      mac: "E0:50:8B:01:BB:02", uptime: "20d 8h" },
  { id: "cam-deck1",  label: "Cam-Deck-01",     type: "camera",  ip: "192.168.10.53", status: "online",  vendor: "Dahua",     model: "IPC-HDW3849H",      mac: "E0:50:8B:01:BB:03", uptime: "20d 8h" },
  { id: "cam-deck2",  label: "Cam-Deck-02",     type: "camera",  ip: "192.168.10.54", status: "online",  vendor: "Dahua",     model: "IPC-HDW3849H",      mac: "E0:50:8B:01:BB:04", uptime: "20d 8h" },
  { id: "nas",        label: "NAS-Synology",    type: "server",  ip: "192.168.10.80", status: "online",  vendor: "Synology",  model: "DS1522+",           mac: "00:11:32:AA:11:01", uptime: "47d 3h" },
  { id: "ups-main",   label: "UPS-Main",        type: "ups",     ip: "192.168.10.90", status: "online",  vendor: "APC",       model: "SMT1500RM2U",       mac: "00:C0:B7:01:CC:01", uptime: "47d 3h" },
  { id: "ups-av",     label: "UPS-AV",          type: "ups",     ip: "192.168.10.91", status: "online",  vendor: "APC",       model: "SMT750RM2U",        mac: "00:C0:B7:01:CC:02", uptime: "47d 3h" },
  { id: "starlink",   label: "Starlink Router", type: "router",  ip: "192.168.100.1", status: "online",  vendor: "SpaceX",    model: "Gen3 Dish",         mac: "98:DE:D0:01:11:FF", uptime: "14d 2h" },
  { id: "tablet-br",  label: "Bridge Tablet",   type: "endpoint",ip: "192.168.10.110",status: "online",  vendor: "Apple",     model: "iPad Pro 12.9",     mac: "A4:C3:F0:01:EE:01", uptime: "Dynamic" },
];

const TYPE_CONFIG = {
  switch:   { icon: Network,     color: "text-cyan-400",   bg: "bg-cyan-500/20"   },
  router:   { icon: RouterIcon,  color: "text-blue-400",   bg: "bg-blue-500/20"   },
  ap:       { icon: Wifi,        color: "text-indigo-400", bg: "bg-indigo-500/20" },
  camera:   { icon: Camera,      color: "text-purple-400", bg: "bg-purple-500/20" },
  av:       { icon: Monitor,     color: "text-orange-400", bg: "bg-orange-500/20" },
  server:   { icon: Server,      color: "text-green-400",  bg: "bg-green-500/20"  },
  ups:      { icon: Zap,         color: "text-yellow-400", bg: "bg-yellow-500/20" },
  endpoint: { icon: Smartphone,  color: "text-gray-400",   bg: "bg-gray-500/20"   },
};

const RECENT_EVENTS = [
  { time: "14m ago", msg: "ICMP ping timeout (3 consecutive)", type: "error" },
  { time: "2h ago",  msg: "SNMP polling resumed", type: "success" },
  { time: "6h ago",  msg: "Link state changed: up → down", type: "error" },
  { time: "1d ago",  msg: "Configuration backup completed", type: "info" },
  { time: "3d ago",  msg: "Firmware version detected: 2.820.0000", type: "info" },
];

export default function EquipmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const node = NODES.find(n => n.id === id);

  if (!node) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Device not found.</p>
        <button onClick={() => navigate("/topology")} className="mt-4 text-primary text-sm">← Back to Topology</button>
      </div>
    );
  }

  const cfg = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.endpoint;
  const StatusIcon = node.status === "online" ? CheckCircle2 : node.status === "offline" ? WifiOff : AlertTriangle;
  const statusColor = node.status === "online" ? "text-green-400" : node.status === "offline" ? "text-red-400" : "text-yellow-400";
  const statusBg = node.status === "online" ? "bg-green-500/10 border-green-500/25" : node.status === "offline" ? "bg-red-500/10 border-red-500/25" : "bg-yellow-500/10 border-yellow-500/25";

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/topology" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Network size={11} /> Topology
        </Link>
        <ChevronRight size={10} />
        <span className="text-foreground">{node.label}</span>
      </div>

      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
            <cfg.icon size={26} className={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-lg font-bold text-foreground">{node.label}</h1>
                <p className="text-sm text-muted-foreground">{node.vendor} · {node.model}</p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${statusBg} ${statusColor}`}>
                <StatusIcon size={14} />
                {node.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: "IP Address",  value: node.ip,     mono: true },
            { label: "MAC Address", value: node.mac,    mono: true },
            { label: "Uptime",      value: node.uptime, mono: false },
            { label: "Type",        value: node.type,   mono: false, capitalize: true },
          ].map(f => (
            <div key={f.label} className="bg-secondary/50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">{f.label}</p>
              <p className={`text-sm font-semibold text-foreground ${f.mono ? "font-mono" : ""} ${f.capitalize ? "capitalize" : ""}`}>{f.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Traffic chart (only for switches / routers / APs) */}
      {["switch", "router", "ap"].includes(node.type) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={14} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">24h Traffic</h2>
          </div>
          <MetricSparkline height={160} />
        </motion.div>
      )}

      {/* Event log */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Recent Events</h2>
        </div>
        <div className="space-y-2.5">
          {RECENT_EVENTS.map((ev, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ev.type === "error" ? "bg-red-500" : ev.type === "success" ? "bg-green-500" : "bg-blue-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{ev.msg}</p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                <Clock size={10} />{ev.time}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2">
        {[
          { label: "Ping Device", icon: Activity },
          { label: "Schedule Maintenance", icon: Wrench },
          { label: "View SNMP Ports", icon: Network },
        ].map(a => (
          <button key={a.label} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            <a.icon size={13} />{a.label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}