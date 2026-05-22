import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { buildOccupiedMap, canPlaceAt } from "@/lib/topology/rackPlacement";

export default function RackPlacementModal({
  open,
  onOpenChange,
  item,
  racks,
  rackItemsById,
  onSave,
  onRemove,
}) {
  const placement = item?.placement;
  const [rackId, setRackId] = useState(placement?.rackId || "");
  const [ruStart, setRuStart] = useState(String(placement?.ruStart ?? 1));
  const [ruHeight, setRuHeight] = useState(String(placement?.ruHeight ?? item?.ruHeight ?? 1));

  const rack = useMemo(() => racks.find((r) => r.id === rackId), [racks, rackId]);
  const totalUnits = rack?.units ?? 12;

  const handleOpenChange = (isOpen) => {
    if (isOpen && item) {
      setRackId(item.placement?.rackId || racks[0]?.id || "");
      setRuStart(String(item.placement?.ruStart ?? 1));
      setRuHeight(String(item.placement?.ruHeight ?? item.ruHeight ?? 1));
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    const start = parseInt(ruStart, 10);
    const height = parseInt(ruHeight, 10);
    if (!rackId || Number.isNaN(start) || Number.isNaN(height)) {
      toast.error("Fill in rack, start U, and height");
      return;
    }
    if (height < 1 || height > 8) {
      toast.error("Height must be between 1 and 8U");
      return;
    }
    const items = (rackItemsById[rackId] || []).filter((i) => i.id !== item.id);
    const occupied = buildOccupiedMap(items);
    if (!canPlaceAt(occupied, start, height, totalUnits)) {
      toast.error("Not enough free space at that position");
      return;
    }
    onSave({ rackId, ruStart: start, ruHeight: height });
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-secondary border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit rack placement</DialogTitle>
          <p className="text-xs text-muted-foreground">{item.name}</p>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-secondary-foreground">Rack</Label>
            <Select value={rackId} onValueChange={setRackId}>
              <SelectTrigger className="bg-secondary border-border text-foreground">
                <SelectValue placeholder="Select rack" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border border-border">
                {racks.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-foreground">
                    {r.name} ({r.units}U)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-secondary-foreground">Start U</Label>
              <Input
                type="number"
                min={1}
                max={totalUnits}
                value={ruStart}
                onChange={(e) => setRuStart(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-secondary-foreground">Height (U)</Label>
              <Input
                type="number"
                min={1}
                max={8}
                value={ruHeight}
                onChange={(e) => setRuHeight(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-border">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1 bg-cyan-500 hover:bg-cyan-600">
                Save
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onRemove(item.id);
                onOpenChange(false);
              }}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Remove from rack
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
