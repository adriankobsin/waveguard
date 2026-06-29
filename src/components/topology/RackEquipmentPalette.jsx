import { useMemo, useState } from "react";
import { Search, GripVertical } from "lucide-react";
import { normalizeEquipmentRecord, CATEGORY_COLORS } from "@/lib/topology/equipmentCatalog";

export default function RackEquipmentPalette({
  devices,
  placedIds,
  canEdit,
  onDragStart,
}) {
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.toLowerCase();
    return (devices || [])
      .map((d) => normalizeEquipmentRecord(d))
      .filter((d) => {
        if (!q) return true;
        return (
          d.name?.toLowerCase().includes(q) ||
          d.model?.toLowerCase().includes(q) ||
          d.location?.toLowerCase().includes(q)
        );
      });
  }, [devices, query]);

  return (
    <div className="w-56 flex-shrink-0 border-r border-border bg-card/80 flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <p className="text-xs font-semibold text-foreground mb-2">Equipment catalog</p>
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-2 py-1.5">
          <Search size={12} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {items.map((item) => {
          const placed = placedIds.has(item.id);
          const color = CATEGORY_COLORS[item.category] || "#94a3b8";
          return (
            <div
              key={item.id}
              draggable={canEdit && !placed}
              onDragStart={() => canEdit && !placed && onDragStart?.(item)}
              className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                placed
                  ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                  : canEdit
                    ? "border-border bg-muted hover:border-cyan-500/30 cursor-grab active:cursor-grabbing"
                    : "border-border bg-muted"
              }`}
            >
              {canEdit && <GripVertical size={12} className="text-muted-foreground mt-0.5 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.model}</p>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                  <span style={{ color }}>{item.category}</span>
                  <span>{item.ruHeight}U</span>
                  <span>{item.telemetry?.powerW ?? item.defaultWatts}W</span>
                </div>
                {placed && <span className="text-[9px] text-amber-500/80">Placed</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

