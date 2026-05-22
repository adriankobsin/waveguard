import { useState, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { readThemeColors, getCssVarHsl } from "@/lib/appearanceSettingsStorage";

const PROTOCOL_COLORS = {
  DMX:    { fill: "rgba(168,85,247,0.18)",  stroke: "#a855f7", text: "#c084fc" },
  DALI:   { fill: "rgba(59,130,246,0.18)",  stroke: "#3b82f6", text: "#60a5fa" },
  KNX:    { fill: "rgba(249,115,22,0.18)",  stroke: "#f97316", text: "#fb923c" },
  Lutron: { fill: "rgba(6,182,212,0.18)",   stroke: "#06b6d4", text: "#22d3ee" },
};

const FAULT_STYLE = { fill: "rgba(239,68,68,0.12)",  stroke: "#ef4444", text: "#f87171" };

function getOffStyle() {
  const colors = readThemeColors();
  return {
    fill: getCssVarHsl("muted", 0.45) || "rgba(255,255,255,0.03)",
    stroke: colors.border || "rgba(255,255,255,0.12)",
    text: colors.mutedForeground || "#475569",
  };
}

function getLevelGradient(on, level, protocol) {
  if (!on || level === 0) return null;
  const base = PROTOCOL_COLORS[protocol];
  if (!base) return null;
  const opacity = 0.08 + (level / 100) * 0.35;
  return `rgba(${hexToRgb(base.stroke)},${opacity.toFixed(2)})`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function LightingZoneMap({ deck, zones, selectedZone, onSelectZone, onUpdateZone }) {
  const [hoveredZone, setHoveredZone] = useState(null);
  const { theme } = useTheme();
  const mapColors = useMemo(() => readThemeColors(), [theme]);
  const offStyle = useMemo(() => getOffStyle(), [theme]);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Deck label */}
      <div className="px-5 py-2.5 border-b border-border bg-card/40 flex-shrink-0">
        <p className="text-xs font-semibold text-foreground">{deck?.label}</p>
        <p className="text-[10px] text-muted-foreground">{zones.length} zones — click a zone to control</p>
      </div>

      {/* SVG floor plan */}
      <div className="flex-1 relative overflow-hidden p-4">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ filter: "drop-shadow(0 0 40px rgba(0,0,0,0.8))" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width="100" height="100" fill={mapColors.background || "hsl(var(--background))"} rx="1" />

          {/* Deck border */}
          <rect x="6" y="8" width="88" height="84" rx="2"
            fill="none" stroke={getCssVarHsl("border", 0.6) || "rgba(255,255,255,0.06)"} strokeWidth="0.3" />

          {/* Grid lines */}
          {[20, 40, 60, 80].map(v => (
            <g key={v}>
              <line x1={v} y1="8" x2={v} y2="92" stroke={getCssVarHsl("border", 0.25) || "rgba(255,255,255,0.03)"} strokeWidth="0.2" />
              <line x1="6" y1={v} x2="94" y2={v} stroke={getCssVarHsl("border", 0.25) || "rgba(255,255,255,0.03)"} strokeWidth="0.2" />
            </g>
          ))}

          {/* Zones */}
          {zones.map(zone => {
            const isSelected = selectedZone === zone.id;
            const isHovered = hoveredZone === zone.id;
            const style = zone.fault
              ? FAULT_STYLE
              : zone.on
              ? (PROTOCOL_COLORS[zone.protocol] || offStyle)
              : offStyle;

            const fillColor = zone.on && !zone.fault
              ? getLevelGradient(zone.on, zone.level, zone.protocol) || style.fill
              : style.fill;

            return (
              <g key={zone.id}>
                {/* Glow for selected/on zones */}
                {(isSelected || (zone.on && !zone.fault)) && (
                  <rect
                    x={zone.x - 0.5} y={zone.y - 0.5}
                    width={zone.w + 1} height={zone.h + 1}
                    rx="1.5"
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth="0.4"
                    opacity={isSelected ? 0.9 : 0.3}
                    filter={isSelected ? "url(#glow)" : undefined}
                  />
                )}

                {/* Zone rectangle */}
                <rect
                  x={zone.x} y={zone.y}
                  width={zone.w} height={zone.h}
                  rx="1"
                  fill={fillColor}
                  stroke={isSelected ? style.stroke : zone.on ? style.stroke : "rgba(255,255,255,0.08)"}
                  strokeWidth={isSelected ? "0.5" : "0.25"}
                  className="cursor-pointer transition-all"
                  onClick={() => onSelectZone(isSelected ? null : zone.id)}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  opacity={isHovered && !isSelected ? 0.85 : 1}
                />

                {/* Level fill bar */}
                {zone.on && zone.level > 0 && !zone.fault && (
                  <rect
                    x={zone.x + 0.5} y={zone.y + zone.h - 1.5 - ((zone.h - 2) * zone.level / 100)}
                    width={zone.w - 1}
                    height={(zone.h - 2) * zone.level / 100}
                    rx="0.5"
                    fill={style.stroke}
                    opacity="0.12"
                    className="pointer-events-none"
                  />
                )}

                {/* Label */}
                <text
                  x={zone.x + zone.w / 2}
                  y={zone.y + zone.h / 2 - (zone.h > 14 ? 2 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="2.4"
                  fill={zone.on && !zone.fault ? style.text : "#334155"}
                  fontFamily="Inter, sans-serif"
                  fontWeight={isSelected ? "700" : "500"}
                  className="pointer-events-none select-none"
                >
                  {zone.name.length > 14 ? zone.name.slice(0, 13) + "…" : zone.name}
                </text>

                {/* Level text */}
                {zone.on && zone.h > 14 && (
                  <text
                    x={zone.x + zone.w / 2}
                    y={zone.y + zone.h / 2 + 3.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="2.8"
                    fill={style.stroke}
                    fontFamily="Inter, sans-serif"
                    fontWeight="700"
                    className="pointer-events-none select-none"
                    opacity="0.85"
                  >
                    {zone.level}%
                  </text>
                )}

                {/* Fault icon */}
                {zone.fault && (
                  <text
                    x={zone.x + zone.w - 2.5}
                    y={zone.y + 3}
                    fontSize="3"
                    fill="#ef4444"
                    className="pointer-events-none select-none"
                  >⚠</text>
                )}

                {/* Protocol badge */}
                <text
                  x={zone.x + 1.5}
                  y={zone.y + 3}
                  fontSize="1.8"
                  fill={zone.on && !zone.fault ? style.text : "#334155"}
                  fontFamily="Inter, sans-serif"
                  fontWeight="700"
                  className="pointer-events-none select-none"
                  opacity="0.7"
                >
                  {zone.protocol}
                </text>
              </g>
            );
          })}

          {/* Glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Protocol legend */}
        <div className="absolute bottom-4 right-4 rounded-xl border border-border bg-secondary/90 backdrop-blur-md px-3 py-2.5 space-y-1.5">
          {Object.entries(PROTOCOL_COLORS).map(([proto, style]) => (
            <div key={proto} className="flex items-center gap-2 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: style.stroke }} />
              <span style={{ color: style.text }}>{proto}</span>
            </div>
          ))}
          <div className="border-t border-border pt-1.5 mt-1">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 flex-shrink-0" />
              <span className="text-red-400">Fault</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}