import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {number} props.count
 * @param {Array<{ key: string, label: string, type?: 'text'|'select', options?: string[], placeholder?: string }>} props.fields
 * @param {(patch: Record<string, string>) => Promise<void>} props.onApply
 */
export default function BulkEditModal({ open, onClose, count, fields, onApply, title = "Bulk edit" }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    setValues({});
    onClose();
  };

  const handleApply = async () => {
    const patch = {};
    for (const f of fields) {
      const v = values[f.key];
      if (v != null && String(v).trim() !== "") {
        patch[f.key] = String(v).trim();
      }
    }
    if (Object.keys(patch).length === 0) {
      handleClose();
      return;
    }
    setBusy(true);
    try {
      await onApply(patch);
      setValues({});
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Apply changes to {count} item{count !== 1 ? "s" : ""}. Leave a field empty to keep existing values.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— No change —</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder || `Leave empty to skip`}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={busy}>
            {busy && <Loader2 size={14} className="animate-spin mr-2" />}
            Apply to {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
