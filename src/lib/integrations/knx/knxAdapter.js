/**
 * KNX Adapter
 *
 * Connects to a KNX IP gateway/router via tunnelling or routing (port 3671).
 * Follows the LightingSystemTemplate interface so it can be swapped in
 * via lightingRegistry.js.
 *
 * Mock engine:
 *   Simulates group address writes in memory so the UI works offline.
 *
 * Live client:
 *   Opens a KNXnet/IP tunnel to the gateway and writes group values.
 *   (Uses the scanner/integrations/knx module — not yet wired.)
 *
 * KNX group addresses use the standard three-level format: main/middle/sub
 * (e.g. "1/2/3") encoded in the href as /group/1_2_3 or /group/1/2/3.
 *
 * Protocol options:
 *   - knx-ip (KNXnet/IP tunnelling, port 3671)
 *   - knx-tunnelling (legacy tunnelling, port 3671)
 *
 * Default credentials: none (KNX typically uses no auth over IP).
 */
const ZONE_COUNT = 12;

export function buildMockKnxEngine() {
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

  function activateScene(sceneHref, sceneZones = []) {
    const results = [];
    for (const z of sceneZones) {
      results.push(setZoneLevel(z.href, z.level, z.fadeSeconds || 0));
    }
    return { sceneHref, zones: results };
  }

  function pressButton(_buttonHref) {
    return { buttonHref: _buttonHref, pressedAt: new Date().toISOString() };
  }

  function pollZones(hrefs) {
    if (!Array.isArray(hrefs) || hrefs.length === 0) {
      return [...zoneState.entries()].map(([href, s]) => ({ href, ...s }));
    }
    return hrefs.map((href) => ({ href, ...ensureZone(href) }));
  }

  function snapshot() {
    return { zones: Object.fromEntries(zoneState.entries()), activeScene: null };
  }

  return { setZoneLevel, raiseLower, activateScene, pressButton, pollZones, snapshot };
}

/** Create a pre-populated mock engine with realistic KNX zones. */
buildMockKnxEngine.withDefaults = function () {
  const engine = buildMockKnxEngine();
  for (let i = 1; i <= ZONE_COUNT; i++) {
    const href = `/group/1/${i}`;
    engine.setZoneLevel(href, Math.floor(Math.random() * 80) + 10, 2);
  }
  return engine;
};

export function createKnxClient(_conn) {
  // Browser-side: commands go through the mock-server HTTP API.
  return null;
}

export const KNX_PORT_PROBES = [
  { port: 3671, label: "KNX IP", role: "knx-ip" },
];
