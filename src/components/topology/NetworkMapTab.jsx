import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import ForceGraph2D from "react-force-graph-2d";
import { base44 } from "@/api/base44Client";
import {
  Search, Filter, RefreshCw, Maximize2, GitBranch, ArrowRight,
  CheckCircle2, Loader2, X, MapPin, Hash, Tag, FileText, Cable
} from "lucide-react";

const CATEGORY_COLORS = {
  Network: "#06b6d4",
  Camera: "#a78bfa",
  AV: "#60a5fa",
  Server: "#34d399",
  Power: "#fbbf24",
  Other: "#94a3b8",
};

const STATUS_COLORS = {
  online: "#22c55e",
  offline: "#ef4444",
  warning: "#f59e0b",
  unknown: "#64748b",
};

const STATUS_CONFIG = {
  online: { label: "Online", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400" },
  offline: { label: "Offline", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", dot: "bg-red-400" },
  warning: { label: "Warning", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", dot: "bg-amber-400" },
  unknown: { label: "Unknown", color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30", dot: "bg-slate-400" },
};

const CONDITION_COLORS = {
  Excellent: "text-emerald-400",
  Good: "text-cyan-400",
  Fair: "text-amber-400",
  Poor: "text-red-400",
  Decommissioned: "text-slate-400",
};

// BFS shortest path algorithm
function findPath(sourceId, targetId, connections) {
  if (sourceId === targetId) return { nodeIds: new Set([sourceId]), edgeIds: new Set() };

  const adj = {};
  connections.forEach(c => {
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
  return null;
}

function DetailPanel({ node, onClose }) {
  if (!node) return null;
  const status = node.status || "unknown";
  const cfg = STATUS_CONFIG[status];
  const connections = node.connections || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="absolute top-4 right-4 w-80 z-20 pointer-events-auto"
    >
      <div className="rounded-2xl border border-white/10 bg-[#0a0f1c]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
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
          {node.model && <Row icon={Tag} label="Model" value={node.model} />}
          {node.ip && <Row icon={Hash} label="IP Address" value={node.ip} mono />}
          {node.mac && <Row icon={Hash} label="MAC Address" value={node.mac} mono />}
          {node.location && <Row icon={MapPin} label="Location" value={node.location} />}
          {node.serial && <Row icon={Hash} label="Serial" value={node.serial} mono />}
          {node.notes && (
            <div className="pt-1 border-t border-white/6">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><FileText size={10} /> Notes</p>
              <p className="text-xs text-slate-300 leading-relaxed">{node.notes}</p>
            </div>
          )}
        </div>
        {connections.length > 0 && (
          <div className="px-4 pb-4 border-t border-white/6 pt-3">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Cable size={10} /> Connections ({connections.length})
            </p>
            <div className="space-y-2">
              {connections.map((conn, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-cyan-400" />
                    <span className="text-slate-300 truncate">{conn.target}</span>
                  </div>
                  <span className="text-cyan-400/70 font-mono text-[10px] flex-shrink-0 ml-1">Port {conn.port}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
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

function PathPanel({ path, onClose }) {
  if (!path) return null;
  const hops = path.orderedNodes || [];
  const edges = path.orderedEdges || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[600px] max-w-[92vw]"
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
            const cable = i < edges.length ? edges[i] : null;
            const isEndpoint = i === 0 || i === hops.length - 1;
            return (
              <div key={nodeId} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${
                  isEndpoint
                    ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                    : "border-white/10 bg-white/4 text-slate-300"
                }`}>
                  {isEndpoint && <CheckCircle2 size={10} className="text-orange-400" />}
                  {nodeId}
                </div>
                {cable && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <ArrowRight size={10} />
                    <ArrowRight size={10} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

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

export default function NetworkMapTab({ topologyData, loading, onRefresh }) {
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pathMode, setPathMode] = useState(false);
  const [pathSource, setPathSource] = useState(null);
  const [pathTarget, setPathTarget] = useState(null);
  const [activePath, setActivePath] = useState(null);
  const dashOffsetRef = useRef(0);

  const pathRef = useRef(activePath);
  pathRef.current = activePath;
  const pathSourceRef = useRef(pathSource);
  pathSourceRef.current = pathSource;
  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

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

  useEffect(() => {
    let rafId;
    const animate = () => {
      dashOffsetRef.current = (dashOffsetRef.current - 0.4) % 20;
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const visibleDevices = useMemo(() => {
    if (!topologyData?.devices) return [];
    let devices = topologyData.devices;
    if (categoryFilter) {
      devices = devices.filter(d => d.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      devices = devices.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.ip?.toLowerCase().includes(q) ||
        d.model?.toLowerCase().includes(q) ||
        d.location?.toLowerCase().includes(q)
      );
    }
    return devices;
  }, [topologyData, categoryFilter, searchQuery]);

  const visibleIds = new Set(visibleDevices.map(d => d.id));
  const visibleConnections = useMemo(() => {
    if (!topologyData?.connections) return [];
    return topologyData.connections.filter(c => visibleIds.has(c.source) && visibleIds.has(c.target));
  }, [topologyData, visibleIds]);

  const graphData = useMemo(() => ({
    nodes: visibleDevices.map(d => ({
      ...d,
      status: d.status || "unknown",
      connections: visibleConnections.filter(c => c.source === d.id || c.target === d.id)
        .map(c => ({ target: c.source === d.id ? c.target : c.source, port: c.source_port })),
    })),
    links: visibleConnections.map(c => ({ ...c, source: c.source, target: c.target })),
  }), [visibleDevices, visibleConnections]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (!isFinite(node.x) || !isFinite(node.y)) return;
    const path = pathRef.current;
    const isPathNode = path?.nodeIds?.has(node.id);
    const isPickedSource = pathSourceRef.current?.id === node.id;
    const isSelected = !path && selectedNodeRef.current?.id === node.id;

    const catColor = CATEGORY_COLORS[node.category] || "#94a3b8";
    const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;
    const dimmed = path && !isPathNode;
    const radius = (isSelected || isPathNode) ? 14 : 10;

    ctx.globalAlpha = dimmed ? 0.2 : 1;

    if (isSelected || isPickedSource || isPathNode) {
      ctx.shadowColor = isPickedSource || isPathNode ? "#f97316" : catColor;
      ctx.shadowBlur = 22;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
    ctx.fillStyle = isPathNode ? "#fb923c22" : catColor + "22";
    ctx.fill();

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

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = isPathNode ? "#fb923c" : isSelected ? "#ffffff55" : catColor + "88";
    ctx.lineWidth = isPathNode ? 2 : isSelected ? 2 : 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x + radius * 0.68, node.y - radius * 0.68, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = statusColor;
    ctx.shadowBlur = 6;
    ctx.shadowColor = statusColor;
    ctx.fill();
    ctx.shadowBlur = 0;

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

    if (!pathSourceRef.current) {
      setPathSource(node);
      return;
    }

    if (pathSourceRef.current.id === node.id) {
      setPathSource(null);
      return;
    }

    const result = findPath(pathSourceRef.current.id, node.id, topologyData?.connections || []);
    setPathTarget(node);
    setActivePath(result);
  }, [pathMode, topologyData]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <p className="text-sm">Scanning network topology via SNMP...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 bg-[#0a0f1c]/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search devices..."
            className="bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none w-48"
          />
        </div>
        <button
          onClick={togglePathMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
            pathMode
              ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
              : "bg-[#0a0f1c]/90 border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          <GitBranch size={12} />
          {pathMode ? "Cancel Path Trace" : "Trace Path"}
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-[#0a0f1c]/90 text-slate-400 hover:text-white text-xs font-medium transition-all"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        <button
          onClick={() => graphRef.current?.zoomToFit(500, 80)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-[#0a0f1c]/90 text-slate-400 hover:text-white text-xs font-medium transition-all"
        >
          <Maximize2 size={12} />
          Fit
        </button>
      </div>

      {/* Graph */}
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="transparent"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "replace"}
        onNodeClick={handleNodeClick}
        nodeLabel={() => ""}
        cooldownTicks={80}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        onEngineStop={() => graphRef.current?.zoomToFit(500, 80)}
      />

      {/* Overlays */}
      <Legend filter={categoryFilter} onFilter={setCategoryFilter} />
      <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      <PathPanel path={activePath} onClose={clearPath} />

      {/* Path mode hint */}
      {pathMode && !pathSource && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium">
            Select the source device
          </div>
        </div>
      )}
      {pathMode && pathSource && !pathTarget && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium">
            Select the target device
          </div>
        </div>
      )}
    </div>
  );
}