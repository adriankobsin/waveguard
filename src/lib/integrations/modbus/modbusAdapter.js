const HVAC_ZONE_COUNT = 8;
const REGISTER_COUNT = 16;

export function buildMockModbusEngine() {
  const registers = new Map();
  const coils = new Map();

  function ensureRegister(addr) {
    if (!registers.has(addr)) {
      registers.set(addr, { value: 0, updatedAt: null });
    }
    return registers.get(addr);
  }

  function ensureCoil(addr) {
    if (!coils.has(addr)) {
      coils.set(addr, { on: false, updatedAt: null });
    }
    return coils.get(addr);
  }

  function readHoldingRegisters(address, count = 1) {
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(ensureRegister(address + i).value);
    }
    return values;
  }

  function writeSingleRegister(address, value) {
    const r = ensureRegister(address);
    r.value = value;
    r.updatedAt = new Date().toISOString();
    return { address, value };
  }

  function readCoils(address, count = 1) {
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(ensureCoil(address + i).on);
    }
    return values;
  }

  function writeSingleCoil(address, on) {
    const c = ensureCoil(address);
    c.on = !!on;
    c.updatedAt = new Date().toISOString();
    return { address, on: c.on };
  }

  function setHvacSetpoint(zoneIndex, temperatureC) {
    const reg = zoneIndex * 2;
    const scaled = Math.round(temperatureC * 10);
    return writeSingleRegister(reg, scaled);
  }

  function getHvacSetpoint(zoneIndex) {
    const reg = zoneIndex * 2;
    const val = ensureRegister(reg).value;
    return val / 10;
  }

  function setHvacMode(zoneIndex, mode) {
    const reg = zoneIndex * 2 + 1;
    const modeMap = { off: 0, heat: 1, cool: 2, auto: 3, fanOnly: 4, emergency: 5 };
    return writeSingleRegister(reg, modeMap[mode] || 0);
  }

  function getHvacMode(zoneIndex) {
    const modeMap = ["off", "heat", "cool", "auto", "fanOnly", "emergency"];
    const reg = zoneIndex * 2 + 1;
    return modeMap[ensureRegister(reg).value] || "off";
  }

  function setOutput(id, level, fadeSeconds = 0) {
    if (String(id).startsWith("coil:")) {
      const coilAddr = parseInt(id.replace("coil:", ""), 10);
      return { ...writeSingleCoil(coilAddr, level > 0), level, fade: fadeSeconds };
    }
    if (String(id).startsWith("hvac_temp:")) {
      const zoneIdx = parseInt(id.replace("hvac_temp:", ""), 10);
      setHvacSetpoint(zoneIdx, level);
      return { id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(), fade: fadeSeconds };
    }
    if (String(id).startsWith("hvac_mode:")) {
      const zoneIdx = parseInt(id.replace("hvac_mode:", ""), 10);
      const mode = ["off", "heat", "cool", "auto", "fanOnly", "emergency"][Math.round(level / 20)] || "off";
      setHvacMode(zoneIdx, mode);
      return { id: String(id), level, on: mode !== "off", updatedAt: new Date().toISOString() };
    }
    const regAddr = parseInt(String(id).replace(/\D/g, "") || "0", 10);
    const scaled = Math.round((Math.max(0, Math.min(100, Number(level) || 0)) / 100) * 65535);
    writeSingleRegister(regAddr, scaled);
    return { id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(), fade: fadeSeconds };
  }

  function raiseLower(id, action) {
    const regAddr = parseInt(String(id).replace(/\D/g, "") || "0", 10);
    const r = ensureRegister(regAddr);
    const current = r.value;
    const step = Math.round(65535 / 20);
    if (action === "raise") r.value = Math.min(65535, current + step);
    else if (action === "lower") r.value = Math.max(0, current - step);
    r.updatedAt = new Date().toISOString();
    const level = Math.round((r.value / 65535) * 100);
    return { id: String(id), level, on: level > 0, updatedAt: r.updatedAt };
  }

  function activateScene(sceneHref, sceneRegisters = []) {
    const results = [];
    for (const sr of sceneRegisters) {
      results.push(setOutput(sr.id, sr.level, sr.fadeSeconds || 0));
    }
    return { sceneHref, zones: results };
  }

  function pressButton(_buttonHref) {
    return { buttonHref: _buttonHref, pressedAt: new Date().toISOString() };
  }

  function pollZones(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      const all = [];
      for (let i = 0; i < HVAC_ZONE_COUNT; i++) {
        const temp = getHvacSetpoint(i);
        const mode = getHvacMode(i);
        all.push({
          id: `hvac_zone_${i}`,
          temp,
          mode,
          on: mode !== "off",
          updatedAt: registers.get(i * 2)?.updatedAt || null,
        });
      }
      for (let i = 0; i < REGISTER_COUNT; i++) {
        const r = registers.get(i);
        if (r) all.push({ id: `reg_${i}`, value: r.value, updatedAt: r.updatedAt });
      }
      return all;
    }
    return ids.map((id) => {
      if (String(id).startsWith("hvac_zone_")) {
        const idx = parseInt(id.replace("hvac_zone_", ""), 10);
        return { id, temp: getHvacSetpoint(idx), mode: getHvacMode(idx), updatedAt: registers.get(idx * 2)?.updatedAt || null };
      }
      return { id };
    });
  }

  function snapshot() {
    const regs = {};
    const col = {};
    for (const [k, v] of registers) regs[k] = v;
    for (const [k, v] of coils) col[k] = v;
    return { registers: regs, coils: col, hvacZones: HVAC_ZONE_COUNT };
  }

  return { setOutput, raiseLower, activateScene, pressButton, pollZones, snapshot, readHoldingRegisters, writeSingleRegister, readCoils, writeSingleCoil, setHvacSetpoint, getHvacSetpoint, setHvacMode, getHvacMode };
}

buildMockModbusEngine.withDefaults = function () {
  const engine = buildMockModbusEngine();
  for (let i = 0; i < HVAC_ZONE_COUNT; i++) {
    engine.setHvacSetpoint(i, 20 + Math.floor(Math.random() * 6));
    engine.setHvacMode(i, ["off", "heat", "cool", "auto"][Math.floor(Math.random() * 4)]);
  }
  for (let i = HVAC_ZONE_COUNT * 2; i < HVAC_ZONE_COUNT * 2 + 8; i++) {
    engine.writeSingleRegister(i, Math.floor(Math.random() * 65535));
  }
  return engine;
};

export function createModbusClient(_conn) {
  return null;
}

export const MODBUS_PORT_PROBES = [
  { port: 502, label: "Modbus TCP", role: "modbus-tcp" },
];
