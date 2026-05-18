import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ForceGraph2D from "react-force-graph-2d";
import { X, MapPin, Hash, Tag, FileText, Cable, Filter, Maximize2, RefreshCw, Layers, GitBranch, ArrowRight, CheckCircle2, Monitor, Cpu, Lightbulb, Server } from "lucide-react";
import LightingMapTab from "../components/topology/LightingMapTab";
import RackElevationTab from "../components/topology/RackElevationTab";
import NetworkMapTab from "../components/topology/NetworkMapTab";

// ─── Full device + cable dataset ─────────────────────────────────────────────
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

const CATEGORY_COLORS = {
  Network: "#06b6d4", Camera: "#a78bfa", AV: "#60a5fa",
  Server: "#34d399",  Power:  "#fbbf24", Other: "#94a3b8",
};

const STATUS_COLORS = {
  online: "#22c55e", offline: "#ef4444", warning: "#f59e0b", unknown: "#64748b",
};

const STATUS_CONFIG = {
  online:  { label: "Online",  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400" },
  offline: { label: "Offline", color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",         dot: "bg-red-400" },
  warning: { label: "Warning", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",     dot: "bg-amber-400" },
  unknown: { label: "Unknown", color: "text-slate-400",   bg: "bg-slate-500/15 border-slate-500/30",     dot: "bg-slate-400" },
};

const CONDITION_COLORS = {
  Excellent: "text-emerald-400", Good: "text-cyan-400",
  Fair: "text-amber-400",        Poor: "text-red-400",
  Decommissioned: "text-slate-400",
};

// ─── BFS shortest path ────────────────────────────────────────────────────────
function findPath(sourceId, targetId, cables) {
  if (sourceId === targetId) return { nodeIds: new Set([sourceId]), edgeIds: new Set() };

  // Build adjacency: undirected
  const adj = {};
  cables.forEach(c => {
    if (!adj[c.source]) adj[c.source] = [];
    if (!adj[c.target]) adj[c.target] = [];
    adj[c.source].push({ node: c.target, edgeId: c.id });
    adj[c.target].push({ node: c.source, edgeId: c.id });
  });

  const visited = new Set([sourceId]);
  const queue = [{ node: sourceId, path: [sourceId], edges: [] }];

  while (queue.length) {
    const { node, path, edges } = queue.shift();
    for (const { node: next, edgeId } of (adj[node] || [])) {
      if (visited.has(next)) continue;
      visited.add(next);
      const newPath = [...path, next];
      const newEdges = [...edges, edgeId];
      if (next === targetId) {
        return { nodeIds: new Set(newPath), edgeIds: new Set(newEdges), orderedNodes: newPath, orderedEdges: newEdges };
      }
      queue.push({ node: next, path: newPath, edges: newEdges });
    }
  }
  return null; // no path
}

// ─── Path Info Panel ──────────────────────────────────────────────────────────
function PathPanel({ path, sourceNode, targetNode, onClose }) {
  if (!path) return null;
  const hops = path.orderedNodes || [];
  const edges = path.orderedEdges || [];

  return (
    <AnimatePresence>
      <motion.div
        key="path-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[520px] max-w-[92vw]"
      >
        <div className="rounded-2xl border border-orange-500/30 bg-[#0a0f1c]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
            <div className="flex items-center gap-2">
              <GitBranch size={13} className="text-orange-400" />
              <p className="text-xs font-semibold text-white">Signal Path</p>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400">{hops.length - 1} hop{hops.length !== 2 ? "s" : ""}</span>
            </div>
            <button onClick={onClose} className="w-5 h-5 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-500 hover:text-white">
              <X size={11} />
            </button>
          </div>
          <div className="px-4 py-3 flex items-center gap-1 flex-wrap">
            {hops.map((nodeId, i) => {
              const dev = DEVICES.find(d => d.id === nodeId);
              const cable = i < edges.length ? CABLES.find(c => c.id === edges[i]) : null;
              const isEndpoint = i === 0 || i === hops.length - 1;
              return (
                <div key={nodeId} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${
                    isEndpoint
                      ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                      : "border-white/10 bg-white/4 text-slate-300"
                  }`}>
                    {isEndpoint && <CheckCircle2 size={10} className="text-orange-400" />}
                    {dev?.name || nodeId}
                  </div>
                  {cable && (
                    <div className="flex items-center gap-1 text-slate-600">
                      <ArrowRight size={10} />
                      <span className="text-[10px] font-mono text-cyan-500/60">{cable.type}</span>
                      <ArrowRight size={10} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ node, onClose }) {
  if (!node) return null;
  const status = MOCK_STATUS[node.id] || "unknown";
  const cfg = STATUS_CONFIG[status];
  const cables = CABLES.filter(c => c.source === node.id || c.target === node.id);

  return (
    <AnimatePresence>
      <motion.div
        key={node.id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute top-4 right-4 w-72 z-20 pointer-events-auto"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0a0f1c]/92 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <p className="text-sm font-semibold text-white leading-tight">{node.name}</p>
            </div>
            <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 text-slate-400">
              {node.category}
            </span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {node.model    && <Row icon={Tag}    label="Model"    value={node.model} />}
            {node.ip       && <Row icon={Hash}   label="IP"       value={node.ip} mono />}
            {node.location && <Row icon={MapPin} label="Location" value={node.location} />}
            {node.serial   && <Row icon={Hash}   label="Serial"   value={node.serial} mono />}
            {node.condition && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Condition</span>
                <span className={`text-xs font-medium ${CONDITION_COLORS[node.condition] || "text-slate-400"}`}>{node.condition}</span>
              </div>
            )}
            {node.notes && (
              <div className="pt-1 border-t border-white/6">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><FileText size={10} /> Notes</p>
                <p className="text-xs text-slate-300 leading-relaxed">{node.notes}</p>
              </div>
            )}
          </div>
          {cables.length > 0 && (
            <div className="px-4 pb-4 border-t border-white/6 pt-3">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <Cable size={10} /> Connections ({cables.length})
              </p>
              <div className="space-y-2">
                {cables.map(c => {
                  const peerId = c.source === node.id ? c.target : c.source;
                  const peer = DEVICES.find(d => d.id === peerId);
                  return (
                    <div key={c.id} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[MOCK_STATUS[peerId] || "unknown"] }} />
                        <span className="text-slate-300 truncate">{peer?.name || peerId}</span>
                      </div>
                      <span className="text-cyan-400/70 font-mono text-[10px] flex-shrink-0 ml-1">{c.type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0"><Icon size={10} />{label}</span>
      <span className={`text-xs text-slate-200 truncate text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ filter, onFilter }) {
  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-white/10 bg-[#0a0f1c]/90 backdrop-blur-md p-3 space-y-1.5">
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Category</p>
      {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
        <button
          key={cat}
          onClick={() => onFilter(f => f === cat ? null : cat)}
          className={`flex items-center gap-2 text-xs w-full transition-opacity ${filter && filter !== cat ? "opacity-30" : "opacity-100"}`}
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-slate-400">{cat}</span>
        </button>
      ))}
      <div className="border-t border-white/6 mt-2 pt-2 space-y-1.5">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Status</p>
        {Object.entries(STATUS_COLORS).slice(0, 3).map(([s, color]) => (
          <div key={s} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-slate-400 capitalize">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Placeholder tab panels ───────────────────────────────────────────────────
function PlaceholderTab({ icon: Icon, title, body, color = "text-cyan-400" }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
        <Icon size={28} className={color} />
      </div>
      <div>
        <p className="text-base font-semibold text-white mb-1">{title}</p>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

const TOPOLOGY_TABS = [
  { key: "network",  label: "Network",        icon: Layers },
  { key: "av",       label: "AV signal flow",  icon: Monitor },
  { key: "control",  label: "Control path",    icon: Cpu },
  { key: "lighting", label: "Lighting map",    icon: Lightbulb },
  { key: "rack",     label: "Rack layout",     icon: Server },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TopologyPage() {
  const [activeTab, setActiveTab] = useState("network");
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [key, setKey] = useState(0);

  // Path-tracing state
  const [pathMode, setPathMode] = useState(false);     // true = picking mode active
  const [pathSource, setPathSource] = useState(null);  // first selected node
  const [pathTarget, setPathTarget] = useState(null);  // second selected node
  const [activePath, setActivePath] = useState(null);  // { nodeIds, edgeIds, orderedNodes, orderedEdges }

  // Animation offset for path dashes
  const dashOffsetRef = useRef(0);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Animate dash offset
  useEffect(() => {
    let rafId;
    const animate = () => {
      dashOffsetRef.current = (dashOffsetRef.current - 0.4) % 20;
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Build filtered graph data
  const visibleDevices = categoryFilter
    ? DEVICES.filter(d => d.category === categoryFilter)
    : DEVICES;
  const visibleIds = new Set(visibleDevices.map(d => d.id));
  const visibleCables = CABLES.filter(c => visibleIds.has(c.source) && visibleIds.has(c.target));

  const graphData = useMemo(() => ({
    nodes: visibleDevices.map(d => ({ ...d, status: MOCK_STATUS[d.id] || "unknown" })),
    links: visibleCables.map(c => ({ ...c, source: c.source, target: c.target })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key, categoryFilter]);

  // Stable refs so canvas callbacks read latest without recreation
  const pathRef = useRef(activePath);
  pathRef.current = activePath;
  const pathSourceRef = useRef(pathSource);
  pathSourceRef.current = pathSource;
  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (!isFinite(node.x) || !isFinite(node.y)) return;
    const path = pathRef.current;
    const isPathNode = path?.nodeIds?.has(node.id);
    const isPickedSource = pathSourceRef.current?.id === node.id;
    const isSelected = !path && selectedNodeRef.current?.id === node.id;

    const catColor = CATEGORY_COLORS[node.category] || "#94a3b8";
    const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;

    // Dim non-path nodes when a path is active
    const dimmed = path && !isPathNode;
    const radius = (isSelected || isPathNode) ? 14 : 10;

    ctx.globalAlpha = dimmed ? 0.2 : 1;

    if (isSelected || isPickedSource) {
      ctx.shadowColor = isPickedSource ? "#f97316" : catColor;
      ctx.shadowBlur = 22;
    }
    if (isPathNode && path) {
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 18;
    }

    // Outer ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
    ctx.fillStyle = isPathNode ? "#f9731622" : catColor + "22";
    ctx.fill();

    // Body gradient
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(node.x - 2, node.y - 2, 1, node.x, node.y, radius);
    if (isPathNode) {
      grad.addColorStop(0, "#fb923cee");
      grad.addColorStop(1, "#ea580c88");
    } else {
      grad.addColorStop(0, catColor + "ee");
      grad.addColorStop(1, catColor + "77");
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = isPathNode ? "#fb923c" : isSelected ? "#ffffff55" : catColor + "88";
    ctx.lineWidth = isPathNode ? 2 : isSelected ? 2 : 1;
    ctx.stroke();

    // Status dot
    ctx.beginPath();
    ctx.arc(node.x + radius * 0.68, node.y - radius * 0.68, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = statusColor;
    ctx.shadowBlur = 6;
    ctx.shadowColor = statusColor;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    const fontSize = Math.max(8, 10 / globalScale);
    ctx.font = `${(isSelected || isPathNode) ? "600" : "500"} ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = (isSelected || isPathNode) ? "#ffffff" : "rgba(255,255,255,0.75)";
    ctx.textAlign = "center";
    ctx.fillText(node.name.length > 14 ? node.name.slice(0, 13) + "…" : node.name, node.x, node.y + radius + fontSize + 2);

    ctx.globalAlpha = 1;
  }, []);

  const linkCanvasObject = useCallback((link, ctx) => {
    const s = link.source;
    const t = link.target;
    if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(t.x) || !isFinite(t.y)) return;

    const path = pathRef.current;
    const isPathEdge = path?.edgeIds?.has(link.id);
    const dimmed = path && !isPathEdge;

    ctx.globalAlpha = dimmed ? 0.08 : 1;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);

    if (isPathEdge) {
      // Animated glowing path link
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 12;
      ctx.setLineDash([8, 5]);
      ctx.lineDashOffset = dashOffsetRef.current;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    } else {
      const isPower = link.type === "Power IEC";
      ctx.strokeStyle = isPower ? "rgba(251,191,36,0.3)" : "rgba(6,182,212,0.2)";
      ctx.lineWidth = isPower ? 2 : 1.5;
      ctx.setLineDash(isPower ? [5, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
  }, []);

  const handleNodeClick = useCallback((node) => {
    if (!pathMode) {
      setSelectedNode(prev => prev?.id === node.id ? null : node);
      return;
    }

    // Path picking mode
    if (!pathSourceRef.current) {
      setPathSource(node);
      return;
    }

    if (pathSourceRef.current.id === node.id) {
      // Clicked same node — deselect source
      setPathSource(null);
      return;
    }

    // We have source + target — compute path
    const result = findPath(pathSourceRef.current.id, node.id, CABLES);
    setPathTarget(node);
    setActivePath(result);
  }, [pathMode]);

  const clearPath = useCallback(() => {
    setPathSource(null);
    setPathTarget(null);
    setActivePath(null);
  }, []);

  const togglePathMode = useCallback(() => {
    setPathMode(m => {
      if (m) {
        clearPath();
        setSelectedNode(null);
      }
      return !m;
    });
  }, [clearPath]);

  const statusCounts = {
    online:  DEVICES.filter(d => MOCK_STATUS[d.id] === "online").length,
    warning: DEVICES.filter(d => MOCK_STATUS[d.id] === "warning").length,
    offline: DEVICES.filter(d => MOCK_STATUS[d.id] === "offline").length,
  };

  return (
    <div className="h-full flex flex-col bg-[#060912]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/6 bg-[#070b13]/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/12 flex items-center justify-center ring-1 ring-cyan-500/20">
            <Layers size={14} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Topology &amp; racks</h1>
            <p className="text-xs text-slate-500 mt-0.5">Signal flow, patching, VLAN overlays, rack elevation, weight, thermal, power, uplinks.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{statusCounts.online} online</span>
          {statusCounts.warning > 0 && <span className="flex items-center gap-1.5 text-xs text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{statusCounts.warning} warning</span>}
          {statusCounts.offline > 0 && <span className="flex items-center gap-1.5 text-xs text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{statusCounts.offline} offline</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-white/6 bg-[#070b13]/60 flex-shrink-0 overflow-x-auto">
        {TOPOLOGY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                : "text-slate-500 hover:text-slate-200 hover:bg-white/4 border border-transparent"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">

        {/* Non-network tabs render placeholder */}
        {activeTab === "av" && <PlaceholderTab icon={Monitor} color="text-blue-400" title="AV signal flow" body="NVX encoder → core → decoder → display. Live route analytics plug into the AV driver bus." />}
        {activeTab === "control" && <PlaceholderTab icon={Cpu} color="text-purple-400" title="Control signal flow" body="CP4 orchestration to subsystems — REST/CIP placeholders per integration driver." />}
        {activeTab === "lighting" && <LightingMapTab />}
        {activeTab === "rack" && <RackElevationTab />}

        {/* Network tab */}
        {activeTab === "network" && <NetworkMapTab />}
      </div>
    </div>
  );
}