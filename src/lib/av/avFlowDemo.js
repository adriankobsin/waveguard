/**
 * Demo vessel for the AV Flow page: 3 NVX encoders, 4 decoders, a Q-SYS core
 * and Dante amps/mics on a C9200L, with a few realistic faults planted so
 * every finding type shows up.
 */
import { buildAvFlow } from "./avFlowModel";

const SW = "192.168.10.250";

function port(n, { vlan = 40, speed = 1000, poe = 0, errors = null, alias = "" } = {}) {
  return { name: `Gi1/0/${n}`, ifAlias: alias, status: "up", speedMbps: speed, vlan, poeWatts: poe, errors, isUplink: false };
}

export function buildAvFlowDemo() {
  const nvx = [
    { ip: "192.168.40.21", online: true, mode: "tx", name: "ENC-Saloon-AppleTV", model: "DM-NVX-E30", firmware: "7.1.5304.00038", mac: "00:10:7F:A1:00:21", multicast: "239.8.0.21", streamLocation: "rtsp://192.168.40.21:554/live.sdp", status: "Stream started", resolution: "3840x2160@60", inputSync: true },
    { ip: "192.168.40.22", online: true, mode: "tx", name: "ENC-Cinema-Kaleidescape", model: "DM-NVX-360", firmware: "7.1.5304.00038", mac: "00:10:7F:A1:00:22", multicast: "239.8.0.22", streamLocation: "rtsp://192.168.40.22:554/live.sdp", status: "Stream started", resolution: "3840x2160@24", inputSync: true },
    { ip: "192.168.40.23", online: true, mode: "tx", name: "ENC-Sky-Deck-TV", model: "DM-NVX-E30", firmware: "6.2.0.12", mac: "00:10:7F:A1:00:23", multicast: "239.8.0.23", streamLocation: "rtsp://192.168.40.23:554/live.sdp", status: "Stream started", resolution: "", inputSync: false },
    { ip: "192.168.40.31", online: true, mode: "rx", name: "DEC-Saloon-TV", model: "DM-NVX-D30", firmware: "7.1.5304.00038", mac: "00:10:7F:A1:00:31", multicast: "239.8.0.21", streamLocation: "rtsp://192.168.40.21:554/live.sdp", status: "Stream started", resolution: "3840x2160@60" },
    { ip: "192.168.40.32", online: true, mode: "rx", name: "DEC-Owner-TV", model: "DM-NVX-D30", firmware: "7.1.5304.00038", mac: "00:10:7F:A1:00:32", multicast: "239.8.0.22", streamLocation: "rtsp://192.168.40.22:554/live.sdp", status: "Stream started", resolution: "3840x2160@24" },
    { ip: "192.168.40.33", online: true, mode: "rx", name: "DEC-Cinema-Projector", model: "DM-NVX-360", firmware: "7.1.5304.00038", mac: "00:10:7F:A1:00:33", multicast: "239.8.0.22", streamLocation: "rtsp://192.168.40.22:554/live.sdp", status: "No stream", resolution: "" },
    { ip: "192.168.40.34", online: true, mode: "rx", name: "DEC-Sky-Lounge", model: "DM-NVX-D30", firmware: "6.2.0.12", mac: "00:10:7F:A1:00:34", multicast: "239.8.0.23", streamLocation: "rtsp://192.168.40.23:554/live.sdp", status: "Stream started", resolution: "" },
    { ip: "192.168.40.35", online: false, mode: "rx", name: "DEC-VIP-TV", error: "No answer on HTTPS (timed out)" },
  ];
  const dante = [
    { ip: "192.168.41.10", name: "QSYS-Core-110f", manufacturer: "QSC", model: "Core 110f", mac: "00:60:74:B1:00:10", txChannels: 64, sampleRate: 48000 },
    { ip: "192.168.41.21", name: "AMP-Saloon", manufacturer: "Powersoft", model: "Mezzo 604 AD", mac: "00:1E:C0:B1:00:21", txChannels: 4, sampleRate: 48000 },
    { ip: "192.168.41.22", name: "AMP-Aft-Deck", manufacturer: "Powersoft", model: "Mezzo 604 AD", mac: "00:1E:C0:B1:00:22", txChannels: 4, sampleRate: 48000 },
    { ip: "192.168.41.31", name: "MIC-Cinema-Wall", manufacturer: "Shure", model: "MXA710", mac: "00:0E:DD:B1:00:31", txChannels: 8, sampleRate: 48000 },
  ];
  const interfaces = [
    port(1, { alias: "ENC Saloon AppleTV", poe: 12.9 }),
    port(2, { alias: "ENC Cinema Kaleidescape", poe: 15.1 }),
    port(3, { alias: "ENC Sky Deck TV", poe: 12.6 }),
    port(4, { alias: "DEC Saloon TV", poe: 11.8 }),
    port(5, { alias: "DEC Owner TV", poe: 11.9 }),
    port(6, { alias: "DEC Cinema", poe: 14.7, errors: { in: 412, out: 0, fcs: 1980 } }),
    port(7, { alias: "DEC Sky Lounge", speed: 100, poe: 11.2 }),
    port(8, { alias: "DEC VIP", poe: 0 }),
    port(10, { alias: "Q-SYS Core", vlan: 41 }),
    port(11, { alias: "AMP Saloon", vlan: 41 }),
    port(12, { alias: "AMP Aft", vlan: 41 }),
    port(13, { alias: "MXA710 Cinema", vlan: 41, poe: 9.4 }),
    { name: "Te1/1/1", ifAlias: "Uplink core", status: "up", speedMbps: 10000, vlan: null, trunk: true, isUplink: true },
  ];
  interfaces[7].status = "down";
  const macs = [
    ...nvx.filter((d) => d.mac).map((d, i) => ({ vlan: 40, mac: d.mac, port: `Gi1/0/${i + 1}`, type: "dynamic" })),
    ...dante.map((d, i) => ({ vlan: 41, mac: d.mac, port: `Gi1/0/${10 + i}`, type: "dynamic" })),
  ];
  const multicast = {
    snoopingEnabled: true,
    querierChecked: true,
    vlans: [{ vlan: 40, snooping: true }, { vlan: 41, snooping: true }],
    queriers: [{ vlan: 40, address: "192.168.40.1", version: 2, port: "Te1/1/1" }],
    groups: [
      { vlan: 40, group: "239.8.0.21", ports: ["Gi1/0/4"] },
      { vlan: 40, group: "239.8.0.22", ports: ["Gi1/0/5"] },
      { vlan: 40, group: "239.8.0.23", ports: ["Gi1/0/7"] },
      { vlan: 41, group: "239.255.220.1", ports: ["Gi1/0/11", "Gi1/0/12"] },
      { vlan: 41, group: "239.255.220.2", ports: ["Gi1/0/10"] },
      { vlan: 41, group: "224.0.1.129", ports: ["Gi1/0/10", "Gi1/0/11", "Gi1/0/12", "Gi1/0/13"] },
    ],
  };
  const ptp = {
    ptp: [
      { ip: "192.168.41.10", version: 1, packets: 64, sendsSync: true, vendor: "QSC" },
      { ip: "192.168.41.21", version: 1, packets: 12, sendsSync: false, vendor: "Powersoft" },
    ],
    streams: [],
    findings: [],
  };
  const switches = [{ host: SW, name: "SW-AV-Bridge-Deck (C9200L-24P)", snapshot: { system: { hostname: "SW-AV-Bridge-Deck" }, interfaces, macs, multicast } }];
  const equipment = [
    { ip: "192.168.40.21", location: "Saloon AV rack" },
    { ip: "192.168.40.22", location: "Cinema rack" },
    { ip: "192.168.40.33", location: "Cinema ceiling" },
    { ip: "192.168.41.10", location: "Main AV rack" },
  ];
  return { ...buildAvFlow({ nvx, dante, ptp, switches, neighbours: [], equipment }), demo: true };
}
