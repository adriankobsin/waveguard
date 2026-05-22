import { useState, useEffect, useMemo, useRef } from "react";
import { Search, RefreshCw, Loader2 } from "lucide-react";
import SignalFlowCanvas from "./SignalFlowCanvas";
import { listSignalLinks } from "@/api/topologyApi";
import { normalizeEquipmentRecord, CATEGORY_COLORS } from "@/lib/topology/equipmentCatalog";

const PROTOCOL_COLORS = {
  Dante: "#22c55e",
  NVX: "#60a5fa",
  HDMI: "#f472b6",
};

export default function AvSignalFlowTab({ topologyData, onRefresh, loading }) {
  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const containerRef = useRef(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setDimensions({ width: node.offsetWidth, height: node.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLinksLoading(true);
      try {
        const rows = await listSignalLinks({ kind: "av" });
        if (!cancelled) setLinks(rows);
      } finally {
        if (!cancelled) setLinksLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topologyData]);

  const devices = useMemo(() => {
    const all = (topologyData?.devices || []).map((d) => normalizeEquipmentRecord(d));
    const linkedIds = new Set();
    links.forEach((l) => {
      linkedIds.add(l.sourceEquipmentId);
      linkedIds.add(l.targetEquipmentId);
    });
    return all.filter((d) => d.avRole !== "none" || linkedIds.has(d.id));
  }, [topologyData, links]);

  const deviceMap = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);

  const filteredDevices = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.model?.toLowerCase().includes(q) ||
        d.avRole?.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const filteredIds = useMemo(() => new Set(filteredDevices.map((d) => d.id)), [filteredDevices]);

  const graphNodes = useMemo(
    () =>
      filteredDevices.map((d) => ({
        id: d.id,
        label: d.name,
        layer: d.avRole,
        color: CATEGORY_COLORS[d.category] || "#60a5fa",
      })),
    [filteredDevices]
  );

  const graphEdges = useMemo(
    () =>
      links
        .filter((l) => filteredIds.has(l.sourceEquipmentId) && filteredIds.has(l.targetEquipmentId))
        .map((l) => ({
          id: l.id,
          source: l.sourceEquipmentId,
          target: l.targetEquipmentId,
          label: l.protocol,
          color: PROTOCOL_COLORS[l.protocol] || "#64748b",
          multicast: l.multicast,
        })),
    [links, filteredIds]
  );

  const streams = useMemo(
    () =>
      links.map((l) => ({
        id: l.id,
        from: deviceMap[l.sourceEquipmentId]?.name || l.sourceEquipmentId,
        to: deviceMap[l.targetEquipmentId]?.name || l.targetEquipmentId,
        protocol: l.protocol,
        multicast: l.multicast || "—",
        status: l.status || "unknown",
        raw: l,
      })),
    [links, deviceMap]
  );

  if (loading || linksLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">Loading AV signal flow…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 bg-secondary/90 border border-border rounded-xl px-3 py-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AV devices..."
            className="bg-transparent text-sm text-foreground w-48 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-2 rounded-xl border border-border bg-secondary/90 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div ref={containerRef} className="flex-1 relative min-h-0">
        <SignalFlowCanvas
          nodes={graphNodes}
          edges={graphEdges}
          layoutMode="layered"
          selectedNodeId={selectedNode?.id}
          onNodeSelect={(n) => {
            setSelectedNode(n);
            if (n) {
              const stream = streams.find(
                (s) => s.raw.sourceEquipmentId === n.id || s.raw.targetEquipmentId === n.id
              );
              setSelectedStream(stream || null);
            }
          }}
          dimensions={dimensions}
        />
      </div>

      <div className="flex-shrink-0 border-t border-border bg-secondary/95 max-h-48 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary">
            <tr className="text-muted-foreground text-left">
              <th className="px-4 py-2 font-medium">Endpoint A</th>
              <th className="px-4 py-2 font-medium">Endpoint B</th>
              <th className="px-4 py-2 font-medium">Protocol</th>
              <th className="px-4 py-2 font-medium">Multicast</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {streams.map((s) => (
              <tr
                key={s.id}
                onClick={() => {
                  setSelectedStream(s);
                  setSelectedNode({ id: s.raw.sourceEquipmentId });
                }}
                className={`border-t border-border cursor-pointer hover:bg-secondary ${
                  selectedStream?.id === s.id ? "bg-cyan-500/10" : ""
                }`}
              >
                <td className="px-4 py-2 text-foreground">{s.from}</td>
                <td className="px-4 py-2 text-foreground">{s.to}</td>
                <td className="px-4 py-2" style={{ color: PROTOCOL_COLORS[s.protocol] }}>
                  {s.protocol}
                </td>
                <td className="px-4 py-2 font-mono text-muted-foreground">{s.multicast}</td>
                <td className="px-4 py-2 text-emerald-400 capitalize">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
