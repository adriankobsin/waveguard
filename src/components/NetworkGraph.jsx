import { useRef, useEffect, useCallback, useState, useMemo, memo } from "react";
import ForceGraph2D from "react-force-graph-2d";

const CATEGORY_COLORS = {
  Network: "#06b6d4",
  Camera: "#a78bfa",
  AV: "#60a5fa",
  Power: "#fbbf24",
  Control: "#34d399",
  Other: "#94a3b8",
};

const STATUS_COLORS = {
  online: "#22c55e",
  offline: "#ef4444",
  warning: "#f59e0b",
  unknown: "#64748b",
};

const MOCK_STATUS = {
  "SW-Bridge": "online",
  "SW-Saloon": "online",
  "Cam-Bridge-01": "offline",
  "AV-Proc-Saloon": "offline",
  "UPS-Main": "warning",
  "Router-WAN": "online",
  "SW-Deck-Lower": "warning",
  "AP-Deck-Aft": "online",
  "AV-Matrix-Saloon": "online",
  "TV-Saloon-Main": "online",
  "Rack-Comms": "online",
};

// Build stable graph data once — never rebuild so force-graph doesn't lose node refs
function buildGraphData(equipment, cables) {
  const nodeMap = new Map();
  equipment.forEach(eq => {
    nodeMap.set(eq.name, {
      id: eq.name,
      label: eq.name,
      category: eq.category,
      ...eq,
      status: MOCK_STATUS[eq.name] || "online",
    });
  });

  cables.forEach(c => {
    const fromName = (c.source ?? c.from ?? "").split(" (")[0];
    const toName = (c.target ?? c.to ?? "").split(" (")[0];
    [fromName, toName].forEach(name => {
      if (name && !nodeMap.has(name)) {
        nodeMap.set(name, { id: name, label: name, category: "Other", name, status: MOCK_STATUS[name] || "unknown" });
      }
    });
  });

  const nodes = Array.from(nodeMap.values());
  const links = cables
    .map(c => ({
      source: (c.source ?? c.from ?? "").split(" (")[0],
      target: (c.target ?? c.to ?? "").split(" (")[0],
      label: c.type,
      cableLabel: c.label,
    }))
    .filter(l => l.source && l.target && nodeMap.has(l.source) && nodeMap.has(l.target));

  return { nodes, links };
}

// Inner graph isolated from selectedNode re-renders via memo
const GraphCanvas = memo(function GraphCanvas({ graphData, selectedNodeId, onNodeClick }) {
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (!isFinite(node.x) || !isFinite(node.y)) return;
    const isSelected = selectedNodeId === node.id;
    const catColor = CATEGORY_COLORS[node.category] || "#94a3b8";
    const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;
    const radius = isSelected ? 14 : 10;

    if (isSelected) { ctx.shadowColor = catColor; ctx.shadowBlur = 20; }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
    ctx.fillStyle = statusColor + "33";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(node.x - 2, node.y - 2, 1, node.x, node.y, radius);
    grad.addColorStop(0, catColor + "ff");
    grad.addColorStop(1, catColor + "88");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x + radius * 0.65, node.y - radius * 0.65, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = statusColor;
    ctx.fill();
    ctx.shadowBlur = 0;

    const fontSize = Math.max(8, 10 / globalScale);
    ctx.font = `${isSelected ? "600" : "500"} ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = isSelected ? "#ffffff" : "rgba(255,255,255,0.75)";
    ctx.textAlign = "center";
    ctx.fillText(node.label, node.x, node.y + radius + fontSize + 2);
  }, [selectedNodeId]);

  const linkCanvasObject = useCallback((link, ctx) => {
    const start = link.source;
    const end = link.target;
    if (!start?.x || !end?.x || !isFinite(start.x) || !isFinite(end.x)) return;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = "rgba(6,182,212,0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
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
        onNodeClick={onNodeClick}
        nodeLabel={() => ""}
        cooldownTicks={80}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={true}
        enableZoomInteraction={true}
      />
    </div>
  );
});

export default function NetworkGraph({ equipment, cables, onNodeClick, selectedNode }) {
  // Build a fresh deep-copy each mount so force-graph can freely mutate it
  // without corrupting our source arrays. The memo key is a stable string so
  // it only rebuilds if the actual data identity changes.
  const dataKey = useMemo(
    () => equipment.map(e => e.name).join(","),
    [equipment]
  );

  const graphData = useMemo(() => {
    const base = buildGraphData(equipment, cables);
    // Deep copy so force-graph's internal mutations don't affect our source
    return {
      nodes: base.nodes.map(n => ({ ...n })),
      links: base.links.map(l => ({ ...l })),
    };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GraphCanvas
      key={dataKey}
      graphData={graphData}
      selectedNodeId={selectedNode?.id ?? null}
      onNodeClick={onNodeClick}
    />
  );
}