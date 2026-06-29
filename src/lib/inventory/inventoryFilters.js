import { floorToDeckName } from "@/lib/spreadsheet/normalize";

export const EMPTY_INVENTORY_FILTERS = {
  category: "All",
  make: "All",
  model: "All",
  condition: "All",
  system: "All",
  area: "All",
  room: "All",
  status: "All",
  floor: "All",
};

function norm(value) {
  if (value == null) return "";
  return String(value).trim();
}

function eqNorm(a, b) {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

/** Deck / area — prefer floor code → deck name, then parse location. */
export function getEquipmentArea(eq) {
  if (norm(eq.floor)) {
    return floorToDeckName(eq.floor) || norm(eq.floor);
  }
  if (norm(eq.deck)) return norm(eq.deck);
  const loc = norm(eq.location);
  if (!loc) return "";
  const parts = loc.split(/\s*[·•]\s*/);
  if (parts[0]) return parts[0].trim();
  return loc;
}

/** Room from dedicated field or parsed from location. */
export function getEquipmentRoom(eq) {
  if (norm(eq.room)) return norm(eq.room);
  const loc = norm(eq.location);
  const roomMatch = loc.match(/[·•]\s*Room\s+(.+)$/i);
  if (roomMatch) return roomMatch[1].trim();
  return "";
}

/** System code (IT, ANT, AV, SEC, …). */
export function getEquipmentSystem(eq) {
  const raw = norm(eq.systemCategory || eq.system_category);
  return raw ? raw.toUpperCase() : "";
}

/** Make / manufacturer — dedicated field, or parsed from name (text before " - "). */
export function getEquipmentMake(eq) {
  if (norm(eq.make)) return norm(eq.make);
  const name = norm(eq.name);
  if (!name) return "";
  const dash = name.indexOf(" - ");
  if (dash > 0) return name.slice(0, dash).trim();
  return name;
}

/** Model / type from equipment record. */
export function getEquipmentModel(eq) {
  return norm(eq.model) || "";
}

function uniqueSorted(values) {
  return [...new Set(values.map(norm).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

/** Build dropdown options from the current inventory list. */
export function buildInventoryFilterOptions(equipment = []) {
  const categories = [];
  const makes = [];
  const models = [];
  const conditions = [];
  const systems = [];
  const areas = [];
  const rooms = [];
  const statuses = [];
  const floors = [];

  for (const e of equipment) {
    if (norm(e.category)) categories.push(e.category);
    const make = getEquipmentMake(e);
    if (make) makes.push(make);
    const model = getEquipmentModel(e);
    if (model) models.push(model);
    if (norm(e.condition)) conditions.push(e.condition);
    const sys = getEquipmentSystem(e);
    if (sys) systems.push(sys);
    const area = getEquipmentArea(e);
    if (area) areas.push(area);
    const room = getEquipmentRoom(e);
    if (room) rooms.push(room);
    if (norm(e.status)) statuses.push(e.status);
    if (norm(e.floor)) floors.push(e.floor);
  }

  return {
    categories: uniqueSorted(categories),
    makes: uniqueSorted(makes),
    models: uniqueSorted(models),
    conditions: uniqueSorted(conditions),
    systems: uniqueSorted(systems),
    areas: uniqueSorted(areas),
    rooms: uniqueSorted(rooms),
    statuses: uniqueSorted(statuses),
    floors: uniqueSorted(floors),
  };
}

export function countActiveInventoryFilters(filters) {
  const f = { ...EMPTY_INVENTORY_FILTERS, ...filters };
  return Object.entries(f).filter(([, v]) => v && v !== "All").length;
}

function matchesField(filterValue, actual) {
  if (!filterValue || filterValue === "All") return true;
  if (!actual) return false;
  return eqNorm(filterValue, actual);
}

export function applyInventoryFilters(equipment, filters, search = "") {
  const f = { ...EMPTY_INVENTORY_FILTERS, ...filters };
  const q = norm(search).toLowerCase();

  return equipment.filter((e) => {
    if (!matchesField(f.category, e.category)) return false;
    if (!matchesField(f.make, getEquipmentMake(e))) return false;
    if (!matchesField(f.model, getEquipmentModel(e))) return false;
    if (!matchesField(f.condition, e.condition)) return false;
    if (!matchesField(f.system, getEquipmentSystem(e))) return false;
    if (!matchesField(f.area, getEquipmentArea(e))) return false;
    if (!matchesField(f.room, getEquipmentRoom(e))) return false;
    if (!matchesField(f.status, e.status || "unknown")) return false;
    if (!matchesField(f.floor, e.floor)) return false;

    if (q) {
      const hay = [
        e.name,
        e.model,
        e.ip,
        e.mac,
        e.location,
        e.serial,
        e.notes,
        e.category,
        e.condition,
        getEquipmentSystem(e),
        getEquipmentArea(e),
        getEquipmentRoom(e),
        getEquipmentMake(e),
        e.floor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}
