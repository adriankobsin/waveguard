/**
 * In-memory mock engine for a Cisco Catalyst 1300 / CBS350 switch.
 *
 * Used by the mock-server when the operator wants to demo the Cisco
 * Switches page without an actual switch on the LAN, or when the SSH /
 * SNMP connection is not available. The shape returned by `pollAll()`
 * matches the live `CiscoSshClient.pollAll()` output one-for-one so the
 * adapter and UI can stay vendor-agnostic.
 */

const DEFAULT_MOCK_MODEL = "C1300-48FP-4G";
const DEFAULT_MOCK_HOSTNAME = "C1300-Engine";
const DEFAULT_MOCK_SERIAL = "FCW2645X0DM";
const DEFAULT_MOCK_FIRMWARE = "4.0.0.10";
const DEFAULT_MOCK_DESCRIPTION =
  "Cisco Catalyst 1300 48-Port Gigabit PoE Switch with 4 10G SFP+ Uplinks";

function pad(n, w) {
  return String(n).padStart(w, "0");
}

function makeMockInterfaces(model = DEFAULT_MOCK_MODEL) {
  const out = [];
  // 48 PoE+ copper + 4 SFP+ uplinks for C1300-48FP-4G; degrade to chassis
  // size for other variants.
  const copperCount = /48/.test(model) ? 48 : /24/.test(model) ? 24 : /16/.test(model) ? 16 : 8;
  const uplinkCount = /4G$/i.test(model) || /4X$/i.test(model) ? 4 : 2;

  const sampleAliases = [
    "AP-Bridge", "AP-Saloon", "AP-Master", "AP-VIP-1",
    "CCTV-Bridge", "CCTV-Stern", "Music-Server",
    "DECK-IP1", "DECK-IP2", "Engine-PC", "ECDIS-1", "ECDIS-2",
    "AIS-Receiver", "Radar-Switch", "VOIP-Master", "VOIP-Galley",
    "TV-Saloon", "TV-Master", "Sonos-Saloon", "Sonos-Aft",
  ];
  const sampleMacs = [
    "C0:25:E9:11:22:01", "C0:25:E9:11:22:02", "C0:25:E9:11:22:03",
    "78:24:AF:33:44:55", "FC:EC:DA:55:66:77", "F8:0F:F9:88:99:AA",
    "00:1B:21:AB:CD:EF", "AC:DE:48:00:11:22",
  ];

  for (let i = 1; i <= copperCount; i++) {
    const live = i <= Math.min(sampleAliases.length, copperCount - 4);
    const speed = live ? 1000 : 0;
    out.push({
      index: i,
      name: `gi1/0/${i}`,
      ifAlias: live ? sampleAliases[i - 1] : "",
      status: live ? "up" : "down",
      speed,
      speedMbps: speed,
      duplex: live ? "Full" : null,
      type: "1G-Copper",
      mtu: 1500,
      vlan: live ? (i <= 8 ? 10 : i <= 16 ? 20 : 30) : null,
      poeStatus: live ? "on" : "off",
      poeWatts: live ? Math.round((4 + Math.random() * 20) * 10) / 10 : 0,
      isUplink: false,
      portRole: "lan",
    });
  }
  for (let u = 1; u <= uplinkCount; u++) {
    out.push({
      index: copperCount + u,
      name: `te1/0/${u}`,
      ifAlias: u === 1 ? "Uplink-Core" : "",
      status: u === 1 ? "up" : "down",
      speed: u === 1 ? 10000 : 0,
      speedMbps: u === 1 ? 10000 : 0,
      duplex: u === 1 ? "Full" : null,
      type: "10G-SFP+",
      mtu: 1500,
      vlan: u === 1 ? 1 : null,
      poeStatus: null,
      poeWatts: null,
      isUplink: true,
      portRole: "uplink",
    });
  }

  // Sprinkle MAC entries onto the live ports.
  for (let i = 0; i < Math.min(sampleAliases.length, out.length); i++) {
    if (out[i].status === "up") {
      out[i].macAddr = sampleMacs[i % sampleMacs.length];
      out[i].connectedDevice = sampleAliases[i];
    }
  }
  return out;
}

function makeMacTable(interfaces) {
  const out = [];
  for (const p of interfaces) {
    if (p.status !== "up" || !p.macAddr) continue;
    out.push({
      vlan: p.vlan || 1,
      mac: p.macAddr,
      port: p.name,
      type: "dynamic",
    });
  }
  // Extra MACs behind a downstream switch on one port
  if (interfaces.length > 0) {
    const trunkPort = interfaces.find((p) => p.status === "up" && p.isUplink) || interfaces.find((p) => p.status === "up");
    if (trunkPort) {
      for (let i = 0; i < 5; i++) {
        out.push({
          vlan: 1,
          mac: `AC:DE:48:AB:CD:${pad(i + 16, 2).toUpperCase()}`,
          port: trunkPort.name,
          type: "dynamic",
        });
      }
    }
  }
  return out;
}

function makeNeighbors(interfaces) {
  const lldp = [];
  const cdp = [];
  const candidates = interfaces.filter((p) => p.status === "up" && !p.isUplink).slice(0, 4);
  const neighbours = [
    { name: "AP-Bridge", desc: "Aruba AP-535", platform: "Aruba AP-535", ip: "192.168.10.40" },
    { name: "CCTV-NVR", desc: "Hikvision DS-9664NI", platform: "Hikvision DS-9664NI", ip: "192.168.10.50" },
    { name: "ECDIS-1", desc: "Furuno FAR-3320", platform: "Furuno FAR-3320", ip: "192.168.10.61" },
    { name: "Music-Server", desc: "Roon Nucleus+", platform: "Roon Nucleus+", ip: "192.168.10.65" },
  ];
  candidates.forEach((p, idx) => {
    const n = neighbours[idx];
    if (!n) return;
    lldp.push({
      port: p.name,
      chassisId: p.macAddr,
      portId: "1",
      systemName: n.name,
      systemDescription: n.desc,
      portDescription: "ge-0/0/1",
      capabilities: "Bridge, Router",
    });
    cdp.push({
      deviceId: n.name,
      ip: n.ip,
      platform: n.platform,
      port: p.name,
      remotePort: "ge-0/0/1",
      capabilities: "Switch IGMP",
      version: "4.0.0.10",
    });
  });
  return { lldp, cdp };
}

export class CiscoMockEngine {
  constructor({ model = DEFAULT_MOCK_MODEL, host = "192.168.10.250", hostname = DEFAULT_MOCK_HOSTNAME } = {}) {
    this.model = model;
    this.host = host;
    this.hostname = hostname;
    this.interfaces = makeMockInterfaces(model);
    this.bootAt = Date.now();
  }

  uptimeSec() {
    return Math.floor((Date.now() - this.bootAt) / 1000);
  }

  getSystem() {
    const sec = this.uptimeSec();
    return {
      host: this.host,
      model: this.model,
      serial: DEFAULT_MOCK_SERIAL,
      firmware: DEFAULT_MOCK_FIRMWARE,
      uptime: humanUptime(sec),
      uptimeSec: sec,
      hostname: this.hostname,
      mac: "74:86:0B:00:11:22",
      description: DEFAULT_MOCK_DESCRIPTION,
      poeBudgetW: 740,
      poeUsedW: this.interfaces
        .filter((p) => p.poeWatts > 0)
        .reduce((s, p) => s + p.poeWatts, 0),
    };
  }

  getInterfaces() {
    // Apply gentle jitter so the UI shows live updates between polls.
    return this.interfaces.map((p) => {
      if (p.status !== "up") return p;
      const drift = (Math.random() - 0.5) * 0.5;
      return {
        ...p,
        inMbps: Math.max(0, Math.round((10 + Math.random() * 80) * 10) / 10),
        outMbps: Math.max(0, Math.round((5 + Math.random() * 40) * 10) / 10),
        poeWatts: p.poeWatts > 0 ? Math.max(0.1, Math.round((p.poeWatts + drift) * 10) / 10) : p.poeWatts,
      };
    });
  }

  getMacTable() {
    return makeMacTable(this.interfaces);
  }

  getNeighbors() {
    return makeNeighbors(this.interfaces);
  }

  pollAll() {
    return {
      system: this.getSystem(),
      interfaces: this.getInterfaces(),
      macs: this.getMacTable(),
      neighbors: this.getNeighbors(),
      polledAt: new Date().toISOString(),
    };
  }
}

function humanUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "unknown";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d} day${d > 1 ? "s" : ""}`);
  if (h) parts.push(`${h} hour${h > 1 ? "s" : ""}`);
  if (m) parts.push(`${m} min`);
  return parts.length ? parts.join(", ") : `${seconds}s`;
}

// Singleton — shared across all callers in this Node process so the mock
// state is consistent through a session.
let singleton = null;
export function getCiscoMockEngine(connection = {}) {
  if (!singleton || singleton.host !== (connection.host || singleton.host)) {
    singleton = new CiscoMockEngine({ host: connection.host || "192.168.10.250" });
  }
  return singleton;
}
