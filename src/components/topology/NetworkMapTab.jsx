import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi, Camera, Monitor, Zap, Server, HardDrive,
  ChevronDown, ChevronRight, X, Cable, MapPin, Hash, Tag,
  FileText, Search, GitBranch, CheckCircle2, ArrowRight, Filter
} from "lucide-react";

// ─── Data (mirrors TopologyPage DEVICES / CABLES) ─────────────────────────────
const DEVICES = [
  { id: "router-wan",  name: "Router-WAN",      category: "Network", model: "MikroTik CCR2004-1G",  ip: "192.168.1.1",   location: "Bridge Rack",    serial: "MT220B0041",  condition: "Excellent", notes: "BGP + failover configured" },
  { id: "sw-bridge",   name: "SW-Bridge",        category: "Network", model: "Cisco CBS350-24T",     ip: "192.168.10.1",  location: "Bridge Rack",    serial: "FOC2241X0AB", condition: "Good",      notes: "Primary distribution switch" },
  { id: "sw-saloon",   name: "SW-Saloon",        category: "Network", model: "Cisco CBS350-16T",     ip: "192.168.10.2",  location: "Saloon Cabinet", serial: "FOC2241X0CD", condition: "Good",      notes: "" },
  { id: "sw-deck",     name: "SW-Deck-Lower",    category: "Network", model: "Cisco SG250-18",       ip: "192.168.10.5",  location: "Deck Cabinet",   serial: "FOC2131X0EF", condition: "Fair",      notes: "CPU spikes noted" },
  { id: "sw-engine",   name: "SW-Engine",        category: "Network", model: "Cisco SG250-18",       ip: "192.168.10.6",  location: "Engine Room",    serial: "FOC2131X0GH", condition: "Good",      notes: "" },
  { id: "ap-bridge",   name: "AP-Bridge",        category: "Network", model: "Ubiquiti UAP-AC-Pro",  ip: "192.168.10.20", location: "Bridge Mast",    serial: "UBQ2022A001", condition: "Good",      notes: "" },
  { id: "ap-deck",     name: "AP-Deck-Aft",      category: "Network", model: "Ubiquiti UAP-AC-Pro",  ip: "192.168.10.21", location: "Aft Deck",       serial: "UBQ2022A002", condition: "Good",      notes: "" },
  { id: "cam-bridge",  name: "Cam-Bridge-01",    category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.51", location: "Bridge Ext.",    serial: "DH2023051201",condition: "Fair",      notes: "PoE — requires port bounce" },
  { id: "cam-saloon",  name: "Cam-Saloon-01",    category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.52", location: "Saloon",         serial: "DH2023051202",condition: "Good",      notes: "" },
  { id: "cam-deck1",   name: "Cam-Deck-01",      category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.53", location: "Fore Deck",      serial: "DH2023051203",condition: "Good",      notes: "" },
  { id: "cam-deck2",   name: "Cam-Deck-02",      category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.54", location: "Aft Deck",       serial: "DH2023051204",condition: "Good",      notes: "" },
  { id: "av-proc",     name: "AV-Proc-Saloon",   category: "AV",      model: "Crestron NVX-350",     ip: "192.168.10.22", location: "Saloon AV Rack", serial: "CRE7462183",  condition: "Good",      notes: "4K HDR matrix" },
  { id: "av-matrix",   name: "AV-Matrix-Saloon", category: "AV",      model: "Kramer VS-88H",        ip: "192.168.10.23", location: "Saloon AV Rack", serial: "KRM1980041",  condition: "Good",      notes: "" },
  { id: "qsys-core",   name: "Q-SYS Core",       category: "AV",      model: "Q-SYS Core 110f",      ip: "192.168.10.30", location: "Bridge Rack",    serial: "QSC2021001",  condition: "Good",      notes: "Audio DSP main" },
  { id: "nas",         name: "NAS-Synology",      category: "Server",  model: "Synology DS1522+",     ip: "192.168.10.80", location: "Engine Room",    serial: "SYN2022001",  condition: "Good",      notes: "" },
  { id: "ups-main",    name: "UPS-Main",          category: "Power",   model: "APC Smart-UPS 3000VA", ip: "192.168.10.90", location: "Engine Room",    serial: "AS1720140893",condition: "Good",      notes: "Battery at 42%" },
  { id: "ups-av",      name: "UPS-AV",            category: "Power",   model: "APC Smart-UPS 750VA",  ip: "192.168.10.91", location: "Saloon AV Rack", serial: "AS1820140112",condition: "Good",      notes: "" },
];

const CABLES = [
  { id: "c01", label: "C-001", source: "router-wan", target: "sw-bridge",  type: "Cat6A",     notes: "Primary WAN uplink" },
  { id: "c02", label: "C-002", source: "sw-bridge",  target: "sw-saloon",  type: "Cat6A",     notes: "Trunk" },
  { id: "c03", label: "C-003", source: "sw-bridge",  target: "sw-deck",    type: "Cat6A",     notes: "Trunk" },
  { id: "c04", label: "C-004", source: "sw-bridge",  target: "sw-engine",  type: "Cat6A",     notes: "Trunk" },
  { id: "c05", label: "C-005", source: "sw-bridge",  target: "ap-bridge",  type: "Cat6",      notes: "PoE" },
  { id: "c06", label: "C-006", source: "sw-bridge",  target: "cam-bridge", type: "Cat6",      notes: "PoE camera" },
  { id: "c07", label: "C-007", source: "sw-bridge",  target: "qsys-core",  type: "Cat6A",     notes: "" },
  { id: "c08", label: "C-008", source: "sw-bridge",  target: "nas",        type: "Cat6A",     notes: "" },
  { id: "c09", label: "C-009", source: "sw-saloon",  target: "ap-deck",    type: "Cat6",      notes: "PoE" },
  { id: "c10", label: "C-010", source: "sw-saloon",  target: "cam-saloon", type: "Cat6",      notes: "PoE camera" },
  { id: "c11", label: "C-011", source: "sw-saloon",  target: "av-proc",    type: "Cat6A",     notes: "" },
  { id: "c12", label: "C-012", source: "sw-saloon",  target: "av-matrix",  type: "Cat6A",     notes: "" },
  { id: "c13", label: "C-013", source: "sw-saloon",  target: "ups-av",     type: "Cat6",      notes: "SNMP monitoring" },
  { id: "c14", label: "C-014", source: "sw-deck",    target: "cam-deck1",  type: "Cat6",      notes: "PoE camera" },
  { id: "c15", label: "C-015", source: "sw-deck",    target: "cam-deck2",  type: "Cat6",      notes: "PoE camera" },
  { id: "c16", label: "C-016", source: "ups-main",   target: "sw-bridge",  type: "Power IEC", notes: "Protected feed" },
  { id: "c17", label: "C-017", source: "ups-main",   target: "router-wan", type: "Power IEC", notes: "Protected feed" },
];

const MOCK_STATUS = {
  "router-wan": "online",  "sw-bridge":  "online",  "sw-saloon": "online",
  "sw-deck":    "warning", "sw-engine":  "online",  "ap-bridge": "online",
  "ap-deck":    "online",  "cam-bridge": "offline", "cam-saloon":"online",
  "cam-deck1":  "online",  "cam-deck2":  "online",  "av-proc":   "online",
  "av-matrix":  "online",  "qsys-core":  "online",  "nas":       "online",
  "ups-main":   "warning", "ups-av":     "online",
};

const CATEGORY_META = {
  Network: { icon: Wifi,      color: "#06b6d4", label: "Network" },
  Camera:  { icon: Camera,    color: "#a78bfa", label: "Cameras" },
  AV:      { icon: Monitor,   color: "#60a5fa", label: "AV Systems" },
  Server:  { icon: HardDrive, color: "#34d399", label: "Servers" },
  Power:   { icon: Zap,       color: "#fbbf24", label: "Power" },
};

const STATUS_CFG = {
  online:  { dot: "bg-emerald-400", text: "text-emerald-400", label: "Online",  badge: "bg-emerald-500/12 border-emerald-500/25 text-emerald-400" },
  offline: { dot: "bg-red-400",     text: "text-red-400",     label: "Offline", badge: "bg-red-500/12 border-red-500/25 text-red-400" },
  warning: { dot: "bg-amber-400",   text: "text-amber-400",   label: "Warning", badge: "bg-amber-500/12 border-amber-500/25 text-amber-400" },
  unknown: { dot: "bg-slate-500",   text: "text-slate-400",   label: "Unknown", badge: "bg-slate-500/12 border-slate-500/25 text-slate-400" },
};

const CONDITION_COLORS = {
  Excellent: "text-emerald-400", Good: "text-cyan-400",
  Fair: "text-amber-400", Poor: "text-red-400",
};

// BFS shortest path
function findPath(sourceId, targetId) {
  if (sourceId === targetId) return [sourceId];
  const adj = {};
  CABLES.forEach(c => {
    if (!adj[c.source]) adj[c.source] = [];
    if (!adj[c.target]) adj[c.target] = [];
    adj[c.source].push(c.target);
    adj[c.target].push(c.source);
  });
  const visited = new Set([sourceId]);
  const queue = [[sourceId]];
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    for (const next of (adj[node] || [])) {
      if (visited.has(next)) continue;
      visited.add(next);
      const newPath = [...path, next];
      if (next === targetId) return newPath;
      queue.push(newPath);
    }
  }
  return null;
}

// ─── Device detail panel ──────────────────────────────────────────────────────
function DevicePanel({ device, onClose }) {
  const status = MOCK_STATUS[device.id] || "unknown";
  const scfg = STATUS_CFG[status];
  const catMeta = CATEGORY_META[device.category] || CATEGORY_META.Network;
  const connections = CABLES.filter(c => c.source === device.id || c.target === device.id);
  const Icon = catMeta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.18 }}
      className="w-72 flex-shrink-0 rounded-2xl border border-white/10 bg-[#0a0f1c]/98 backdrop-blur-xl shadow-2xl overflow-hidden self-start sticky top-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: catMeta.color + "22" }}>
            <Icon size={15} style={{ color: catMeta.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">{device.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{device.category}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 pt-3 pb-1 flex gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${scfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
          {scfg.label}
        </span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 ${CONDITION_COLORS[device.condition] || "text-slate-400"}`}>
          {device.condition}
        </span>
      </div>

      {/* Specs */}
      <div className="px-4 py-3 space-y-2.5">
        {[
          { icon: Tag,    label: "Model",    value: device.model },
          { icon: Hash,   label: "IP",       value: device.ip,       mono: true },
          { icon: MapPin, label: "Location", value: device.location },
          { icon: Hash,   label: "Serial",   value: device.serial,   mono: true },
        ].map(r => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0">
              <r.icon size={10} />{r.label}
            </span>
            <span className={`text-xs text-slate-200 truncate text-right ${r.mono ? "font-mono" : ""}`}>{r.value}</span>
          </div>
        ))}
        {device.notes && (
          <div className="pt-1 border-t border-white/6">
            <p className="text-xs text-slate-500 flex items-center gap-1 mb-1"><FileText size={10} />Notes</p>
            <p className="text-xs text-slate-300 leading-relaxed">{device.notes}</p>
          </div>
        )}
      </div>

      {/* Connections */}
      {connections.length > 0 && (
        <div className="px-4 pb-4 border-t border-white/6 pt-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Cable size={10} /> Connections ({connections.length})
          </p>
          <div className="space-y-1.5">
            {connections.map(c => {
              const peerId = c.source === device.id ? c.target : c.source;
              const peer = DEVICES.find(d => d.id === peerId);
              const peerStatus = MOCK_STATUS[peerId] || "unknown";
              const peerDot = STATUS_CFG[peerStatus]?.dot || "bg-slate-500";
              return (
                <div key={c.id} className="flex items-center justify-between text-xs gap-2 px-2 py-1.5 rounded-lg bg-white/3 border border-white/5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${peerDot}`} />
                    <span className="text-slate-300 truncate">{peer?.name || peerId}</span>
                  </div>
                  <span className="text-cyan-400/70 font-mono text-[10px] flex-shrink-0">{c.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Path trace panel ─────────────────────────────────────────────────────────
function PathPanel({ path, source, target, onClose }) {
  if (!path) return (
    <div className="mt-3 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8 text-xs text-red-400">
      No path found between <b>{source?.name}</b> and <b>{target?.name}</b>.
    </div>
  );

  return (
    <div className="mt-3 px-4 py-3 rounded-xl border border-orange-500/25 bg-orange-500/8">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-orange-300">
          <GitBranch size={12} /> Path — {path.length - 1} hop{path.length !== 2 ? "s" : ""}
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={12} /></button>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {path.map((nodeId, i) => {
          const dev = DEVICES.find(d => d.id === nodeId);
          return (
            <div key={nodeId} className="flex items-center gap-1">
              <span className={`text-xs px-2 py-0.5 rounded-md border ${i === 0 || i === path.length - 1 ? "border-orange-500/40 bg-orange-500/15 text-orange-300" : "border-white/10 bg-white/4 text-slate-300"}`}>
                {i === 0 || i === path.length - 1 ? <CheckCircle2 size={9} className="inline mr-1 text-orange-400" /> : null}
                {dev?.name || nodeId}
              </span>
              {i < path.length - 1 && <ArrowRight size={10} className="text-slate-600" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Device row ───────────────────────────────────────────────────────────────
function DeviceRow({ device, selected, pathSource, pathMode, onSelect, onPathPick }) {
  const status = MOCK_STATUS[device.id] || "unknown";
  const scfg = STATUS_CFG[status];
  const catMeta = CATEGORY_META[device.category];
  const Icon = catMeta?.icon || Wifi;
  const connCount = CABLES.filter(c => c.source === device.id || c.target === device.id).length;
  const isPathSrc = pathSource?.id === device.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => pathMode ? onPathPick(device) : onSelect(device)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
        isPathSrc
          ? "border-orange-500/40 bg-orange-500/10"
          : selected
          ? "border-cyan-500/40 bg-cyan-500/8"
          : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
      }`}
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: catMeta?.color + "18" }}>
        <Icon size={14} style={{ color: catMeta?.color }} />
      </div>

      {/* Name + model */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{device.name}</p>
        <p className="text-xs text-slate-500 truncate">{device.model}</p>
      </div>

      {/* IP */}
      <span className="hidden md:block font-mono text-xs text-slate-400 w-28 text-right flex-shrink-0">{device.ip}</span>

      {/* Location */}
      <span className="hidden lg:block text-xs text-slate-500 w-32 text-right flex-shrink-0 truncate">{device.location}</span>

      {/* Connections */}
      <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 w-14 justify-end flex-shrink-0">
        <Cable size={10} />{connCount}
      </span>

      {/* Status */}
      <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${scfg.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
        <span className="hidden sm:inline">{scfg.label}</span>
      </span>
    </motion.div>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────
function CategoryGroup({ category, devices, selectedId, pathSource, pathMode, onSelect, onPathPick }) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[category] || { icon: Wifi, color: "#94a3b8", label: category };
  const Icon = meta.icon;
  const onlineCount = devices.filter(d => (MOCK_STATUS[d.id] || "unknown") === "online").length;
  const offlineCount = devices.filter(d => (MOCK_STATUS[d.id] || "unknown") === "offline").length;
  const warnCount = devices.filter(d => (MOCK_STATUS[d.id] || "unknown") === "warning").length;

  return (
    <div className="mb-3">
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/3 transition-colors group"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: meta.color + "20" }}>
          <Icon size={13} style={{ color: meta.color }} />
        </div>
        <span className="text-sm font-bold text-white flex-1 text-left">{meta.label}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-400">{onlineCount} online</span>
          {warnCount > 0 && <span className="text-amber-400">{warnCount} warn</span>}
          {offlineCount > 0 && <span className="text-red-400">{offlineCount} offline</span>}
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{devices.length} total</span>
        </div>
        {open ? <ChevronDown size={13} className="text-slate-500 ml-1" /> : <ChevronRight size={13} className="text-slate-500 ml-1" />}
      </button>

      {/* Devices */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pl-2 space-y-1 pt-1">
              {devices.map(device => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  selected={selectedId === device.id}
                  pathSource={pathSource}
                  pathMode={pathMode}
                  onSelect={onSelect}
                  onPathPick={onPathPick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NetworkMapTab() {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pathMode, setPathMode] = useState(false);
  const [pathSource, setPathSource] = useState(null);
  const [pathTarget, setPathTarget] = useState(null);
  const [pathResult, setPathResult] = useState(undefined); // undefined = not computed yet

  const handleSelect = (device) => {
    setSelectedDevice(prev => prev?.id === device.id ? null : device);
  };

  const handlePathPick = (device) => {
    if (!pathSource) {
      setPathSource(device);
      setPathResult(undefined);
      setPathTarget(null);
      return;
    }
    if (pathSource.id === device.id) {
      setPathSource(null);
      setPathResult(undefined);
      return;
    }
    setPathTarget(device);
    setPathResult(findPath(pathSource.id, device.id));
  };

  const clearPath = () => {
    setPathSource(null);
    setPathTarget(null);
    setPathResult(undefined);
  };

  const togglePathMode = () => {
    setPathMode(m => { if (m) clearPath(); return !m; });
  };

  // Group + filter
  const filtered = useMemo(() => {
    return DEVICES.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.name.toLowerCase().includes(q) || d.model.toLowerCase().includes(q) || d.ip.includes(q) || d.location.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || (MOCK_STATUS[d.id] || "unknown") === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const grouped = useMemo(() => {
    const order = ["Network", "AV", "Camera", "Server", "Power"];
    const map = {};
    filtered.forEach(d => {
      if (!map[d.category]) map[d.category] = [];
      map[d.category].push(d);
    });
    return order.filter(c => map[c]).map(c => ({ category: c, devices: map[c] }));
  }, [filtered]);

  const totalOnline  = DEVICES.filter(d => MOCK_STATUS[d.id] === "online").length;
  const totalOffline = DEVICES.filter(d => MOCK_STATUS[d.id] === "offline").length;
  const totalWarn    = DEVICES.filter(d => MOCK_STATUS[d.id] === "warning").length;

  return (
    <div className="flex h-full overflow-hidden bg-[#060912]">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/6 bg-[#070b13]/70 flex-shrink-0 flex-wrap gap-y-2">
          {/* Search */}
          <div className="relative flex-1 min-w-40 max-w-72">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search devices…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            {["all", "online", "warning", "offline"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors capitalize ${
                  statusFilter === s
                    ? s === "all" ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                      : s === "online" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : s === "warning" ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                      : "border-red-500/40 bg-red-500/15 text-red-400"
                    : "border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15"
                }`}
              >
                {s === "all" ? `All (${DEVICES.length})` : s === "online" ? `Online (${totalOnline})` : s === "warning" ? `Warn (${totalWarn})` : `Offline (${totalOffline})`}
              </button>
            ))}
          </div>

          {/* Path trace */}
          <button
            onClick={togglePathMode}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ml-auto ${
              pathMode ? "border-orange-500/40 bg-orange-500/15 text-orange-400" : "border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitBranch size={12} />
            {pathMode ? "Exit path" : "Trace path"}
          </button>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/4 bg-[#070b13]/40 flex-shrink-0 text-[10px] text-slate-600 uppercase tracking-widest">
          <div className="w-8 flex-shrink-0" />
          <div className="flex-1">Device</div>
          <div className="hidden md:block w-28 text-right">IP</div>
          <div className="hidden lg:block w-32 text-right">Location</div>
          <div className="hidden sm:block w-14 text-right">Links</div>
          <div className="w-20 text-right">Status</div>
        </div>

        {/* Path hint / result */}
        {pathMode && (
          <div className="px-5 pb-1">
            {!pathSource ? (
              <div className="mt-2 px-4 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/6 text-xs text-orange-400/80">
                Click a device to set path source
              </div>
            ) : pathResult === undefined ? (
              <div className="mt-2 px-4 py-2.5 rounded-xl border border-orange-500/25 bg-orange-500/8 text-xs text-orange-300">
                Source: <b>{pathSource.name}</b> — now click a target device
              </div>
            ) : (
              <PathPanel path={pathResult} source={pathSource} target={pathTarget} onClose={clearPath} />
            )}
          </div>
        )}

        {/* Device groups */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-600">
              <Filter size={20} />
              <p className="text-sm">No devices match your filter</p>
            </div>
          ) : (
            grouped.map(({ category, devices }) => (
              <CategoryGroup
                key={category}
                category={category}
                devices={devices}
                selectedId={selectedDevice?.id}
                pathSource={pathSource}
                pathMode={pathMode}
                onSelect={handleSelect}
                onPathPick={handlePathPick}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDevice && !pathMode && (
          <div className="hidden md:flex p-4 border-l border-white/6 bg-[#070b13]/60">
            <DevicePanel
              device={selectedDevice}
              onClose={() => setSelectedDevice(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}