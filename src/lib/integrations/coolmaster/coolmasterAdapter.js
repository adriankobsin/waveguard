const UNIT_COUNT = 4;

export function buildMockCoolmasterEngine() {
  const units = new Map();

  function ensureUnit(id) {
    if (!units.has(id)) {
      units.set(id, {
        temperature: 22,
        setpoint: 22,
        mode: "cool",
        fanSpeed: "auto",
        power: false,
        updatedAt: null,
      });
    }
    return units.get(id);
  }

  function setTemperature(unitId, tempC) {
    const u = ensureUnit(unitId);
    u.setpoint = Math.max(16, Math.min(30, Math.round(tempC)));
    u.updatedAt = new Date().toISOString();
    return { unitId, temperature: u.setpoint };
  }

  function setMode(unitId, mode) {
    const u = ensureUnit(unitId);
    u.mode = mode;
    u.updatedAt = new Date().toISOString();
    return { unitId, mode };
  }

  function setFanSpeed(unitId, speed) {
    const u = ensureUnit(unitId);
    u.fanSpeed = speed;
    u.updatedAt = new Date().toISOString();
    return { unitId, speed };
  }

  function setPower(unitId, on) {
    const u = ensureUnit(unitId);
    u.power = !!on;
    u.updatedAt = new Date().toISOString();
    return { unitId, on: u.power };
  }

  function queryUnit(unitId) {
    const u = ensureUnit(unitId);
    return {
      id: unitId,
      temperature: u.temperature,
      setpoint: u.setpoint,
      mode: u.mode,
      fanSpeed: u.fanSpeed,
      power: u.power,
    };
  }

  function setOutput(id, level, fadeSeconds = 0) {
    if (String(id).startsWith("temp:")) {
      const uid = parseInt(id.replace("temp:", ""), 10);
      setTemperature(uid, level);
      return { id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(), fade: fadeSeconds };
    }
    if (String(id).startsWith("power:")) {
      const uid = parseInt(id.replace("power:", ""), 10);
      setPower(uid, level > 0);
      return { id: String(id), level, on: level > 0, updatedAt: new Date().toISOString() };
    }
    if (String(id).startsWith("mode:")) {
      const uid = parseInt(id.replace("mode:", ""), 10);
      const modes = ["cool", "heat", "fan", "dry", "auto"];
      setMode(uid, modes[Math.min(Math.floor(level / 25), 4)]);
      return { id: String(id), level, on: true, updatedAt: new Date().toISOString() };
    }
    if (String(id).startsWith("fan:")) {
      const uid = parseInt(id.replace("fan:", ""), 10);
      const speeds = ["low", "medium", "high", "auto"];
      setFanSpeed(uid, speeds[Math.min(Math.floor(level / 33), 3)]);
      return { id: String(id), level, on: true, updatedAt: new Date().toISOString() };
    }
    const uid = parseInt(String(id).replace(/\D/g, "") || "0", 10);
    setTemperature(uid, level);
    return { id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(), fade: fadeSeconds };
  }

  function raiseLower(id, action) {
    const uid = parseInt(String(id).replace(/\D/g, "") || "0", 10);
    const u = ensureUnit(uid);
    if (action === "raise") u.setpoint = Math.min(30, u.setpoint + 1);
    else if (action === "lower") u.setpoint = Math.max(16, u.setpoint - 1);
    u.updatedAt = new Date().toISOString();
    return { id: String(id), level: u.setpoint, on: u.power, updatedAt: u.updatedAt };
  }

  function activateScene(sceneHref, sceneUnits = []) {
    const results = [];
    for (const su of sceneUnits) {
      results.push(setOutput(su.id, su.level, su.fadeSeconds || 0));
    }
    return { sceneHref, zones: results };
  }

  function pressButton(_buttonHref) {
    return { buttonHref: _buttonHref, pressedAt: new Date().toISOString() };
  }

  function pollZones(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return Array.from({ length: UNIT_COUNT }, (_, i) => {
        const u = queryUnit(i);
        return {
          id: `hvac_${i}`,
          href: `/hvac/unit/${i}`,
          temp: u.temperature,
          setpoint: u.setpoint,
          mode: u.mode,
          fanSpeed: u.fanSpeed,
          on: u.power,
          updatedAt: u.updatedAt,
        };
      });
    }
    return ids.map((id) => {
      const m = String(id).match(/hvac_(\d+)/);
      if (m) {
        const u = queryUnit(parseInt(m[1], 10));
        return { id, ...u, updatedAt: u.updatedAt };
      }
      return { id };
    });
  }

  function snapshot() {
    const allUnits = {};
    for (const [k, v] of units) allUnits[k] = v;
    return { units: allUnits };
  }

  return { setOutput, raiseLower, activateScene, pressButton, pollZones, snapshot, setTemperature, setMode, setFanSpeed, setPower, queryUnit };
}

buildMockCoolmasterEngine.withDefaults = function () {
  const engine = buildMockCoolmasterEngine();
  for (let i = 0; i < UNIT_COUNT; i++) {
    engine.setTemperature(i, 22 + Math.floor(Math.random() * 6));
    engine.setMode(i, ["cool", "heat", "auto"][Math.floor(Math.random() * 3)]);
    engine.setFanSpeed(i, ["low", "medium", "high", "auto"][Math.floor(Math.random() * 4)]);
    engine.setPower(i, true);
  }
  return engine;
};

export function createCoolmasterClient(_conn) {
  return null;
}

export const COOLMASTER_PORT_PROBES = [
  { port: 10102, label: "Coolmaster Net", role: "coolmaster" },
];
