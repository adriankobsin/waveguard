import { useRef, useEffect, useCallback, useMemo } from "react";

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

const RING_RADII = {
  core: 80,
  switches: 200,
  edges: 380,
};

function calculateRadialPosition(index, total, radius) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export default function RadialNetworkGraph({
  graphData,
  selectedNode,
  onNodeClick,
  pathSource,
  activePath,
  dimensions,
  zoom = 1,
}) {
  const canvasRef = useRef();

  // Categorize and position nodes
  const nodePositions = useMemo(() => {
    if (!graphData?.nodes) return {};

    const positions = {};
    const centerX = (dimensions.width || 800) / 2;
    const centerY = (dimensions.height || 600) / 2;

    const core = graphData.nodes.filter(n =>
      n.category === "Network" && (n.name?.toLowerCase().includes("router") || n.name?.toLowerCase().includes("gateway"))
    );
    const switches = graphData.nodes.filter(n =>
      n.category === "Network" && !n.name?.toLowerCase().includes("router") && !n.name?.toLowerCase().includes("gateway")
    );
    const edges = graphData.nodes.filter(n => n.category !== "Network");

    // Core devices
    core.forEach((node, idx) => {
      const pos = calculateRadialPosition(idx, Math.max(1, core.length), RING_RADII.core);
      positions[node.id] = { ...node, x: centerX + pos.x, y: centerY + pos.y, ring: "core" };
    });

    // Switches
    switches.forEach((node, idx) => {
      const pos = calculateRadialPosition(idx, Math.max(1, switches.length), RING_RADII.switches);
      positions[node.id] = { ...node, x: centerX + pos.x, y: centerY + pos.y, ring: "switches" };
    });

    // Edge devices
    edges.forEach((node, idx) => {
      const pos = calculateRadialPosition(idx, Math.max(1, edges.length), RING_RADII.edges);
      positions[node.id] = { ...node, x: centerX + pos.x, y: centerY + pos.y, ring: "edges" };
    });

    return positions;
  }, [graphData, dimensions]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = dimensions.width || 800;
    const height = dimensions.height || 600;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#060912";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Apply zoom transform
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(zoom, zoom);
    ctx.translate(-centerX, -centerY);

    // Draw concentric rings
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 1;
    [RING_RADII.core, RING_RADII.switches, RING_RADII.edges].forEach(r => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Draw connections
    if (graphData?.links) {
      graphData.links.forEach(link => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        const sourceNode = nodePositions[sourceId];
        const targetNode = nodePositions[targetId];

        if (!sourceNode || !targetNode) return;

        const isPathEdge = activePath?.edgeIds?.has(link.id);
        const dimmed = activePath && !isPathEdge;

        ctx.globalAlpha = dimmed ? 0.1 : 0.4;
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);

        // Curve midpoint
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        const offsetX = (targetNode.y - sourceNode.y) * 0.15;
        const offsetY = -(targetNode.x - sourceNode.x) * 0.15;

        ctx.quadraticCurveTo(midX + offsetX, midY + offsetY, targetNode.x, targetNode.y);

        if (isPathEdge) {
          ctx.strokeStyle = "#f97316";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else {
          ctx.strokeStyle = CATEGORY_COLORS[sourceNode.category] || "#64748b";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }

    ctx.globalAlpha = 1;

    // Draw nodes
    Object.values(nodePositions).forEach(node => {
      const isSelected = selectedNode?.id === node.id && !activePath;
      const isPathNode = activePath?.nodeIds?.has(node.id);
      const isPickedSource = pathSource?.id === node.id;
      const dimmed = activePath && !isPathNode;

      const catColor = CATEGORY_COLORS[node.category] || "#94a3b8";
      const statusColor = STATUS_COLORS[node.status] || "#64748b";
      const radius = isSelected || isPathNode ? 14 : 10;

      ctx.globalAlpha = dimmed ? 0.15 : 1;

      // Glow effect
      if (isSelected || isPickedSource || isPathNode) {
        ctx.shadowColor = isPathNode || isPickedSource ? "#f97316" : catColor;
        ctx.shadowBlur = 16;
      }

      // Outer ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = isPathNode ? "#fb923c33" : catColor + "22";
      ctx.fill();

      // Main node
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(node.x - 2, node.y - 2, 0, node.x, node.y, radius);
      grad.addColorStop(0, isPathNode ? "#fb923cff" : catColor + "ff");
      grad.addColorStop(1, isPathNode ? "#ea580ccc" : catColor + "99");
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isPathNode ? "#f97316" : isSelected ? "#ffffff" : catColor + "99";
      ctx.lineWidth = isPathNode || isSelected ? 2 : 1.5;
      ctx.stroke();

      // Status dot
      ctx.beginPath();
      ctx.arc(node.x + radius * 0.7, node.y - radius * 0.7, 3, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.shadowBlur = 8;
      ctx.shadowColor = statusColor;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.font = `${isSelected || isPathNode ? "600" : "500"} 11px Inter, sans-serif`;
      ctx.fillStyle = isSelected || isPathNode ? "#ffffff" : "rgba(255,255,255,0.8)";
      ctx.textAlign = "center";
      const label = node.name.length > 13 ? node.name.slice(0, 12) + "…" : node.name;
      ctx.fillText(label, node.x, node.y + radius + 14);

      ctx.globalAlpha = 1;
    });

    ctx.shadowBlur = 0;
    ctx.restore();
  }, [graphData, nodePositions, selectedNode, pathSource, activePath, dimensions, zoom]);

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const width = dimensions.width || 800;
    const height = dimensions.height || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Adjust for zoom
    const adjustedX = centerX + (clickX - centerX) / zoom;
    const adjustedY = centerY + (clickY - centerY) / zoom;

    for (const node of Object.values(nodePositions)) {
      const dist = Math.sqrt((adjustedX - node.x) ** 2 + (adjustedY - node.y) ** 2);
      if (dist < 18) {
        onNodeClick(node);
        return;
      }
    }
  }, [nodePositions, onNodeClick, dimensions, zoom]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        cursor: "pointer",
      }}
    />
  );
}