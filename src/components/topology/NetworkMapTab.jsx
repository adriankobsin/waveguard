import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { GroupManager } from "./GroupManager";
import { DeviceEditModal } from "./DeviceEditModal";
import DeviceImportModal from "./DeviceImportModal";
import NetworkEquipmentList from "./NetworkEquipmentList";
import SnmpPortMapPanel from "../snmp/SnmpPortMapPanel";
import { networkScanDeviceToPatch } from "@/lib/topology/syncTopologyFromEquipment";
import {
  persistTopologyDeviceEdit,
  persistTopologyDeviceScan,
} from "@/lib/topology/persistTopologyDevice";
import { toast } from "sonner";
import {
  Search, RefreshCw, GitBranch, ArrowRight,
  Loader2, X, MapPin, Hash, Tag, FileText, Cable,
  Cpu, Activity, ScanLine, Upload, Wrench, Users, Network, Pencil,
} from "lucide-react";
import { useTopologyAdmin } from "@/hooks/useTopologyAdmin";

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
  unknown: { label: "Unknown", color: "text-muted-foreground", bg: "bg-slate-500/15 border-slate-500/30", dot: "bg-slate-400" },
};

function findPath(sourceId, targetId, connections) {
  if (sourceId === targetId) return { nodeIds: new Set([sourceId]), edgeIds: new Set(), orderedNodes: [sourceId], orderedEdges: [] };

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
    <div className="w-80 flex-shrink-0 border-l border-border bg-secondary flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{node.name}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Pencil size={12} />
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="px-4 pt-3 pb-1 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border border-border text-muted-foreground">
          {node.category}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2.5 flex-1">
        {node.model && <Row icon={Tag} label="Model" value={node.model} />}
        {node.ip && <Row icon={Hash} label="IP Address" value={node.ip} mono />}
        {node.mac && <Row icon={Hash} label="MAC Address" value={node.mac} mono />}
        {node.firmware && <Row icon={Cpu} label="Firmware" value={node.firmware} mono />}
        {node.location && <Row icon={MapPin} label="Location" value={node.location} />}
        {node.serial && <Row icon={Hash} label="Serial" value={node.serial} mono />}
        {node.uptime && <Row icon={Activity} label="Uptime" value={node.uptime} />}
        {node.notes && (
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><FileText size={10} /> Notes</p>
            <p className="text-xs text-secondary-foreground leading-relaxed">{node.notes}</p>
          </div>
        )}
        {connections.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Cable size={10} /> Connections ({connections.length})
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {connections.map((conn, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-secondary-foreground truncate">{conn.targetName || conn.target}</span>
                  {conn.port && <span className="text-cyan-400/70 font-mono text-[10px]">Port {conn.port}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-4 pb-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning || !node.ip}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 text-xs font-medium transition-all disabled:opacity-50"
        >
          {scanning ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} />}
          {scanning ? "Scanning..." : "Scan Device"}
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0"><Icon size={10} />{label}</span>
      <span className={`text-xs text-foreground truncate text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function PathPanel({ path, deviceMap, onClose }) {
  if (!path) return null;
  const hops = path.orderedNodes || [];

  return (
    <div className="border-t border-orange-500/20 bg-orange-500/5 px-4 py-3 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-orange-400" />
          <p className="text-xs font-semibold text-foreground">Signal Path</p>
          <span className="text-xs text-muted-foreground">{hops.length - 1} hop{hops.length !== 2 ? "s" : ""}</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
          <X size={11} />
        </button>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {hops.map((nodeId, i) => (
          <div key={nodeId} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${
              i === 0 || i === hops.length - 1
                ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                : "border-border bg-muted text-secondary-foreground"
            }`}>
              {deviceMap[nodeId]?.name || nodeId}
            </div>
            {i < hops.length - 1 && <ArrowRight size={10} className="text-muted-foreground" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}

export default function NetworkMapTab({
  topologyData,
  refreshing = false,
  onFullRefresh,
  onPatchDevice,
  onSyncFromEquipment,
}) {
  const { canEdit } = useTopologyAdmin();
  const location = useLocation();
  const [selectedNode, setSelectedNode] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [groupFilter, setGroupFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pathMode, setPathMode] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [groups, setGroups] = useState([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSnmpPanel, setShowSnmpPanel] = useState(false);
  const [cableBanner, setCableBanner] = useState(null);
  const [pathSource, setPathSource] = useState(null);
  const [pathTarget, setPathTarget] = useState(null);
  const [activePath, setActivePath] = useState(null);

  const deviceMap = useMemo(() => {
    const map = {};
    for (const d of topologyData?.devices || []) {
      map[d.id] = d;
    }
    return map;
  }, [topologyData?.devices]);

  useEffect(() => {
    if (!selectedNode?.id || !topologyData?.devices) return;
    const updated = topologyData.devices.find((d) => d.id === selectedNode.id);
    if (updated) {
      setSelectedNode((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    }
  }, [topologyData?.devices, selectedNode?.id]);

  useEffect(() => {
    if (!topologyData?.devices || !topologyData?.connections) return;
    const params = new URLSearchParams(location.search);
    const cableLabel = params.get("cableLabel");
    const fromName = params.get("from");
    const toName = params.get("to");
    if (!fromName && !toName) return;

    setCableBanner({ label: cableLabel, from: fromName, to: toName });

    const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const fromDevice = topologyData.devices.find(d => normalize(d.name).includes(normalize(fromName)) || normalize(fromName).includes(normalize(d.name)));
    const toDevice = topologyData.devices.find(d => normalize(d.name).includes(normalize(toName)) || normalize(toName).includes(normalize(d.name)));

    if (fromDevice && toDevice) {
      const result = findPath(fromDevice.id, toDevice.id, topologyData.connections);
      setPathSource(fromDevice);
      setPathTarget(toDevice);
      setActivePath(result);
      setSelectedNode(fromDevice);
    }
  }, [topologyData, location.search]);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await base44.entities.DeviceGroup.list();
        setGroups(response);
      } catch (error) {
        console.error("Failed to load groups:", error);
      }
    };
    loadGroups();
  }, []);

  const visibleConnections = useMemo(() => {
    if (!topologyData?.connections) return [];
    return topologyData.connections;
  }, [topologyData?.connections]);

  const listDevices = useMemo(() => {
    if (!topologyData?.devices) return [];
    let devices = topologyData.devices;
    if (categoryFilter) devices = devices.filter(d => d.category === categoryFilter);
    if (statusFilter) devices = devices.filter(d => d.status === statusFilter);
    if (groupFilter) {
      const group = groups.find(g => g.id === groupFilter);
      if (group) {
        const ids = new Set(group.device_ids || []);
        devices = devices.filter(d => ids.has(d.id));
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      devices = devices.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.ip?.toLowerCase().includes(q) ||
        d.model?.toLowerCase().includes(q) ||
        d.location?.toLowerCase().includes(q)
      );
    }
    return devices.map(d => ({
      ...d,
      connections: visibleConnections
        .filter(c => c.source === d.id || c.target === d.id)
        .map(c => {
          const otherId = c.source === d.id ? c.target : c.source;
          return {
            target: otherId,
            targetName: deviceMap[otherId]?.name || otherId,
            port: c.source_port,
          };
        }),
    }));
  }, [topologyData, categoryFilter, statusFilter, groupFilter, groups, searchQuery, visibleConnections, deviceMap]);

  const handleRowClick = useCallback((node) => {
    if (!pathMode) {
      setSelectedNode(prev => (prev?.id === node.id ? null : { ...node }));
      return;
    }
    if (!pathSource) {
      setPathSource(node);
      setSelectedNode(node);
      return;
    }
    if (pathSource.id === node.id) {
      setPathSource(null);
      return;
    }
    const result = findPath(pathSource.id, node.id, topologyData?.connections || []);
    setPathTarget(node);
    setActivePath(result);
    setSelectedNode(node);
  }, [pathMode, pathSource, topologyData]);

  const clearPath = useCallback(() => {
    setPathSource(null);
    setPathTarget(null);
    setActivePath(null);
  }, []);

  const togglePathMode = useCallback(() => {
    setPathMode(m => {
      if (m) {
        clearPath();
      }
      return !m;
    });
  }, [clearPath]);

  const handleScanDevice = useCallback(async (node) => {
    if (!node.ip) {
      toast.error("No IP address to scan");
      return;
    }
    try {
      const response = await base44.functions.invoke("networkScan", { target: node.ip });
      if (response.data?.success) {
        const scanned = response.data.devices?.[0];
        if (scanned) {
          const savedNode = await persistTopologyDeviceScan(node.id, scanned, node);
          if (onPatchDevice) {
            onPatchDevice(node.id, networkScanDeviceToPatch(scanned, { ...node, ...savedNode }));
          }
        }
        toast.success(`Scan complete for ${node.name}`);
      }
    } catch (error) {
      console.error("Failed to scan device:", error);
      toast.error("Scan failed");
    }
  }, [onPatchDevice]);

  const handleUpdateDevice = useCallback(async (deviceData) => {
    if (!editingDevice?.id) return;
    try {
      const savedNode = await persistTopologyDeviceEdit(
        editingDevice.id,
        deviceData,
        editingDevice
      );
      if (onPatchDevice) {
        onPatchDevice(editingDevice.id, savedNode);
      }
      toast.success("Device updated");
      setEditingDevice(null);
    } catch (error) {
      console.error("Failed to update device:", error);
      toast.error(error.message || "Failed to update device");
    }
  }, [editingDevice, onPatchDevice]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none flex-1"
            />
          </div>
          <button
            type="button"
            onClick={onFullRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Scanning…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setShowSnmpPanel(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium"
          >
            <Network size={12} />
            SNMP Map
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setToolsOpen((o) => !o)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
                pathMode ? "border-orange-500/40 bg-orange-500/15 text-orange-300" : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wrench size={12} />
              Tools
            </button>
            {toolsOpen && (
              <div className="absolute top-full right-0 mt-1 min-w-[200px] rounded-xl border border-border bg-secondary shadow-xl py-1 z-30">
                <button
                  type="button"
                  onClick={() => { togglePathMode(); setToolsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-secondary flex items-center gap-2 text-secondary-foreground"
                >
                  <GitBranch size={12} />
                  {pathMode ? "Cancel path trace" : "Trace path"}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setShowImportModal(true); setToolsOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-secondary-foreground hover:bg-secondary flex items-center gap-2"
                  >
                    <Upload size={12} />
                    Import CSV
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setShowGroupManager(true); setToolsOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-secondary-foreground hover:bg-secondary flex items-center gap-2"
                  >
                    <Users size={12} />
                    Manage groups
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {listDevices.length} device{listDevices.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Category</span>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <FilterChip
              key={cat}
              label={cat}
              color={color}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(f => (f === cat ? null : cat))}
            />
          ))}
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mx-2">Status</span>
          {Object.entries(STATUS_COLORS).map(([s, color]) => (
            <FilterChip
              key={s}
              label={s}
              color={color}
              active={statusFilter === s}
              onClick={() => setStatusFilter(f => (f === s ? null : s))}
            />
          ))}
          {groups.length > 0 && (
            <select
              value={groupFilter || ""}
              onChange={(e) => setGroupFilter(e.target.value || null)}
              className="ml-2 px-2 py-1 rounded-lg border border-border bg-secondary text-xs text-secondary-foreground"
            >
              <option value="">All groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>

        {cableBanner && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Cable size={13} className="text-cyan-400" />
            <div className="text-xs flex-1 min-w-0">
              <span className="text-muted-foreground">Cable path: </span>
              <span className="text-cyan-300 font-mono">{cableBanner.label || "cable"}</span>
              {cableBanner.from && cableBanner.to && (
                <span className="text-muted-foreground"> · {cableBanner.from} → {cableBanner.to}</span>
              )}
            </div>
            <button onClick={() => { setCableBanner(null); clearPath(); }} className="text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          </div>
        )}

        {pathMode && (
          <p className="text-xs text-orange-300 px-2">
            {!pathSource ? "Path trace: click a device as source" : !pathTarget ? `Source: ${pathSource.name} — click target device` : `Path: ${pathSource.name} → ${pathTarget.name}`}
          </p>
        )}

        {refreshing && (
          <p className="text-xs text-cyan-400/80 px-2 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            Refreshing topology scan…
          </p>
        )}
      </div>

      {/* Main: list + detail */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <NetworkEquipmentList
            devices={listDevices}
            selectedNode={selectedNode}
            pathSource={pathSource}
            pathTarget={pathTarget}
            pathMode={pathMode}
            onRowClick={handleRowClick}
            onScan={handleScanDevice}
            onEdit={(d) => setEditingDevice(d)}
          />
          <PathPanel path={activePath} deviceMap={deviceMap} onClose={() => { clearPath(); setCableBanner(null); }} />
        </div>
        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onScan={handleScanDevice}
            onEdit={() => setEditingDevice(selectedNode)}
          />
        )}
      </div>

      {showGroupManager && (
        <GroupManager
          devices={topologyData?.devices || []}
          onGroupChange={async () => {
            try {
              const response = await base44.entities.DeviceGroup.list();
              setGroups(response);
            } catch {
              /* ignore */
            }
            onSyncFromEquipment?.();
          }}
        />
      )}

      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          onSubmit={handleUpdateDevice}
          onClose={() => setEditingDevice(null)}
        />
      )}

      <DeviceImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          onSyncFromEquipment?.();
        }}
      />

      {/* SNMP slide-over */}
      <AnimatePresence>
        {showSnmpPanel && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowSnmpPanel(false)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative w-full max-w-lg h-full bg-secondary border-l border-border shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Network size={14} className="text-cyan-400" />
                  SNMP Port Map
                </h3>
                <button onClick={() => setShowSnmpPanel(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <SnmpPortMapPanel />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
