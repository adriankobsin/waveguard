import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Power,
  PlayCircle,
  Loader2,
  Building2,
  MapPin,
  Wand2,
  GripVertical,
} from "lucide-react";
import ZoneInlineControls from "./ZoneInlineControls";
import { applyFloorOrder } from "@/lib/lighting/lightingSettings";

function ZoneRow(props) {
  return <ZoneInlineControls {...props} variant="row" />;
}

function AreaCard({
  area,
  zoneState,
  pending,
  onZoneLevel,
  onZoneToggle,
  onStopShade,
  onEditZone,
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
                      onStopShade={onStopShade}
                      onEditZone={onEditZone}
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

export default function LutronAreaLoads({
  hierarchy,
  zoneState,
  pendingZones,
  pendingScene,
  onZoneLevel,
  onZoneToggle,
  onStopShade,
  onEditZone,
  onActivateScene,
  defaultFloor,
  emptyMessage,
  orderKey,
  floorOrder,
  onFloorReorder,
}) {
  // Floors and areas start collapsed; the user expands what they need.
  const sortedHierarchy = useMemo(
    () => applyFloorOrder(hierarchy, floorOrder?.[orderKey]),
    [hierarchy, floorOrder, orderKey]
  );
  const allFloorIds = useMemo(
    () => (sortedHierarchy || []).map((f) => f.id),
    [sortedHierarchy]
  );
  const allAreaIds = useMemo(
    () =>
      (hierarchy || []).flatMap((f) =>
        (f.areas || []).map((a) => a.fullPath || a.id)
      ),
    [hierarchy]
  );
  const [openFloors, setOpenFloors] = useState(() =>
    new Set(defaultFloor ? [defaultFloor] : [])
  );
  const [openAreas, setOpenAreas] = useState(() => new Set());

  // Drop expand state for floors/areas removed from the hierarchy (e.g.
  // re-import). Never auto-expand — the user opens sections manually.
  useEffect(() => {
    const floorSet = new Set(allFloorIds);
    const areaSet = new Set(allAreaIds);
    setOpenFloors((prev) => {
      const next = new Set([...prev].filter((id) => floorSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setOpenAreas((prev) => {
      const next = new Set([...prev].filter((id) => areaSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allFloorIds, allAreaIds]);

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

  function handleDragEnd(result) {
    if (!result.destination || result.source.index === result.destination.index) return;
    onFloorReorder?.(result.source.index, result.destination.index);
  }

  function renderFloorSection(floor, { dragHandleProps } = {}) {
    const totals = floorTotals.get(floor.id) || { zones: 0, on: 0 };
    const isOpen = openFloors.has(floor.id);
    return (
      <>
        <div className="w-full flex items-center gap-1 px-2 py-3">
          {dragHandleProps && (
            <button
              type="button"
              {...dragHandleProps}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
              aria-label={`Drag to reorder ${floor.name}`}
              title="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleFloor(floor.id)}
            className="flex-1 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors rounded-lg px-2 py-1 min-w-0"
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
        </div>
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
                    onStopShade={onStopShade}
                    onEditZone={onEditZone}
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
      </>
    );
  }

  if (!hierarchy || hierarchy.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 ring-1 ring-amber-500/20">
          <Wand2 size={28} className="text-amber-400" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1">
          {emptyMessage ? "Nothing to show here" : "No lighting house loaded"}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md">
          {emptyMessage ||
            "Import a Lutron Integration Report to populate areas, loads (zones) and scenes. The report is generated by Lutron Designer for HomeWorks QSX, Athena and RadioRA 3 systems."}
        </p>
      </div>
    );
  }

  const canReorder = Boolean(orderKey && onFloorReorder);

  if (canReorder) {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`lutron-floors-${orderKey}`}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="max-w-5xl mx-auto px-4 py-4 space-y-3"
            >
              {sortedHierarchy.map((floor, index) => (
                <Draggable key={floor.id} draggableId={floor.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <section
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`rounded-2xl border border-border bg-card/40 overflow-hidden transition-shadow ${
                        snapshot.isDragging
                          ? "shadow-xl ring-2 ring-amber-500/25 z-10"
                          : ""
                      }`}
                    >
                      {renderFloorSection(floor, {
                        dragHandleProps: dragProvided.dragHandleProps,
                      })}
                    </section>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
      {sortedHierarchy.map((floor) => (
        <section
          key={floor.id}
          className="rounded-2xl border border-border bg-card/40 overflow-hidden"
        >
          {renderFloorSection(floor)}
        </section>
      ))}
    </div>
  );
}
