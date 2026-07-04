import { useState } from "react";
import { motion } from "framer-motion";
import {
  Thermometer, Power, Snowflake, Flame, Wind, Fan,
  Droplets, AlertTriangle, Wifi, WifiOff, ChevronDown, ChevronUp,
} from "lucide-react";

const MODE_ICONS = { off: Power, cool: Snowflake, heat: Flame, auto: Wind, dry: Droplets, fan_only: Fan };
const MODE_COLORS = {
  off: "text-muted-foreground", cool: "text-cyan-400", heat: "text-orange-400",
  auto: "text-green-400", dry: "text-yellow-400", fan_only: "text-blue-400",
};
const MODE_OPTIONS = ["off", "cool", "heat", "auto", "dry", "fan_only"];
const FAN_OPTIONS = ["auto", "low", "medium", "high"];

function tempColor(temp) {
  if (temp == null) return "text-muted-foreground";
  if (temp < 18) return "text-blue-400";
  if (temp < 22) return "text-cyan-400";
  if (temp < 26) return "text-orange-300";
  return "text-red-400";
}

export default function HVACZoneCard({ zone, onPower, onSetpoint, onMode, onFan, onDiagnostics, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const [setpointInput, setSetpointInput] = useState(zone.targetTemperature ?? 22);
  const [error, setError] = useState(null);

  const ModeIcon = MODE_ICONS[zone.mode] || Power;

  const handlePower = async () => {
    setError(null);
    try {
      await onPower(zone.id, zone.powerState !== "on");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSetpoint = async () => {
    setError(null);
    try {
      await onSetpoint(zone.id, Number(setpointInput));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMode = async (mode) => {
    setError(null);
    try {
      await onMode(zone.id, mode);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFan = async (speed) => {
    setError(null);
    try {
      await onFan(zone.id, speed);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border overflow-hidden transition-all ${
        zone.online
          ? "bg-card border-border"
          : "bg-card/50 border-red-500/30 opacity-70"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${zone.online ? "bg-emerald-500" : "bg-red-500"}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{zone.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{zone.deck} · {zone.room}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {zone.alarmStatus && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
              <AlertTriangle size={8} /> {zone.alarmCode}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">{zone.manufacturer}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Temperature display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer size={16} className="text-muted-foreground" />
            <span className={`text-2xl font-bold tabular-nums ${tempColor(zone.currentTemperature)}`}>
              {zone.currentTemperature != null ? `${zone.currentTemperature.toFixed(1)}°` : "—"}
            </span>
            {zone.humidity != null && (
              <span className="text-xs text-muted-foreground">
                <Droplets size={10} className="inline mr-0.5" />
                {zone.humidity}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePower}
              disabled={disabled}
              className={`p-2 rounded-lg transition-colors ${
                zone.powerState === "on"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                  : "bg-secondary text-muted-foreground border border-border hover:text-foreground"
              } ${disabled ? "opacity-50" : ""}`}
              title={zone.powerState === "on" ? "Turn off" : "Turn on"}
            >
              <Power size={14} />
            </button>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {zone.powerState}
            </span>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode selector */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 border border-border">
            {MODE_OPTIONS.map((m) => {
              const MI = MODE_ICONS[m];
              const active = zone.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMode(m)}
                  disabled={disabled || !zone.online}
                  className={`p-1.5 rounded-md transition-colors ${
                    active
                      ? `${MODE_COLORS[m]} bg-background shadow-sm`
                      : "text-muted-foreground hover:text-foreground"
                  } ${disabled || !zone.online ? "opacity-50" : ""}`}
                  title={m}
                >
                  <MI size={13} />
                </button>
              );
            })}
          </div>

          {/* Fan speed selector */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 border border-border">
            {FAN_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleFan(s)}
                disabled={disabled || !zone.online}
                className={`px-1.5 py-1 rounded-md text-[9px] font-medium uppercase tracking-wider transition-colors ${
                  zone.fanSpeed === s
                    ? "bg-background text-cyan-400 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                } ${disabled || !zone.online ? "opacity-50" : ""}`}
              >
                {s === "auto" ? "A" : s.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Setpoint slider */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground font-medium w-12">Setpoint</span>
          <input
            type="range"
            min={16}
            max={30}
            step={0.5}
            value={zone.targetTemperature ?? 22}
            onChange={(e) => setSetpointInput(Number(e.target.value))}
            onMouseUp={handleSetpoint}
            onTouchEnd={handleSetpoint}
            disabled={disabled || !zone.online}
            className="flex-1 h-1.5 rounded-full appearance-none bg-secondary accent-cyan-500 cursor-pointer disabled:opacity-50"
          />
          <span className="text-xs font-bold tabular-nums text-foreground w-10 text-right">
            {zone.targetTemperature != null ? `${zone.targetTemperature.toFixed(1)}°` : "—"}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">
            <AlertTriangle size={10} /> {error}
          </div>
        )}

        {/* Expand diagnostics */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? "Hide details" : "Details"}
        </button>

        {expanded && (
          <div className="space-y-1.5 pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
            <div className="flex justify-between"><span>Protocol</span><span className="font-mono text-foreground">{zone.protocol}</span></div>
            <div className="flex justify-between"><span>Valve</span><span className="font-mono text-foreground">{zone.valveStatus != null ? `${zone.valveStatus}%` : "—"}</span></div>
            <div className="flex justify-between"><span>Compressor</span><span className="font-mono text-foreground">{zone.compressorStatus != null ? (zone.compressorStatus ? "Running" : "Idle") : "—"}</span></div>
            {zone.alarmStatus && (
              <div className="flex justify-between text-red-400"><span>Alarm</span><span className="font-mono">{zone.alarmCode}</span></div>
            )}
            <button
              type="button"
              onClick={() => onDiagnostics?.(zone.id)}
              className="w-full text-left mt-1 text-[10px] text-primary hover:underline"
            >
              View raw diagnostics →
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
