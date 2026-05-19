import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSiteLocations } from "@/contexts/SiteLocationsContext";

/**
 * Deck + room dropdowns. Updates parent with deckId, roomId, and formatted location string.
 */
export default function LocationPicker({
  deckId,
  roomId,
  onChange,
  required = false,
  className = "",
  dark = true,
}) {
  const { decks, loading, formatLocation } = useSiteLocations();

  const rooms = useMemo(() => {
    const deck = decks.find((d) => d.id === deckId);
    return deck?.rooms || [];
  }, [decks, deckId]);

  const triggerCls = dark
    ? "bg-white/5 border-white/10 text-white mt-1"
    : "bg-secondary border-border text-foreground mt-1";
  const contentCls = dark
    ? "bg-[#0a0f1c] border border-white/10"
    : "bg-card border border-border";

  if (loading) {
    return <p className="text-xs text-slate-500">Loading decks…</p>;
  }

  if (decks.length === 0) {
    return (
      <p className="text-xs text-amber-400/90">
        No decks configured. Add decks and rooms in Settings → Decks & rooms.
      </p>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <div>
        <Label className={dark ? "text-slate-300" : "text-muted-foreground"}>
          Deck{required ? " *" : ""}
        </Label>
        <Select
          value={deckId || ""}
          onValueChange={(id) => {
            const deck = decks.find((d) => d.id === id);
            const firstRoom = deck?.rooms?.[0];
            onChange?.({
              deckId: id,
              roomId: firstRoom?.id || "",
              location: formatLocation(id, firstRoom?.id || ""),
            });
          }}
        >
          <SelectTrigger className={triggerCls}>
            <SelectValue placeholder="Select deck" />
          </SelectTrigger>
          <SelectContent className={contentCls}>
            {decks.map((d) => (
              <SelectItem key={d.id} value={d.id} className="text-white">
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className={dark ? "text-slate-300" : "text-muted-foreground"}>
          Room / area{required ? " *" : ""}
        </Label>
        <Select
          value={roomId || ""}
          onValueChange={(id) => {
            onChange?.({
              deckId,
              roomId: id,
              location: formatLocation(deckId, id),
            });
          }}
          disabled={!deckId || rooms.length === 0}
        >
          <SelectTrigger className={triggerCls}>
            <SelectValue placeholder={deckId ? "Select room" : "Select deck first"} />
          </SelectTrigger>
          <SelectContent className={contentCls}>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-white">
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
