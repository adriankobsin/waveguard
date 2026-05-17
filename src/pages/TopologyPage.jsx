import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network, RefreshCw, ZoomIn, ZoomOut, Maximize2, Filter,
  Wifi, Camera, Monitor, Zap, Server, Router as RouterIcon,
  Smartphone, HardDrive, ChevronRight, X
} from "lucide-react";

// ─── Mock topology data ──────────────────────────────────────────────
const NODES = [
  { id: "core-sw",    label: "Core Switch",     type: "switch",  ip: "192.168.10.1",  status: "online",  vendor: "Cisco",     ports: 48, model: "Catalyst 2960X" },
  { id: "sw-bridge",  label: "SW-Bridge",       type: "switch",  ip: "192.168.10.2",  status: "online",  vendor: "Cisco",     ports: 24, model: "SG350-28" },
  { id: "sw-saloon",  label: "SW-Saloon",       type: "switch",  ip: "192.168.10.3",  status: "online",  vendor: "Cisco",     ports: 24, model: "SG350-28" },
  { id: "sw-deck",    label: "SW-Deck-Lower",   type: "switch",  ip: "192.168.10.5",  status: "warning", vendor: "Cisco",     ports: 16, model: "SG250-18" },
  { id: "sw-engine",  label: "SW-Engine",       type: "switch",  ip: "192.168.10.6",  status: "online",  vendor: "Cisco",     ports: 16, model: "SG250-18" },
  { id: "ap-bridge",  label: "AP-Bridge",       type: "ap",      ip: "192.168.10.20", status: "online",  vendor: "Ubiquiti",  model: "UAP-AC-Pro" },
  { id: "ap-deck",    label: "AP-Deck",         type: "ap",      ip: "192.168.10.21", status: "online",  vendor: "Ubiquiti",  model: "UAP-AC-Pro" },
  { id: "qsys-core",  label: "Q-SYS Core",      type: "av",      ip: "192.168.10.30", status: "online",  vendor: "Q-SYS",     model: "Core 110f" },
  { id: "qsys-amp",   label: "Q-SYS Amp",       type: "av",      ip: "192.168.10.31", status: "online",  vendor: "Q-SYS",     model: "CX-Q 4K8" },
  { id: "cam-bridge", label: "Cam-Bridge-01",   type: "camera",  ip: "192.168.10.51", status: "offline", vendor: "Dahua",     model: "SD49425XB-HNR" },
  { id: "cam-saloon", label: "Cam-Saloon-01",   type: "camera",  ip: "192.168.10.52", status: "online",  vendor: "Dahua",     model: "IPC-HDW3849H" },
  { id: "cam-deck1",  label: "Cam-Deck-01",     type: "camera",  ip: "192.168.10.53", status: "online",  vendor: "Dahua",     model: "IPC-HDW3849H" },
  { id: "cam-deck2",  label: "Cam-Deck-02",     type: "camera",  ip: "192.168.10.54", status: "online",  vendor: "Dahua",     model: "IPC-HDW3849H" },
  { id: "nas",        label: "NAS-Synology",    type: "server",  ip: "192.168.10.80", status: "online",  vendor: "Synology",  model: "DS1522+" },
  { id: "ups-main",   label: "UPS-Main",        type: "ups",     ip: "192.168.10.90", status: "online",  vendor: "APC",       model: "SMT1500RM2U" },
  { id: "ups-av",     label: "UPS-AV",          type: "ups",     ip: "192.168.10.91", status: "online",  vendor: "APC",       model: "SMT750RM2U" },
  { id: "starlink",   label: "Starlink Router", type: "router",  ip: "192.168.100.1", status: "online",  vendor: "SpaceX",    model: "Gen3 Dish" },
  { id: "tablet-br",  label: "Bridge Tablet",   type: "endpoint",ip: "192.168.10.110",status: "online",  vendor: "Apple",     model: "iPad Pro 12.9" },
];

const EDGES = [
  { from: "starlink",  to: "core-sw"  },
  { from: "core-sw",   to: "sw-bridge" },
  { from: "core-sw",   to: "sw-saloon" },
  { from: "core-sw",   to: "sw-deck"  },
  { from: "core-sw",   to: "sw-engine" },
  { from: "core-sw",   to: "nas"      },
  { from: "core-sw",   to: "ups-main" },
  { from: "sw-bridge", to: "ap-bridge" },
  { from: "sw-bridge", to: "cam-bridge" },
  { from: "sw-bridge", to: "qsys-core" },
  { from: "sw-bridge", to: "tablet-br" },
  { from: "sw-saloon", to: "ap-deck"  },
  { from: "sw-saloon", to: "cam-saloon" },
  { from: "sw-saloon", to: "qsys-amp" },
  { from: "sw-saloon", to: "ups-av"   },
  { from: "sw-deck",   to: "cam-deck1" },
  { from: "sw-deck",   to: "cam-deck2" },
  { from: "qsys-core", to: "qsys-amp" },
];

// ─── Layout: hierarchical force-ish positions ────────────────────────
const POSITIONS = {
  "starlink":  { x: 500, y: 60  },
  "core-sw":   { x: 500, y: 170 },
  "sw-bridge": { x: 200, y: 300 },
  "sw-saloon": { x: 500, y: 300 },
  "sw-deck":   { x: 750, y: 300 },
  "sw-engine": { x: 950, y: 300 },
  "nas":       { x: 650, y: 170 },
  "ups-main":  { x: 350, y: 170 },
  "ap-bridge": { x: 80,  y: 420 },
  "cam-bridge":{ x: 200, y: 420 },
  "qsys-core": { x: 310, y: 420 },
  "tablet-br": { x: 80,  y: 530 },
  "ap-deck":   { x: 410, y: 420 },
  "cam-saloon":{ x: 510, y: 420 },
  "qsys-amp":  { x: 310, y: 530 },
  "ups-av":    { x: 610, y: 420 },
  "cam-deck1": { x: 700, y: 420 },
  "cam-deck2": { x: 820, y: 420 },
};

const TYPE_CONFIG = {
  switch:   { icon: Network,     color: "text-cyan-400",   bg: "bg-cyan-500/20",    border: "border-cyan-500/40" },
  router:   { icon: RouterIcon,  color: "text-blue-400",   bg: "bg-blue-500/20",    border: "border-blue-500/40" },
  ap:       { icon: Wifi,        color: "text-indigo-400", bg: "bg-indigo-500/20",  border: "border-indigo-500/40" },
  camera:   { icon: Camera,      color: "text-purple-400", bg: "bg-purple-500/20",  border: "border-purple-500/40" },
  av:       { icon: Monitor,     color: "text-orange-400", bg: "bg-orange-500/20",  border: "border-orange-500/40" },
  server:   { icon: Server,      color: "text-green-400",  bg: "bg-green-500/20",   border: "border-green-500/40" },
  ups:      { icon: Zap,         color: "text-yellow-400", bg: "bg-yellow-500/20",  border: "border-yellow-500/40" },
  endpoint: { icon: Smartphone,  color: "text-gray-400",   bg: "bg-gray-500/20",    border: "border-gray-500/40" },
};

const STATUS_DOT = {
  online:  "bg-green-500",
  offline: "bg-red-500 animate-pulse",
  warning: "bg-yellow-500 animate-pulse",
  unknown: "bg-gray-500",
};

const STATUS_RING = {
  online:  "",
  offline: "ring-2 ring-red-500/50",
  warning: "ring-2 ring-yellow-500/50",
  unknown: "",
};

const CANVAS_W = 1080;
const CANVAS_H = 620;

// ─── Tooltip Component ───────────────────────────────────────────────
function NodeTooltip({ node, x, y }) {
  const cfg = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.endpoint;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      className="absolute z-50 pointer-events-none"
      style={{ left: x + 16, top: y - 10 }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl p-3 min-w-[180px]">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
            <cfg.icon size={14} className={cfg.color} />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground leading-none">{node.label}</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{node.ip}</p>
          </div>
          <span className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[node.status]}`} />
        </div>
        <div className="space-y-1 text-xs text-muted-foreground border-t border-border/50 pt-2">
          <div className="flex justify-between"><span>Vendor</span><span className="text-foreground">{node.vendor}</span></div>
          <div className="flex justify-between"><span>Model</span><span className="text-foreground truncate ml-2 max-w-[120px]">{node.model}</span></div>
          {node.ports && <div className="flex justify-between"><span>Ports</span><span className="text-foreground">{node.ports}</span></div>}
          <div className="flex justify-between">
            <span>Status</span>
            <span className={node.status === "online" ? "text-green-400" : node.status === "offline" ? "text-red-400" : "text-yellow-400"}>
              {node.status.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50 text-xs text-primary">
          <span>Click to view details</span>
          <ChevronRight size={10} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function TopologyPage() {
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredNodeIds = new Set(
    NODES.filter(n =>
      (filterType === "all" || n.type === filterType) &&
      (filterStatus === "all" || n.status === filterStatus)
    ).map(n => n.id)
  );

  const visibleEdges = EDGES.filter(e => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.addEventListener("wheel", handleWheel, { passive: false });
    return () => { if (el) el.removeEventListener("wheel", handleWheel); };
  }, [handleWheel]);

  const onMouseDown = (e) => {
    if (e.target.tagName === "svg" || e.target.tagName === "rect") {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const onMouseMove = (e) => {
    if (dragging && dragStart) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
    if (hoveredNode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const onMouseUp = () => { setDragging(false); setDragStart(null); };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const statusCounts = {
    online:  NODES.filter(n => n.status === "online").length,
    offline: NODES.filter(n => n.status === "offline").length,
    warning: NODES.filter(n => n.status === "warning").length,
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Network Topology</h1>
          <p className="text-xs text-muted-foreground">{NODES.length} devices · {EDGES.length} links</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status summary pills */}
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <span className="flex items-center gap-1.5 text-xs text-green-400"><span className="w-2 h-2 rounded-full bg-green-500" />{statusCounts.online} online</span>
            {statusCounts.warning > 0 && <span className="flex items-center gap-1.5 text-xs text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-500" />{statusCounts.warning} warn</span>}
            {statusCounts.offline > 0 && <span className="flex items-center gap-1.5 text-xs text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" />{statusCounts.offline} offline</span>}
          </div>
          <button onClick={() => setShowFilters(f => !f)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${showFilters ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <Filter size={12} /> Filter
          </button>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"><ZoomIn size={13} /></button>
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"><ZoomOut size={13} /></button>
          <button onClick={resetView} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"><Maximize2 size={13} /></button>
        </div>
      </div>

      {/* Filter bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-border/50 overflow-hidden">
            <div className="px-5 py-2.5 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Type:</span>
                {["all", "switch", "router", "ap", "camera", "av", "server", "ups", "endpoint"].map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={`px-2 py-1 rounded-md capitalize transition-colors ${filterType === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                {["all", "online", "offline", "warning"].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={`px-2 py-1 rounded-md capitalize transition-colors ${filterStatus === s ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ touchAction: "none" }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(220,15%,12%)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {visibleEdges.map((edge, i) => {
              const from = POSITIONS[edge.from];
              const to = POSITIONS[edge.to];
              if (!from || !to) return null;
              const fromNode = NODES.find(n => n.id === edge.from);
              const toNode = NODES.find(n => n.id === edge.to);
              const hasOffline = fromNode?.status === "offline" || toNode?.status === "offline";
              const hasWarning = fromNode?.status === "warning" || toNode?.status === "warning";
              const stroke = hasOffline ? "hsl(0,75%,45%)" : hasWarning ? "hsl(38,92%,45%)" : "hsl(220,15%,22%)";
              return (
                <line
                  key={i}
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke={stroke}
                  strokeWidth={hasOffline || hasWarning ? 1.5 : 1}
                  strokeDasharray={hasOffline ? "4 3" : undefined}
                  opacity={0.7}
                />
              );
            })}

            {/* Nodes */}
            {NODES.filter(n => filteredNodeIds.has(n.id)).map(node => {
              const pos = POSITIONS[node.id];
              if (!pos) return null;
              const cfg = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.endpoint;
              const isCore = node.type === "switch" && node.id === "core-sw";
              const r = isCore ? 28 : 22;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    setHoveredNode(node);
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => navigate(`/equipment/${node.id}`)}
                >
                  {/* Outer ring for offline/warning */}
                  {(node.status === "offline" || node.status === "warning") && (
                    <circle
                      r={r + 6}
                      fill="none"
                      stroke={node.status === "offline" ? "hsl(0,75%,55%)" : "hsl(38,92%,50%)"}
                      strokeWidth={1}
                      opacity={0.4}
                      strokeDasharray="3 2"
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    r={r}
                    fill={`hsl(220,18%,${isCore ? 12 : 10}%)`}
                    stroke={
                      node.status === "offline" ? "hsl(0,75%,55%)" :
                      node.status === "warning" ? "hsl(38,92%,50%)" :
                      hoveredNode?.id === node.id ? "hsl(192,100%,48%)" :
                      "hsl(220,15%,22%)"
                    }
                    strokeWidth={hoveredNode?.id === node.id ? 2 : 1.5}
                  />

                  {/* Status dot */}
                  <circle
                    cx={r - 4} cy={-(r - 4)}
                    r={5}
                    fill={
                      node.status === "online" ? "hsl(145,65%,45%)" :
                      node.status === "offline" ? "hsl(0,75%,55%)" :
                      "hsl(38,92%,50%)"
                    }
                    stroke="hsl(220,20%,6%)"
                    strokeWidth={1.5}
                  />

                  {/* Label */}
                  <text
                    textAnchor="middle"
                    y={r + 14}
                    fontSize={10}
                    fill="hsl(210,20%,72%)"
                    fontFamily="Inter, sans-serif"
                    fontWeight={isCore ? "600" : "400"}
                  >
                    {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                  </text>

                  {/* Inline icon using foreignObject */}
                  <foreignObject x={-10} y={-10} width={20} height={20} style={{ pointerEvents: "none" }}>
                    <div className={`w-full h-full flex items-center justify-center ${cfg.color}`} xmlns="http://www.w3.org/1999/xhtml">
                      <cfg.icon size={isCore ? 16 : 13} />
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredNode && (
            <NodeTooltip
              node={hoveredNode}
              x={tooltipPos.x}
              y={tooltipPos.y}
            />
          )}
        </AnimatePresence>

        {/* Zoom indicator */}
        <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-card/80 border border-border/50 px-2 py-1 rounded-lg font-mono">
          {Math.round(zoom * 100)}%
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-card/90 border border-border/50 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Legend</p>
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-2 text-xs text-muted-foreground">
              <cfg.icon size={11} className={cfg.color} />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>

        {/* Pan hint */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 pointer-events-none">
          Drag to pan · Scroll to zoom · Click node for details
        </div>
      </div>
    </div>
  );
}