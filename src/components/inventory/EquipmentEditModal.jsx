import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { DEVICE_CATEGORIES } from "@/lib/equipment/deviceFormConstants";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Decommissioned"];

const inputCls =
  "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

const selectCls =
  "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

export default function EquipmentEditModal({
  open,
  onClose,
  isNew,
  form,
  onChange,
  onSave,
  saving = false,
  categoryOptions = [],
  areaOptions = [],
  roomOptions = [],
}) {
  const categories = [...new Set([...DEVICE_CATEGORIES, ...categoryOptions])];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "New equipment" : "Edit equipment"}</DialogTitle>
          <DialogDescription>
            Update device details. Area and room set the location shown in the inventory list.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <Field label="Name">
            <input
              value={form.name || ""}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. 552-Sw2"
              className={inputCls}
            />
          </Field>
          <Field label="Make">
            <input
              value={form.make || ""}
              onChange={(e) => onChange({ make: e.target.value })}
              placeholder="e.g. Cisco"
              className={inputCls}
            />
          </Field>
          <Field label="Model">
            <input
              value={form.model || ""}
              onChange={(e) => onChange({ model: e.target.value })}
              placeholder="e.g. C9300L-24P-4X-E"
              className={inputCls}
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category || "Network"}
              onChange={(e) => onChange({ category: e.target.value })}
              className={selectCls}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="IP address">
            <input
              value={form.ip || ""}
              onChange={(e) => onChange({ ip: e.target.value })}
              placeholder="192.168.x.x"
              className={inputCls}
            />
          </Field>
          <Field label="MAC address">
            <input
              value={form.mac || ""}
              onChange={(e) => onChange({ mac: e.target.value })}
              placeholder="00:1A:…"
              className={inputCls}
            />
          </Field>
          <Field label="Area / deck">
            <select
              value={form.area || ""}
              onChange={(e) => onChange({ area: e.target.value })}
              className={selectCls}
            >
              <option value="">— Select area —</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Room">
            <select
              value={form.room || ""}
              onChange={(e) => onChange({ room: e.target.value })}
              className={selectCls}
            >
              <option value="">— Select room —</option>
              {roomOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Condition">
            <select
              value={form.condition || "Good"}
              onChange={(e) => onChange({ condition: e.target.value })}
              className={selectCls}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Serial number">
            <input
              value={form.serial || ""}
              onChange={(e) => onChange({ serial: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Location (optional override)">
            <input
              value={form.location || ""}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="Auto-filled from area · room"
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <input
                value={form.notes || ""}
                onChange={(e) => onChange({ notes: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || !form.name?.trim() || !form.model?.trim()}
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Check size={14} className="mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
