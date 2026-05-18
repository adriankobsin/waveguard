import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import RadialNetworkGraph from "./RadialNetworkGraph";
import { GroupManager } from "./GroupManager";
import { DeviceEditModal } from "./DeviceEditModal";
import LayoutSelector from "./LayoutSelector";
import { toast } from "sonner";
import {
  Search, Filter, RefreshCw, Maximize2, GitBranch, ArrowRight,
  CheckCircle2, Loader2, X, MapPin, Hash, Tag, FileText, Cable,
  Cpu, Wifi, Activity, ScanLine, Edit2, Link, Save, LayoutGrid
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

function DetailPanel({ node, onClose, onScan, onEdit }) {
  const [scanning, setScanning] = useState(false);
  if (!node) return null;
  const status = node.status || "unknown";
  const cfg = STATUS_CONFIG[status];
  const connections = node.connections || [];

  const handleScan = async () => {
    setScanning(true);
    try {
      await onScan?.(node);
    } finally {
      setScanning(false);
    }
  };

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
          <div className="flex items-center gap-1">
            {onEdit && (
              <button 
                onClick={onEdit} 
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
              >
                <Edit2 size={12} />
              </button>
            )}
            <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
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
          {node.firmware && <Row icon={Cpu} label="Firmware" value={node.firmware} mono />}
          {node.location && <Row icon={MapPin} label="Location" value={node.location} />}
          {node.serial && <Row icon={Hash} label="Serial" value={node.serial} mono />}
          {node.uptime && <Row icon={Activity} label="Uptime" value={node.uptime} />}
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
        <div className="px-4 pb-4 border-t border-white/6 pt-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} />}
            {scanning ? "Scanning..." : "Scan Device"}
          </button>
        </div>
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

function Legend({ filter, onFilter, statusFilter, onStatusFilter, groups, onGroupFilter, groupFilter }) {
  const GROUP_COLORS = {
    cyan: "#06b6d4",
    blue: "#3b82f6",
    purple: "#a855f7",
    green: "#22c55e",
    yellow: "#eab308",
    orange: "#f97316",
    red: "#ef4444",
    pink: "#ec4899",
  };

  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-white/10 bg-[#0a0f1c]/90 backdrop-blur-md p-3 space-y-1.5 max-h-[80vh] overflow-y-auto">
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
      
      {groups && groups.length > 0 && (
        <div className="border-t border-white/6 mt-2 pt-2 space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Groups</p>
          {groups.map(group => {
            const groupColor = GROUP_COLORS[group.color] || "#94a3b8";
            const deviceCount = group.device_ids?.length || 0;
            return (
              <button
                key={group.id}
                onClick={() => onGroupFilter?.(g => g === group.id ? null : group.id)}
                className={`flex items-center justify-between gap-2 text-xs w-full transition-opacity ${
                  groupFilter && groupFilter !== group.id ? "opacity-30" : "opacity-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: groupColor }} />
                  <span className="text-slate-400">{group.name}</span>
                </div>
                <span className="text-[10px] text-slate-600">{deviceCount}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="border-t border-white/6 mt-2 pt-2 space-y-1.5">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Status</p>
        {Object.entries(STATUS_COLORS).map(([s, color]) => (
          <button
            key={s}
            onClick={() => onStatusFilter(f => f === s ? null : s)}
            className={`flex items-center gap-2 text-xs w-full transition-opacity ${statusFilter && statusFilter !== s ? "opacity-30" : "opacity-100"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-slate-400 capitalize">{s}</span>
          </button>
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
  const [statusFilter, setStatusFilter] = useState(null);
  const [groupFilter, setGroupFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pathMode, setPathMode] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [groups, setGroups] = useState([]);
  const [connectionMode, setConnectionMode] = useState(false);
  const [customPositions, setCustomPositions] = useState({});
  const [currentLayout, setCurrentLayout] = useState(null);

  // Load groups
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await base44.entities.DeviceGroup.list();
        setGroups(response);
      } catch (error) {
        console.error('Failed to load groups:', error);
      }
    };
    loadGroups();
  }, []);

  // Load saved layout
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const response = await base44.functions.invoke('loadTopologyLayout', {});
        if (response.data.layout) {
          setCurrentLayout(response.data.layout);
          setCustomPositions(response.data.layout.node_positions || {});
        }
      } catch (error) {
        console.error('Failed to load layout:', error);
      }
    };
    loadLayout();
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.5, Math.min(2, z + delta)));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);
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
    if (statusFilter) {
      devices = devices.filter(d => d.status === statusFilter);
    }
    if (groupFilter) {
      const group = groups.find(g => g.id === groupFilter);
      if (group) {
        const groupDeviceIds = new Set(group.device_ids || []);
        devices = devices.filter(d => groupDeviceIds.has(d.id));
      }
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
  }, [topologyData, categoryFilter, statusFilter, groupFilter, groups, searchQuery]);

  const visibleIds = new Set(visibleDevices.map(d => d.id));
  const visibleConnections = useMemo(() => {
    if (!topologyData?.connections) return [];
    return topologyData.connections.filter(c => visibleIds.has(c.source) && visibleIds.has(c.target));
  }, [topologyData, visibleIds]);

  const graphData = useMemo(() => ({
    nodes: visibleDevices.map(d => ({
      id: d.id,
      name: d.name,
      category: d.category,
      status: d.status || "unknown",
      ...d,
      connections: visibleConnections.filter(c => c.source === d.id || c.target === d.id)
        .map(c => ({ target: c.source === d.id ? c.target : c.source, port: c.source_port })),
    })),
    links: visibleConnections.map((c, idx) => ({ 
      id: c.id || `link-${idx}`,
      source: c.source, 
      target: c.target,
      ...c 
    })),
  }), [visibleDevices, visibleConnections]);



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

  const handleScanDevice = useCallback(async (node) => {
    try {
      const response = await base44.functions.invoke('networkScan', { target: node.ip });
      if (response.data.success) {
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to scan device:', error);
    }
  }, [onRefresh]);

  const handleUpdateDevice = useCallback(async (deviceData) => {
    try {
      const response = await base44.functions.invoke('updateDevice', {
        deviceId: editingDevice.id,
        deviceData,
      });
      if (response.data.success) {
        toast.success("Device updated successfully");
        onRefresh?.();
        setEditingDevice(null);
      }
    } catch (error) {
      console.error('Failed to update device:', error);
      toast.error("Failed to update device");
    }
  }, [editingDevice, onRefresh]);

  const handleNodeDrag = useCallback((nodeId, x, y) => {
    setCustomPositions(prev => ({
      ...prev,
      [nodeId]: { x, y }
    }));
  }, []);

  const handleConnectionCreate = useCallback(async (sourceNode, targetNode) => {
    try {
      toast.success(`Connection created: ${sourceNode.name} → ${targetNode.name}`);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to create connection:', error);
      toast.error("Failed to create connection");
    }
  }, [onRefresh]);

  const handleSaveLayout = useCallback(async () => {
    try {
      const layoutName = prompt('Enter layout name:', currentLayout?.name || 'My Layout');
      if (!layoutName) return;

      const layoutData = {
        id: currentLayout?.id,
        name: layoutName,
        node_positions: customPositions,
        is_default: confirm('Set as default layout?')
      };

      const response = await base44.functions.invoke('saveTopologyLayout', { layoutData });
      if (response.data.success) {
        toast.success('Layout saved successfully');
        setCurrentLayout(response.data.layout);
      }
    } catch (error) {
      console.error('Failed to save layout:', error);
      toast.error("Failed to save layout");
    }
  }, [customPositions, currentLayout]);

  const handleLoadLayout = useCallback(async (layout) => {
    try {
      setCurrentLayout(layout);
      setCustomPositions(layout.node_positions || {});
      toast.success(`Layout "${layout.name}" loaded`);
    } catch (error) {
      console.error('Failed to load layout:', error);
      toast.error("Failed to load layout");
    }
  }, []);

  const toggleConnectionMode = useCallback(() => {
    setConnectionMode(m => !m);
  }, []);

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
    <div ref={containerRef} className="w-full h-full relative bg-[#060912] overflow-hidden">
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
          onClick={toggleConnectionMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
            connectionMode
              ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
              : "bg-[#0a0f1c]/90 border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          <Link size={12} />
          {connectionMode ? "Cancel Connection" : "Create Connection"}
        </button>
        <LayoutSelector 
          currentLayout={currentLayout}
          onLoadLayout={handleLoadLayout}
          onSaveLayout={handleSaveLayout}
        />
        <button
          onClick={handleSaveLayout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-[#0a0f1c]/90 text-slate-400 hover:text-white text-xs font-medium transition-all"
        >
          <Save size={12} />
          Save Layout
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-[#0a0f1c]/90 text-slate-400 hover:text-white text-xs font-medium transition-all"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        <div className="flex items-center gap-1 bg-[#0a0f1c]/90 backdrop-blur-md border border-white/10 rounded-xl px-2 py-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
          >
            <span className="text-lg font-bold">−</span>
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.25))}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
          >
            <span className="text-lg font-bold">+</span>
          </button>
        </div>
      </div>

      {/* Graph */}
      <RadialNetworkGraph
        graphData={graphData}
        selectedNode={selectedNode}
        onNodeClick={handleNodeClick}
        onNodeDrag={handleNodeDrag}
        onConnectionCreate={handleConnectionCreate}
        pathSource={pathSource}
        activePath={activePath}
        dimensions={dimensions}
        zoom={zoom}
        connectionMode={connectionMode}
      />

      {/* Pan hint */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="px-3 py-1.5 rounded-lg bg-[#0a0f1c]/90 backdrop-blur-md border border-white/10 text-xs text-slate-400">
          Drag nodes to reposition · Scroll to zoom
        </div>
      </div>

      {/* Connection mode hint */}
      {connectionMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium">
            Click two devices to create a connection
          </div>
        </div>
      )}

      {/* Group Manager */}
      <GroupManager devices={topologyData?.devices || []} onGroupChange={() => {}} />

      {/* Overlays */}
      <Legend 
        filter={categoryFilter} 
        onFilter={setCategoryFilter} 
        statusFilter={statusFilter} 
        onStatusFilter={setStatusFilter}
        groups={groups}
        onGroupFilter={setGroupFilter}
      />
      <DetailPanel 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)} 
        onScan={handleScanDevice}
        onEdit={() => setEditingDevice(selectedNode)}
      />
      <PathPanel path={activePath} onClose={clearPath} />

      {/* Device Edit Modal */}
      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          onSubmit={handleUpdateDevice}
          onClose={() => setEditingDevice(null)}
        />
      )}

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