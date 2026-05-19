import { useState } from "react";
import { useSiteLocations } from "@/contexts/SiteLocationsContext";
import { normalizeSiteLocations } from "@/lib/siteLocations";
import { Loader2, Plus, Trash2, X, Save, CheckCircle2 } from "lucide-react";

function SaveBar({ saving, saved, onSave, label }) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
      {saving ? "Saving…" : saved ? "Saved!" : label}
    </button>
  );
}

const INPUT_CLS =
  "w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50";

function DeckEditor({ deck, onRenameDeck, onRemoveDeck, onAddRoom, onRenameRoom, onRemoveRoom }) {
  const [roomName, setRoomName] = useState("");

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          className={`${INPUT_CLS} flex-1`}
          value={deck.name}
          onChange={(e) => onRenameDeck(e.target.value)}
        />
        <button
          type="button"
          onClick={onRemoveDeck}
          className="p-2 rounded-lg text-muted-foreground hover:text-red-400"
          title="Remove deck"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="pl-2 space-y-2 border-l-2 border-border">
        {deck.rooms.map((room) => (
          <div key={room.id} className="flex items-center gap-2">
            <input
              className={`${INPUT_CLS} flex-1 text-sm`}
              value={room.name}
              onChange={(e) => onRenameRoom(room.id, e.target.value)}
            />
            <button
              type="button"
              onClick={() => onRemoveRoom(room.id)}
              className="p-1.5 rounded text-muted-foreground hover:text-red-400"
              title="Remove room"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            className={`${INPUT_CLS} flex-1 text-sm`}
            placeholder="New room / area"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddRoom(roomName);
                setRoomName("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              onAddRoom(roomName);
              setRoomName("");
            }}
            className="px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
          >
            Add room
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DecksRoomsPanel() {
  const { decks, setDecks, saveLocations, saving, saved, loading } = useSiteLocations();
  const [newDeckName, setNewDeckName] = useState("");

  const addDeck = () => {
    const name = newDeckName.trim();
    if (!name) return;
    setDecks((prev) =>
      normalizeSiteLocations({
        decks: [
          ...prev.decks,
          { id: `deck-${Date.now()}`, name, rooms: [{ id: `room-${Date.now()}`, name: "Main" }] },
        ],
      })
    );
    setNewDeckName("");
  };

  const addRoom = (deckId, roomName) => {
    const name = roomName.trim();
    if (!name) return;
    setDecks((prev) =>
      normalizeSiteLocations({
        decks: prev.decks.map((d) =>
          d.id === deckId ? { ...d, rooms: [...d.rooms, { id: `room-${Date.now()}`, name }] } : d
        ),
      })
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
        <Loader2 size={16} className="animate-spin" /> Loading decks…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Define decks and rooms for the vessel. These appear when placing racks and assigning equipment
        location across the platform.
      </p>
      <div className="flex gap-2">
        <input
          className={INPUT_CLS}
          placeholder="New deck name (e.g. Bridge)"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDeck())}
        />
        <button
          type="button"
          onClick={addDeck}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1"
        >
          <Plus size={14} /> Add deck
        </button>
      </div>
      <div className="space-y-4">
        {decks.map((deck) => (
          <DeckEditor
            key={deck.id}
            deck={deck}
            onRenameDeck={(name) =>
              setDecks((prev) =>
                normalizeSiteLocations({
                  decks: prev.decks.map((d) => (d.id === deck.id ? { ...d, name } : d)),
                })
              )
            }
            onRemoveDeck={() =>
              setDecks((prev) =>
                normalizeSiteLocations({ decks: prev.decks.filter((d) => d.id !== deck.id) })
              )
            }
            onAddRoom={(name) => addRoom(deck.id, name)}
            onRenameRoom={(roomId, name) =>
              setDecks((prev) =>
                normalizeSiteLocations({
                  decks: prev.decks.map((d) =>
                    d.id === deck.id
                      ? { ...d, rooms: d.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)) }
                      : d
                  ),
                })
              )
            }
            onRemoveRoom={(roomId) =>
              setDecks((prev) =>
                normalizeSiteLocations({
                  decks: prev.decks.map((d) =>
                    d.id === deck.id ? { ...d, rooms: d.rooms.filter((r) => r.id !== roomId) } : d
                  ),
                })
              )
            }
          />
        ))}
      </div>
      <SaveBar
        saving={saving}
        saved={saved}
        onSave={() => saveLocations(normalizeSiteLocations({ decks }))}
        label="Save decks & rooms"
      />
    </div>
  );
}

