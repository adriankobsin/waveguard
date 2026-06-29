import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import GridLayout from "react-grid-layout/legacy";
import { useContainerWidth } from "react-grid-layout";
import { Plus, Move, Trash2, Save, Loader2 } from "lucide-react";
import { WIDGET_TYPES, WIDGET_COMPONENTS } from "./widgets/DashboardWidgets";
import { DEFAULT_DASHBOARD_LAYOUT, ensureLocationWidget } from "@/lib/dashboardLayout";
import { useSettings } from "@/hooks/useSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const GRID_COLS = 12;
const ROW_HEIGHT = 80;

const CHART_TYPES = new Set(["network_traffic"]);
const TALL_WIDGET_TYPES = new Set(["network_traffic", "system_location", "live_weather"]);

function toRglLayout(layout) {
  return layout.map((widget) => {
    const def = WIDGET_TYPES[widget.type];
    return {
      i: widget.id,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      minW: def?.minSize?.w ?? 1,
      minH: def?.minSize?.h ?? 1,
      maxW: def?.maxSize?.w ?? GRID_COLS,
      maxH: def?.maxSize?.h ?? 12,
    };
  });
}

function mergeLayoutChange(prev, rglLayout) {
  const byId = Object.fromEntries(rglLayout.map((item) => [item.i, item]));
  return prev.map((widget) => {
    const item = byId[widget.id];
    if (!item) return widget;
    return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
  });
}

export default function CustomizableDashboard() {
  const { value: savedLayout, save, loading, saving } = useSettings(
    "dashboard-layout",
    { layout: DEFAULT_DASHBOARD_LAYOUT }
  );
  const [layout, setLayout] = useState(DEFAULT_DASHBOARD_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth();

  useEffect(() => {
    if (!loading) {
      const saved = savedLayout?.layout?.filter(w => WIDGET_COMPONENTS[w.type]);
      if (saved?.length) {
        setLayout(ensureLocationWidget(saved));
      } else {
        setLayout(DEFAULT_DASHBOARD_LAYOUT);
      }
    }
  }, [loading, savedLayout]);

  const syncLayout = useCallback((rglLayout) => {
    setLayout((prev) => mergeLayoutChange(prev, rglLayout));
  }, []);

  const handleAddWidget = (widgetType) => {
    const widgetDef = WIDGET_TYPES[widgetType];
    if (!widgetDef) return;
    const newWidget = {
      id: `w${Date.now()}`,
      type: widgetType,
      x: 0,
      y: 0,
      w: widgetDef.defaultSize.w,
      h: widgetDef.defaultSize.h,
    };
    setLayout((prev) => [...prev, newWidget]);
    setShowAddModal(false);
  };

  const handleRemoveWidget = (widgetId) => {
    setLayout((prev) => prev.filter((w) => w.id !== widgetId));
  };

  const persistLayout = async () => {
    try {
      await save({ layout });
      toast.success("Dashboard layout saved.");
    } catch {
      toast.error("Could not save layout.");
    }
  };

  const exitEditMode = async () => {
    await persistLayout();
    setEditMode(false);
  };

  const layoutTypesOnBoard = new Set(layout.map((w) => w.type));

  return (
    <div className="min-h-screen bg-background p-3 md:p-6 space-y-4 md:space-y-6">
      <motion.div
        className="flex items-center justify-between gap-2"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">System Overview</p>
          {editMode && (
            <p className="hidden md:block text-xs text-primary/80 mt-1">
              Drag widgets to move · corner handle to resize
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <Button variant="outline" size="sm" onClick={persistLayout} disabled={saving} className="gap-1.5 text-xs md:text-sm">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </Button>
          )}
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => (editMode ? exitEditMode() : setEditMode(true))}
            className="gap-1.5 text-xs md:text-sm"
          >
            <Move size={13} />
            <span className="hidden sm:inline">{editMode ? "Done" : "Edit Layout"}</span>
            <span className="sm:hidden">{editMode ? "Done" : "Edit"}</span>
          </Button>
          {editMode && (
            <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5 text-xs md:text-sm">
              <Plus size={13} />
              <span className="hidden sm:inline">Add Widget</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading dashboard…
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {layout.map((widget) => {
              const WidgetComponent = WIDGET_COMPONENTS[widget.type];
              if (!WidgetComponent) return null;
              const isChart = CHART_TYPES.has(widget.type);
              const isTall = TALL_WIDGET_TYPES.has(widget.type);
              return (
                <motion.div
                  key={widget.id}
                  className="relative rounded-2xl overflow-hidden border border-border"
                  style={{ minHeight: isTall ? 280 : isChart ? 220 : 160 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <WidgetComponent />
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => handleRemoveWidget(widget.id)}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-destructive/20 hover:bg-destructive/40 rounded-lg z-10"
                    >
                      <Trash2 size={12} className="text-destructive" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>

          <div
            ref={containerRef}
            className={`hidden md:block dashboard-grid w-full ${editMode ? "dashboard-grid--editing" : ""}`}
          >
            {mounted && width > 0 && (
              <GridLayout
                className="layout"
                width={width}
                layout={toRglLayout(layout)}
                cols={GRID_COLS}
                rowHeight={ROW_HEIGHT}
                margin={[16, 16]}
                containerPadding={[0, 0]}
                compactType={null}
                preventCollision
                isDraggable={editMode}
                isResizable={editMode}
                draggableCancel=".widget-no-drag"
                onDragStop={editMode ? syncLayout : undefined}
                onResizeStop={editMode ? syncLayout : undefined}
              >
                {layout.map((widget) => {
                  const WidgetComponent = WIDGET_COMPONENTS[widget.type];
                  const widgetDef = WIDGET_TYPES[widget.type];
                  if (!WidgetComponent) return null;

                  return (
                    <div
                      key={widget.id}
                      className={`h-full rounded-2xl overflow-hidden relative ${
                        editMode ? "cursor-grab active:cursor-grabbing" : ""
                      }`}
                    >
                      {editMode && (
                        <>
                          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center py-1 pointer-events-none bg-background/80 backdrop-blur-sm border-b border-border">
                            <div className="flex items-center gap-1.5 px-2">
                              <Move size={12} className="text-primary/80" />
                              <span className="text-[10px] text-primary font-medium">
                                {widgetDef?.name} · drag to move
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveWidget(widget.id)}
                            className="widget-no-drag absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-destructive/20 hover:bg-destructive/40 rounded-lg z-20"
                          >
                            <Trash2 size={12} className="text-destructive" />
                          </button>
                        </>
                      )}
                      <div className={`h-full ${editMode ? "pt-7" : ""}`}>
                        <WidgetComponent />
                      </div>
                    </div>
                  );
                })}
              </GridLayout>
            )}
          </div>
        </>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>All available widgets — choose one to add to your dashboard</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4 max-h-[60vh] overflow-y-auto pr-1">
            {Object.values(WIDGET_TYPES).map((widget) => {
              const Icon = widget.icon;
              const onBoard = layoutTypesOnBoard.has(widget.id);
              return (
                <button
                  key={widget.id}
                  type="button"
                  onClick={() => handleAddWidget(widget.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    onBoard
                      ? "border-border bg-muted/50 opacity-80 hover:opacity-100"
                      : "border-border bg-secondary hover:bg-secondary/80 hover:border-primary/40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{widget.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{widget.description}</p>
                    {onBoard && <p className="text-[10px] text-primary mt-1">Already on dashboard</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}