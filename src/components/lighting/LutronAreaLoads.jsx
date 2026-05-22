import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  Power,
  PlayCircle,
  Loader2,
  Building2,
  MapPin,
  Wand2,
} from "lucide-react";

const KIND_META = {
  light: {
    label: "Light",
    icon: Lightbulb,
    accent: "text-amber-400 bg-amber-500/12 border-amber-500/30",
    onIcon: "text-amber-400",
    offIcon: "text-muted-foreground",
  },
  shade: {
    label: "Shade",
    icon: Sun,
    accent: "text-sky-400 bg-sky-500/12 border-sky-500/30",
    onIcon: "text-sky-400",
    offIcon: "text-muted-foreground",
  },
  blind: {
    label: "Blind",
    icon: Sun,
    accent: "text-indigo-400 bg-indigo-500/12 border-indigo-500/30",
    onIcon: "text-indigo-400",
    offIcon: "text-muted-foreground",
  },
  blackout: {
    label: "Blackout",
    icon: Moon,
    accent: "text-violet-400 bg-violet-500/12 border-violet-500/30",
    onIcon: "text-violet-400",
    offIcon: "text-muted-foreground",
  },
  load: {
    label: "Load",
    icon: Lightbulb,
    accent: "text-emerald-400 bg-emerald-500/12 border-emerald-500/30",
    onIcon: "text-emerald-400",
    offIcon: "text-muted-foreground",
  },
};

function kindMeta(kind) {
  return KIND_META[kind] || KIND_META.load;
}

function ZoneRow({ zone, state, pending, onLevelChange, onToggle }) {
  const meta = kindMeta(zone.kind);
  const Icon = meta.icon;
  const level = state?.level ?? 0;
  const isOn = state?.on ?? false;
  const isBusy = !!pending;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
        isOn
          ? "border-amber-500/25 bg-amber-500/5"
          : "border-border bg-muted/30"
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
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.accent}`}
          >
            {meta.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate font-mono">
          {zone.href}
        </p>
      </div>

      <div className="hidden sm:block w-36 flex-shrink-0">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className="text-muted-foreground">Level</span>
          <span
            className={isOn ? "text-amber-400 font-bold" : "text-muted-foreground"}
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
          onChange={(e) => onLevelChange(zone, Number(e.target.value))}
          className="w-full h-1.5 cursor-pointer disabled:opacity-50"
          style={{ accentColor: "#f59e0b" }}
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

      {isBusy && (
        <Loader2 size={12} className="text-amber-400 animate-spin flex-shrink-0" />
      )}
    </motion.div>
  );
}

function AreaCard({
  area,
  zoneState,
  pending,
  onZoneLevel,
  onZoneToggle,
  onActivateScene,
  pendingScene,
  expanded,
  onToggleExpanded,
}) {
  const onCount = area.zones.filter(
    (z) => (zoneState[z.href]?.on ?? false) === true
  ).length;
  const litWatts = area.zones.length;
  return (
    <div
      className={`rounded-2xl border bg-card/70 transition-colors ${
        onCount > 0 ? "border-amber-500/30" : "border-border"
      }`}
    >
      <button
        onClick={onToggleExpanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${
            onCount > 0
              ? "bg-amber-500/15 ring-amber-500/25"
              : "bg-secondary ring-border"
          }`}
        >
          <Lightbulb
            size={16}
            className={onCount > 0 ? "text-amber-400" : "text-muted-foreground"}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{area.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            <MapPin size={9} className="inline -mt-0.5 mr-1" />
            {area.fullPath || area.floor}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end text-right">
          <p className="text-xs font-bold text-foreground">
            {onCount}/{litWatts}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
            loads on
          </p>
        </div>
        {expanded ? (
          <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {area.scenes?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Area scenes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {area.scenes.map((s) => {
                      const isPending = pendingScene === s.href;
                      const isOff = /off scene/i.test(s.name);
                      return (
                        <button
                          key={s.href}
                          onClick={() => onActivateScene(area, s)}
                          disabled={isPending}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                            isOff
                              ? "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                              : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          }`}
                        >
                          {isPending ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : isOff ? (
                            <Power size={11} />
                          ) : (
                            <PlayCircle size={11} />
                          )}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {area.zones.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No loads declared for this area.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {area.zones.map((z) => (
                    <ZoneRow
                      key={z.href}
                      zone={z}
                      state={zoneState[z.href]}
                      pending={pending[z.href]}
                      onLevelChange={onZoneLevel}
                      onToggle={onZoneToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Loads-by-area view. Renders the lighting hierarchy (floors → areas → zones)
 * with per-zone level/toggle controls and per-area scene buttons.
 */
export default function LutronAreaLoads({
  hierarchy,
  zoneState,
  pendingZones,
  pendingScene,
  onZoneLevel,
  onZoneToggle,
  onActivateScene,
  defaultFloor,
}) {
  const [openFloors, setOpenFloors] = useState(() => {
    const ids = (hierarchy || []).map((f) => f.id);
    return new Set(defaultFloor ? [defaultFloor] : ids.slice(0, 1));
  });
  const [openAreas, setOpenAreas] = useState(() => new Set());

  const floorTotals = useMemo(() => {
    const t = new Map();
    for (const floor of hierarchy || []) {
      let on = 0;
      let zones = 0;
      for (const area of floor.areas) {
        zones += area.zones.length;
        on += area.zones.filter((z) => zoneState[z.href]?.on).length;
      }
      t.set(floor.id, { zones, on });
    }
    return t;
  }, [hierarchy, zoneState]);

  const toggleFloor = (id) => {
    setOpenFloors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleArea = (id) => {
    setOpenAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!hierarchy || hierarchy.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 ring-1 ring-amber-500/20">
          <Wand2 size={28} className="text-amber-400" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1">
          No lighting house loaded
        </h3>
        <p className="text-xs text-muted-foreground max-w-md">
          Import a Lutron Integration Report to populate areas, loads (zones)
          and scenes. The report is generated by Lutron Designer for
          HomeWorks QSX, Athena and RadioRA 3 systems.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
      {hierarchy.map((floor) => {
        const totals = floorTotals.get(floor.id) || { zones: 0, on: 0 };
        const isOpen = openFloors.has(floor.id);
        return (
          <section
            key={floor.id}
            className="rounded-2xl border border-border bg-card/40 overflow-hidden"
          >
            <button
              onClick={() => toggleFloor(floor.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                <Building2 size={15} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{floor.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {floor.areas.length} areas · {totals.zones} loads
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <p
                  className={`text-sm font-bold ${
                    totals.on > 0 ? "text-amber-400" : "text-muted-foreground"
                  }`}
                >
                  {totals.on}/{totals.zones}
                </p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  loads on
                </p>
              </div>
              {isOpen ? (
                <ChevronDown size={16} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={16} className="text-muted-foreground" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2">
                    {floor.areas.map((area) => (
                      <AreaCard
                        key={area.fullPath || area.id}
                        area={area}
                        zoneState={zoneState}
                        pending={pendingZones}
                        pendingScene={pendingScene}
                        onZoneLevel={onZoneLevel}
                        onZoneToggle={onZoneToggle}
                        onActivateScene={onActivateScene}
                        expanded={openAreas.has(area.fullPath || area.id)}
                        onToggleExpanded={() =>
                          toggleArea(area.fullPath || area.id)
                        }
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
