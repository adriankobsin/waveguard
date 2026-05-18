import { useRef, useEffect, useCallback, useState } from "react";
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

// Build graph data with pre-resolved object references in links.
// This way force-graph never needs to do its own string→node lookup,
// which is what causes the "node not found" crash.
function buildGraphData(equipment, cables) {
  const nodeMap = new Map();

  equipment.forEach(eq => {
    const node = {
      id: eq.name,
      label: eq.name,
      category: eq.category,
      ...eq,
      status: MOCK_STATUS[eq.name] || "online",
    };
    nodeMap.set(eq.name, node);
  });

  // Ensure any cable endpoints that aren't in equipment are also nodes
  cables.forEach(c => {
    const fromName = (c.source ?? c.from ?? "").split(" (")[0];
    const toName = (c.target ?? c.to ?? "").split(" (")[0];
    [fromName, toName].forEach(name => {
      if (name && !nodeMap.has(name)) {
        nodeMap.set(name, { id: name, label: name, category: "Other", name, status: "unknown" });
      }
    });
  });

  const nodes = Array.from(nodeMap.values());

  // Pre-resolve source/target to actual node objects so force-graph
  // skips its internal string lookup entirely
  const links = cables
    .map(c => {
      const fromName = (c.source ?? c.from ?? "").split(" (")[0];
      const toName = (c.target ?? c.to ?? "").split(" (")[0];
      const sourceNode = nodeMap.get(fromName);
      const targetNode = nodeMap.get(toName);
      if (!sourceNode || !targetNode) return null;
      return { source: sourceNode, target: targetNode, label: c.type };
    })
    .filter(Boolean);

  return { nodes, links };
}

export default function NetworkGraph({ equipment, cables, onNodeClick, selectedNode }) {
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // selectedNode in a ref so callbacks stay stable and never cause re-renders
  const selectedNodeIdRef = useRef(selectedNode?.id ?? null);
  selectedNodeIdRef.current = selectedNode?.id ?? null;

  // Build once and never rebuild — the ref to graphData never changes,
  // so ForceGraph2D is never handed a new prop that triggers re-init
  const graphDataRef = useRef(null);
  if (!graphDataRef.current) {
    graphDataRef.current = buildGraphData(equipment, cables);
  }

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (!isFinite(node.x) || !isFinite(node.y)) return;
    const isSelected = selectedNodeIdRef.current === node.id;
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
  }, []); // stable — reads ref at paint time

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
        graphData={graphDataRef.current}
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
}