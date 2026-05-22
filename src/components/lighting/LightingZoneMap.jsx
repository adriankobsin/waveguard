import { motion } from "framer-motion";
import { Lightbulb, Moon, MapPin, Loader2, PanelTop, Blinds, Zap } from "lucide-react";
import { isShadeZone } from "@/lib/lighting/lightingSettings";

const KIND_ACCENT = {
  light:    { color: "#f59e0b", tone: "amber" },
  shade:    { color: "#0ea5e9", tone: "sky" },
  blind:    { color: "#6366f1", tone: "indigo" },
  blackout: { color: "#8b5cf6", tone: "violet" },
  load:     { color: "#10b981", tone: "emerald" },
};
const TONE_TEXT = {
  amber: "text-amber-400",
  sky: "text-sky-400",
  indigo: "text-indigo-400",
  violet: "text-violet-400",
  emerald: "text-emerald-400",
};

function accent(kind) {
  return KIND_ACCENT[kind] || KIND_ACCENT.load;
}

function kindIcon(kind) {
  if (kind === "shade") return PanelTop;
  if (kind === "blind") return Blinds;
  if (kind === "blackout") return Moon;
  if (kind === "load") return Zap;
  return Lightbulb;
}

function ZoneTile({ zone, state, pending, selected, onSelect }) {
  const a = accent(zone.kind);
  const Icon = kindIcon(zone.kind);
  const level = state?.level ?? 0;
  const isOn = state?.on ?? false;
  const busy = !!pending;
  const shade = isShadeZone(zone);
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onSelect(zone);
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`relative flex flex-col items-start gap-1 px-2.5 py-2 rounded-xl border text-left transition-all ${
        selected
          ? "border-amber-500/50 bg-amber-500/12 ring-1 ring-amber-500/30"
          : isOn
          ? "border-amber-500/25 bg-amber-500/8"
          : "border-border bg-muted/40 hover:bg-muted/60"
      }`}
      title={zone.name}
    >
      <div className="flex items-center gap-1.5 w-full">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            isOn ? "bg-amber-500/20" : "bg-secondary"
          }`}
          style={isOn ? { boxShadow: `0 0 10px ${a.color}55` } : undefined}
        >
          <Icon size={11} style={{ color: isOn ? a.color : "#64748b" }} />
        </div>
        <p className="text-[11px] font-semibold text-foreground truncate flex-1">
          {zone.name}
        </p>
      </div>
      <div className="flex items-center justify-between w-full text-[9px]">
        <span className={`uppercase tracking-wide ${TONE_TEXT[a.tone]}`}>
          {zone.kind}
        </span>
        <span
          className={
            shade
              ? level >= 50
                ? "text-sky-400 font-bold"
                : "text-muted-foreground"
              : isOn
              ? "text-amber-400 font-bold"
              : "text-muted-foreground"
          }
        >
          {shade ? (level >= 50 ? "Open" : "Closed") : isOn ? `${level}%` : "Off"}
        </span>
      </div>
      <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: shade ? "100%" : `${level}%`,
            background: shade
              ? level >= 50
                ? a.color
                : "#334155"
              : isOn
              ? a.color
              : "#334155",
          }}
        />
      </div>
      {busy && (
        <Loader2
          size={10}
          className="absolute top-1 right-1 text-amber-400 animate-spin"
        />
      )}
    </motion.button>
  );
}

function AreaCard({
  area,
  zoneState,
  pendingZones,
  selectedHref,
  onSelectZone,
}) {
  const zones = area.zones || [];
  const onCount = zones.filter((z) => zoneState?.[z.href]?.on).length;
  return (
    <div
      className={`rounded-2xl border bg-card/40 p-3 transition-colors ${
        onCount > 0 ? "border-amber-500/30" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            onCount > 0 ? "bg-amber-500/15" : "bg-secondary"
          }`}
        >
          <MapPin
            size={12}
            className={
              onCount > 0 ? "text-amber-400" : "text-muted-foreground"
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">
            {area.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {onCount}/{zones.length} on
          </p>
        </div>
      </div>
      {zones.length === 0 ? (
        <p className="text-[10px] italic text-muted-foreground">No loads</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {zones.map((z) => (
            <ZoneTile
              key={z.href}
              zone={z}
              state={zoneState?.[z.href]}
              pending={pendingZones?.[z.href]}
              selected={selectedHref === z.href}
              onSelect={(zone) =>
                onSelectZone(selectedHref === zone.href ? null : zone.href)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LightingZoneMap({
  floor,
  zoneState,
  pendingZones,
  selectedHref,
  onSelectZone,
}) {
  if (!floor) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
        No floor selected.
      </div>
    );
  }
  const areas = floor.areas || [];
  const totalZones = areas.reduce((s, a) => s + (a.zones?.length || 0), 0);
  const onZones = areas.reduce(
    (s, a) =>
      s + (a.zones || []).filter((z) => zoneState?.[z.href]?.on).length,
    0
  );

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="px-5 py-2.5 border-b border-border bg-card/40 flex items-center justify-between flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {floor.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {areas.length} areas · {totalZones} loads — click a zone to control
          </p>
        </div>
        <p
          className={`text-xs font-bold flex-shrink-0 ${
            onZones > 0 ? "text-amber-400" : "text-muted-foreground"
          }`}
        >
          {onZones}/{totalZones} on
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {areas.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-12">
            No areas on this floor.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
            {areas.map((area) => (
              <AreaCard
                key={area.fullPath || area.id}
                area={area}
                zoneState={zoneState}
                pendingZones={pendingZones}
                selectedHref={selectedHref}
                onSelectZone={onSelectZone}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
