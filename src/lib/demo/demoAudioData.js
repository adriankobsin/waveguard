export const DEMO_AUDIO_SYSTEMS = {
  systems: [
    {
      id: "audio-sys-qsc-1",
      name: "Main Auditorium - QSC Core 510i",
      type: "qsys",
      host: "192.168.1.100",
      port: 1710,
      protocol: "qrc",
      status: "online",
      designName: "WaveGuard Demo",
      lastPolled: new Date().toISOString(),
      enabled: true,
      credentials: { username: "", password: "" },
      inputs: [
        { id: "in-1", name: "Wireless Mic 1", channelNumber: 1, type: "analog", ioType: "input", format: "mic", gain: 0, mute: false, delay: 0, phantomPower: true, danteFlowId: null, levelMeter: -12, peakMeter: -6 },
        { id: "in-2", name: "Wireless Mic 2", channelNumber: 2, type: "analog", ioType: "input", format: "mic", gain: 0, mute: false, delay: 0, phantomPower: true, danteFlowId: null, levelMeter: -14, peakMeter: -8 },
        { id: "in-3", name: "Lavalier Mic", channelNumber: 3, type: "analog", ioType: "input", format: "mic", gain: 2, mute: false, delay: 0, phantomPower: true, danteFlowId: null, levelMeter: -10, peakMeter: -5 },
        { id: "in-4", name: "DVD Player", channelNumber: 4, type: "analog", ioType: "input", format: "line", gain: -6, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -18, peakMeter: -12 },
        { id: "in-5", name: "HDMI Input", channelNumber: 5, type: "digital", ioType: "input", format: "aes", gain: 0, mute: false, delay: 0, phantomPower: false, danteFlowId: "flow-1", levelMeter: -20, peakMeter: -14 },
        { id: "in-6", name: "Bluetooth Audio", channelNumber: 6, type: "digital", ioType: "input", format: "aes", gain: -3, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -16, peakMeter: -10 },
      ],
      outputs: [
        { id: "out-1", name: "Main L", channelNumber: 1, type: "analog", ioType: "output", format: "line", gain: 0, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -8, peakMeter: -3 },
        { id: "out-2", name: "Main R", channelNumber: 2, type: "analog", ioType: "output", format: "line", gain: 0, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -8, peakMeter: -3 },
        { id: "out-3", name: "Sub L", channelNumber: 3, type: "analog", ioType: "output", format: "line", gain: 3, mute: false, delay: 10, phantomPower: false, danteFlowId: null, levelMeter: -15, peakMeter: -8 },
        { id: "out-4", name: "Sub R", channelNumber: 4, type: "analog", ioType: "output", format: "line", gain: 3, mute: false, delay: 10, phantomPower: false, danteFlowId: null, levelMeter: -15, peakMeter: -8 },
        { id: "out-5", name: "Stage Mon 1", channelNumber: 5, type: "analog", ioType: "output", format: "line", gain: -6, mute: true, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -40, peakMeter: -30 },
        { id: "out-6", name: "Stage Mon 2", channelNumber: 6, type: "analog", ioType: "output", format: "line", gain: -6, mute: true, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -40, peakMeter: -30 },
        { id: "out-7", name: "Lobby Feed (AES67)", channelNumber: 7, type: "digital", ioType: "output", format: "aes", gain: -3, mute: false, delay: 5, phantomPower: false, danteFlowId: "flow-2", levelMeter: -22, peakMeter: -14 },
        { id: "out-8", name: "Recording Bus", channelNumber: 8, type: "digital", ioType: "output", format: "aes", gain: 0, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -10, peakMeter: -5 },
      ],
      zones: [
        { id: "zone-1", name: "Main Hall", volume: -18, mute: false, sourceId: "out-1", sourceSelected: "out-1", bass: 0, treble: 0, balance: 0, priority: 0, speakerProfile: "Main PA" },
        { id: "zone-2", name: "Stage", volume: -12, mute: false, sourceId: "out-5", sourceSelected: "out-5", bass: 2, treble: 1, balance: 0, priority: 0, speakerProfile: "Stage Monitors" },
        { id: "zone-3", name: "Lobby", volume: -24, mute: false, sourceId: "out-7", sourceSelected: "out-7", bass: 0, treble: 0, balance: 0, priority: 0, speakerProfile: "Distributed" },
        { id: "zone-4", name: "Green Room", volume: -30, mute: true, sourceId: null, sourceSelected: null, bass: 0, treble: 0, balance: 0, priority: 0, speakerProfile: "Small Room" },
      ],
      amplifiers: [
        {
          id: "amp-1", name: "Main PA Amp", model: "CX-Q 4x350", status: "online", powerWatts: 280, temperature: 45, impedance: 4, loadStatus: "ok",
          channels: [
            { id: "amp1-ch1", name: "Main L", power: 140, clip: false, protect: false, load: "4Ω" },
            { id: "amp1-ch2", name: "Main R", power: 140, clip: false, protect: false, load: "4Ω" },
          ], firmware: "2.1.0",
        },
        {
          id: "amp-2", name: "Sub Amp", model: "CX-Q 2x700", status: "online", powerWatts: 400, temperature: 52, impedance: 8, loadStatus: "ok",
          channels: [
            { id: "amp2-ch1", name: "Sub L", power: 200, clip: false, protect: false, load: "8Ω" },
            { id: "amp2-ch2", name: "Sub R", power: 200, clip: false, protect: false, load: "8Ω" },
          ], firmware: "2.1.0",
        },
        {
          id: "amp-3", name: "Stage Monitor Amp", model: "CX-Q 4x350", status: "online", powerWatts: 60, temperature: 35, impedance: 8, loadStatus: "ok",
          channels: [
            { id: "amp3-ch1", name: "Mon 1", power: 30, clip: false, protect: false, load: "8Ω" },
            { id: "amp3-ch2", name: "Mon 2", power: 30, clip: false, protect: false, load: "8Ω" },
          ], firmware: "2.1.0",
        },
      ],
      snapshots: [
        { id: "snap-1", bankName: "Default", bankNumber: 1, name: "Presentation", active: false, updatedAt: "2026-04-15T10:00:00Z" },
        { id: "snap-2", bankName: "Default", bankNumber: 2, name: "Music Playback", active: true, updatedAt: "2026-04-20T14:30:00Z" },
        { id: "snap-3", bankName: "Default", bankNumber: 3, name: "Theater Mode", active: false, updatedAt: "2026-04-22T09:15:00Z" },
        { id: "snap-4", bankName: "Default", bankNumber: 4, name: "All Off", active: false, updatedAt: "2026-04-01T08:00:00Z" },
      ],
      danteFlows: [
        {
          id: "flow-1", name: "HDMI->Amp Rack", sourceDevice: "Core 510i", sourceChannel: 5,
          multicastAddress: "239.192.1.1", format: "L24", sampleRate: 48000, bitDepth: 24, active: true, aes67Mode: false,
          subscriptions: [{ device: "CX-Q 4x350", channel: 1, status: "active" }],
        },
        {
          id: "flow-2", name: "Lobby Feed", sourceDevice: "Core 510i", sourceChannel: 7,
          multicastAddress: "239.192.1.2", format: "L16", sampleRate: 48000, bitDepth: 16, active: true, aes67Mode: true,
          subscriptions: [{ device: "Lobby DSP", channel: 1, status: "active" }],
        },
      ],
      metadata: {},
      createdAt: "2026-01-15T08:00:00Z",
      updatedAt: "2026-04-22T09:15:00Z",
    },
    {
      id: "audio-sys-sym-1",
      name: "Conference Wing - Symetrix Radius NX",
      type: "symetrix",
      host: "192.168.2.50",
      port: 1024,
      protocol: "composer-tcp",
      status: "online",
      designName: "Conf Wing v2",
      lastPolled: new Date().toISOString(),
      enabled: true,
      credentials: { username: "", password: "" },
      inputs: [
        { id: "sym-in-1", name: "Ceiling Mic 1", channelNumber: 1, type: "analog", ioType: "input", format: "mic", gain: 0, mute: false, delay: 0, phantomPower: true, danteFlowId: null, levelMeter: -16, peakMeter: -9 },
        { id: "sym-in-2", name: "Ceiling Mic 2", channelNumber: 2, type: "analog", ioType: "input", format: "mic", gain: 0, mute: false, delay: 0, phantomPower: true, danteFlowId: null, levelMeter: -16, peakMeter: -9 },
        { id: "sym-in-3", name: "HDMI Audio", channelNumber: 3, type: "digital", ioType: "input", format: "aes", gain: -6, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -22, peakMeter: -14 },
      ],
      outputs: [
        { id: "sym-out-1", name: "Room L", channelNumber: 1, type: "analog", ioType: "output", format: "line", gain: 0, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -10, peakMeter: -4 },
        { id: "sym-out-2", name: "Room R", channelNumber: 2, type: "analog", ioType: "output", format: "line", gain: 0, mute: false, delay: 0, phantomPower: false, danteFlowId: null, levelMeter: -10, peakMeter: -4 },
      ],
      zones: [
        { id: "sym-zone-1", name: "Conference Room A", volume: -20, mute: false, sourceId: null, sourceSelected: null, bass: 0, treble: 0, balance: 0, priority: 0, speakerProfile: "Ceiling Speakers" },
        { id: "sym-zone-2", name: "Conference Room B", volume: -18, mute: true, sourceId: null, sourceSelected: null, bass: 0, treble: 0, balance: 0, priority: 0, speakerProfile: "Ceiling Speakers" },
      ],
      amplifiers: [],
      snapshots: [
        { id: "sym-snap-1", bankName: "Preset", bankNumber: 1, name: "Meeting Mode", active: true, updatedAt: "2026-04-10T11:00:00Z" },
        { id: "sym-snap-2", bankName: "Preset", bankNumber: 2, name: "VC Mode", active: false, updatedAt: "2026-04-10T11:00:00Z" },
      ],
      danteFlows: [],
      metadata: {},
      createdAt: "2026-02-01T09:00:00Z",
      updatedAt: "2026-04-20T14:00:00Z",
    },
  ],
};

export const DEMO_AUDIO_ZONE_STATE = {
  "zone-1": { volume: -18, mute: false },
  "zone-2": { volume: -12, mute: false },
  "zone-3": { volume: -24, mute: false },
  "zone-4": { volume: -30, mute: true },
  "sym-zone-1": { volume: -20, mute: false },
  "sym-zone-2": { volume: -18, mute: true },
};

export const DEMO_AUDIO_EVENTS = [
  { id: "ae-1", kind: "system", severity: "info", systemId: "audio-sys-qsc-1", systemName: "Main Auditorium - QSC Core 510i", zoneHref: "/zones/zone-1", action: "volume_set", result: "success", level: -18, message: "Main Hall volume set to -18dB", timestamp: "2026-04-22T09:15:00Z" },
  { id: "ae-2", kind: "connection", severity: "info", systemId: "audio-sys-qsc-1", systemName: "Main Auditorium - QSC Core 510i", zoneHref: "", action: "connect", result: "success", level: null, message: "Connected to Q-SYS Core 510i at 192.168.1.100:1710", timestamp: "2026-04-22T09:14:55Z" },
  { id: "ae-3", kind: "system", severity: "warning", systemId: "audio-sys-qsc-1", systemName: "Main Auditorium - QSC Core 510i", zoneHref: "/zones/zone-3", action: "mute_set", result: "success", level: null, message: "Stage Mon 1 muted via zone control", timestamp: "2026-04-22T09:10:00Z" },
  { id: "ae-4", kind: "snapshot", severity: "info", systemId: "audio-sys-qsc-1", systemName: "Main Auditorium - QSC Core 510i", zoneHref: "", action: "snapshot_load", result: "success", level: null, message: "Snapshot 'Music Playback' (Bank 2) loaded", timestamp: "2026-04-22T09:00:00Z" },
  { id: "ae-5", kind: "system", severity: "error", systemId: "audio-sys-qsc-1", systemName: "Main Auditorium - QSC Core 510i", zoneHref: "", action: "snapshot_save", result: "error", level: null, message: "Failed to save snapshot: Access denied", timestamp: "2026-04-22T08:55:00Z" },
  { id: "ae-6", kind: "connection", severity: "info", systemId: "audio-sys-sym-1", systemName: "Conference Wing - Symetrix Radius NX", zoneHref: "", action: "connect", result: "success", level: null, message: "Connected to Symetrix Radius NX at 192.168.2.50:1024", timestamp: "2026-04-22T08:30:00Z" },
  { id: "ae-7", kind: "system", severity: "info", systemId: "audio-sys-sym-1", systemName: "Conference Wing - Symetrix Radius NX", zoneHref: "/zones/sym-zone-1", action: "volume_set", result: "success", level: -20, message: "Conference Room A volume set to -20dB", timestamp: "2026-04-22T08:30:05Z" },
];

export const DEMO_AUDIO_DANTE_ROUTING = {
  flows: [
    { id: "flow-1", name: "HDMI->Amp Rack", sourceDevice: "Core 510i", sourceChannel: 5, multicastAddress: "239.192.1.1", format: "L24", sampleRate: 48000, bitDepth: 24, active: true, aes67Mode: false, subscriptions: [{ device: "CX-Q 4x350", channel: 1, status: "active" }] },
    { id: "flow-2", name: "Lobby Feed", sourceDevice: "Core 510i", sourceChannel: 7, multicastAddress: "239.192.1.2", format: "L16", sampleRate: 48000, bitDepth: 16, active: true, aes67Mode: true, subscriptions: [{ device: "Lobby DSP", channel: 1, status: "active" }] },
  ],
  subscriptions: [],
};
