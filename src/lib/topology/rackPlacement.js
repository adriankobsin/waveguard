export const RU_PX = 32;

/** Occupied RU index → equipment id (optionally exclude one placement while dragging). */
export function buildOccupiedMap(items, excludeEquipmentId = null) {
  const occupied = {};
  for (const item of items || []) {
    if (excludeEquipmentId && item.id === excludeEquipmentId) continue;
    const start = item.ruStart ?? 1;
    const height = item.ruHeight ?? 1;
    for (let u = start; u < start + height; u++) {
      occupied[u] = item.id;
    }
  }
  return occupied;
}

export function canPlaceAt(occupied, ruStart, ruHeight, totalUnits) {
  if (ruStart < 1 || ruStart + ruHeight - 1 > totalUnits) return false;
  for (let u = ruStart; u < ruStart + ruHeight; u++) {
    if (occupied[u]) return false;
  }
  return true;
}

/** Map pointer Y within rack body to a 1-based RU (top of rack = 1U). */
export function ruFromClientY(clientY, rackTop, totalUnits) {
  const y = clientY - rackTop;
  const ru = Math.floor(y / RU_PX) + 1;
  return Math.min(totalUnits, Math.max(1, ru));
}

/**
 * Find a valid ruStart near targetRu (prefer aligning top of device to hovered RU).
 * Searches outward so drops on busy areas snap to the nearest free slot.
 */
export function findPlacementRu(targetRu, ruHeight, occupied, totalUnits) {
  const tryStart = (start) => canPlaceAt(occupied, start, ruHeight, totalUnits);

  if (tryStart(targetRu)) return targetRu;

  for (let offset = 1; offset < totalUnits; offset++) {
    const below = targetRu + offset;
    if (below <= totalUnits - ruHeight + 1 && tryStart(below)) return below;
    const above = targetRu - offset;
    if (above >= 1 && tryStart(above)) return above;
  }
  return null;
}
