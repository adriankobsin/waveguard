/**
 * Lutron adapter.
 *
 * The platform interacts with Lutron systems (HomeWorks QSX / Athena /
 * RadioRA 3) through the LEAP API which exposes JSON resources under
 * `https://<processor-ip>/<href>` (e.g. `/zone/5384`). The processor accepts
 * `CreateRequest` commands such as setting a `GoToLevel` for a zone or
 * pressing a button on a phantom keypad.
 *
 * In the platform we keep this adapter small and protocol-agnostic so we can
 * back it with either:
 *   - a real LEAP HTTP call (when wired against a live processor), or
 *   - a deterministic in-memory mock used by the mock-server and demo mode.
 *
 * `buildMockLutronEngine` returns an engine that simulates GoToLevel /
 * activateScene / pressButton in memory. The mock-server holds a single
 * shared engine instance keyed by processor ID.
 */

/**
 * @typedef {Object} LutronCommand
 * @property {"setZoneLevel"|"activateScene"|"pressButton"|"raiseLowerStop"|"poll"} op
 * @property {string} [zoneHref]
 * @property {string} [sceneHref]
 * @property {string} [buttonHref]
 * @property {number} [level]       0-100
 * @property {number} [fadeSeconds]
 * @property {"raise"|"lower"|"stop"} [action]
 */

export function buildMockLutronEngine() {
  const zoneState = new Map();       // href → { level, on, updatedAt }
  let activeScene = null;
  const buttonLog = [];

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
    activeScene = sceneHref;
    const results = [];
    for (const z of sceneZones) {
      results.push(setZoneLevel(z.href, z.level, z.fadeSeconds || 0));
    }
    return { sceneHref, zones: results };
  }

  function pressButton(buttonHref) {
    const entry = { buttonHref, pressedAt: new Date().toISOString() };
    buttonLog.push(entry);
    if (buttonLog.length > 200) buttonLog.shift();
    return entry;
  }

  function pollZones(hrefs) {
    if (!Array.isArray(hrefs) || hrefs.length === 0) {
      return [...zoneState.entries()].map(([href, s]) => ({ href, ...s }));
    }
    return hrefs.map((href) => ({ href, ...ensureZone(href) }));
  }

  function snapshot() {
    return {
      zones: Object.fromEntries(zoneState.entries()),
      activeScene,
      buttonLog: buttonLog.slice(-20),
    };
  }

  return {
    setZoneLevel,
    raiseLower,
    activateScene,
    pressButton,
    pollZones,
    snapshot,
  };
}

/**
 * Build a payload for the LEAP `CreateRequest` ZoneCommand `GoToLevel`.
 * Returned object can be sent as the body to `https://<processor>/zone/<id>/commandprocessor`.
 * Kept here for reference; real wiring goes through `scanner/integrations`.
 */
export function buildLeapGoToLevelBody(level, fadeSeconds = 0) {
  return {
    CommuniqueType: "CreateRequest",
    Header: { Url: "/commandprocessor" },
    Body: {
      Command: {
        CommandType: "GoToLevel",
        Parameter: [
          { Type: "Level", Value: Math.round(Math.max(0, Math.min(100, level))) },
          { Type: "Fade", Value: `00:00:${Math.max(0, Math.round(fadeSeconds))}` },
        ],
      },
    },
  };
}

export function buildLeapActivateSceneBody() {
  return {
    CommuniqueType: "CreateRequest",
    Body: { Command: { CommandType: "PressAndRelease" } },
  };
}

export function buildLeapPressButtonBody() {
  return {
    CommuniqueType: "CreateRequest",
    Body: { Command: { CommandType: "PressAndRelease" } },
  };
}

/**
 * Create a live Lutron Telnet client for the given connection config.
 * Server-side only (requires Node.js `net` module).
 * In the browser, returns null — commands go through the mock-server HTTP API.
 */
export function createLutronClient(_conn) {
  // Browser-side: live commands are sent to the mock-server via HTTP.
  return null;
}
