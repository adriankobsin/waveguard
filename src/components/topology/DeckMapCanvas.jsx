import { useRef, useState } from "react";

const STATUS_COLORS = {
  online:  { ring: "#22c55e", bg: "#166534", dot: "#4ade80" },
  offline: { ring: "#ef4444", bg: "#7f1d1d", dot: "#f87171" },
  warning: { ring: "#f59e0b", bg: "#78350f", dot: "#fbbf24" },
  unknown: { ring: "#64748b", bg: "#1e293b", dot: "#94a3b8" },
};

const CATEGORY_ICONS = {
  Network: "⬡",
  Camera:  "◎",
  AV:      "▶",
  Server:  "▪",
  Power:   "⚡",
};

const CABLE_COLORS = {
  Network: "#06b6d4",
  AV:      "#60a5fa",
  CCTV:    "#a78bfa",
  Power:   "#fbbf24",
  Other:   "#94a3b8",
};

export default function DeckMapCanvas({
  floorPlan, pins, devices, mockStatus, placingDevice, onCanvasClick, onPinClick,
  cablePaths = [], cableDrawMode = false, cableDrawStart = null, onCableClick,
}) {
  const containerRef = useRef();
  const [hoveredPin, setHoveredPin] = useState(null);

  const handleClick = (e) => {
    if (!placingDevice) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onCanvasClick(xPct, yPct);
  };

  // Build SVG cable lines overlaid on top of the image
  const renderCables = () => (
    <svg
    className="absolute inset-0 w-full h-full"
    style={{ zIndex: 5, pointerEvents: "none" }}
    >
      <defs>
        {Object.entries(CABLE_COLORS).map(([type, color]) => (
          <marker key={type} id={`arrow-${type}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={color} opacity="0.7" />
          </marker>
        ))}
      </defs>
      {cablePaths.map(cable => {
        const fromPin = pins.find(p => p.deviceId === cable.fromDeviceId);
        const toPin = pins.find(p => p.deviceId === cable.toDeviceId);
        if (!fromPin || !toPin) return null;
        const color = CABLE_COLORS[cable.category] || CABLE_COLORS.Other;
        const x1 = fromPin.x;
        const y1 = fromPin.y;
        const x2 = toPin.x;
        const y2 = toPin.y;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - 5;
        return (
          <g
            key={cable.id}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onClick={(e) => { e.stopPropagation(); onCableClick?.(cable); }}
          >
            {/* Wider invisible hit area */}
            <path
              d={`M ${x1}% ${y1}% Q ${mx}% ${my}% ${x2}% ${y2}%`}
              fill="none"
              stroke="transparent"
              strokeWidth="14"
            />
            {/* Visible cable line */}
            <path
              d={`M ${x1}% ${y1}% Q ${mx}% ${my}% ${x2}% ${y2}%`}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray={cable.status === "planned" ? "6 3" : undefined}
              opacity="0.75"
              markerEnd={`url(#arrow-${cable.category || "Other"})`}
            />
            {/* Label with click affordance background */}
            <text
              x={`${mx}%`}
              y={`${my - 1.5}%`}
              textAnchor="middle"
              fill={color}
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
              opacity="0.9"
            >
              {cable.label} ▸
            </text>
          </g>
        );
      })}
      {/* In-progress cable draw line */}
      {cableDrawStart && (
        <circle
          cx={`${cableDrawStart.x}%`}
          cy={`${cableDrawStart.y}%`}
          r="6"
          fill="none"
          stroke="#f97316"
          strokeWidth="2"
          opacity="0.8"
        />
      )}
    </svg>
  );

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`flex-1 relative overflow-hidden ${placingDevice ? "cursor-crosshair" : "cursor-default"}`}
      style={{ minHeight: 0 }}
    >
      {/* Floor plan image */}
      <img
        src={floorPlan.url}
        alt="Floor plan"
        className="w-full h-full object-contain select-none pointer-events-none"
        draggable={false}
      />

      {/* Cable paths SVG overlay */}
      {renderCables()}

      {/* Pins */}
      {pins.map(pin => {
        const device = devices.find(d => d.id === pin.deviceId);
        if (!device) return null;
        const status = (mockStatus && mockStatus[pin.deviceId]) || pin.status || "unknown";
        const colors = STATUS_COLORS[status];
        const isHovered = hoveredPin === pin.id;
        const isDrawStart = cableDrawStart?.deviceId === pin.deviceId;

        return (
          <button
            key={pin.id}
            onClick={(e) => { e.stopPropagation(); onPinClick(pin); }}
            onMouseEnter={() => setHoveredPin(pin.id)}
            onMouseLeave={() => setHoveredPin(null)}
            style={{
              position: "absolute",
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: "translate(-50%, -100%)",
              zIndex: isHovered ? 20 : 10,
            }}
            className="group focus:outline-none"
          >
            {/* Tooltip */}
            {isHovered && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap pointer-events-none"
                style={{ zIndex: 30 }}
              >
                <div className="px-2.5 py-1.5 rounded-lg bg-secondary/95 border border-border text-xs text-foreground shadow-xl">
                  <p className="font-semibold">{device.name}</p>
                  <p className="text-muted-foreground">{device.model || device.category}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: colors.dot }}>● {status}</p>
                </div>
                <div className="w-2 h-2 bg-secondary border-r border-b border-border rotate-45 mx-auto -mt-1" />
              </div>
            )}

            {/* Pin body */}
            <div className="flex flex-col items-center">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-transform group-hover:scale-110"
                style={{
                  background: isDrawStart ? "#431407" : colors.bg,
                  border: `2px solid ${isDrawStart ? "#f97316" : colors.ring}`,
                  boxShadow: `0 0 10px ${isDrawStart ? "#f97316" : colors.ring}55, 0 2px 8px rgba(0,0,0,0.6)`,
                  color: isDrawStart ? "#fb923c" : colors.dot,
                }}
              >
                {CATEGORY_ICONS[device.category] || "●"}
              </div>
              <div className="w-0.5 h-3" style={{ background: `linear-gradient(to bottom, ${isDrawStart ? "#f97316" : colors.ring}, transparent)` }} />
              <div className="w-1.5 h-1.5 rounded-full opacity-60" style={{ background: isDrawStart ? "#f97316" : colors.ring }} />
            </div>

            {/* Pulse ring for offline/warning */}
            {(status === "offline" || status === "warning") && (
              <div
                className="absolute inset-0 top-0 rounded-full animate-ping opacity-30"
                style={{ width: 36, height: 36, margin: "0 auto", background: colors.ring }}
              />
            )}
          </button>
        );
      })}

      {/* Placing hint overlay */}
      {placingDevice && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-cyan-500/30 rounded-sm">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-300">
            Click to place <b>{placingDevice.name}</b>
          </div>
        </div>
      )}
    </div>
  );
}
