/** Default vessel decks and rooms — overridden by Settings → Decks & rooms. */
export const DEFAULT_SITE_LOCATIONS = {
  decks: [
    {
      id: "deck-bridge",
      name: "Bridge",
      rooms: [
        { id: "room-bridge-rack", name: "Bridge Rack" },
        { id: "room-bridge-console", name: "Bridge Console" },
        { id: "room-bridge-mast", name: "Bridge Mast" },
      ],
    },
    {
      id: "deck-saloon",
      name: "Saloon",
      rooms: [
        { id: "room-saloon-av", name: "Saloon AV Rack" },
        { id: "room-saloon-cabinet", name: "Saloon Cabinet" },
        { id: "room-saloon-main", name: "Saloon" },
      ],
    },
    {
      id: "deck-engine",
      name: "Engine Room",
      rooms: [{ id: "room-engine-main", name: "Engine Room" }],
    },
    {
      id: "deck-upper",
      name: "Upper Deck",
      rooms: [{ id: "room-upper-open", name: "Upper Deck" }],
    },
    {
      id: "deck-fore",
      name: "Fore Deck",
      rooms: [{ id: "room-fore-open", name: "Fore Deck" }],
    },
    {
      id: "deck-aft",
      name: "Aft Deck",
      rooms: [{ id: "room-aft-open", name: "Aft Deck" }],
    },
  ],
};

export const SITE_LOCATIONS_SETTINGS_KEY = "site-locations";
export const SITE_LOCATIONS_CHANGED_EVENT = "waveguard-site-locations-changed";

export function normalizeSiteLocations(raw) {
  const decks = Array.isArray(raw?.decks) ? raw.decks : DEFAULT_SITE_LOCATIONS.decks;
  return {
    decks: decks.map((d) => ({
      id: d.id || `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: (d.name || "").trim() || "Unnamed deck",
      rooms: (d.rooms || []).map((r) => ({
        id: r.id || `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: (r.name || "").trim() || "Unnamed room",
      })),
    })),
  };
}

export function formatLocationLabel(decks, deckId, roomId) {
  const deck = decks.find((d) => d.id === deckId);
  const room = deck?.rooms?.find((r) => r.id === roomId);
  if (deck && room) return `${deck.name} · ${room.name}`;
  if (deck) return deck.name;
  return "";
}

export function findLocationIds(decks, locationText) {
  if (!locationText) return { deckId: "", roomId: "" };
  const text = locationText.toLowerCase();
  for (const deck of decks) {
    for (const room of deck.rooms || []) {
      const label = `${deck.name} · ${room.name}`.toLowerCase();
      if (text === label || text.includes(room.name.toLowerCase())) {
        return { deckId: deck.id, roomId: room.id };
      }
    }
    if (text.includes(deck.name.toLowerCase())) {
      const firstRoom = deck.rooms?.[0];
      return { deckId: deck.id, roomId: firstRoom?.id || "" };
    }
  }
  return { deckId: "", roomId: "" };
}

export function loadSiteLocationsLocal() {
  try {
    const raw = localStorage.getItem(SITE_LOCATIONS_SETTINGS_KEY);
    if (!raw) return null;
    return normalizeSiteLocations(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSiteLocationsLocal(data) {
  localStorage.setItem(SITE_LOCATIONS_SETTINGS_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(SITE_LOCATIONS_CHANGED_EVENT, { detail: data }));
}
