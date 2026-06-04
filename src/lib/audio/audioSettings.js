export const AUDIO_SYSTEMS_KEY = "audio-systems";
export const AUDIO_ZONE_STATE_KEY = "audio-zone-state";
export const AUDIO_CONNECTION_KEY = "audio-connection";
export const AUDIO_DANTE_ROUTING_KEY = "audio-dante-routing";
export const AUDIO_EVENT_LOG_KEY = "audio-event-log";
export const AUDIO_SNAPSHOTS_KEY = "audio-snapshots";
export const AUDIO_PROJECTS_KEY = "audio-projects";

export const AUDIO_SYSTEMS_CHANGED_EVENT = "waveguard-audio-systems-changed";
export const AUDIO_ZONE_STATE_CHANGED_EVENT = "waveguard-audio-zone-state-changed";
export const AUDIO_CONNECTION_CHANGED_EVENT = "waveguard-audio-connection-changed";
export const AUDIO_DANTE_ROUTING_CHANGED_EVENT = "waveguard-audio-dante-routing-changed";
export const AUDIO_EVENT_LOG_CHANGED_EVENT = "waveguard-audio-event-log-changed";
export const AUDIO_SNAPSHOTS_CHANGED_EVENT = "waveguard-audio-snapshots-changed";
export const AUDIO_PROJECTS_CHANGED_EVENT = "waveguard-audio-projects-changed";

const SYSTEMS_LOCAL_KEY = "waveguard:audio:systems";
const ZONE_STATE_LOCAL_KEY = "waveguard:audio:zone-state";
const CONNECTION_LOCAL_KEY = "waveguard:audio:connection";
const DANTE_ROUTING_LOCAL_KEY = "waveguard:audio:dante-routing";
const EVENT_LOG_LOCAL_KEY = "waveguard:audio:event-log";
const SNAPSHOTS_LOCAL_KEY = "waveguard:audio:snapshots";
const PROJECTS_LOCAL_KEY = "waveguard:audio:projects";

export const AUDIO_EVENT_LOG_MAX = 200;

export const DEFAULT_AUDIO_SYSTEMS = { systems: [] };

export const DEFAULT_AUDIO_ZONE_STATE = {};

export const DEFAULT_AUDIO_CONNECTION = {
  enabled: false,
  host: "",
  port: 1710,
  protocol: "qrc",
  systemType: "qsys",
  username: "",
  password: "",
  updatedAt: null,
};

export const DEFAULT_AUDIO_DANTE_ROUTING = {
  flows: [],
  subscriptions: [],
};

export const DEFAULT_AUDIO_EVENT_LOG = { events: [] };

export const DEFAULT_AUDIO_SNAPSHOTS = { snapshots: [] };

export const DEFAULT_AUDIO_PROJECTS = { projects: [] };

export function normalizeAudioSystems(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_AUDIO_SYSTEMS;
  return {
    systems: Array.isArray(raw.systems) ? raw.systems.map(normalizeAudioSystem) : [],
  };
}

export function normalizeAudioSystem(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `audio-${Date.now()}`,
    name: raw.name || "Unnamed DSP",
    type: raw.type || "qsys",
    host: raw.host || "",
    port: raw.port || 1710,
    protocol: raw.protocol || "qrc",
    status: raw.status || "offline",
    designName: raw.designName || "",
    lastPolled: raw.lastPolled || null,
    enabled: raw.enabled || false,
    credentials: raw.credentials || { username: "", password: "" },
    inputs: Array.isArray(raw.inputs) ? raw.inputs.map(normalizeAudioIO) : [],
    outputs: Array.isArray(raw.outputs) ? raw.outputs.map(normalizeAudioIO) : [],
    zones: Array.isArray(raw.zones) ? raw.zones.map(normalizeDspZone) : [],
    amplifiers: Array.isArray(raw.amplifiers) ? raw.amplifiers.map(normalizeAmplifier) : [],
    snapshots: Array.isArray(raw.snapshots) ? raw.snapshots.map(normalizeAudioSnapshot) : [],
    danteFlows: Array.isArray(raw.danteFlows) ? raw.danteFlows.map(normalizeDanteFlow) : [],
    metadata: raw.metadata || {},
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeAudioIO(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `io-${Date.now()}`,
    name: raw.name || "Unnamed",
    channelNumber: raw.channelNumber ?? 0,
    type: raw.type || "analog",
    ioType: raw.ioType || "input",
    format: raw.format || "line",
    gain: raw.gain ?? 0,
    mute: raw.mute ?? false,
    delay: raw.delay ?? 0,
    phantomPower: raw.phantomPower ?? false,
    danteFlowId: raw.danteFlowId || null,
    levelMeter: raw.levelMeter ?? -Infinity,
    peakMeter: raw.peakMeter ?? -Infinity,
  };
}

export function normalizeDspZone(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `zone-${Date.now()}`,
    name: raw.name || "Unnamed Zone",
    volume: raw.volume ?? 0,
    mute: raw.mute ?? false,
    sourceId: raw.sourceId || null,
    sourceSelected: raw.sourceSelected || null,
    bass: raw.bass ?? 0,
    treble: raw.treble ?? 0,
    balance: raw.balance ?? 0,
    priority: raw.priority ?? 0,
    speakerProfile: raw.speakerProfile || "",
  };
}

export function normalizeAmplifier(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `amp-${Date.now()}`,
    name: raw.name || "Unnamed Amplifier",
    model: raw.model || "",
    status: raw.status || "offline",
    powerWatts: raw.powerWatts ?? 0,
    temperature: raw.temperature ?? 0,
    impedance: raw.impedance ?? 0,
    loadStatus: raw.loadStatus || "unknown",
    channels: Array.isArray(raw.channels)
      ? raw.channels.map((c) => ({
          id: c.id || `ch-${Date.now()}`,
          name: c.name || `Channel ${(c.id || 1)}`,
          power: c.power ?? 0,
          clip: c.clip ?? false,
          protect: c.protect ?? false,
          load: c.load ?? "unknown",
        }))
      : [],
    firmware: raw.firmware || "",
  };
}

export function normalizeAudioSnapshot(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `snap-${Date.now()}`,
    bankName: raw.bankName || "Default",
    bankNumber: raw.bankNumber ?? 1,
    name: raw.name || `Snapshot ${raw.bankNumber ?? 1}`,
    active: raw.active ?? false,
    updatedAt: raw.updatedAt || null,
  };
}

export function normalizeDanteFlow(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `flow-${Date.now()}`,
    name: raw.name || "Unnamed Flow",
    sourceDevice: raw.sourceDevice || "",
    sourceChannel: raw.sourceChannel ?? 0,
    multicastAddress: raw.multicastAddress || "",
    format: raw.format || "L16",
    sampleRate: raw.sampleRate || 48000,
    bitDepth: raw.bitDepth || 16,
    active: raw.active ?? false,
    aes67Mode: raw.aes67Mode ?? false,
    subscriptions: Array.isArray(raw.subscriptions)
      ? raw.subscriptions.map((s) => ({
          device: s.device || "",
          channel: s.channel ?? 0,
          status: s.status || "inactive",
        }))
      : [],
  };
}

export function normalizeAudioEvent(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `evt-${Date.now()}`,
    kind: raw.kind || "system",
    severity: raw.severity || "info",
    systemId: raw.systemId || "",
    systemName: raw.systemName || "",
    zoneHref: raw.zoneHref || "",
    action: raw.action || "",
    result: raw.result || "",
    level: raw.level ?? null,
    message: raw.message || "",
    timestamp: raw.timestamp || new Date().toISOString(),
  };
}

export function normalizeAudioEventLog(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_AUDIO_EVENT_LOG;
  return {
    events: Array.isArray(raw.events) ? raw.events.map(normalizeAudioEvent).filter(Boolean) : [],
  };
}

function loadLocal(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[audioSettings] localStorage save ${key} failed:`, err);
  }
}

export function loadAudioSystemsLocal() {
  return loadLocal(SYSTEMS_LOCAL_KEY, DEFAULT_AUDIO_SYSTEMS);
}

export function saveAudioSystemsLocal(data) {
  saveLocal(SYSTEMS_LOCAL_KEY, data);
}

export function loadZoneStateLocal() {
  return loadLocal(ZONE_STATE_LOCAL_KEY, DEFAULT_AUDIO_ZONE_STATE);
}

export function saveZoneStateLocal(data) {
  saveLocal(ZONE_STATE_LOCAL_KEY, data);
}

export function loadAudioConnectionLocal() {
  return loadLocal(CONNECTION_LOCAL_KEY, DEFAULT_AUDIO_CONNECTION);
}

export function saveAudioConnectionLocal(data) {
  saveLocal(CONNECTION_LOCAL_KEY, data);
}

export function loadDanteRoutingLocal() {
  return loadLocal(DANTE_ROUTING_LOCAL_KEY, DEFAULT_AUDIO_DANTE_ROUTING);
}

export function saveDanteRoutingLocal(data) {
  saveLocal(DANTE_ROUTING_LOCAL_KEY, data);
}

export function loadAudioEventLogLocal() {
  return loadLocal(EVENT_LOG_LOCAL_KEY, DEFAULT_AUDIO_EVENT_LOG);
}

export function saveAudioEventLogLocal(data) {
  saveLocal(EVENT_LOG_LOCAL_KEY, data);
}

export function loadSnapshotsLocal() {
  return loadLocal(SNAPSHOTS_LOCAL_KEY, DEFAULT_AUDIO_SNAPSHOTS);
}

export function saveSnapshotsLocal(data) {
  saveLocal(SNAPSHOTS_LOCAL_KEY, data);
}

export function loadAudioProjectsLocal() {
  return loadLocal(PROJECTS_LOCAL_KEY, DEFAULT_AUDIO_PROJECTS);
}

export function saveAudioProjectsLocal(data) {
  saveLocal(PROJECTS_LOCAL_KEY, data);
}
