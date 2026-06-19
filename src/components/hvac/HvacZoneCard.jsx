import { useState } from "react";
import { Thermometer, Snowflake, RotateCw, Fan, Power, Droplets, GripVertical } from "lucide-react";
import { HVAC_MODE_LABELS } from "@/lib/hvac/hvacSettings";

const MODE_ICONS = {
  cool: Snowflake,
  heat: Thermometer,
  auto: RotateCw,
  fanOnly: Fan,
  off: Power,
  dry: Droplets,
};

export default function HvacZoneCard({ zone, state, pending, onSetpoint, onMode, onPower, onFanSpeed, onEdit }) {
  const [localSetpoint, setLocalSetpoint] = useState(null);
  const mode = state?.mode || "off";
  const setpoint = localSetpoint ?? state?.setpoint ?? 22;
  const temperature = state?.temperature ?? null;
  const on = state?.on ?? false;
  const isPending = pending?.[zone.id];

  const ModeIcon = MODE_ICONS[mode] || RotateCw;

  const handleSetpointChange = (e) => {
    const val = Number(e.target.value);
    setLocalSetpoint(val);
  };

  const handleSetpointCommit = () => {
    if (localSetpoint != null && localSetpoint !== state?.setpoint) {
      onSetpoint?.(zone, localSetpoint);
    }
    setLocalSetpoint(null);
  };

  const bgMode = on
    ? mode === "cool"
      ? "bg-sky-500/10 border-sky-500/25"
      : mode === "heat"
        ? "bg-orange-500/10 border-orange-500/25"
        : mode === "auto"
          ? "bg-emerald-500/10 border-emerald-500/25"
          : "bg-secondary border-border"
    : "bg-secondary/40 border-border";

  return (
    <div className={`rounded-xl border ${bgMode} p-4 space-y-3 transition-colors ${isPending ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ModeIcon size={14} className={on ? "text-foreground" : "text-muted-foreground"} />
          <span className="text-sm font-medium text-foreground truncate">{zone.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase font-semibold">
            {zone.systemType}
          </span>
          <button
            onClick={() => onPower?.(zone, !on)}
            className={`p-1.5 rounded-lg transition-colors ${on ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            title={on ? "Turn off" : "Turn on"}
          >
            <Power size={11} />
          </button>
          {onEdit && (
            <button onClick={() => onEdit(zone)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
              <GripVertical size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {temperature != null && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {Math.round(temperature * 10) / 10}°
            </p>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-muted-foreground">Setpoint</p>
          <div className="flex items-center gap-1">
            <input
              type="range"
              min={16}
              max={30}
              step={0.5}
              value={setpoint}
              onChange={handleSetpointChange}
              onMouseUp={handleSetpointCommit}
              onTouchEnd={handleSetpointCommit}
              disabled={!on}
              className="w-20 h-1.5 accent-primary"
            />
            <span className="text-sm font-semibold text-foreground w-8 tabular-nums">{setpoint}°</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={mode}
          onChange={(e) => onMode?.(zone, e.target.value)}
          disabled={!on}
          className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
        >
          {Object.entries(HVAC_MODE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {zone.kind === "fan" && (
          <select
            value={state?.fanSpeed || "auto"}
            onChange={(e) => onFanSpeed?.(zone, e.target.value)}
            disabled={!on}
            className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
          >
            {["low", "medium", "high", "auto"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        )}

        {state?.humidity != null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Droplets size={10} />
            {state.humidity}%
          </span>
        )}
      </div>

      {state?.updatedAt && (
        <p className="text-[10px] text-muted-foreground/60">
          Updated {new Date(state.updatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
