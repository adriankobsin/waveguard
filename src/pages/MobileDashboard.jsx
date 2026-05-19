import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, WifiOff, AlertTriangle, Signal, Gauge,
  Camera, Wrench, RefreshCw, ChevronDown, ChevronUp, X, Monitor
} from "lucide-react";

const REFRESH_INTERVAL = 30000;

const MOCK_DATA = {
  allOk: false,
  offlineDevices: [
    { id: "1", name: "Cam-Bridge-01", ip: "192.168.10.51", since: "14m" },
    { id: "2", name: "AV-Proc-Saloon", ip: "192.168.10.22", since: "2h" },
    { id: "3", name: "SW-Deck-Lower", ip: "192.168.10.5", since: "5m" },
  ],
  alarms: [
    { id: "a1", title: "Cam-Bridge-01 offline", severity: "critical", time: "14m ago" },
    { id: "a2", title: "SW-Deck-Lower CPU >80%", severity: "warning", time: "3h ago" },
    { id: "a3", title: "WAN degraded (12 Mbps)", severity: "warning", time: "6h ago" },
  ],
  network: {
    switches: [
      { name: "SW-Bridge", ping: 3, status: "online" },
      { name: "SW-Saloon", ping: 8, status: "online" },
      { name: "SW-Deck-Lower", ping: 180, status: "warning" },
      { name: "SW-Engine", ping: 5, status: "online" },
    ],
  },
  wan: { speed: 24.3, isp: "Starlink", status: "online" },
  overduePM: 2,
  cameras: [
    { id: "c1", name: "Bridge Cam", thumb: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=300&h=200&fit=crop", online: true },
    { id: "c2", name: "Deck Cam", thumb: "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=300&h=200&fit=crop", online: true },
    { id: "c3", name: "Bridge-01", thumb: null, online: false },
  ],
};

function PingBadge({ ms }) {
  const color = ms < 10 ? "text-green-400 bg-green-500/15" : ms < 50 ? "text-yellow-400 bg-yellow-500/15" : "text-red-400 bg-red-500/15";
  return <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${color}`}>{ms}ms</span>;
}

function ExpandableCard({ title, icon: Icon, iconColor, badge, badgeColor, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-secondary/50 border border-border/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left active:bg-secondary/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{title}</p>
            {badge !== undefined && (
              <span className={`text-xs font-bold ${badgeColor}`}>{badge}</span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/30 pt-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CameraModal({ cam, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white">
          <X size={24} />
        </button>
        <p className="text-white font-semibold mb-3">{cam.name}</p>
        {cam.thumb ? (
          <img src={cam.thumb} alt={cam.name} className="w-full rounded-xl" />
        ) : (
          <div className="w-full aspect-video bg-secondary rounded-xl flex items-center justify-center">
            <WifiOff size={32} className="text-muted-foreground" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function MobileDashboard() {
  const navigate = useNavigate();
  const [data] = useState(MOCK_DATA);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCam, setSelectedCam] = useState(null);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); setLastRefresh(new Date()); }, 1000);
  };

  useEffect(() => {
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const offlineCount = data.offlineDevices.length;
  const criticalAlarms = data.alarms.filter(a => a.severity === "critical").length;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      {/* Camera Modal */}
      <AnimatePresence>
        {selectedCam && <CameraModal cam={selectedCam} onClose={() => setSelectedCam(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className={`sticky top-0 z-10 px-4 py-3 ${offlineCount > 0 ? "bg-red-900/90" : "bg-green-900/90"} backdrop-blur-md border-b border-border/50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {offlineCount > 0
              ? <WifiOff size={20} className="text-red-300" />
              : <CheckCircle2 size={20} className="text-green-300" />
            }
            <div>
              <p className="font-bold text-white text-sm">
                {offlineCount > 0 ? `${offlineCount} Offline` : "All Systems OK"}
              </p>
              <p className="text-xs text-white/60">M/Y Horizon · {lastRefresh.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 active:bg-white/20 transition-colors text-xs text-white/80"
            >
              <Monitor size={12} /> Desktop
            </button>
            <button
              onClick={refresh}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
            >
              <RefreshCw size={14} className={`text-white ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {[
          { label: `${offlineCount} Offline`, color: offlineCount > 0 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30" },
          { label: `${criticalAlarms} Critical`, color: criticalAlarms > 0 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-secondary text-muted-foreground border-border" },
          { label: `${data.overduePM} Overdue PM`, color: data.overduePM > 0 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-secondary text-muted-foreground border-border" },
          { label: `WAN ${data.wan.speed} Mbps`, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
        ].map(pill => (
          <span key={pill.label} className={`text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 ${pill.color}`}>
            {pill.label}
          </span>
        ))}
      </div>

      {/* Cards */}
      <div className="px-4 space-y-3 pb-8">

        {/* Offline Devices */}
        <ExpandableCard
          title="Offline Devices"
          icon={WifiOff}
          iconColor="bg-red-500/20 text-red-400"
          badge={`${offlineCount} devices`}
          badgeColor="text-red-400"
          defaultOpen={offlineCount > 0}
        >
          <div className="space-y-2">
            {data.offlineDevices.map(dev => (
              <div key={dev.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{dev.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{dev.ip}</p>
                </div>
                <span className="text-xs text-red-400">{dev.since} ago</span>
              </div>
            ))}
          </div>
        </ExpandableCard>

        {/* Alarms */}
        <ExpandableCard
          title="Active Alarms"
          icon={AlertTriangle}
          iconColor="bg-yellow-500/20 text-yellow-400"
          badge={`${data.alarms.length} open`}
          badgeColor="text-yellow-400"
          defaultOpen={criticalAlarms > 0}
        >
          <div className="space-y-2">
            {data.alarms.map(alarm => (
              <div key={alarm.id} className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${alarm.severity === "critical" ? "bg-red-500" : "bg-yellow-500"}`} />
                <div>
                  <p className="text-sm text-foreground">{alarm.title}</p>
                  <p className="text-xs text-muted-foreground">{alarm.time}</p>
                </div>
              </div>
            ))}
          </div>
        </ExpandableCard>

        {/* Network Health */}
        <ExpandableCard
          title="Network Health"
          icon={Signal}
          iconColor="bg-cyan-500/20 text-cyan-400"
          badge="4 switches"
          badgeColor="text-cyan-400"
          defaultOpen
        >
          <div className="space-y-2.5">
            {data.network.switches.map(sw => (
              <div key={sw.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${sw.status === "online" ? "bg-green-500" : sw.status === "warning" ? "bg-yellow-500" : "bg-red-500"}`} />
                  <span className="text-sm text-foreground">{sw.name}</span>
                </div>
                <PingBadge ms={sw.ping} />
              </div>
            ))}
          </div>
        </ExpandableCard>

        {/* WAN */}
        <div className="bg-secondary/50 border border-border/50 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <Gauge size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">WAN — {data.wan.isp}</p>
            <p className="text-xs text-muted-foreground">↓ {data.wan.speed} Mbps</p>
          </div>
          <span className={`w-2 h-2 rounded-full ${data.wan.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
        </div>

        {/* Overdue PM */}
        {data.overduePM > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 flex-shrink-0">
              <Wrench size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{data.overduePM} Overdue Tasks</p>
              <p className="text-xs text-muted-foreground">Tap to view maintenance schedule</p>
            </div>
          </div>
        )}

        {/* Camera Quick-View */}
        <ExpandableCard
          title="Camera Quick-View"
          icon={Camera}
          iconColor="bg-purple-500/20 text-purple-400"
          badge={`${data.cameras.filter(c => c.online).length} online`}
          badgeColor="text-purple-400"
        >
          <div className="grid grid-cols-2 gap-2">
            {data.cameras.map(cam => (
              <button
                key={cam.id}
                onClick={() => setSelectedCam(cam)}
                className="relative rounded-xl overflow-hidden aspect-video bg-secondary active:opacity-80 transition-opacity"
              >
                {cam.online && cam.thumb ? (
                  <img src={cam.thumb} alt={cam.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <WifiOff size={20} className="text-muted-foreground" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                  <p className="text-xs text-white truncate">{cam.name}</p>
                </div>
                <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${cam.online ? "bg-green-500" : "bg-red-500"}`} />
              </button>
            ))}
          </div>
        </ExpandableCard>

      </div>
    </div>
  );
}