import { motion } from "framer-motion";
import { Lightbulb, Moon, Loader2, ChevronUp, ChevronDown, Square, PanelTop, Blinds, Zap } from "lucide-react";
import { isShadeZone } from "@/lib/lighting/lightingSettings";

const KIND_META = {
  light:    { label: "Light",    Icon: Lightbulb, tone: "amber" },
  shade:    { label: "Shade",    Icon: PanelTop,  tone: "sky" },
  blind:    { label: "Blind",    Icon: Blinds,    tone: "indigo" },
  blackout: { label: "Blackout", Icon: Moon,      tone: "violet" },
  load:     { label: "Load",     Icon: Zap,       tone: "emerald" },
};
const TONE_CLS = {
  amber:   "text-amber-400 bg-amber-500/10 border-amber-500/30",
  sky:     "text-sky-400 bg-sky-500/10 border-sky-500/30",
  indigo:  "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
  violet:  "text-violet-400 bg-violet-500/10 border-violet-500/30",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

function meta(kind) {
  return KIND_META[kind] || KIND_META.load;
}

export default function LightingZoneList({
  zones,
  zoneState,
  pendingZones,
  selectedHref,
  onSelectZone,
  onZoneLevel,
  onZoneToggle,
  onStopShade,
}) {
  if (!zones || zones.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-6 text-center text-xs text-muted-foreground">
        No loads in this floor.
      </div>
    );
  }
  return (
    <div className="space-y-2 max-w-3xl mx-auto p-4">
      {zones.map((zone, i) => {
        const m = meta(zone.kind);
        const Icon = m.Icon;
        const state = zoneState?.[zone.href];
        const level = state?.level ?? 0;
        const isOn = state?.on ?? false;
        const isBusy = !!pendingZones?.[zone.href];
        const isSelected = selectedHref === zone.href;
        const shade = isShadeZone(zone);
        return (
          <motion.div
            key={zone.href}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            onClick={() =>
              onSelectZone?.(isSelected ? null : zone.href)
            }
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
              isSelected
                ? "border-amber-500/40 bg-amber-500/8"
                : isOn
                ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                : "border-border bg-muted/50 hover:bg-secondary"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isOn ? "bg-amber-500/15" : "bg-secondary"
              }`}
            >
              <Icon
                size={16}
                className={
                  isOn ? "text-amber-400" : "text-muted-foreground"
                }
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-foreground truncate">
                  {zone.name}
                </p>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${TONE_CLS[m.tone]}`}
                >
                  {m.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {zone.area} · <span className="font-mono">{zone.href}</span>
              </p>
            </div>

            {shade ? (
              <div
                className="flex items-center gap-1.5 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onZoneLevel(zone, 100)}
                  disabled={isBusy}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-muted hover:bg-secondary disabled:opacity-40 transition-colors"
                  title="Open"
                >
                  <ChevronUp size={14} className="text-sky-400" />
                </button>
                <button
                  onClick={() => onZoneLevel(zone, 0)}
                  disabled={isBusy}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-muted hover:bg-secondary disabled:opacity-40 transition-colors"
                  title="Close"
                >
                  <ChevronDown size={14} className="text-sky-400" />
                </button>
                {onStopShade && (
                  <button
                    onClick={() => onStopShade(zone)}
                    disabled={isBusy}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-muted hover:bg-secondary disabled:opacity-40 transition-colors"
                    title="Stop"
                  >
                    <Square size={12} className="text-muted-foreground" />
                  </button>
                )}
              </div>
            ) : (
              <div
                className="w-32 flex-shrink-0 hidden sm:block"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Level</span>
                  <span
                    className={
                      isOn
                        ? "text-amber-400 font-bold"
                        : "text-muted-foreground"
                    }
                  >
                    {isOn ? `${level}%` : "Off"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={level}
                  disabled={isBusy}
                  onChange={(e) =>
                    onZoneLevel(zone, Number(e.target.value))
                  }
                  className="w-full h-1.5 cursor-pointer disabled:opacity-50"
                  style={{ accentColor: "#f59e0b" }}
                />
              </div>
            )}

            {!shade && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onZoneToggle(zone, !isOn);
                }}
                disabled={isBusy}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                  isOn ? "bg-amber-500" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            )}

            {isBusy && (
              <Loader2
                size={12}
                className="text-amber-400 animate-spin flex-shrink-0"
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
