/**
 * Crestron lighting / shade adapter (CIP / REST).
 *
 * Mock engine simulates digital/analog joins in memory for offline UI.
 * Live client routes through the mock-server HTTP bridge.
 */
const ZONE_COUNT = 12;

export function buildMockCrestronEngine() {
  const zoneState = new Map();

  function ensureZone(href) {
    if (!zoneState.has(href)) {
      zoneState.set(href, { level: 0, on: false, updatedAt: null });
    }
    return zoneState.get(href);
  }

  function setZoneLevel(href, level, fadeSeconds = 0) {
    const clamped = Math.max(0, Math.min(100, Number(level) || 0));
    const zone = ensureZone(href);
    zone.level = clamped;
    zone.on = clamped > 0;
    zone.updatedAt = new Date().toISOString();
    zone.fade = fadeSeconds;
    return { href, ...zone };
  }

  function raiseLower(href, action) {
    const zone = ensureZone(href);
    if (action === "raise") zone.level = Math.min(100, zone.level + 10);
    else if (action === "lower") zone.level = Math.max(0, zone.level - 10);
    zone.on = zone.level > 0;
    zone.updatedAt = new Date().toISOString();
    return { href, ...zone };
  }

  function pollZones(hrefs) {
    return (hrefs || []).map((href) => ({ href, ...ensureZone(href) }));
  }

  function snapshot() {
    return {
      zones: [...zoneState.entries()].map(([href, z]) => ({ href, ...z })),
    };
  }

  return { setZoneLevel, raiseLower, pollZones, snapshot };
}

export function createCrestronClient(_conn) {
  return null;
}
