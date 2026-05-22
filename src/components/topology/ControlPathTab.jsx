import { useState, useEffect, useMemo, useRef } from "react";
import { Search, RefreshCw, Loader2 } from "lucide-react";
import SignalFlowCanvas from "./SignalFlowCanvas";
import { listSignalLinks } from "@/api/topologyApi";
import { normalizeEquipmentRecord, CATEGORY_COLORS } from "@/lib/topology/equipmentCatalog";
import { CONTROL_TYPE_COLORS } from "@/lib/equipment/deviceFormConstants";

const CONTROL_COLORS = CONTROL_TYPE_COLORS;

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}

export default function ControlPathTab({ topologyData, onRefresh, loading }) {
  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [controlFilter, setControlFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
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
        const rows = await listSignalLinks({ kind: "control" });
        if (!cancelled) setLinks(rows);
      } finally {
        if (!cancelled) setLinksLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topologyData]);

  const devices = useMemo(
    () =>
      (topologyData?.devices || [])
        .map((d) => normalizeEquipmentRecord(d))
        .filter((d) => d.controlType && d.controlType !== "none"),
    [topologyData]
  );

  const deviceMap = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);

  const filteredIds = useMemo(() => {
    const q = search.toLowerCase();
    return new Set(
      devices
        .filter((d) => {
          if (controlFilter && d.controlType !== controlFilter) return false;
          if (!q) return true;
          return (
            d.name?.toLowerCase().includes(q) ||
            d.location?.toLowerCase().includes(q) ||
            d.controlType?.toLowerCase().includes(q)
          );
        })
        .map((d) => d.id)
    );
  }, [devices, search, controlFilter]);

  const graphNodes = useMemo(
    () =>
      devices
        .filter((d) => filteredIds.has(d.id))
        .map((d) => ({
          id: d.id,
          label: d.name,
          controlType: d.controlType,
          color: CONTROL_COLORS[d.controlType] || CATEGORY_COLORS[d.category],
        })),
    [devices, filteredIds]
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
          color: CONTROL_COLORS[l.protocol] || "#64748b",
        })),
    [links, filteredIds]
  );

  const controlTypes = useMemo(() => [...new Set(devices.map((d) => d.controlType))], [devices]);

  if (loading || linksLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">Loading control path…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      <div ref={containerRef} className="flex-1 relative min-w-0">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="flex items-center gap-2 bg-secondary/90 border border-border rounded-xl px-3 py-2">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-sm text-foreground w-40 focus:outline-none"
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

        <SignalFlowCanvas
          nodes={graphNodes}
          edges={graphEdges}
          layoutMode="free"
          selectedNodeId={selected?.id}
          onNodeSelect={setSelected}
          colorForNode={(n) => CONTROL_COLORS[n.controlType] || n.color}
          dimensions={dimensions}
        />

        <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-border bg-secondary/90 p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Control type</p>
          {controlTypes.map((ct) => (
            <button
              key={ct}
              type="button"
              onClick={() => setControlFilter((f) => (f === ct ? null : ct))}
              className={`flex items-center gap-2 text-xs w-full ${controlFilter && controlFilter !== ct ? "opacity-40" : ""}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: CONTROL_COLORS[ct] }} />
              <span className="text-muted-foreground">{ct}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <aside className="w-72 border-l border-border bg-secondary/95 p-4 flex-shrink-0 overflow-y-auto">
          <p className="text-sm font-semibold text-foreground">{selected.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{deviceMap[selected.id]?.model}</p>
          <div className="mt-4 space-y-2">
            <DetailRow label="Control" value={deviceMap[selected.id]?.controlType} />
            <DetailRow label="IP" value={deviceMap[selected.id]?.ip} />
            <DetailRow label="Status" value={deviceMap[selected.id]?.status} />
            <DetailRow label="Location" value={deviceMap[selected.id]?.location} />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase mt-4 mb-2">Links</p>
          {links
            .filter((l) => l.sourceEquipmentId === selected.id || l.targetEquipmentId === selected.id)
            .map((l) => (
              <div key={l.id} className="text-xs text-muted-foreground py-1 border-b border-border">
                {l.label || l.protocol}
              </div>
            ))}
        </aside>
      )}
    </div>
  );
}



