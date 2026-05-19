import { useRef, useEffect, useMemo, useState, useCallback } from "react";

const LAYER_ORDER = { encoder: 0, dsp: 1, matrix: 1, decoder: 2, display: 3, none: 1 };

export default function SignalFlowCanvas({
  nodes = [],
  edges = [],
  layoutMode = "free",
  selectedNodeId,
  onNodeSelect,
  colorForNode,
  dimensions,
}) {
  const canvasRef = useRef();
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef(null);

  const width = dimensions?.width || 800;
  const height = dimensions?.height || 600;
  const centerX = width / 2;
  const centerY = height / 2;

  const nodePositions = useMemo(() => {
    const positions = {};
    if (layoutMode === "layered") {
      const cols = {};
      nodes.forEach((n) => {
        const col = LAYER_ORDER[n.layer] ?? 1;
        if (!cols[col]) cols[col] = [];
        cols[col].push(n);
      });
      const colKeys = Object.keys(cols).sort((a, b) => Number(a) - Number(b));
      const colW = width / (colKeys.length + 1);
      colKeys.forEach((col, ci) => {
        const list = cols[col];
        const x = colW * (ci + 1);
        list.forEach((node, i) => {
          const y = (height / (list.length + 1)) * (i + 1);
          positions[node.id] = { ...node, x, y };
        });
      });
    } else {
      const ring = Math.min(width, height) * 0.35;
      nodes.forEach((node, i) => {
        const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
        positions[node.id] = {
          ...node,
          x: centerX + Math.cos(angle) * ring,
          y: centerY + Math.sin(angle) * ring,
        };
      });
    }
    return positions;
  }, [nodes, layoutMode, width, height, centerX, centerY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#060912";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX + pan.x, centerY + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-centerX, -centerY);

    edges.forEach((edge) => {
      const s = nodePositions[edge.source];
      const t = nodePositions[edge.target];
      if (!s || !t) return;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const midX = (s.x + t.x) / 2;
      const midY = (s.y + t.y) / 2 - 30;
      ctx.quadraticCurveTo(midX, midY, t.x, t.y);
      ctx.strokeStyle = edge.color || "#64748b";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (edge.label) {
        ctx.fillStyle = "rgba(148,163,184,0.9)";
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText(edge.label, midX, midY - 4);
      }
    });

    Object.values(nodePositions).forEach((node) => {
      const selected = selectedNodeId === node.id;
      const color = colorForNode?.(node) || node.color || "#06b6d4";
      const r = selected ? 16 : 12;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + "cc";
      ctx.fill();
      ctx.strokeStyle = selected ? "#fff" : color;
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "center";
      const label = (node.label || node.name || "").slice(0, 16);
      ctx.fillText(label, node.x, node.y + r + 14);
    });

    ctx.restore();
  }, [nodePositions, edges, width, height, pan, zoom, selectedNodeId, colorForNode, centerX, centerY]);

  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      return {
        x: centerX + (cx - centerX - pan.x) / zoom,
        y: centerY + (cy - centerY - pan.y) / zoom,
      };
    },
    [centerX, centerY, pan, zoom]
  );

  const handleClick = (e) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    for (const node of Object.values(nodePositions)) {
      if (Math.hypot(x - node.x, y - node.y) < 18) {
        onNodeSelect?.(node);
        return;
      }
    }
    onNodeSelect?.(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.4, Math.min(2.5, z + (e.deltaY > 0 ? -0.08 : 0.08))));
  };

  const handleMouseDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, pan: { ...pan } };
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.pan.x + (e.clientX - dragRef.current.x),
      y: dragRef.current.pan.y + (e.clientY - dragRef.current.y),
    });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="w-full h-full block cursor-grab active:cursor-grabbing"
    />
  );
}

