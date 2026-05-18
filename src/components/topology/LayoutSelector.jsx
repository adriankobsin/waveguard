import { useState, useEffect } from "react";
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

export default function LayoutSelector({ currentLayout, onLoadLayout, onSaveLayout }) {
  const [layouts, setLayouts] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadLayouts();
    }
  }, [open]);

  const loadLayouts = async () => {
    try {
      const response = await base44.entities.LayoutTopology.list();
      setLayouts(response);
    } catch (error) {
      console.error('Failed to load layouts:', error);
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
        <Button variant="outline" size="sm" className="gap-2">
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
            <p className="text-sm text-slate-500 text-center py-8">No saved layouts yet</p>
          ) : (
            layouts.map(layout => (
              <motion.div
                key={layout.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-[#0a0f1c]/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <LayoutGrid size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{layout.name}</p>
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
                    <p className="text-xs text-slate-500">
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
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}