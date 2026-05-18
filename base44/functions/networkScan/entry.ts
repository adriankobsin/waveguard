import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// MAC vendor prefix lookup (top 80 common vendors)
const VENDOR_MAP = {
  "00:00:0C": "Cisco", "00:01:42": "Cisco", "00:04:6B": "Cisco", "00:0A:41": "Cisco",
  "B8:27:EB": "Raspberry Pi", "DC:A6:32": "Raspberry Pi", "E4:5F:01": "Raspberry Pi",
  "00:50:56": "VMware", "00:0C:29": "VMware", "00:1C:42": "Parallels",
  "00:15:5D": "Microsoft Hyper-V", "00:03:FF": "Microsoft",
  "00:1A:11": "Google", "F4:F5:E8": "Google",
  "AC:BC:32": "Apple", "00:1B:63": "Apple", "00:1C:B3": "Apple", "3C:07:54": "Apple",
  "18:FE:34": "Espressif", "2C:F4:32": "Espressif", "A4:CF:12": "Espressif",
  "00:0F:BB": "MikroTik", "4C:5E:0C": "MikroTik", "48:8F:5A": "MikroTik",
  "00:1D:AA": "Dahua", "3C:EF:8C": "Dahua", "90:02:A9": "Dahua",
  "00:30:48": "Supermicro", "AC:1F:6B": "Supermicro",
  "00:50:BA": "D-Link", "00:19:5B": "D-Link", "1C:AF:F7": "D-Link",
  "00:1C:57": "Ubiquiti", "04:18:D6": "Ubiquiti", "24:A4:3C": "Ubiquiti",
  "00:23:EB": "Cisco Meraki", "0C:8D:DB": "Cisco Meraki", "88:15:44": "Cisco Meraki",
  "00:1D:E5": "AudioCodes", "00:90:8F": "AudioCodes",
  "00:40:9D": "Crestron", "00:10:7F": "Crestron",
  "00:50:C2": "DALI Gateway",
  "00:60:47": "Schneider Electric", "00:80:F4": "Schneider Electric",
  "00:1B:8F": "Synology", "00:11:32": "Synology",
  "00:17:88": "Philips Hue", "EC:B5:FA": "Philips",
  "00:07:32": "Siemens", "00:0E:8C": "Siemens",
  "00:1A:4B": "QSC", "00:16:E0": "QSC",
  "00:1D:FE": "APC/Schneider", "00:C0:B7": "APC",
};

function lookupVendor(mac) {
  if (!mac) return "Unknown";
  const prefix6 = mac.slice(0, 8).toUpperCase();
  const prefix8 = mac.slice(0, 11).toUpperCase();
  return VENDOR_MAP[prefix8] || VENDOR_MAP[prefix6] || "Unknown";
}

// Guess device category from hostname, vendor, or open ports
function guessCategory(hostname, vendor, ports) {
  const h = (hostname || "").toLowerCase();
  const v = (vendor || "").toLowerCase();
  if (h.includes("cam") || h.includes("nvr") || h.includes("ipc")) return "Camera";
  if (h.includes("ap-") || h.includes("uap") || h.includes("wifi") || v.includes("ubiquiti")) return "Network";
  if (h.includes("sw-") || h.includes("switch") || v.includes("cisco") || v.includes("mikrotik")) return "Network";
  if (h.includes("router") || h.includes("wan") || h.includes("fw-")) return "Network";
  if (h.includes("ups") || h.includes("apc")) return "Power";
  if (h.includes("nas") || h.includes("synology") || h.includes("qnap")) return "Server";
  if (h.includes("av-") || h.includes("crestron") || h.includes("qsys") || v.includes("crestron") || v.includes("qsc")) return "AV";
  if (h.includes("dali") || h.includes("knx") || h.includes("dmx") || h.includes("lutron")) return "Lighting";
  if (v.includes("raspberry")) return "Server";
  if (ports?.includes(80) || ports?.includes(443)) return "Network";
  return "Unknown";
}

// Generate a realistic mock scan result for a given subnet
function generateMockScan(subnet, count) {
  const base = subnet.split("/")[0].split(".");
  const prefix = `${base[0]}.${base[1]}.${base[2]}`;

  const MOCK_DEVICES = [
    { lastOctet: 1,   hostname: "router-wan",      mac: "00:0F:BB:12:34:56", vendor: "MikroTik",          ports: [22, 80, 443, 8291] },
    { lastOctet: 2,   hostname: "fw-main",          mac: "00:1A:4B:AB:CD:EF", vendor: "Cisco",             ports: [22, 443] },
    { lastOctet: 10,  hostname: "sw-bridge",        mac: "00:1C:57:AA:BB:CC", vendor: "Cisco",             ports: [22, 23, 80, 443, 161] },
    { lastOctet: 11,  hostname: "sw-saloon",        mac: "00:1C:57:DD:EE:FF", vendor: "Cisco",             ports: [22, 80, 443, 161] },
    { lastOctet: 12,  hostname: "sw-deck",          mac: "00:1C:57:11:22:33", vendor: "Cisco",             ports: [22, 80, 443, 161] },
    { lastOctet: 13,  hostname: "sw-engine",        mac: "00:1C:57:44:55:66", vendor: "Cisco",             ports: [22, 80, 161] },
    { lastOctet: 20,  hostname: "ap-bridge",        mac: "04:18:D6:77:88:99", vendor: "Ubiquiti",          ports: [22, 80, 443] },
    { lastOctet: 21,  hostname: "ap-deck",          mac: "04:18:D6:AA:BB:CC", vendor: "Ubiquiti",          ports: [22, 80, 443] },
    { lastOctet: 22,  hostname: "ap-saloon",        mac: "04:18:D6:DD:EE:FF", vendor: "Ubiquiti",          ports: [22, 80, 443] },
    { lastOctet: 30,  hostname: "av-proc-saloon",   mac: "00:40:9D:11:22:33", vendor: "Crestron",          ports: [41794, 41796, 80, 443] },
    { lastOctet: 31,  hostname: "av-matrix",        mac: "00:40:9D:44:55:66", vendor: "Crestron",          ports: [41794, 80] },
    { lastOctet: 32,  hostname: "qsys-core",        mac: "00:1A:4B:77:88:99", vendor: "QSC",               ports: [80, 443, 1702] },
    { lastOctet: 40,  hostname: "cam-bridge-01",    mac: "3C:EF:8C:AA:BB:CC", vendor: "Dahua",             ports: [80, 554, 37777] },
    { lastOctet: 41,  hostname: "cam-saloon-01",    mac: "3C:EF:8C:DD:EE:FF", vendor: "Dahua",             ports: [80, 554, 37777] },
    { lastOctet: 42,  hostname: "cam-deck-01",      mac: "3C:EF:8C:11:22:33", vendor: "Dahua",             ports: [80, 554] },
    { lastOctet: 43,  hostname: "cam-deck-02",      mac: "3C:EF:8C:44:55:66", vendor: "Dahua",             ports: [80, 554] },
    { lastOctet: 50,  hostname: "dali-gw-1",        mac: "00:50:C2:77:88:99", vendor: "DALI Gateway",      ports: [80, 502] },
    { lastOctet: 51,  hostname: "knx-gw-1",         mac: "00:07:32:AA:BB:CC", vendor: "Siemens",           ports: [3671, 80] },
    { lastOctet: 52,  hostname: "dmx-gw-1",         mac: "00:60:47:DD:EE:FF", vendor: "Schneider Electric",ports: [80, 5568] },
    { lastOctet: 80,  hostname: "nas-synology",     mac: "00:1B:8F:11:22:33", vendor: "Synology",          ports: [80, 443, 5000, 5001] },
    { lastOctet: 90,  hostname: "ups-main",         mac: "00:C0:B7:44:55:66", vendor: "APC",               ports: [80, 443, 161, 3052] },
    { lastOctet: 91,  hostname: "ups-av",           mac: "00:C0:B7:77:88:99", vendor: "APC",               ports: [80, 161] },
    { lastOctet: 100, hostname: "pi-guardian",      mac: "B8:27:EB:AA:BB:CC", vendor: "Raspberry Pi",      ports: [22, 3001, 5173] },
    { lastOctet: 110, hostname: "unknown-device",   mac: "F4:F5:E8:DD:EE:FF", vendor: "Unknown",           ports: [80] },
    { lastOctet: 120, hostname: "guest-laptop",     mac: "AC:BC:32:11:22:33", vendor: "Apple",             ports: [] },
  ];

  return MOCK_DEVICES.slice(0, count).map((d, i) => {
    const vendor = lookupVendor(d.mac) !== "Unknown" ? lookupVendor(d.mac) : d.vendor;
    return {
      id: `disc-${subnet.replace(/\//g, "-")}-${d.lastOctet}`,
      ip: `${prefix}.${d.lastOctet}`,
      hostname: d.hostname,
      mac: d.mac,
      vendor,
      category: guessCategory(d.hostname, vendor, d.ports),
      openPorts: d.ports,
      responseTimeMs: Math.round(Math.random() * 8 + 1),
      status: "discovered",
      classification: "unclassified",
      firstSeen: new Date().toISOString(),
      subnet,
    };
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { subnets = ["192.168.10.0/24"], scanType = "ping" } = body;

    // Simulate scan delay
    await new Promise(r => setTimeout(r, 1200));

    const results = [];
    const scanInterface = "eth0 (192.168.10.100)";

    for (const subnet of subnets) {
      // Vary device count per subnet
      const count = subnet === "192.168.10.0/24" ? 25 : Math.floor(Math.random() * 8) + 3;
      const devices = generateMockScan(subnet, count);
      results.push(...devices);
    }

    // De-duplicate by IP
    const seen = new Set();
    const unique = results.filter(d => {
      if (seen.has(d.ip)) return false;
      seen.add(d.ip);
      return true;
    });

    return Response.json({
      success: true,
      scanInterface,
      subnets,
      scanType,
      totalFound: unique.length,
      durationMs: 1200 + Math.round(Math.random() * 800),
      devices: unique,
      scannedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});