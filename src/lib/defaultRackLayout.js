/** Built-in rack layout when API and local cache are unavailable (matches mock-server seed). */
export const DEFAULT_RACK_LAYOUT = {
  id: "rack-layout-default",
  name: "Default vessel layout",
  is_default: true,
  racks: [
    {
      id: "rack-bridge",
      name: "Bridge Rack",
      deckId: "deck-bridge",
      roomId: "room-bridge-rack",
      location: "Bridge · Bridge Rack",
      units: 12,
    },
    {
      id: "rack-saloon",
      name: "Saloon AV Rack",
      deckId: "deck-saloon",
      roomId: "room-saloon-av",
      location: "Saloon · Saloon AV Rack",
      units: 9,
    },
    {
      id: "rack-engine",
      name: "Engine Room Rack",
      deckId: "deck-engine",
      roomId: "room-engine-main",
      location: "Engine Room · Engine Room",
      units: 8,
    },
  ],
  placements: [
    { rackId: "rack-bridge", equipmentId: "dev-3", ruStart: 1, ruHeight: 1 },
    { rackId: "rack-bridge", equipmentId: "dev-1", ruStart: 2, ruHeight: 1 },
    { rackId: "rack-bridge", equipmentId: "dev-18", ruStart: 3, ruHeight: 1 },
    { rackId: "rack-bridge", equipmentId: "dev-11", ruStart: 4, ruHeight: 2 },
    { rackId: "rack-saloon", equipmentId: "dev-21", ruStart: 1, ruHeight: 1 },
    { rackId: "rack-saloon", equipmentId: "dev-19", ruStart: 2, ruHeight: 2 },
    { rackId: "rack-saloon", equipmentId: "dev-20", ruStart: 4, ruHeight: 2 },
    { rackId: "rack-saloon", equipmentId: "dev-22", ruStart: 7, ruHeight: 2 },
    { rackId: "rack-engine", equipmentId: "dev-10", ruStart: 1, ruHeight: 2 },
    { rackId: "rack-engine", equipmentId: "dev-4", ruStart: 5, ruHeight: 3 },
  ],
};
