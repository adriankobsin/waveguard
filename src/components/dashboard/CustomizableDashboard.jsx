import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Grid3X3, Move, Trash2, Settings, Check,
  ChevronRight, Monitor, Activity, AlertTriangle, Globe,
  Radio, BarChart3, Server
} from "lucide-react";
import { WIDGET_TYPES, WIDGET_COMPONENTS } from "./widgets/DashboardWidgets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_LAYOUT = [
  { id: "w1", type: "stats_grid", x: 0, y: 0, w: 12, h: 2 },
  { id: "w2", type: "alarms", x: 0, y: 2, w: 4, h: 3 },
  { id: "w3", type: "categories", x: 4, y: 2, w: 4, h: 3 },
  { id: "w4", type: "wan_status", x: 8, y: 2, w: 4, h: 3 },
  { id: "w5", type: "traffic_chart", x: 0, y: 5, w: 8, h: 4 },
  { id: "w6", type: "wan_latency", x: 8, y: 5, w: 4, h: 4 },
];

const GRID_COLS = 12;
const CELL_HEIGHT = 100;

export default function CustomizableDashboard() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [gridContainer, setGridContainer] = useState(null);

  const handleAddWidget = (widgetType) => {
    const widgetDef = WIDGET_TYPES[widgetType];
    const newWidget = {
      id: `w${Date.now()}`,
      type: widgetType,
      x: 0,
      y: 0,
      w: widgetDef.defaultSize.w,
      h: widgetDef.defaultSize.h,
    };
    setLayout([...layout, newWidget]);
    setShowAddModal(false);
  };

  const handleRemoveWidget = (widgetId) => {
    setLayout(layout.filter(w => w.id !== widgetId));
  };

  const handleDragStart = (e, widget) => {
    if (!editMode || !gridContainer) return;
    setDraggingId(widget.id);
    const rect = e.currentTarget?.getBoundingClientRect();
    const gridRect = gridContainer.getBoundingClientRect();
    if (rect && gridRect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleDrag = (e) => {
    if (!draggingId || !editMode || !gridContainer) return;
    const gridRect = gridContainer.getBoundingClientRect();
    if (!gridRect) return;
    
    const cellWidth = gridRect.width / GRID_COLS;
    const x = e.clientX - gridRect.left - dragOffset.x;
    const y = e.clientY - gridRect.top - dragOffset.y;
    
    const newGridX = Math.max(0, Math.min(Math.round(x / cellWidth), GRID_COLS - 1));
    const newGridY = Math.max(0, Math.round(y / CELL_HEIGHT));
    
    setLayout(prev => prev.map(w => {
      if (w.id === draggingId) {
        return {
          ...w,
          x: newGridX,
          y: newGridY,
        };
      }
      return w;
    }));
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleResize = (widgetId, direction, delta) => {
    if (!editMode) return;
    setLayout(prev => prev.map(w => {
      if (w.id === widgetId) {
        const widgetDef = WIDGET_TYPES[w.type];
        let newW = w.w;
        let newH = w.h;
        
        if (direction.includes('e')) {
          newW = Math.max(widgetDef.minSize.w, w.w + delta);
        }
        if (direction.includes('s')) {
          newH = Math.max(widgetDef.minSize.h, w.h + delta);
        }
        
        return { ...w, w: newW, h: newH };
      }
      return w;
    }));
  };

  // Determine if we're on mobile via window width
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-[#060912] p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header with Edit Mode Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-xs md:text-sm text-slate-500">System overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
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
      </div>

      {/* Mobile: stacked single-column layout */}
      <div className="md:hidden space-y-3">
        {layout.map(widget => {
          const WidgetComponent = WIDGET_COMPONENTS[widget.type];
          const widgetDef = WIDGET_TYPES[widget.type];
          const isChart = widget.type === "traffic_chart" || widget.type === "wan_latency";
          return (
            <motion.div
              key={widget.id}
              className="relative rounded-2xl overflow-hidden"
              style={{ minHeight: isChart ? 220 : 160 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="h-full">
                <WidgetComponent />
              </div>
              {editMode && (
                <button
                  onClick={() => handleRemoveWidget(widget.id)}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors z-10"
                >
                  <Trash2 size={12} className="text-red-400" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Desktop: 12-column grid layout */}
      <div
        ref={setGridContainer}
        className="relative hidden md:grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          gridAutoRows: `${CELL_HEIGHT}px`,
        }}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {layout.map(widget => {
          const WidgetComponent = WIDGET_COMPONENTS[widget.type];
          const widgetDef = WIDGET_TYPES[widget.type];
          const Icon = widgetDef?.icon || Grid3X3;
          
          return (
            <motion.div
              key={widget.id}
              drag={editMode}
              dragMomentum={false}
              onDragStart={(e) => handleDragStart(e, widget)}
              className={`relative rounded-2xl overflow-hidden ${
                draggingId === widget.id ? "opacity-50" : ""
              }`}
              style={{
                gridColumn: `span ${widget.w}`,
                gridRow: `span ${widget.h}`,
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="h-full">
                <WidgetComponent />
              </div>

              {editMode && (
                <>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                    <div className="flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg">
                      <Move size={12} className="text-white/70" />
                      <span className="text-[10px] text-white/70">{widgetDef?.name}</span>
                    </div>
                  </div>

                  <div
                    className="absolute bottom-2 right-2 w-6 h-6 cursor-se-resize z-10 flex items-center justify-center"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const onMove = (moveEvent) => {
                        if (!gridContainer) return;
                        const gridRect = gridContainer.getBoundingClientRect();
                        if (!gridRect) return;
                        const deltaX = Math.round((moveEvent.clientX - startX) / (gridRect.width / GRID_COLS));
                        const deltaY = Math.round((moveEvent.clientY - startY) / CELL_HEIGHT);
                        handleResize(widget.id, 'se', Math.max(deltaX, deltaY));
                      };
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                  >
                    <div className="w-3 h-3 border-r-2 border-b-2 border-white/50" />
                  </div>

                  <button
                    onClick={() => handleRemoveWidget(widget.id)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors z-10"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Add Widget Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Choose a widget to add to your dashboard
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {Object.values(WIDGET_TYPES).map(widget => {
              const Icon = widget.icon;
              return (
                <button
                  key={widget.id}
                  onClick={() => handleAddWidget(widget.id)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/40 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{widget.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{widget.description}</p>
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