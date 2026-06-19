export function buildMockRs485Engine() {
  const state = new Map();

  function ensureDevice(addr) {
    if (!state.has(addr)) {
      state.set(addr, { value: 0, raw: "", on: false, updatedAt: null });
    }
    return state.get(addr);
  }

  function setOutput(id, level, fadeSeconds = 0) {
    const d = ensureDevice(id);
    d.value = Math.max(0, Math.min(100, Number(level) || 0));
    d.on = d.value > 0;
    d.raw = `${id}:${d.value}`;
    d.updatedAt = new Date().toISOString();
    return { id: String(id), level: d.value, on: d.on, updatedAt: d.updatedAt, fade: fadeSeconds };
  }

  function raiseLower(id, action) {
    const d = ensureDevice(id);
    if (action === "raise") d.value = Math.min(100, d.value + 10);
    else if (action === "lower") d.value = Math.max(0, d.value - 10);
    d.on = d.value > 0;
    d.raw = `${id}:${d.value}`;
    d.updatedAt = new Date().toISOString();
    return { id: String(id), level: d.value, on: d.on, updatedAt: d.updatedAt };
  }

  function sendRaw(data) {
    const addr = `raw_${Date.now()}`;
    const d = ensureDevice(addr);
    d.raw = String(data);
    d.updatedAt = new Date().toISOString();
    return { address: addr, sent: String(data), timestamp: d.updatedAt };
  }

  function activateScene(sceneHref, sceneDevices = []) {
    const results = [];
    for (const sd of sceneDevices) {
      results.push(setOutput(sd.id, sd.level, sd.fadeSeconds || 0));
    }
    return { sceneHref, zones: results };
  }

  function pressButton(_buttonHref) {
    return { buttonHref: _buttonHref, pressedAt: new Date().toISOString() };
  }

  function pollZones(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [...state.entries()].map(([id, s]) => ({ id, ...s }));
    }
    return ids.map((id) => ({ id, ...ensureDevice(id) }));
  }

  function snapshot() {
    return { devices: Object.fromEntries(state.entries()) };
  }

  return { setOutput, raiseLower, activateScene, pressButton, pollZones, snapshot, sendRaw };
}

buildMockRs485Engine.withDefaults = function () {
  const engine = buildMockRs485Engine();
  for (let i = 0; i < 4; i++) {
    engine.setOutput(`hvac_${i}`, Math.floor(Math.random() * 80) + 10);
  }
  engine.setOutput("temperature_1", 22);
  engine.setOutput("temperature_2", 19);
  return engine;
};

export function createRs485Client(_conn) {
  return null;
}

export const RS485_PORT_PROBES = [
  { port: 4001, label: "RS485 Bridge (TCP 4001)", role: "rs485" },
  { port: 4002, label: "RS485 Bridge (TCP 4002)", role: "rs485" },
  { port: 4003, label: "RS485 Bridge (TCP 4003)", role: "rs485" },
  { port: 4004, label: "RS485 Bridge (TCP 4004)", role: "rs485" },
  { port: 4005, label: "RS485 Bridge (TCP 4005)", role: "rs485" },
];
