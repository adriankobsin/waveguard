import { motion } from "framer-motion";
import {
  Lightbulb,
  Moon,
  ChevronUp,
  ChevronDown,
  Loader2,
  PanelTop,
  Blinds,
  Square,
  Zap,
  Pencil,
} from "lucide-react";
import { isShadeZone } from "@/lib/lighting/lightingSettings";
import SmoothLevelSlider from "./SmoothLevelSlider";

// Visual treatment table shared between LutronAreaLoads.ZoneRow and the
// Area Control deck map's inline popover. Centralising it keeps the two
// places visually consistent and lets us pick up new kinds (e.g.
// openCloseStop / tilt / shadeAndTilt) from the live LEAP probe in one
// spot.
const KIND_META = {
  light: { label: "Light", icon: Lightbulb, accent: "text-amber-400 bg-amber-500/12 border-amber-500/30", onIcon: "text-amber-400", offIcon: "text-muted-foreground" },
  shade: { label: "Shade", icon: PanelTop, accent: "text-sky-400 bg-sky-500/12 border-sky-500/30", onIcon: "text-sky-400", offIcon: "text-muted-foreground" },
  blind: { label: "Blind", icon: Blinds, accent: "text-indigo-400 bg-indigo-500/12 border-indigo-500/30", onIcon: "text-indigo-400", offIcon: "text-muted-foreground" },
  blackout: { label: "Blackout", icon: Moon, accent: "text-violet-400 bg-violet-500/12 border-violet-500/30", onIcon: "text-violet-400", offIcon: "text-muted-foreground" },
  openCloseStop: { label: "Shade", icon: Blinds, accent: "text-sky-400 bg-sky-500/12 border-sky-500/30", onIcon: "text-sky-400", offIcon: "text-muted-foreground" },
  shadeAndTilt: { label: "Shade+Tilt", icon: PanelTop, accent: "text-sky-400 bg-sky-500/12 border-sky-500/30", onIcon: "text-sky-400", offIcon: "text-muted-foreground" },
  tilt: { label: "Tilt", icon: PanelTop, accent: "text-cyan-400 bg-cyan-500/12 border-cyan-500/30", onIcon: "text-cyan-400", offIcon: "text-muted-foreground" },
  load: { label: "Load", icon: Zap, accent: "text-emerald-400 bg-emerald-500/12 border-emerald-500/30", onIcon: "text-emerald-400", offIcon: "text-muted-foreground" },
};

export function kindMeta(kind) {
  return KIND_META[kind] || KIND_META.load;
}

/**
 * Inline control surface for a single Lutron zone. Renders:
 *  - A slider + on/off toggle for dimmer/switched/load zones.
 *  - Open / Close / Stop buttons for shade-family zones (shade, blind,
 *    blackout, curtain, openCloseStop, tilt, shadeAndTilt).
 *
 * `variant="row"` is the compact horizontal layout used inside
 * `LutronAreaLoads.ZoneRow`. `variant="card"` is the stand-alone card
 * used as a popover on the Area Control deck map.
 */
export default function ZoneInlineControls({
  zone,
  state,
  pending,
  onLevelChange,
  onToggle,
  onStopShade,
  onEditZone,
  variant = "row",
}) {
  const meta = kindMeta(zone.kind);
  const Icon = meta.icon;
  const level = state?.level ?? 0;
  const isOn = state?.on ?? false;
  const isBusy = !!pending;
  const shade = isShadeZone(zone);

  if (variant === "card") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mt-2 p-3 rounded-xl border bg-card ${
          isOn ? "border-amber-500/30" : "border-border"
        }`}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isOn ? "bg-amber-500/15" : "bg-secondary"
            }`}
          >
            <Icon size={13} className={isOn ? meta.onIcon : meta.offIcon} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{zone.name}</p>
            <p className="text-[10px] text-muted-foreground truncate font-mono">{zone.href}</p>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.accent}`}>
            {meta.label}
          </span>
          {onEditZone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditZone(zone);
              }}
              className="w-6 h-6 rounded-md flex items-center justify-center border border-border bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Edit name or integration address"
              type="button"
            >
              <Pencil size={10} />
            </button>
          )}
          {isBusy && <Loader2 size={12} className="text-amber-400 animate-spin" />}
        </div>

        {shade ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onLevelChange(zone, 100)}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[11px] font-semibold disabled:opacity-40 transition-colors"
              title="Open"
            >
              <ChevronUp size={12} />
              Open
            </button>
            <button
              onClick={() => onLevelChange(zone, 0)}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[11px] font-semibold disabled:opacity-40 transition-colors"
              title="Close"
            >
              <ChevronDown size={12} />
              Close
            </button>
            {onStopShade && (
              <button
                onClick={() => onStopShade(zone)}
                disabled={isBusy}
                className="flex items-center justify-center w-9 py-1.5 rounded-lg border border-border bg-muted hover:bg-secondary text-muted-foreground disabled:opacity-40 transition-colors"
                title="Stop"
              >
                <Square size={11} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Level</span>
              <span className={isOn ? "text-amber-400 font-bold" : "text-muted-foreground"}>
                {isOn ? `${level}%` : "Off"}
              </span>
            </div>
            <SmoothLevelSlider
              value={level}
              busy={isBusy}
              onChange={(v) => onLevelChange(zone, v)}
              className="w-full h-1.5 cursor-pointer"
            />
            <button
              onClick={() => onToggle(zone, !isOn)}
              disabled={isBusy}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                isOn
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                  : "bg-muted text-muted-foreground border border-border hover:bg-secondary"
              }`}
            >
              {isOn ? "Turn off" : "Turn on"}
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  // variant === "row" — compact horizontal layout used inside the
  // Lights / Shades tabs (LutronAreaLoads.ZoneRow).
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
        isOn ? "border-amber-500/25 bg-amber-500/5" : "border-border bg-muted/30"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isOn ? "bg-amber-500/15" : "bg-secondary"
        }`}
      >
        <Icon size={14} className={isOn ? meta.onIcon : meta.offIcon} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-semibold text-foreground truncate">{zone.name}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.accent}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate font-mono">{zone.href}</p>
      </div>

      {shade ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onLevelChange(zone, 100)}
            disabled={isBusy}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-muted hover:bg-secondary disabled:opacity-40 transition-colors"
            title="Open"
          >
            <ChevronUp size={14} className="text-sky-400" />
          </button>
          <button
            onClick={() => onLevelChange(zone, 0)}
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
        <>
          <div className="hidden sm:block w-36 flex-shrink-0">
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-muted-foreground">Level</span>
              <span className={isOn ? "text-amber-400 font-bold" : "text-muted-foreground"}>
                {isOn ? `${level}%` : "Off"}
              </span>
            </div>
            <SmoothLevelSlider
              value={level}
              busy={isBusy}
              onChange={(v) => onLevelChange(zone, v)}
              className="w-full h-1.5 cursor-pointer"
            />
          </div>
          <button
            onClick={() => onToggle(zone, !isOn)}
            disabled={isBusy}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
              isOn ? "bg-amber-500" : "bg-muted"
            }`}
            title={isOn ? "Turn off" : "Turn on"}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isOn ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </>
      )}

      {isBusy && <Loader2 size={12} className="text-amber-400 animate-spin flex-shrink-0" />}

      {onEditZone && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditZone(zone);
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center border border-border bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Edit name or integration address"
          type="button"
        >
          <Pencil size={11} />
        </button>
      )}
    </motion.div>
  );
}
