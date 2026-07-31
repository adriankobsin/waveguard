import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { LayoutGrid, Trash2, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function LayoutSelector({ currentLayout, onLoadLayout, onSaveLayout, canSave = true }) {
  const [layouts, setLayouts] = useState([]);
  const [open, setOpen] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (open) {
      loadLayouts();
    }
    return () => { cancelledRef.current = true; };
  }, [open]);

  const loadLayouts = async () => {
    try {
      const response = await base44.entities.LayoutTopology.list();
      if (!cancelledRef.current) setLayouts(response);
    } catch (error) {
      if (!cancelledRef.current) console.error('Failed to load layouts:', error);
    }
  };

  const handleLoad = async (layout) => {
    await onLoadLayout(layout);
    setOpen(false);
  };

  const handleDelete = async (layoutId) => {
    if (confirm('Delete this layout?')) {
      try {
        await base44.entities.LayoutTopology.delete(layoutId);
        loadLayouts();
      } catch (error) {
        console.error('Failed to delete layout:', error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-secondary/90 border-border text-secondary-foreground">
          <LayoutGrid size={12} />
          Layouts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved Layouts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
          {layouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No saved layouts yet</p>
          ) : (
            layouts.map(layout => (
              <motion.div
                key={layout.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <LayoutGrid size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{layout.name}</p>
                      {layout.is_default && (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <Star size={10} className="fill-current" />
                          Default
                        </span>
                      )}
                      {currentLayout?.id === layout.id && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <Check size={10} />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Object.keys(layout.node_positions || {}).length} custom positions · {layout.custom_connections?.length || 0} connections
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoad(layout)}
                    disabled={currentLayout?.id === layout.id}
                  >
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(layout.id)}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
        {canSave && onSaveLayout && (
          <div className="pt-3 border-t border-border flex justify-end">
            <Button size="sm" onClick={() => { onSaveLayout(); setOpen(false); }}>
              Save current layout
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
