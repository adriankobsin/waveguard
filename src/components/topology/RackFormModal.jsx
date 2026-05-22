import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LocationPicker from "@/components/location/LocationPicker";
import { useSiteLocations } from "@/contexts/SiteLocationsContext";
import { findLocationIds } from "@/lib/siteLocations";

function FormField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <Label className="text-secondary-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary border-border text-foreground mt-1"
      />
    </div>
  );
}

export default function RackFormModal({ open, onOpenChange, rack, onSubmit }) {
  const { decks } = useSiteLocations();
  const [name, setName] = useState("");
  const [deckId, setDeckId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [location, setLocation] = useState("");
  const [units, setUnits] = useState(12);

  useEffect(() => {
    if (!open) return;
    setName(rack?.name || "");
    setUnits(rack?.units || 12);
    if (rack?.deckId && rack?.roomId) {
      setDeckId(rack.deckId);
      setRoomId(rack.roomId);
      setLocation(rack.location || "");
    } else {
      const resolved = findLocationIds(decks, rack?.location || "");
      setDeckId(resolved.deckId);
      setRoomId(resolved.roomId);
      setLocation(rack?.location || "");
    }
  }, [open, rack, decks]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const u = Number(units);
    if (!name.trim()) return;
    if (u < 1 || u > 48) return;
    if (!deckId || !roomId) return;
    onSubmit({
      name: name.trim(),
      deckId,
      roomId,
      location: location.trim(),
      units: u,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{rack ? "Edit rack" : "Add rack"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField label="Name" value={name} onChange={setName} placeholder="Bridge Rack" />
          <LocationPicker
            deckId={deckId}
            roomId={roomId}
            required
            onChange={({ deckId: d, roomId: r, location: loc }) => {
              setDeckId(d);
              setRoomId(r);
              setLocation(loc);
            }}
          />
          <div>
            <Label className="text-secondary-foreground">Rack units (1–48)</Label>
            <Input
              type="number"
              min={1}
              max={48}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="bg-secondary border-border text-foreground mt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!deckId || !roomId}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
