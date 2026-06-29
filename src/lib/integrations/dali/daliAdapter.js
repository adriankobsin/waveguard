/**
 * DALI Adapter
 *
 * Connects to a DALI-2 USB gateway or IP bridge (IEC 62386).
 * Follows the LightingSystemTemplate interface.
 *
 * Mock engine:
 *   Simulates ballast level control in memory so the UI works offline.
 *
 * Live client:
 *   Opens a serial/USB or TCP connection to the DALI gateway.
 *   (Uses the scanner/integrations/dali module — not yet wired.)
 *
 * DALI addresses use short addresses (0-63) or group addresses (0-15)
 * encoded in the href as /ballast/<shortAddr> or /group/<groupAddr>.
 *
 * Protocol options:
 *   - dali-usb (USB/serial gateway, e.g. DALI-USB from https://dali-usb.com)
 *   - dali-ip (IP bridge, port 5582)
 *
 * Default credentials: none
 */
const BALLAST_COUNT = 16;

export function buildMockDaliEngine() {
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

buildMockDaliEngine.withDefaults = function () {
  const engine = buildMockDaliEngine();
  for (let i = 0; i < BALLAST_COUNT; i++) {
    engine.setZoneLevel(`/ballast/${i}`, Math.floor(Math.random() * 90) + 5, 1);
  }
  return engine;
};

export function createDaliClient(_conn) {
  return null;
}

export const DALI_PORT_PROBES = [
  { port: 5582, label: "DALI IP", role: "dali-ip" },
];
