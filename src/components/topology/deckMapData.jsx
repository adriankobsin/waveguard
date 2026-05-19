// Shared data for the Deck Map feature

export const DEVICES = [
  { id: "router-wan",  name: "Router-WAN",      category: "Network", model: "MikroTik CCR2004-1G",  ip: "192.168.1.1",   location: "Bridge Rack",    serial: "MT220B0041",  condition: "Excellent", notes: "BGP + failover configured" },
  { id: "sw-bridge",   name: "SW-Bridge",        category: "Network", model: "Cisco CBS350-24T",     ip: "192.168.10.1",  location: "Bridge Rack",    serial: "FOC2241X0AB", condition: "Good",      notes: "Primary distribution switch" },
  { id: "sw-saloon",   name: "SW-Saloon",        category: "Network", model: "Cisco CBS350-16T",     ip: "192.168.10.2",  location: "Saloon Cabinet", serial: "FOC2241X0CD", condition: "Good",      notes: "" },
  { id: "sw-deck",     name: "SW-Deck-Lower",    category: "Network", model: "Cisco SG250-18",       ip: "192.168.10.5",  location: "Deck Cabinet",   serial: "FOC2131X0EF", condition: "Fair",      notes: "CPU spikes noted" },
  { id: "sw-engine",   name: "SW-Engine",        category: "Network", model: "Cisco SG250-18",       ip: "192.168.10.6",  location: "Engine Room",    serial: "FOC2131X0GH", condition: "Good",      notes: "" },
  { id: "ap-bridge",   name: "AP-Bridge",        category: "Network", model: "Ubiquiti UAP-AC-Pro",  ip: "192.168.10.20", location: "Bridge Mast",    serial: "UBQ2022A001", condition: "Good",      notes: "" },
  { id: "ap-deck",     name: "AP-Deck-Aft",      category: "Network", model: "Ubiquiti UAP-AC-Pro",  ip: "192.168.10.21", location: "Aft Deck",       serial: "UBQ2022A002", condition: "Good",      notes: "" },
  { id: "cam-bridge",  name: "Cam-Bridge-01",    category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.51", location: "Bridge Ext.",    serial: "DH2023051201",condition: "Fair",      notes: "PoE — requires port bounce" },
  { id: "cam-saloon",  name: "Cam-Saloon-01",    category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.52", location: "Saloon",         serial: "DH2023051202",condition: "Good",      notes: "" },
  { id: "cam-deck1",   name: "Cam-Deck-01",      category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.53", location: "Fore Deck",      serial: "DH2023051203",condition: "Good",      notes: "" },
  { id: "cam-deck2",   name: "Cam-Deck-02",      category: "Camera",  model: "Dahua IPC-HDW3849H",   ip: "192.168.10.54", location: "Aft Deck",       serial: "DH2023051204",condition: "Good",      notes: "" },
  { id: "av-proc",     name: "AV-Proc-Saloon",   category: "AV",      model: "Crestron NVX-350",     ip: "192.168.10.22", location: "Saloon AV Rack", serial: "CRE7462183",  condition: "Good",      notes: "4K HDR matrix" },
  { id: "av-matrix",   name: "AV-Matrix-Saloon", category: "AV",      model: "Kramer VS-88H",        ip: "192.168.10.23", location: "Saloon AV Rack", serial: "KRM1980041",  condition: "Good",      notes: "" },
  { id: "qsys-core",   name: "Q-SYS Core",       category: "AV",      model: "Q-SYS Core 110f",      ip: "192.168.10.30", location: "Bridge Rack",    serial: "QSC2021001",  condition: "Good",      notes: "Audio DSP main" },
  { id: "nas",         name: "NAS-Synology",      category: "Server",  model: "Synology DS1522+",     ip: "192.168.10.80", location: "Engine Room",    serial: "SYN2022001",  condition: "Good",      notes: "" },
  { id: "ups-main",    name: "UPS-Main",          category: "Power",   model: "APC Smart-UPS 3000VA", ip: "192.168.10.90", location: "Engine Room",    serial: "AS1720140893",condition: "Good",      notes: "Battery at 42%" },
  { id: "ups-av",      name: "UPS-AV",            category: "Power",   model: "APC Smart-UPS 750VA",  ip: "192.168.10.91", location: "Saloon AV Rack", serial: "AS1820140112",condition: "Good",      notes: "" },
];

export const MOCK_STATUS = {
  "router-wan": "online",  "sw-bridge":  "online",  "sw-saloon": "online",
  "sw-deck":    "warning", "sw-engine":  "online",  "ap-bridge": "online",
  "ap-deck":    "online",  "cam-bridge": "offline", "cam-saloon":"online",
  "cam-deck1":  "online",  "cam-deck2":  "online",  "av-proc":   "online",
  "av-matrix":  "online",  "qsys-core":  "online",  "nas":       "online",
  "ups-main":   "warning", "ups-av":     "online",
};

export const MOCK_EVENTS = {
  "cam-bridge": [
    { id: "e1", time: "14m ago",  severity: "critical", message: "Device went offline — PoE port 12 dropped" },
    { id: "e2", time: "2h ago",   severity: "warning",  message: "Packet loss > 5% detected" },
    { id: "e3", time: "1d ago",   severity: "info",     message: "Firmware update available: v2.800.3" },
  ],
  "sw-deck": [
    { id: "e4", time: "3h ago",   severity: "warning",  message: "CPU utilisation at 84% for 10 min" },
    { id: "e5", time: "6h ago",   severity: "info",     message: "Port 5 flapped — auto-recovered" },
  ],
  "ups-main": [
    { id: "e6", time: "1d ago",   severity: "warning",  message: "Battery capacity at 42% — replacement advised" },
    { id: "e7", time: "3d ago",   severity: "info",     message: "Load test completed successfully" },
  ],
  "router-wan": [
    { id: "e8", time: "6h ago",   severity: "info",     message: "BGP peer re-established" },
    { id: "e9", time: "2d ago",   severity: "warning",  message: "WAN2 failover triggered — 4 min outage" },
  ],
};

export const MOCK_DOCS = {
  "cam-bridge": [
    { id: "d1", name: "Dahua IPC-HDW3849H Manual",  type: "PDF",  category: "Manual",    size: "4.2 MB" },
    { id: "d2", name: "CCTV Schematic - Bridge Ext", type: "PDF",  category: "Schematic", size: "1.8 MB" },
  ],
  "sw-bridge": [
    { id: "d3", name: "Cisco CBS350 Admin Guide",    type: "PDF",  category: "Manual",    size: "12 MB"  },
    { id: "d4", name: "Network Rack Drawing v3",     type: "PDF",  category: "Schematic", size: "2.1 MB" },
    { id: "d5", name: "IP Address Schedule",         type: "XLSX", category: "Schedule",  size: "420 KB" },
  ],
  "av-proc": [
    { id: "d6", name: "Crestron NVX-350 Manual",     type: "PDF",  category: "Manual",    size: "8.7 MB" },
    { id: "d7", name: "AV Signal Flow Diagram",      type: "PDF",  category: "Schematic", size: "3.4 MB" },
  ],
  "qsys-core": [
    { id: "d8", name: "Q-SYS Core 110f Manual",      type: "PDF",  category: "Manual",    size: "15 MB"  },
    { id: "d9", name: "Audio Zone Schedule",          type: "XLSX", category: "Schedule",  size: "290 KB" },
  ],
  "ups-main": [
    { id: "d10", name: "APC Smart-UPS 3000 Manual",  type: "PDF",  category: "Manual",    size: "5.1 MB" },
    { id: "d11", name: "Power Distribution Schematic",type: "PDF", category: "Schematic", size: "2.6 MB" },
  ],
  "router-wan": [
    { id: "d12", name: "MikroTik CCR2004 Manual",    type: "PDF",  category: "Manual",    size: "6.8 MB" },
    { id: "d13", name: "WAN/LAN Network Diagram",    type: "PDF",  category: "Schematic", size: "1.5 MB" },
  ],
};
