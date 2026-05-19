import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Mock SNMP MIB-II ifTable + dot1dTpFdbTable data for the yacht's switches
const SWITCH_PORT_DATA = {
  "192.168.10.1": { // SW-Bridge (Cisco CBS350-24T)
    name: "SW-Bridge",
    ports: [
      { port: 1,  ifAlias: "UPLINK-Router-WAN",    macAddr: "00:0F:BB:12:34:56", connectedDevice: "Router-WAN",      ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 2,  ifAlias: "TRUNK-SW-Saloon",       macAddr: "00:1C:57:DD:EE:FF", connectedDevice: "SW-Saloon",       ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 3,  ifAlias: "TRUNK-SW-Deck",         macAddr: "00:1C:57:11:22:33", connectedDevice: "SW-Deck-Lower",   ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 4,  ifAlias: "TRUNK-SW-Engine",       macAddr: "00:1C:57:44:55:66", connectedDevice: "SW-Engine",       ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 5,  ifAlias: "PoE-AP-Bridge",         macAddr: "04:18:D6:77:88:99", connectedDevice: "AP-Bridge",       ifOperStatus: "up",   ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 20 },
      { port: 6,  ifAlias: "PoE-Cam-Bridge-01",     macAddr: "3C:EF:8C:AA:BB:CC", connectedDevice: "Cam-Bridge-01",   ifOperStatus: "down", ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 30 },
      { port: 7,  ifAlias: "QSys-Core",             macAddr: "00:1A:4B:77:88:99", connectedDevice: "Q-SYS Core",      ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 40 },
      { port: 8,  ifAlias: "NAS-Synology",          macAddr: "00:1B:8F:11:22:33", connectedDevice: "NAS-Synology",    ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 9,  ifAlias: "UPS-Main-SNMP",         macAddr: "00:C0:B7:44:55:66", connectedDevice: "UPS-Main",        ifOperStatus: "up",   ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 1 },
      { port: 10, ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 11, ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 12, ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
    ]
  },
  "192.168.10.2": { // SW-Saloon (Cisco CBS350-16T)
    name: "SW-Saloon",
    ports: [
      { port: 1,  ifAlias: "UPLINK-SW-Bridge",      macAddr: "00:1C:57:AA:BB:CC", connectedDevice: "SW-Bridge",       ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 2,  ifAlias: "PoE-AP-Deck-Aft",       macAddr: "04:18:D6:AA:BB:CC", connectedDevice: "AP-Deck-Aft",     ifOperStatus: "up",   ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 20 },
      { port: 3,  ifAlias: "PoE-Cam-Saloon",        macAddr: "3C:EF:8C:DD:EE:FF", connectedDevice: "Cam-Saloon-01",   ifOperStatus: "up",   ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 30 },
      { port: 4,  ifAlias: "AV-Proc-Saloon",        macAddr: "00:40:9D:11:22:33", connectedDevice: "AV-Proc-Saloon",  ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 40 },
      { port: 5,  ifAlias: "AV-Matrix-Saloon",      macAddr: "00:40:9D:44:55:66", connectedDevice: "AV-Matrix-Saloon",ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 40 },
      { port: 6,  ifAlias: "UPS-AV-SNMP",           macAddr: "00:C0:B7:77:88:99", connectedDevice: "UPS-AV",          ifOperStatus: "up",   ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 1 },
      { port: 7,  ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 8,  ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
    ]
  },
  "192.168.10.5": { // SW-Deck-Lower (Cisco SG250-18)
    name: "SW-Deck-Lower",
    ports: [
      { port: 1,  ifAlias: "UPLINK-SW-Bridge",      macAddr: "00:1C:57:AA:BB:CC", connectedDevice: "SW-Bridge",       ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 2,  ifAlias: "PoE-Cam-Deck-01",       macAddr: "3C:EF:8C:11:22:33", connectedDevice: "Cam-Deck-01",     ifOperStatus: "up",   ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 30 },
      { port: 3,  ifAlias: "PoE-Cam-Deck-02",       macAddr: "3C:EF:8C:44:55:66", connectedDevice: "Cam-Deck-02",     ifOperStatus: "up",   ifSpeed: 100,  ifType: "ethernetCsmacd", vlan: 30 },
      { port: 4,  ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 5,  ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
    ]
  },
  "192.168.10.6": { // SW-Engine (Cisco SG250-18)
    name: "SW-Engine",
    ports: [
      { port: 1,  ifAlias: "UPLINK-SW-Bridge",      macAddr: "00:1C:57:AA:BB:CC", connectedDevice: "SW-Bridge",       ifOperStatus: "up",   ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 2,  ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
      { port: 3,  ifAlias: "",                       macAddr: null,                connectedDevice: null,              ifOperStatus: "down", ifSpeed: 1000, ifType: "ethernetCsmacd", vlan: 1 },
    ]
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { switchIp } = body;

    // Simulate SNMP polling delay
    await new Promise(r => setTimeout(r, 600));

    if (switchIp) {
      // Return single switch port map
      const sw = SWITCH_PORT_DATA[switchIp];
      if (!sw) return Response.json({ error: "Switch not found or SNMP not reachable" }, { status: 404 });
      return Response.json({
        success: true,
        switchIp,
        switchName: sw.name,
        ports: sw.ports,
        polledAt: new Date().toISOString(),
      });
    }

    // Return all switches
    const switches = Object.entries(SWITCH_PORT_DATA).map(([ip, sw]) => ({
      ip,
      name: sw.name,
      totalPorts: sw.ports.length,
      portsUp: sw.ports.filter(p => p.ifOperStatus === "up").length,
      portsDown: sw.ports.filter(p => p.ifOperStatus === "down").length,
      ports: sw.ports,
    }));

    // Build cable-level connection map (ip => port => device)
    const connectionMap = [];
    for (const [ip, sw] of Object.entries(SWITCH_PORT_DATA)) {
      for (const port of sw.ports) {
        if (port.connectedDevice) {
          connectionMap.push({
            switchName: sw.name,
            switchIp: ip,
            port: port.port,
            portAlias: port.ifAlias,
            connectedDevice: port.connectedDevice,
            macAddr: port.macAddr,
            status: port.ifOperStatus,
            speed: port.ifSpeed,
            vlan: port.vlan,
          });
        }
      }
    }

    return Response.json({
      success: true,
      switches,
      connectionMap,
      totalConnections: connectionMap.length,
      disconnectedPorts: connectionMap.filter(c => c.status === "down").length,
      polledAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});