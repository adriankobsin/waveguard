import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkActionBar({ count, onEdit, onDelete, onClear }) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30">
      <span className="text-sm font-medium text-foreground">
        {count} selected
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
          <Pencil size={13} />
          Bulk edit
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} className="gap-1.5">
          <Trash2 size={13} />
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
          <X size={13} />
          Clear
        </Button>
      </div>
    </div>
  );
}
