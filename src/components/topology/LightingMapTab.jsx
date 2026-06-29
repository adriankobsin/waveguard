import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Moon,
  X,
  Building2,
  Sliders,
  MapPin,
  Wand2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Power,
  PlayCircle,
  Filter,
  Square,
  PanelTop,
  Blinds,
  Zap,
} from "lucide-react";
import { isShadeZone } from "@/lib/lighting/lightingSettings";
import SmoothLevelSlider from "@/components/lighting/SmoothLevelSlider";

const KIND_ACCENT = {
  light:    { label: "Lights",    color: "#f59e0b", bg: "bg-amber-500/15",  text: "text-amber-400",   border: "border-amber-500/30" },
  shade:    { label: "Shades",    color: "#0ea5e9", bg: "bg-sky-500/15",    text: "text-sky-400",     border: "border-sky-500/30" },
  blind:    { label: "Blinds",    color: "#6366f1", bg: "bg-indigo-500/15", text: "text-indigo-400",  border: "border-indigo-500/30" },
  blackout: { label: "Blackouts", color: "#8b5cf6", bg: "bg-violet-500/15", text: "text-violet-400",  border: "border-violet-500/30" },
  load:     { label: "Loads",     color: "#10b981", bg: "bg-emerald-500/15",text: "text-emerald-400", border: "border-emerald-500/30" },
};

const KIND_KEYS = ["all", "light", "shade", "blind", "blackout", "load"];

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

function ZoneMarker({ zone, state, pending, selected, onClick }) {
  const a = accent(zone.kind);
  const Icon = kindIcon(zone.kind);
  const isOn = state?.on ?? false;
  const level = state?.level ?? 0;
  const busy = !!pending;
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.15 }}
      onClick={onClick}
      className="group relative flex-shrink-0"
      title={zone.name}
    >
      {isOn && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ background: a.color, animationDuration: "3s" }}
        />
      )}
      <div
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all border-2 ${
          selected ? "scale-125" : ""
        }`}
        style={{
          background: isOn ? `${a.color}22` : "rgba(15,23,42,0.4)",
          borderColor: selected ? "#fbbf24" : isOn ? a.color : "#334155",
          boxShadow: isOn ? `0 0 12px ${a.color}66` : "none",
        }}
      >
        <Icon
          size={14}
          style={{ color: isOn ? a.color : "#64748b" }}
          fill={isOn ? `${a.color}55` : "none"}
        />
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 36 36"
        >
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={a.color}
            strokeOpacity="0.15"
            strokeWidth="2"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={isOn ? a.color : "#334155"}
            strokeOpacity={isOn ? 0.7 : 0.25}
            strokeWidth="2"
            strokeDasharray={`${(level / 100) * 100.53} 100.53`}
            strokeLinecap="round"
          />
        </svg>
      </div>
      {busy && (
        <Loader2
          size={10}
          className="absolute -top-1 -right-1 text-amber-400 animate-spin"
        />
      )}
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-background/90 px-1.5 py-0.5 rounded">
        {zone.name}
      </span>
    </motion.button>
  );
}

function AreaCell({
  area,
  zoneState,
  pendingZones,
  selectedHref,
  onSelectZone,
  kindFilter,
}) {
  const visibleZones = (area.zones || []).filter(
    (z) => kindFilter === "all" || z.kind === kindFilter
  );
  const onCount = visibleZones.filter((z) => zoneState?.[z.href]?.on).length;
  return (
    <div
      className={`rounded-xl border bg-card/30 p-2.5 ${
        onCount > 0 ? "border-amber-500/25" : "border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin
          size={9}
          className={onCount > 0 ? "text-amber-400" : "text-muted-foreground"}
        />
        <p className="text-[10px] font-bold text-foreground truncate flex-1">
          {area.name}
        </p>
        <span className="text-[9px] text-muted-foreground">
          {onCount}/{visibleZones.length}
        </span>
      </div>
      {visibleZones.length === 0 ? (
        <p className="text-[9px] italic text-muted-foreground">—</p>
      ) : (
        <div className="flex flex-wrap gap-2 pb-3">
          {visibleZones.map((z) => (
            <ZoneMarker
              key={z.href}
              zone={z}
              state={zoneState?.[z.href]}
              pending={pendingZones?.[z.href]}
              selected={selectedHref === z.href}
              onClick={() =>
                onSelectZone(selectedHref === z.href ? null : z.href)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ZonePanel({
  zone,
  state,
  pending,
  areaScenes,
  pendingScene,
  onClose,
  onZoneLevel,
  onZoneToggle,
  onStopShade,
  onActivateScene,
}) {
  const a = accent(zone.kind);
  const isOn = state?.on ?? false;
  const level = state?.level ?? 0;
  const busy = !!pending;
  const shade = isShadeZone(zone);
  return (
    <motion.div
      key={zone.href}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.18 }}
      className="absolute top-3 right-3 w-72 z-20 pointer-events-auto"
    >
      <div className="rounded-2xl border border-border bg-secondary/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lightbulb
              size={14}
              style={{ color: isOn ? a.color : "#64748b" }}
            />
            <p className="text-sm font-semibold text-foreground truncate">
              {zone.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${a.bg} ${a.text} ${a.border}`}
          >
            {zone.kind}
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {zone.floor}
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground truncate max-w-[140px]">
            {zone.area}
          </span>
        </div>

        <div className="px-4 pb-3 flex justify-between text-xs">
          <span className="text-muted-foreground">Address</span>
          <span className="font-mono text-secondary-foreground">
            {zone.href}
          </span>
        </div>

        {shade ? (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Shade control</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onZoneLevel(zone, 100)}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-semibold hover:bg-sky-500/20 disabled:opacity-40 transition-colors"
              >
                <ChevronUp size={14} /> Open
              </button>
              <button
                onClick={() => onZoneLevel(zone, 0)}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-semibold hover:bg-secondary disabled:opacity-40 transition-colors"
              >
                <ChevronDown size={14} /> Close
              </button>
              {onStopShade && (
                <button
                  onClick={() => onStopShade(zone)}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-semibold hover:bg-secondary disabled:opacity-40 transition-colors"
                >
                  <Square size={12} /> Stop
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground font-medium">
                  {isOn ? "On" : "Off"}
                </p>
                <p className="text-xs text-muted-foreground">Quick toggle</p>
              </div>
              <button
                onClick={() => onZoneToggle(zone, !isOn)}
                disabled={busy}
                className={`relative w-12 h-6 rounded-full transition-all disabled:opacity-50 ${
                  isOn ? "bg-amber-500" : "bg-secondary border border-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isOn ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="px-4 pb-4 border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sliders size={10} /> Level
                </p>
                <p
                  className="text-xs font-bold"
                  style={{ color: isOn ? a.color : "#64748b" }}
                >
                  {level}%
                </p>
              </div>
              <SmoothLevelSlider
                value={level}
                busy={busy}
                onChange={(v) => onZoneLevel(zone, v)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                accentColor={a.color}
              />
              <div className="flex justify-between mt-2 gap-1">
                {[0, 25, 50, 75, 100].map((v) => (
                  <button
                    key={v}
                    onClick={() => onZoneLevel(zone, v)}
                    disabled={busy}
                    className={`flex-1 text-[10px] py-1 rounded-lg border transition-colors disabled:opacity-30 ${
                      level === v
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                        : "border-border text-muted-foreground hover:text-secondary-foreground"
                    }`}
                  >
                    {v === 0 ? "Off" : v === 100 ? "Full" : `${v}%`}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {areaScenes && areaScenes.length > 0 && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Area scenes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {areaScenes.map((s) => {
                const isPending = pendingScene === s.href;
                const isOff = /off scene/i.test(s.name);
                return (
                  <button
                    key={s.href}
                    onClick={() => onActivateScene(s)}
                    disabled={isPending}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors disabled:opacity-50 ${
                      isOff
                        ? "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    }`}
                  >
                    {isPending ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : isOff ? (
                      <Power size={10} />
                    ) : (
                      <PlayCircle size={10} />
                    )}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function LightingMapTab({
  hierarchy,
  scenes,
  zoneState,
  pendingZones,
  pendingScene,
  onZoneLevel,
  onZoneToggle,
  onStopShade,
  onActivateScene,
}) {
  const [floorFilter, setFloorFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [selectedHref, setSelectedHref] = useState(null);
  const [listExpanded, setListExpanded] = useState(true);

  const safeHierarchy = useMemo(
    () => (Array.isArray(hierarchy) ? hierarchy : []),
    [hierarchy]
  );

  const visibleFloors = useMemo(() => {
    return safeHierarchy.filter(
      (f) => floorFilter === "all" || f.id === floorFilter
    );
  }, [safeHierarchy, floorFilter]);

  const allZones = useMemo(() => {
    const out = [];
    for (const f of visibleFloors) {
      for (const a of f.areas || []) {
        for (const z of a.zones || []) {
          if (kindFilter === "all" || z.kind === kindFilter) out.push(z);
        }
      }
    }
    return out;
  }, [visibleFloors, kindFilter]);

  const totals = useMemo(() => {
    const onCt = allZones.filter((z) => zoneState?.[z.href]?.on).length;
    return { total: allZones.length, on: onCt, off: allZones.length - onCt };
  }, [allZones, zoneState]);

  const selectedZone = useMemo(
    () =>
      safeHierarchy
        .flatMap((f) => f.areas || [])
        .flatMap((a) => a.zones || [])
        .find((z) => z.href === selectedHref) || null,
    [safeHierarchy, selectedHref]
  );

  const selectedAreaScenes = useMemo(() => {
    if (!selectedZone) return [];
    return (scenes || []).filter(
      (s) => s.areaFullPath === selectedZone.areaFullPath
    );
  }, [scenes, selectedZone]);

  useEffect(() => {
    if (selectedHref && !selectedZone) {
      setSelectedHref(null);
    }
  }, [selectedHref, selectedZone]);

  if (safeHierarchy.length === 0) {
    return (
      <div className="flex h-full overflow-hidden items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 ring-1 ring-amber-500/20 mx-auto">
            <Wand2 size={28} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">
            No lighting house loaded
          </h3>
          <p className="text-xs text-muted-foreground">
            Import a Lutron Integration Report to populate the lighting
            map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 relative bg-background overflow-hidden">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/90 border border-border rounded-xl px-2 py-1.5 backdrop-blur">
            <button
              onClick={() => setFloorFilter("all")}
              className={`text-[10px] px-2 py-0.5 rounded-lg transition-colors ${
                floorFilter === "all"
                  ? "bg-amber-500/25 text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All floors
            </button>
            {safeHierarchy.map((f) => (
              <button
                key={f.id}
                onClick={() => setFloorFilter(f.id)}
                className={`text-[10px] px-2 py-0.5 rounded-lg transition-colors ${
                  floorFilter === f.id
                    ? "bg-amber-500/25 text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-secondary/90 border border-border rounded-xl px-2 py-1.5 backdrop-blur">
            <Filter size={11} className="text-muted-foreground" />
            {KIND_KEYS.map((k) => {
              const a = k === "all" ? null : accent(k);
              const isActive = kindFilter === k;
              return (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg transition-colors capitalize ${
                    isActive
                      ? a
                        ? `${a.bg} ${a.text}`
                        : "bg-amber-500/25 text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "all" ? "All" : a?.label || k}
                </button>
              );
            })}
          </div>
        </div>

        {/* Floor strips */}
        <div className="absolute inset-0 mt-14 overflow-y-auto px-4 pb-16">
          <div className="max-w-7xl mx-auto space-y-4">
            {visibleFloors.map((floor) => {
              const floorZones = (floor.areas || []).flatMap((a) =>
                (a.zones || []).filter(
                  (z) => kindFilter === "all" || z.kind === kindFilter
                )
              );
              const floorOn = floorZones.filter(
                (z) => zoneState?.[z.href]?.on
              ).length;
              return (
                <section
                  key={floor.id}
                  className="rounded-2xl border border-border bg-card/30 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
                    <Building2 size={12} className="text-muted-foreground" />
                    <p className="text-xs font-bold text-foreground truncate">
                      {floor.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {floor.areas?.length || 0} areas · {floorZones.length}{" "}
                      loads
                    </span>
                    <span
                      className={`ml-auto text-[10px] font-bold ${
                        floorOn > 0
                          ? "text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {floorOn}/{floorZones.length} on
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {(floor.areas || []).map((area) => (
                      <AreaCell
                        key={area.fullPath || area.id}
                        area={area}
                        zoneState={zoneState}
                        pendingZones={pendingZones}
                        selectedHref={selectedHref}
                        onSelectZone={setSelectedHref}
                        kindFilter={kindFilter}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Stats strip */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-secondary/90 border border-border rounded-xl px-3 py-2 backdrop-blur text-xs">
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {totals.on} on
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            {totals.off} off
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {totals.total} loads
          </span>
        </div>

        <AnimatePresence>
          {selectedZone && (
            <ZonePanel
              zone={selectedZone}
              state={zoneState?.[selectedZone.href]}
              pending={pendingZones?.[selectedZone.href]}
              areaScenes={selectedAreaScenes}
              pendingScene={pendingScene}
              onClose={() => setSelectedHref(null)}
              onZoneLevel={onZoneLevel}
              onZoneToggle={onZoneToggle}
              onStopShade={onStopShade}
              onActivateScene={onActivateScene}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Right sidebar: zone list */}
      <div className="w-64 flex flex-col border-l border-border bg-card/80 overflow-hidden flex-shrink-0">
        <button
          onClick={() => setListExpanded((e) => !e)}
          className="flex items-center justify-between px-4 py-3 border-b border-border text-xs font-semibold text-secondary-foreground hover:bg-muted transition-colors"
        >
          <span className="flex items-center gap-2">
            <Lightbulb size={12} className="text-amber-400" />
            Zones ({allZones.length})
          </span>
          {listExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <div className="flex items-center gap-3 px-4 py-2 border-b border-border flex-wrap">
          {KIND_KEYS.filter((k) => k !== "all").map((k) => {
            const a = accent(k);
            return (
              <span key={k} className="flex items-center gap-1 text-[10px]">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: a.color }}
                />
                <span className={a.text}>{a.label}</span>
              </span>
            );
          })}
        </div>

        {listExpanded && (
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {allZones.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No zones match filters
              </div>
            ) : (
              allZones.map((z) => {
                const state = zoneState?.[z.href];
                const isOn = state?.on ?? false;
                const level = state?.level ?? 0;
                const isSel = selectedHref === z.href;
                const a = accent(z.kind);
                const shade = isShadeZone(z);
                return (
                  <div
                    key={z.href}
                    onClick={() =>
                      setSelectedHref((prev) =>
                        prev === z.href ? null : z.href
                      )
                    }
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                      isSel
                        ? "bg-muted border border-border"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isOn
                          ? `${a.color}22`
                          : "rgba(15,23,42,0.4)",
                      }}
                    >
                      <Lightbulb
                        size={11}
                        style={{ color: isOn ? a.color : "#64748b" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">
                        {z.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[9px] capitalize ${a.text}`}
                        >
                          {z.kind}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          ·
                        </span>
                        <span className="text-[9px] text-muted-foreground truncate">
                          {z.floor}
                        </span>
                      </div>
                    </div>
                    <div className="w-10 flex flex-col items-end gap-0.5">
                      <span
                        className="text-[9px] font-mono"
                        style={{ color: isOn ? a.color : "#64748b" }}
                      >
                        {shade ? (level >= 50 ? "Open" : "Closed") : level}
                      </span>
                      <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${level}%`,
                            background: isOn ? a.color : "#334155",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
