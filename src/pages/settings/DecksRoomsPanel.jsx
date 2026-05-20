import { useState, useEffect, useRef } from "react";
import { useSiteLocations } from "@/contexts/SiteLocationsContext";
import { normalizeSiteLocations } from "@/lib/siteLocations";
import {
  Loader2,
  Plus,
  Trash2,
  X,
  Save,
  CheckCircle2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

function reorder(list, startIndex, endIndex) {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

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

const SELECT_CLS =
  "w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer";

function DragHandle({ isDragging, label, onDragStart, onDragEnd }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary touch-none cursor-grab active:cursor-grabbing ${
        isDragging ? "text-primary bg-primary/10" : ""
      }`}
      title={label}
      aria-label={label}
    >
      <GripVertical size={16} />
    </button>
  );
}

function RoomList({ rooms, onReorder, onRenameRoom, onRemoveRoom }) {
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const rowRefs = useRef({});

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", rooms[index]?.id ?? "");
    setDraggingIndex(index);
    const row = rowRefs.current[rooms[index]?.id];
    if (row) {
      e.dataTransfer.setDragImage(row, 24, 20);
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggingIndex == null || draggingIndex === dropIndex) return;
    onReorder(draggingIndex, dropIndex);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  if (!rooms.length) {
    return (
      <p className="text-sm text-muted-foreground py-2 pl-2 border-l-2 border-border">
        No rooms yet — add one below.
      </p>
    );
  }

  return (
    <div className="space-y-2 border-l-2 border-border pl-2">
      {rooms.map((room, index) => (
        <div
          key={room.id}
          ref={(el) => {
            if (el) rowRefs.current[room.id] = el;
          }}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          className={`flex items-center gap-2 rounded-lg transition-colors ${
            dragOverIndex === index ? "bg-primary/10 ring-1 ring-primary/30" : ""
          } ${draggingIndex === index ? "opacity-40" : ""}`}
        >
          <DragHandle
            isDragging={draggingIndex === index}
            label="Drag to reorder room"
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
          />
          <label className="flex-1 flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Room name</span>
            <input
              className={INPUT_CLS}
              value={room.name}
              onChange={(e) => onRenameRoom(room.id, e.target.value)}
              placeholder="Room / area name"
              draggable={false}
            />
          </label>
          <button
            type="button"
            onClick={() => onRemoveRoom(room.id)}
            className="p-2 rounded-lg text-muted-foreground hover:text-red-400 flex-shrink-0"
            title="Remove room"
            draggable={false}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function DecksRoomsPanel() {
  const { decks, setDecks, saveLocations, saving, saved, loading } = useSiteLocations();
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");

  const selectedIndex = decks.findIndex((d) => d.id === selectedDeckId);
  const selectedDeck = selectedIndex >= 0 ? decks[selectedIndex] : null;

  useEffect(() => {
    if (!decks.length) {
      setSelectedDeckId("");
      return;
    }
    if (!decks.some((d) => d.id === selectedDeckId)) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  const addDeck = () => {
    const name = newDeckName.trim();
    if (!name) return;
    const id = `deck-${Date.now()}`;
    setDecks((prev) =>
      normalizeSiteLocations({
        decks: [
          ...prev.decks,
          { id, name, rooms: [{ id: `room-${Date.now()}`, name: "Main" }] },
        ],
      })
    );
    setSelectedDeckId(id);
    setNewDeckName("");
  };

  const moveDeck = (direction) => {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= decks.length) return;
    setDecks((prev) =>
      normalizeSiteLocations({
        decks: reorder(prev.decks, selectedIndex, target),
      })
    );
  };

  const removeDeck = () => {
    if (!selectedDeck || decks.length <= 1) return;
    const nextDecks = decks.filter((d) => d.id !== selectedDeck.id);
    setDecks((prev) => normalizeSiteLocations({ decks: prev.decks.filter((d) => d.id !== selectedDeck.id) }));
    setSelectedDeckId(nextDecks[0]?.id ?? "");
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
        Choose a deck from the list, edit its name and rooms, and drag room grip handles to reorder.
        Deck order in the dropdown follows the list order used across the platform.
      </p>

      {/* Deck selector */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Deck</span>
          {decks.length > 0 ? (
            <select
              className={SELECT_CLS}
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
            >
              {decks.map((deck, index) => (
                <option key={deck.id} value={deck.id}>
                  {index + 1}. {deck.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No decks defined yet.</p>
          )}
        </label>

        {selectedDeck && (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveDeck(-1)}
                disabled={selectedIndex <= 0}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40"
                title="Move deck up in list"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveDeck(1)}
                disabled={selectedIndex >= decks.length - 1}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40"
                title="Move deck down in list"
              >
                <ChevronDown size={16} />
              </button>
              <span className="text-xs text-muted-foreground flex-1">
                Reorder deck in dropdown list
              </span>
              <button
                type="button"
                onClick={removeDeck}
                disabled={decks.length <= 1}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 disabled:opacity-40"
                title={decks.length <= 1 ? "At least one deck is required" : "Remove deck"}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Deck name</span>
              <input
                className={INPUT_CLS}
                value={selectedDeck.name}
                onChange={(e) =>
                  setDecks((prev) =>
                    normalizeSiteLocations({
                      decks: prev.decks.map((d) =>
                        d.id === selectedDeck.id ? { ...d, name: e.target.value } : d
                      ),
                    })
                  )
                }
                placeholder="Deck name (e.g. Bridge)"
              />
            </label>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rooms</p>
              <RoomList
                rooms={selectedDeck.rooms}
                onReorder={(from, to) =>
                  setDecks((prev) =>
                    normalizeSiteLocations({
                      decks: prev.decks.map((d) =>
                        d.id === selectedDeck.id ? { ...d, rooms: reorder(d.rooms, from, to) } : d
                      ),
                    })
                  )
                }
                onRenameRoom={(roomId, name) =>
                  setDecks((prev) =>
                    normalizeSiteLocations({
                      decks: prev.decks.map((d) =>
                        d.id === selectedDeck.id
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
                        d.id === selectedDeck.id
                          ? { ...d, rooms: d.rooms.filter((r) => r.id !== roomId) }
                          : d
                      ),
                    })
                  )
                }
              />
              <div className="flex gap-2">
                <input
                  className={`${INPUT_CLS} flex-1 text-sm`}
                  placeholder="New room / area"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = newRoomName.trim();
                      if (!name) return;
                      setDecks((prev) =>
                        normalizeSiteLocations({
                          decks: prev.decks.map((d) =>
                            d.id === selectedDeck.id
                              ? { ...d, rooms: [...d.rooms, { id: `room-${Date.now()}`, name }] }
                              : d
                          ),
                        })
                      );
                      setNewRoomName("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newRoomName.trim();
                    if (!name) return;
                    setDecks((prev) =>
                      normalizeSiteLocations({
                        decks: prev.decks.map((d) =>
                          d.id === selectedDeck.id
                            ? { ...d, rooms: [...d.rooms, { id: `room-${Date.now()}`, name }] }
                            : d
                        ),
                      })
                    );
                    setNewRoomName("");
                  }}
                  className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground whitespace-nowrap flex items-center gap-1"
                >
                  <Plus size={12} /> Add room
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add deck */}
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
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1 whitespace-nowrap"
        >
          <Plus size={14} /> Add deck
        </button>
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
