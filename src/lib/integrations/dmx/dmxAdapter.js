/**
 * DMX Adapter
 *
 * Connects to a DMX512 controller via Art-Net, sACN, or ENTTEC USB Pro.
 * Follows the LightingSystemTemplate interface.
 *
 * Mock engine:
 *   Simulates DMX channel writes in memory so the UI works offline.
 *
 * Live client:
 *   Sends Art-Net or sACN UDP packets, or writes to an ENTTEC USB device.
 *   (Uses the scanner/integrations/dmx module — not yet wired.)
 *
 * DMX channels use universe:channel format encoded in the href
 * as /fixture/<universe>/<channel> or /channel/<address>.
 *
 * Protocol options:
 *   - art-net (Art-Net III, UDP port 6454)
 *   - sacn (Streaming ACN / E1.31, UDP port 5568)
 *   - enttec-usb (ENTTEC USB Pro / Open DMX via serial)
 *
 * Default credentials: none
 */
const CHANNEL_COUNT = 24;

export function buildMockDmxEngine() {
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

buildMockDmxEngine.withDefaults = function () {
  const engine = buildMockDmxEngine();
  for (let i = 1; i <= CHANNEL_COUNT; i++) {
    engine.setZoneLevel(`/channel/${i}`, Math.floor(Math.random() * 255), 1);
  }
  return engine;
};

export function createDmxClient(_conn) {
  return null;
}

export const DMX_PORT_PROBES = [
  { port: 6454, label: "Art-Net", role: "art-net" },
  { port: 5568, label: "sACN", role: "sacn" },
];
