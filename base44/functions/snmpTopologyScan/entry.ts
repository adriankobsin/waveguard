import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mock topology data matching the structure expected by NetworkMapTab
    const topologyData = {
      success: true,
      scanned_at: new Date().toISOString(),
      stats: {
        online: 15,
        offline: 2,
        warning: 1,
        active_connections: 24,
      },
      devices: [
        // Core router
        { id: "router-core", name: "Core Router", category: "Network", model: "MikroTik CCR2004", ip: "192.168.1.1", status: "online", location: "Bridge Rack", serial: "MT220B0041" },
        
        // Distribution switches
        { id: "sw-bridge", name: "SW-Bridge", category: "Network", model: "Cisco CBS350", ip: "192.168.10.1", status: "online", location: "Bridge Rack", serial: "FOC2241X0AB" },
        { id: "sw-saloon", name: "SW-Saloon", category: "Network", model: "Cisco CBS350", ip: "192.168.10.2", status: "online", location: "Saloon Cabinet", serial: "FOC2241X0CD" },
        { id: "sw-deck", name: "SW-Deck", category: "Network", model: "Cisco SG250", ip: "192.168.10.5", status: "warning", location: "Deck Cabinet", serial: "FOC2131X0EF" },
        
        // Access points
        { id: "ap-bridge", name: "AP-Bridge", category: "Network", model: "Ubiquiti UAP-AC-Pro", ip: "192.168.10.20", status: "online", location: "Bridge", serial: "UBQ2022A001" },
        { id: "ap-deck", name: "AP-Deck", category: "Network", model: "Ubiquiti UAP-AC-Pro", ip: "192.168.10.21", status: "online", location: "Aft Deck", serial: "UBQ2022A002" },

        // Cameras
        { id: "cam-bridge", name: "Cam-Bridge-01", category: "Camera", model: "Dahua IPC", ip: "192.168.10.51", status: "offline", location: "Bridge Ext", serial: "DH2023051201" },
        { id: "cam-saloon", name: "Cam-Saloon-01", category: "Camera", model: "Dahua IPC", ip: "192.168.10.52", status: "online", location: "Saloon", serial: "DH2023051202" },
        { id: "cam-deck1", name: "Cam-Deck-01", category: "Camera", model: "Dahua IPC", ip: "192.168.10.53", status: "online", location: "Fore Deck", serial: "DH2023051203" },
        { id: "cam-deck2", name: "Cam-Deck-02", category: "Camera", model: "Dahua IPC", ip: "192.168.10.54", status: "online", location: "Aft Deck", serial: "DH2023051204" },

        // AV equipment
        { id: "av-proc", name: "AV-Proc", category: "AV", model: "Crestron NVX", ip: "192.168.10.22", status: "online", location: "Saloon AV", serial: "CRE7462183" },
        { id: "qsys-core", name: "Q-SYS Core", category: "AV", model: "Q-SYS Core 110f", ip: "192.168.10.30", status: "online", location: "Bridge", serial: "QSC2021001" },

        // Server
        { id: "nas", name: "NAS-Storage", category: "Server", model: "Synology DS1522+", ip: "192.168.10.80", status: "online", location: "Engine", serial: "SYN2022001" },

        // Power
        { id: "ups-main", name: "UPS-Main", category: "Power", model: "APC Smart-UPS", ip: "192.168.10.90", status: "online", location: "Engine", serial: "AS1720140893" },
        { id: "ups-av", name: "UPS-AV", category: "Power", model: "APC Smart-UPS", ip: "192.168.10.91", status: "online", location: "Saloon AV", serial: "AS1820140112" },
      ],
      connections: [
        // Core router to switches
        { id: "c-router-bridge", source: "router-core", target: "sw-bridge", type: "Cat6A", source_port: "1" },
        { id: "c-router-saloon", source: "router-core", target: "sw-saloon", type: "Cat6A", source_port: "2" },
        { id: "c-router-deck", source: "router-core", target: "sw-deck", type: "Cat6A", source_port: "3" },
        
        // Switch interconnects
        { id: "c-bridge-saloon", source: "sw-bridge", target: "sw-saloon", type: "Cat6A", source_port: "24" },
        { id: "c-bridge-deck", source: "sw-bridge", target: "sw-deck", type: "Cat6A", source_port: "23" },
        
        // APs
        { id: "c-bridge-ap1", source: "sw-bridge", target: "ap-bridge", type: "Cat6", source_port: "5" },
        { id: "c-saloon-ap2", source: "sw-saloon", target: "ap-deck", type: "Cat6", source_port: "6" },
        
        // Cameras
        { id: "c-bridge-cam1", source: "sw-bridge", target: "cam-bridge", type: "Cat6", source_port: "7" },
        { id: "c-saloon-cam2", source: "sw-saloon", target: "cam-saloon", type: "Cat6", source_port: "8" },
        { id: "c-deck-cam1", source: "sw-deck", target: "cam-deck1", type: "Cat6", source_port: "9" },
        { id: "c-deck-cam2", source: "sw-deck", target: "cam-deck2", type: "Cat6", source_port: "10" },
        
        // AV equipment
        { id: "c-bridge-qsys", source: "sw-bridge", target: "qsys-core", type: "Cat6A", source_port: "11" },
        { id: "c-saloon-avproc", source: "sw-saloon", target: "av-proc", type: "Cat6A", source_port: "12" },
        
        // Server
        { id: "c-bridge-nas", source: "sw-bridge", target: "nas", type: "Cat6A", source_port: "13" },
        
        // Power
        { id: "c-bridge-ups", source: "sw-bridge", target: "ups-main", type: "Cat6", source_port: "14" },
        { id: "c-saloon-ups", source: "sw-saloon", target: "ups-av", type: "Cat6", source_port: "15" },
      ],
    };

    return Response.json(topologyData);
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});