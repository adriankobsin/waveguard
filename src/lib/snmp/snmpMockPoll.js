/** Browser-safe mock poll (mirrors scanner/snmpMockData.js for offline / 404 fallback). */

export const MOCK_SWITCH_PORT_DATA = {
  "192.168.10.2": {
    name: "SW-Bridge",
    sysUptime: 1234567,
    ports: [
      { port: 1, ifAlias: "UPLINK-Router-WAN", macAddr: "00:0F:BB:12:34:56", connectedDevice: "Router-WAN", ifOperStatus: "up", ifSpeed: 1000, vlan: 1, poeWatts: null },
      { port: 2, ifAlias: "TRUNK-SW-Saloon", macAddr: "00:1C:57:DD:EE:FF", connectedDevice: "SW-Saloon", ifOperStatus: "up", ifSpeed: 1000, vlan: 1, poeWatts: null },
      { port: 5, ifAlias: "PoE-AP-Bridge", macAddr: "04:18:D6:77:88:99", connectedDevice: "AP-Bridge", ifOperStatus: "up", ifSpeed: 100, vlan: 20, poeWatts: 12.4 },
      { port: 6, ifAlias: "PoE-Cam-Bridge-01", macAddr: "3C:EF:8C:AA:BB:CC", connectedDevice: "Cam-Bridge-01", ifOperStatus: "down", ifSpeed: 100, vlan: 30, poeWatts: 0 },
    ],
  },
  "192.168.10.3": {
    name: "SW-Saloon",
    sysUptime: 987654,
    ports: [
      { port: 1, ifAlias: "UPLINK-SW-Bridge", macAddr: "00:1C:57:AA:BB:CC", connectedDevice: "SW-Bridge", ifOperStatus: "up", ifSpeed: 1000, vlan: 1, poeWatts: null },
      { port: 2, ifAlias: "PoE-Display-Saloon", macAddr: "04:18:D6:AA:BB:CC", connectedDevice: "Display-Saloon-1", ifOperStatus: "up", ifSpeed: 1000, vlan: 10, poeWatts: 8.2 },
    ],
  },
};

export function buildMockPollResult(ip, name, portCount = null) {
  const seed = MOCK_SWITCH_PORT_DATA[ip];
  let ports = seed?.ports || [];
  if (!ports.length && portCount) {
    ports = Array.from({ length: portCount }, (_, i) => ({
      port: i + 1,
      ifAlias: `Port ${i + 1}`,
      ifOperStatus: i % 5 === 0 ? "down" : "up",
      ifSpeed: i % 3 === 0 ? 100 : 1000,
      connectedDevice: i % 4 === 0 ? `Device-${i}` : null,
      macAddr: i % 4 === 0 ? `00:1A:2B:3C:4D:${String(i).padStart(2, "0")}` : null,
      vlan: 10 + (i % 3),
      poeWatts: i % 2 === 0 ? 5 + i * 0.5 : null,
    }));
  }
  if (portCount && ports.length > portCount) ports = ports.slice(0, portCount);

  const uiPorts = ports.map((p) => ({
    index: p.port,
    name: `Gi0/${p.port}`,
    ifAlias: p.ifAlias || "",
    status: p.ifOperStatus === "up" ? "up" : "down",
    speedMbps: p.ifSpeed,
    speed: p.ifSpeed,
    mtu: 1500,
    inMbps: p.ifOperStatus === "up" ? Math.random() * 40 + 2 : 0,
    outMbps: p.ifOperStatus === "up" ? Math.random() * 30 + 1 : 0,
    poeWatts: p.poeWatts,
    poeStatus: p.poeWatts > 0 ? "delivering" : null,
    vlan: p.vlan,
    macAddr: p.macAddr,
    connectedDevice: p.connectedDevice,
  }));

  return {
    success: true,
    ip,
    name: name || seed?.name || ip,
    sysUptime: seed?.sysUptime ?? 86400,
    sysName: name || seed?.name,
    ports: uiPorts,
    polledAt: new Date().toISOString(),
    source: "mock",
  };
}
