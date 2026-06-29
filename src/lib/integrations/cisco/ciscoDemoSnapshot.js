/**
 * Client-side demo snapshot for the Cisco Switches page.
 *
 * This file exists so the React app never needs to import Node-only code
 * from `scanner/integrations/cisco/`. The shape returned here is identical
 * to what `ciscoSwitchClient.pollAll()` returns over the wire, so the UI
 * code can stay vendor-agnostic.
 *
 * The dataset describes a representative `C1300-48FP-4G` with a busy LAN
 * (Aruba access points, Hikvision NVR, Furuno ECDIS, Roon music server).
 */

const DEFAULT_DEMO_MODEL = "C1300-48FP-4G";
const DEFAULT_DEMO_HOSTNAME = "C1300-Demo";
const DEFAULT_DEMO_SERIAL = "FCW2645X0DM";
const DEFAULT_DEMO_FIRMWARE = "4.0.0.10";
const DEFAULT_DEMO_DESCRIPTION =
  "Cisco Catalyst 1300 48-Port Gigabit PoE Switch with 4 10G SFP+ Uplinks";

function pad(n, w) {
  return String(n).padStart(w, "0");
}

function buildInterfaces() {
  const out = [];
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

  for (let i = 1; i <= 48; i++) {
    const live = i <= sampleAliases.length;
    out.push({
      index: i,
      name: `gi1/0/${i}`,
      ifAlias: live ? sampleAliases[i - 1] : "",
      status: live ? "up" : "down",
      speed: live ? 1000 : 0,
      speedMbps: live ? 1000 : 0,
      duplex: live ? "Full" : null,
      type: "1G-Copper",
      mtu: 1500,
      vlan: live ? (i <= 8 ? 10 : i <= 16 ? 20 : 30) : null,
      poeStatus: live ? "on" : "off",
      poeWatts: live ? Math.round((4 + Math.random() * 20) * 10) / 10 : 0,
      inMbps: live ? Math.round((1 + Math.random() * 80) * 10) / 10 : 0,
      outMbps: live ? Math.round((1 + Math.random() * 40) * 10) / 10 : 0,
      macAddr: live ? sampleMacs[(i - 1) % sampleMacs.length] : null,
      connectedDevice: live ? sampleAliases[i - 1] : null,
      isUplink: false,
      portRole: "lan",
    });
  }
  for (let u = 1; u <= 4; u++) {
    out.push({
      index: 48 + u,
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
      inMbps: u === 1 ? 120.4 : 0,
      outMbps: u === 1 ? 86.2 : 0,
      isUplink: true,
      portRole: "uplink",
    });
  }
  return out;
}

function buildMacTable(interfaces) {
  const out = [];
  for (const p of interfaces) {
    if (!p.macAddr) continue;
    out.push({
      vlan: p.vlan || 1,
      mac: p.macAddr,
      port: p.name,
      type: "dynamic",
    });
  }
  const trunk = interfaces.find((p) => p.isUplink && p.status === "up") || interfaces[0];
  if (trunk) {
    for (let i = 0; i < 6; i++) {
      out.push({
        vlan: 1,
        mac: `AC:DE:48:AB:CD:${pad(i + 16, 2).toUpperCase()}`,
        port: trunk.name,
        type: "dynamic",
      });
    }
  }
  return out;
}

function buildNeighbors(interfaces) {
  const lldp = [];
  const cdp = [];
  const candidates = interfaces.filter((p) => p.status === "up" && !p.isUplink).slice(0, 4);
  const data = [
    { name: "AP-Bridge", desc: "Aruba AP-535", platform: "Aruba AP-535", ip: "192.168.10.40" },
    { name: "CCTV-NVR", desc: "Hikvision DS-9664NI", platform: "Hikvision DS-9664NI", ip: "192.168.10.50" },
    { name: "ECDIS-1", desc: "Furuno FAR-3320", platform: "Furuno FAR-3320", ip: "192.168.10.61" },
    { name: "Music-Server", desc: "Roon Nucleus+", platform: "Roon Nucleus+", ip: "192.168.10.65" },
  ];
  candidates.forEach((p, idx) => {
    const n = data[idx];
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
      version: DEFAULT_DEMO_FIRMWARE,
    });
  });
  return { lldp, cdp };
}

function buildSystem(host, interfaces) {
  return {
    host: host || "192.168.10.250",
    model: DEFAULT_DEMO_MODEL,
    serial: DEFAULT_DEMO_SERIAL,
    firmware: DEFAULT_DEMO_FIRMWARE,
    uptime: "14 days, 22 hours, 18 min",
    uptimeSec: 14 * 86400 + 22 * 3600 + 18 * 60,
    hostname: DEFAULT_DEMO_HOSTNAME,
    mac: "74:86:0B:00:11:22",
    description: DEFAULT_DEMO_DESCRIPTION,
    poeBudgetW: 740,
    poeUsedW: interfaces
      .filter((p) => p.poeWatts > 0)
      .reduce((s, p) => s + p.poeWatts, 0),
  };
}

export function buildClientCiscoMockSnapshot({ host } = {}) {
  const interfaces = buildInterfaces();
  return {
    system: buildSystem(host, interfaces),
    interfaces,
    macs: buildMacTable(interfaces),
    neighbors: buildNeighbors(interfaces),
    polledAt: new Date().toISOString(),
  };
}
