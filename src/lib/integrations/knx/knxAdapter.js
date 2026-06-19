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
const HVAC_ZONE_COUNT = 4;

const HVAC_DPT_MAP = {
  temperature: { main: 2, dpt: "9.001", label: "Temperature (°C)" },
  setpoint: { main: 3, dpt: "5.001", label: "Setpoint (°C)" },
  mode: { main: 4, dpt: "20.102", label: "HVAC Mode" },
  onOff: { main: 5, dpt: "1.001", label: "On/Off" },
  humidity: { main: 6, dpt: "9.007", label: "Humidity (%)" },
};

export function buildMockKnxEngine() {
  const zoneState = new Map();
  const hvacState = new Map();

  function ensureZone(href) {
    if (!zoneState.has(href)) {
      zoneState.set(href, { level: 0, on: false, updatedAt: null });
    }
    return zoneState.get(href);
  }

  function ensureHvacZone(href) {
    if (!hvacState.has(href)) {
      hvacState.set(href, {
        temperature: 22, setpoint: 22, mode: "auto", on: false,
        humidity: 50, updatedAt: null,
      });
    }
    return hvacState.get(href);
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

  function setHvacTemperature(href, tempC) {
    const z = ensureHvacZone(href);
    z.temperature = Math.round(tempC * 10) / 10;
    z.updatedAt = new Date().toISOString();
    return { href, temperature: z.temperature };
  }

  function setHvacSetpoint(href, tempC) {
    const z = ensureHvacZone(href);
    z.setpoint = Math.max(7, Math.min(40, Math.round(tempC * 10) / 10));
    z.on = true;
    z.updatedAt = new Date().toISOString();
    return { href, setpoint: z.setpoint };
  }

  function setHvacMode(href, mode) {
    const z = ensureHvacZone(href);
    z.mode = mode;
    z.updatedAt = new Date().toISOString();
    return { href, mode };
  }

  function setHvacOnOff(href, on) {
    const z = ensureHvacZone(href);
    z.on = !!on;
    z.updatedAt = new Date().toISOString();
    return { href, on: z.on };
  }

  function setHvacHumidity(href, rh) {
    const z = ensureHvacZone(href);
    z.humidity = Math.max(0, Math.min(100, Math.round(rh)));
    z.updatedAt = new Date().toISOString();
    return { href, humidity: z.humidity };
  }

  function setOutput(id, level, fadeSeconds = 0) {
    if (String(id).startsWith("temp:")) {
      const addr = id.replace("temp:", "");
      return setHvacTemperature(addr, level);
    }
    if (String(id).startsWith("setpoint:")) {
      const addr = id.replace("setpoint:", "");
      return setHvacSetpoint(addr, level);
    }
    if (String(id).startsWith("mode:")) {
      const addr = id.replace("mode:", "");
      const modes = ["auto", "comfort", "standby", "night", "frost"];
      const m = modes[Math.min(Math.floor(level / 25), 4)] || "auto";
      return setHvacMode(addr, m);
    }
    if (String(id).startsWith("onoff:")) {
      const addr = id.replace("onoff:", "");
      return setHvacOnOff(addr, level > 0);
    }
    const clamped = Math.max(0, Math.min(100, Number(level) || 0));
    const zone = ensureZone(id);
    zone.level = clamped;
    zone.on = clamped > 0;
    zone.updatedAt = new Date().toISOString();
    zone.fade = fadeSeconds;
    return { id, ...zone };
  }

  function activateScene(sceneHref, sceneZones = []) {
    const results = [];
    for (const z of sceneZones) {
      results.push(setOutput(z.href || z.id, z.level, z.fadeSeconds || 0));
    }
    return { sceneHref, zones: results };
  }

  function pressButton(_buttonHref) {
    return { buttonHref: _buttonHref, pressedAt: new Date().toISOString() };
  }

  function pollZones(hrefs) {
    const lightingZones = [...zoneState.entries()].map(([href, s]) => ({ href, ...s }));
    const hvacZones = [...hvacState.entries()].map(([href, s]) => ({ href, type: "hvac", ...s }));

    if (!Array.isArray(hrefs) || hrefs.length === 0) {
      return [...lightingZones, ...hvacZones];
    }

    return hrefs.map((href) => {
      if (zoneState.has(href)) return { href, ...zoneState.get(href) };
      if (hvacState.has(href)) return { href, type: "hvac", ...hvacState.get(href) };
      return { href, ...ensureZone(href) };
    });
  }

  function snapshot() {
    return {
      zones: Object.fromEntries(zoneState.entries()),
      hvac: Object.fromEntries(hvacState.entries()),
      activeScene: null,
    };
  }

  return {
    setZoneLevel, raiseLower, activateScene, pressButton, pollZones, snapshot,
    setOutput,
    setHvacTemperature, setHvacSetpoint, setHvacMode, setHvacOnOff, setHvacHumidity,
  };
}

buildMockKnxEngine.withDefaults = function () {
  const engine = buildMockKnxEngine();
  for (let i = 1; i <= ZONE_COUNT; i++) {
    const href = `/group/1/${i}`;
    engine.setZoneLevel(href, Math.floor(Math.random() * 80) + 10, 2);
  }
  for (let i = 0; i < HVAC_ZONE_COUNT; i++) {
    const baseAddr = `2/${i}`;
    engine.setHvacTemperature(`temp:${baseAddr}`, 21 + Math.random() * 3);
    engine.setHvacSetpoint(`setpoint:${baseAddr}`, 22 + Math.floor(Math.random() * 4));
    engine.setHvacMode(`mode:${baseAddr}`, ["auto", "comfort", "standby"][Math.floor(Math.random() * 3)]);
    engine.setHvacOnOff(`onoff:${baseAddr}`, true);
  }
  return engine;
};

export function createKnxClient(_conn) {
  return null;
}

export const KNX_PORT_PROBES = [
  { port: 3671, label: "KNX IP", role: "knx-ip" },
];

