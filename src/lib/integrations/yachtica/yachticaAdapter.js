const CHANNEL_COUNT = 8;
const ADDRESS_COUNT = 64;
const MAX_SCENES = 56;

const CHANNEL_MASKS = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function getMemoryForScene(sceneIndex) {
  const bankIndex = Math.floor(sceneIndex / 8);
  const bitIndex = sceneIndex % 8;
  return { base: 0x58 + bankIndex, mask: CHANNEL_MASKS[bitIndex] };
}

export function buildMockYachticaEngine() {
  const channels = new Map();
  const sceneMemory = new Map();

  function ensureChannel(addr, ch) {
    const key = `${addr}:${ch}`;
    if (!channels.has(key)) {
      channels.set(key, { level: 0, on: false, updatedAt: new Date().toISOString() });
    }
    return channels.get(key);
  }

  function setOutput({ address, channelIndex, level }) {
    const c = ensureChannel(address, channelIndex);
    c.level = clamp(level);
    c.on = c.level > 0;
    c.updatedAt = new Date().toISOString();
    return {
      address, channelIndex, level: c.level, on: c.on, updatedAt: c.updatedAt,
      channels: readAllChannels(address),
    };
  }

  function pressInput({ address, channelIndex }) {
    const c = ensureChannel(address, channelIndex);
    c.on = true;
    c.level = 100;
    c.updatedAt = new Date().toISOString();
    return { address, channelIndex, action: "press", updatedAt: c.updatedAt };
  }

  function releaseInput({ address, channelIndex }) {
    const c = ensureChannel(address, channelIndex);
    c.on = false;
    c.level = 0;
    c.updatedAt = new Date().toISOString();
    return { address, channelIndex, action: "release", updatedAt: c.updatedAt };
  }

  function tapInput({ address, channelIndex }) {
    pressInput({ address, channelIndex });
    return releaseInput({ address, channelIndex });
  }

  function recallScene({ address, sceneIndex }) {
    const key = `${address}:${sceneIndex}`;
    const saved = sceneMemory.get(key);
    if (saved) {
      for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
        if (saved[ch] != null) {
          const c = ensureChannel(address, ch);
          c.level = saved[ch];
          c.on = saved[ch] > 0;
          c.updatedAt = new Date().toISOString();
        }
      }
    }
    return { address, sceneIndex, recalled: !!saved, channels: readAllChannels(address) };
  }

  function saveScene({ address, sceneIndex }) {
    const key = `${address}:${sceneIndex}`;
    const snapshot = {};
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      snapshot[ch] = ensureChannel(address, ch).level;
    }
    sceneMemory.set(key, snapshot);
    return { address, sceneIndex, saved: true };
  }

  function readAllChannels(address) {
    const result = [];
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      const c = ensureChannel(address, ch);
      result.push({ channelIndex: ch, level: c.level, on: c.on, updatedAt: c.updatedAt });
    }
    return result;
  }

  function pollStatus(address) {
    return readAllChannels(address);
  }

  function setZoneLevel(href, level, fadeSeconds = 0) {
    const parts = String(href).split("/");
    const addr = parseInt(parts[0], 10);
    const ch = parseInt(parts[1], 10);
    if (isNaN(addr) || isNaN(ch)) return { href, level, on: false, updatedAt: new Date().toISOString(), fade: fadeSeconds };
    const result = setOutput({ address: addr, channelIndex: ch, level });
    return { href, level: result.level, on: result.on, updatedAt: result.updatedAt, fade: fadeSeconds };
  }

  function raiseLower(href, action) {
    const parts = String(href).split("/");
    const addr = parseInt(parts[0], 10);
    const ch = parseInt(parts[1], 10);
    if (isNaN(addr) || isNaN(ch)) return { href, level: 0, on: false, updatedAt: new Date().toISOString() };
    const c = ensureChannel(addr, ch);
    const step = 5;
    if (action === "raise") c.level = clamp(c.level + step);
    else if (action === "lower") c.level = clamp(c.level - step);
    c.on = c.level > 0;
    c.updatedAt = new Date().toISOString();
    return { href, level: c.level, on: c.on, updatedAt: c.updatedAt };
  }

  function activateScene(href, sceneZones) {
    const parts = String(href).split("/");
    const addr = parseInt(parts[0], 10);
    const sceneIdx = parseInt(parts[1], 10);
    if (!isNaN(addr) && !isNaN(sceneIdx)) {
      return recallScene({ address: addr, sceneIndex: sceneIdx });
    }
    const results = [];
    for (const sz of sceneZones || []) {
      results.push(setZoneLevel(sz.id, sz.level, sz.fadeSeconds || 0));
    }
    return { sceneHref: href, zones: results };
  }

  function pressButton(href) {
    const parts = String(href).split("/");
    const addr = parseInt(parts[0], 10);
    const ch = parseInt(parts[1], 10);
    if (!isNaN(addr) && !isNaN(ch)) {
      tapInput({ address: addr, channelIndex: ch });
      return { buttonHref: href, pressedAt: new Date().toISOString() };
    }
    return { buttonHref: href, pressedAt: new Date().toISOString() };
  }

  function pollZones(hrefs) {
    if (!Array.isArray(hrefs) || hrefs.length === 0) {
      const all = [];
      for (let addr = 0; addr < ADDRESS_COUNT; addr++) {
        for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
          const c = ensureChannel(addr, ch);
          all.push({ href: `${addr}/${ch}`, level: c.level, on: c.on, updatedAt: c.updatedAt });
        }
      }
      return all;
    }
    return hrefs.map((href) => {
      const parts = String(href).split("/");
      const addr = parseInt(parts[0], 10);
      const ch = parseInt(parts[1], 10);
      if (!isNaN(addr) && !isNaN(ch)) {
        const c = ensureChannel(addr, ch);
        return { href, level: c.level, on: c.on, updatedAt: c.updatedAt };
      }
      return { href };
    });
  }

  function snapshot() {
    const chs = {};
    const scenes = {};
    for (const [k, v] of channels) chs[k] = v;
    for (const [k, v] of sceneMemory) scenes[k] = v;
    return { channels: chs, scenes, addressCount: ADDRESS_COUNT, channelCount: CHANNEL_COUNT };
  }

  return {
    setOutput, pressInput, releaseInput, tapInput,
    recallScene, saveScene, pollStatus, readAllChannels,
    setZoneLevel, raiseLower, activateScene, pressButton, pollZones, snapshot,
  };
}

buildMockYachticaEngine.withDefaults = function () {
  const engine = buildMockYachticaEngine();
  for (let addr = 0; addr < 4; addr++) {
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      const level = Math.floor(Math.random() * 101);
      engine.setOutput({ address: addr, channelIndex: ch, level });
    }
  }
  return engine;
};

export function createYachticaClient(_conn) {
  return null;
}
