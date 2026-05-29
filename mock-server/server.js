import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  scan,
  scanTopology,
  detectLocalSubnets,
  getHealth,
  buildTopologyConnections,
  mapDevicesToTopology,
  pollSwitchPorts,
  testSwitchInterface,
  buildPollAllResponse,
  isSnmpWalkAvailable,
} from "../scanner/index.js";
import {
  SNMP_SWITCHES_SETTINGS_KEY,
  PEPLINK_CREDENTIALS_KEY,
  normalizeSnmpSwitchesState,
  normalizeSnmpSwitchProfile,
  mergePollIntoProfile,
  buildConnectionMap,
  portCountFromModel,
  buildDefaultProfileFields,
  profileIdForEquipment,
  normalizeSnmpPort,
} from "../src/lib/snmp/snmpSwitchProfiles.js";
import {
  CREDENTIALS_VAULT_KEY,
  normalizeCredentialsVault,
} from "../src/lib/credentials/credentialsVault.js";
import { mergePeplinkIntoPoll, buildMockPeplinkPoll } from "../src/lib/integrations/peplink/peplinkAdapter.js";
import { fetchPeplinkStatus, testPeplinkConnection } from "../scanner/integrations/peplinkPoll.js";
import { runWanSpeedTest } from "../scanner/integrations/wanSpeedTest.js";
import { buildMockLutronEngine } from "../src/lib/integrations/lutron/lutronAdapter.js";
import { buildMockKnxEngine } from "../src/lib/integrations/knx/knxAdapter.js";
import { buildMockDaliEngine } from "../src/lib/integrations/dali/daliAdapter.js";
import { buildMockDmxEngine } from "../src/lib/integrations/dmx/dmxAdapter.js";
import {
  getLutronClient,
  closeLutronClient,
  integrationIdFromHref,
  probeLutronPorts,
  recommendationFromPorts,
} from "../scanner/integrations/lutron/lutronClient.js";
import {
  getLeapClient,
  closeLeapClient,
  isPaired,
  startPairing,
  mockPairing,
  getPairingStatus,
  getPairingDetails,
  getPairedHosts,
  removePairedHost,
  cancelPairing,
  testConnection as testLeapConnection,
} from "../scanner/integrations/lutron/leapClient.js";
import { getKnxClient, closeKnxClient, probeKnxPorts, recommendationFromPorts as knxRecommendation } from "../scanner/integrations/knx/knxClient.js";
import { getDaliClient, closeDaliClient, probeDaliPorts, recommendationFromPorts as daliRecommendation } from "../scanner/integrations/dali/daliClient.js";
import { getDmxClient, closeDmxClient, probeDmxPorts, recommendationFromPorts as dmxRecommendation } from "../scanner/integrations/dmx/dmxClient.js";
import {
  getCiscoSwitchClient,
  closeCiscoSwitchClient,
  probeCiscoPorts,
  recommendationFromPorts as ciscoRecommendation,
} from "../scanner/integrations/cisco/ciscoSwitchClient.js";
import { mergeCiscoIntoPoll } from "../src/lib/integrations/cisco/ciscoAdapter.js";
import { LIGHTING_LUTRON_CONNECTION_KEY, LIGHTING_CONNECTION_KEY, defaultPortForProtocol } from "../src/lib/lighting/lightingSettings.js";
import {
  NETWORK_CISCO_SWITCHES_KEY,
  normalizeCiscoSwitches,
  normalizeCiscoSwitch,
  CISCO_LIVE_POLL_INTERVAL_MS,
  CISCO_BACKGROUND_POLL_INTERVAL_MS,
} from "../src/lib/network/ciscoSwitchSettings.js";
import { applyFactoryResetToDb, PLATFORM_RESET_CONFIRM } from "../src/lib/platformFactoryResetData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Set WAVEGUARD_USE_MOCK_SCAN=true only for demos without LAN access. */
const USE_MOCK_SCAN = process.env.WAVEGUARD_USE_MOCK_SCAN === "true";
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = 3002;
const APP_ID = "mock-app";

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `upload-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static(uploadsDir));

// ---- In-memory data store ----
const WAVE_ADMIN_PASSWORD = "Wave-avi23!";

const db = {
  users: [
    {
      id: "user-admin",
      username: "WaveAdmin",
      email: "waveadmin@local",
      name: "Wave Admin",
      full_name: "Wave Admin",
      role: "admin",
      password: WAVE_ADMIN_PASSWORD,
      created_date: new Date().toISOString(),
    },
    {
      id: "user-2",
      username: "tech",
      email: "tech@waveguard.test",
      name: "Tech User",
      full_name: "Tech User",
      role: "user",
      password: "password123",
      created_date: new Date().toISOString(),
    },
  ],
  backups: [],
  sessions: {},
  deviceGroups: [
    { id: "group-1", name: "Bridge Devices", description: "Equipment on the bridge deck", color: "cyan", icon: "network", device_ids: ["dev-1", "dev-2", "dev-3"], collapsed: false },
    { id: "group-2", name: "AV Rack", description: "Saloon AV equipment", color: "purple", icon: "av", device_ids: ["dev-4", "dev-5"], collapsed: false },
    { id: "group-3", name: "CCTV", description: "Camera system", color: "green", icon: "camera", device_ids: ["dev-6", "dev-7"], collapsed: true },
  ],
  cables: generateMockCables(25),
  maintenanceTasks: generateMockTasks(8),
  automationRules: [
    { id: "rule-1", name: "UPS Low Battery Alert", trigger: "event", condition: '{{event.type}} === "ups_low_battery"', action: "notify_all", enabled: true, fire_count: 12, created_date: new Date().toISOString() },
    { id: "rule-2", name: "Reboot Stuck Camera", trigger: "schedule", condition: "*/30 * * * *", action: "ping_check_cameras", enabled: false, fire_count: 3, created_date: new Date().toISOString() },
  ],
  actionLogs: generateMockLogs(20),
  systemSettings: [
    { id: "setting-1", key: "snmp_community", value: "public", category: "snmp" },
    { id: "setting-2", key: "scan_interval_minutes", value: "60", category: "discovery" },
    {
      id: "setting-discovery",
      key: "discovery",
      category: "discovery",
      value: {
        subnets: [],
        scanType: "ping",
        autoDetectLocalSubnets: true,
        snmpEnabled: true,
        snmpCommunity: "public",
        snmpVersion: "2c",
        maxConcurrent: 64,
        timeoutMs: 1500,
        agentUrl: "",
      },
    },
    {
      id: "setting-site-locations",
      key: "site-locations",
      category: "site",
      value: {
        decks: [
          { id: "deck-bridge", name: "Bridge", rooms: [
            { id: "room-bridge-rack", name: "Bridge Rack" },
            { id: "room-bridge-console", name: "Bridge Console" },
            { id: "room-bridge-mast", name: "Bridge Mast" },
          ]},
          { id: "deck-saloon", name: "Saloon", rooms: [
            { id: "room-saloon-av", name: "Saloon AV Rack" },
            { id: "room-saloon-cabinet", name: "Saloon Cabinet" },
            { id: "room-saloon-main", name: "Saloon" },
          ]},
          { id: "deck-engine", name: "Engine Room", rooms: [
            { id: "room-engine-main", name: "Engine Room" },
          ]},
          { id: "deck-upper", name: "Upper Deck", rooms: [
            { id: "room-upper-open", name: "Upper Deck" },
          ]},
          { id: "deck-fore", name: "Fore Deck", rooms: [
            { id: "room-fore-open", name: "Fore Deck" },
          ]},
          { id: "deck-aft", name: "Aft Deck", rooms: [
            { id: "room-aft-open", name: "Aft Deck" },
          ]},
        ],
      },
    },
  ],
  layoutTopology: [],
  equipment: generateMockEquipment(23),
  rackLayouts: [generateDefaultRackLayout()],
  signalLinks: generateSignalLinks(),
};

// ---- Helpers ----
function generateMockCables(count) {
  const types = ["Cat6", "Cat6A", "Cat7", "Fibre OM3", "HDMI 2.0", "SDI", "DMX", "Power IEC"];
  const systems = ["Network", "AV", "CCTV", "Power", "Comms", "Lighting"];
  const statuses = ["installed", "installed", "installed", "planned", "spare"];
  const from = ["Router-WAN", "SW-Bridge", "SW-CCTV", "UPS-Main", "SW-AV-Rack", "SW-Saloon", "Q-SYS-Core"];
  const to = ["SW-Bridge", "SW-CCTV", "Cam-Bow-01", "SW-AV-Rack", "SW-Saloon", "Cam-Stern-01", "AP-Bridge", "NAS-Main"];
  return Array.from({ length: count }, (_, i) => ({
    id: `cable-${i + 1}`,
    label: `C-${String(i + 1).padStart(3, "0")}`,
    type: types[i % types.length],
    system_category: systems[i % systems.length],
    from_equipment: from[i % from.length],
    to_equipment: to[(i + 2) % to.length],
    length: `${(Math.random() * 40 + 2).toFixed(1)}m`,
    deck: ["Bridge", "Saloon", "Engine Room", "Upper Deck", "Crew Cabin"][i % 5],
    status: statuses[i % statuses.length],
    notes: Math.random() > 0.5 ? `Cable run #${i + 1}` : "",
  }));
}

function generateMockTasks(count) {
  const now = Date.now();
  const tasks = [
    { title: "Inspect Bridge Rack Cooling Fans", category: "inspection", priority: "high" },
    { title: "Test UPS Battery Health", category: "test", priority: "critical" },
    { title: "Update Camera Firmware (Bridge Deck)", category: "firmware", priority: "medium" },
    { title: "Clean AV Rack Air Filters", category: "maintenance", priority: "low" },
    { title: "Verify SNMP Community Strings", category: "audit", priority: "medium" },
    { title: "Calibrate Gyro Stabilizer Interface", category: "calibration", priority: "high" },
    { title: "Patch Cabling Audit - Engine Room", category: "inspection", priority: "medium" },
    { title: "Replace UPS Battery Pack #2", category: "replacement", priority: "critical" },
  ];
  return tasks.map((t, i) => ({
    id: `task-${i + 1}`,
    title: t.title,
    category: t.category,
    priority: t.priority,
    status: ["pending", "in_progress", "completed", "pending", "pending", "pending", "completed", "scheduled"][i],
    next_due_at: new Date(now + (i + 1) * 7 * 86400000).toISOString(),
    last_performed_at: i < 2 ? new Date(now - (i + 5) * 86400000).toISOString() : null,
  }));
}

function generateMockLogs(count) {
  const actions = ["rule_fired", "cable_created", "device_updated", "scan_completed", "snmp_poll", "user_login"];
  const statuses = ["success", "success", "success", "error", "success"];
  return Array.from({ length: count }, (_, i) => ({
    id: `log-${i + 1}`,
    action: actions[i % actions.length],
    details: `Action #${i + 1} performed`,
    status: statuses[i % statuses.length],
    created_date: new Date(Date.now() - i * 3600000).toISOString(),
  }));
}

function enrichEquipmentMeta(item) {
  const n = (item.name || "").toLowerCase();
  const m = (item.model || "").toLowerCase();
  const cat = item.category || "Other";
  const base = {
    ruHeight: 1,
    defaultWatts: 35,
    controlType: "none",
    avRole: "none",
  };
  if (cat === "AV") {
    base.ruHeight = 2;
    base.defaultWatts = 85;
    base.controlType = "REST";
    if (m.includes("q-sys")) base.avRole = "dsp";
    else if (m.includes("nvx")) base.avRole = n.includes("enc") ? "encoder" : "decoder";
    else if (m.includes("qled") || n.startsWith("tv-")) base.avRole = "display";
    else base.avRole = "matrix";
  }
  if (cat === "Power") {
    base.ruHeight = 2;
    base.defaultWatts = 25;
  }
  if (cat === "Server" || (cat === "Network" && m.includes("synology"))) {
    base.ruHeight = 2;
    base.defaultWatts = 65;
    base.controlType = "REST";
  }
  if (cat === "Lighting" || m.includes("lutron")) {
    base.controlType = "KNX";
  }
  if (n.includes("cp4") || m.includes("cp4")) {
    base.controlType = "Crestron-CIP";
    base.ruHeight = 1;
    base.defaultWatts = 40;
  }
  if (m.includes("nvx")) base.controlType = "Crestron-CIP";

  const status = item.status || "online";
  const lanStatus = status === "online" ? "up" : status === "offline" ? "down" : "degraded";
  return {
    ruHeight: item.ruHeight ?? base.ruHeight,
    defaultWatts: item.defaultWatts ?? base.defaultWatts,
    controlType: item.controlType ?? base.controlType,
    avRole: item.avRole ?? base.avRole,
    telemetry: item.telemetry || {
      powerW: item.defaultWatts ?? base.defaultWatts,
      tempC: status === "warning" ? 48 : 36,
      lanStatus,
      lastSeen: new Date().toISOString(),
    },
  };
}

function generateMockEquipment(count) {
  const items = [
    { name: "SW-Bridge", model: "Cisco CBS350-24P", category: "Network", ip: "192.168.10.2", location: "Bridge Rack", serial: "FOC2241X0AB", condition: "Excellent" },
    { name: "SW-CCTV", model: "Cisco CBS350-8P", category: "Network", ip: "192.168.10.3", location: "Bridge Rack", serial: "FOC2241X0AC", condition: "Good" },
    { name: "Router-WAN", make: "Peplink", model: "Balance 2500 EC", category: "Network", ip: "10.0.0.1", location: "Bridge Rack", serial: "PPL-B2500-001", condition: "Excellent", notes: "Primary WAN router — Starlink + 4G failover" },
    { name: "UPS-Main", model: "APC SRT 3000", category: "Power", ip: "192.168.10.100", location: "Engine Room", serial: "APC-SRT-001", condition: "Good" },
    { name: "Cam-Bow-01", model: "Dahua IPC-HFW2831T", category: "Camera", ip: "192.168.20.10", location: "Bow - External", serial: "DAHUA-001", condition: "Fair" },
    { name: "Cam-Stern-01", model: "Dahua IPC-HFW2831T", category: "Camera", ip: "192.168.20.11", location: "Stern - External", serial: "DAHUA-002", condition: "Excellent" },
    { name: "Cam-Saloon-01", model: "Dahua IPC-HDW2831T", category: "Camera", ip: "192.168.20.12", location: "Saloon Ceiling", serial: "DAHUA-003", condition: "Good" },
    { name: "AP-Bridge", model: "Ubiquiti U6 Pro", category: "Network", ip: "192.168.10.50", location: "Bridge Ceiling", serial: "U6PRO-001", condition: "Excellent" },
    { name: "AP-Saloon", model: "Ubiquiti U6 Pro", category: "Network", ip: "192.168.10.51", location: "Saloon Ceiling", serial: "U6PRO-002", condition: "Good" },
    { name: "NAS-Main", model: "Synology DS1621+", category: "Server", ip: "192.168.10.20", location: "Bridge Rack", serial: "SYNO-001", condition: "Excellent" },
    { name: "Q-SYS-Core", model: "QSC Core 110f", category: "AV", ip: "192.168.30.2", location: "AV Rack", serial: "QSC-001", condition: "Excellent", avRole: "dsp", controlType: "REST" },
    { name: "TV-Saloon-01", model: "Samsung QLED 75\"", category: "AV", ip: "192.168.30.10", location: "Saloon Wall", serial: "SAM-001", condition: "Good", avRole: "display", ruHeight: 1 },
    { name: "TV-Saloon-02", model: "Samsung QLED 55\"", category: "AV", ip: "192.168.30.11", location: "Saloon Wall", serial: "SAM-002", condition: "Good", avRole: "display", ruHeight: 1 },
    { name: "Lighting-Controller", model: "Lutron QS", category: "Lighting", ip: "192.168.40.2", location: "AV Rack", serial: "LUT-001", condition: "Good", controlType: "KNX" },
    { name: "KNX-Gateway", model: "KNX IP Router 753", category: "Lighting", ip: "192.168.40.10", location: "AV Rack", serial: "KNX-001", condition: "Good", controlType: "KNX" },
    { name: "DALI-Gateway", model: "DALI USB 2.0 LC", category: "Lighting", ip: "192.168.40.11", location: "AV Rack", serial: "DALI-001", condition: "Good", controlType: "DALI" },
    { name: "Art-Net-Node", model: "DMX King Art-Net Pro", category: "Lighting", ip: "192.168.40.12", location: "Stage Rack", serial: "DMX-001", condition: "Good", controlType: "Art-Net" },
    { name: "Sirius-Weather", model: "Sirius XM Weather", category: "Other", ip: "192.168.10.200", location: "Bridge Console", serial: "SIRIUS-001", condition: "Excellent" },
    { name: "Starlink", model: "Starlink Standard", category: "Network", ip: "10.0.0.2", location: "Upper Deck", serial: "SLINK-001", condition: "Good" },
    { name: "SW-AV-Rack", model: "Cisco CBS350-8P", category: "Network", ip: "192.168.30.1", location: "AV Rack", serial: "FOC2241X0AD", condition: "Excellent" },
    { name: "CP4-Bridge", model: "Crestron CP4", category: "AV", ip: "192.168.30.5", location: "Bridge Rack", serial: "CRE-CP4-001", condition: "Excellent", controlType: "Crestron-CIP", ruHeight: 1, defaultWatts: 40, avRole: "none" },
    { name: "NVX-Encoder-Saloon", model: "Crestron NVX-350", category: "AV", ip: "192.168.30.22", location: "Saloon AV", serial: "CRE7462183", condition: "Excellent", avRole: "encoder", controlType: "Crestron-CIP" },
    { name: "NVX-Decoder-Saloon", model: "Crestron NVX-350", category: "AV", ip: "192.168.30.23", location: "Saloon AV", serial: "CRE7462184", condition: "Excellent", avRole: "decoder", controlType: "Crestron-CIP" },
    { name: "SW-Saloon", model: "Cisco CBS350-16T", category: "Network", ip: "192.168.10.4", location: "Saloon Cabinet", serial: "FOC2241X0AE", condition: "Good" },
    { name: "UPS-AV", model: "APC Smart-UPS 750VA", category: "Power", ip: "192.168.10.91", location: "Saloon AV", serial: "AS1820140112", condition: "Good" },
  ];
  return items.slice(0, count).map((item, i) => {
    const meta = enrichEquipmentMeta(item);
    return {
      id: `dev-${i + 1}`,
      ...item,
      ...meta,
      notes: "",
      created_date: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
      updated_date: new Date().toISOString(),
    };
  });
}

function generateSignalLinks() {
  return [
    { id: "sig-ctrl-1", kind: "control", protocol: "Crestron-CIP", sourceEquipmentId: "dev-18", targetEquipmentId: "dev-11", label: "CP4 → Q-SYS", status: "active" },
    { id: "sig-ctrl-2", kind: "control", protocol: "Crestron-CIP", sourceEquipmentId: "dev-18", targetEquipmentId: "dev-19", label: "CP4 → NVX Encoder", status: "active" },
    { id: "sig-ctrl-3", kind: "control", protocol: "Crestron-CIP", sourceEquipmentId: "dev-18", targetEquipmentId: "dev-20", label: "CP4 → NVX Decoder", status: "active" },
    { id: "sig-ctrl-4", kind: "control", protocol: "KNX", sourceEquipmentId: "dev-18", targetEquipmentId: "dev-14", label: "CP4 → Lighting", status: "active" },
    { id: "sig-ctrl-5", kind: "control", protocol: "REST", sourceEquipmentId: "dev-18", targetEquipmentId: "dev-10", label: "CP4 → NAS", status: "active" },
    { id: "sig-av-1", kind: "av", protocol: "Dante", sourceEquipmentId: "dev-11", targetEquipmentId: "dev-19", label: "Salon program audio", multicast: "239.69.12.1:5004", status: "active" },
    { id: "sig-av-2", kind: "av", protocol: "NVX", sourceEquipmentId: "dev-19", targetEquipmentId: "dev-20", label: "Salon HDMI matrix", multicast: "239.69.12.2:5004", status: "active" },
    { id: "sig-av-3", kind: "av", protocol: "NVX", sourceEquipmentId: "dev-20", targetEquipmentId: "dev-12", label: "Salon main display", multicast: "239.69.12.3:5004", status: "active" },
    { id: "sig-av-4", kind: "av", protocol: "HDMI", sourceEquipmentId: "dev-20", targetEquipmentId: "dev-13", label: "Secondary display", status: "active" },
  ];
}

function generateDefaultRackLayout() {
  return {
    id: "rack-layout-default",
    name: "Default vessel layout",
    is_default: true,
    racks: [
      {
        id: "rack-bridge",
        name: "Bridge Rack",
        deckId: "deck-bridge",
        roomId: "room-bridge-rack",
        location: "Bridge · Bridge Rack",
        units: 12,
      },
      {
        id: "rack-saloon",
        name: "Saloon AV Rack",
        deckId: "deck-saloon",
        roomId: "room-saloon-av",
        location: "Saloon · Saloon AV Rack",
        units: 9,
      },
      {
        id: "rack-engine",
        name: "Engine Room Rack",
        deckId: "deck-engine",
        roomId: "room-engine-main",
        location: "Engine Room · Engine Room",
        units: 8,
      },
    ],
    placements: [
      { rackId: "rack-bridge", equipmentId: "dev-3", ruStart: 1, ruHeight: 1 },
      { rackId: "rack-bridge", equipmentId: "dev-1", ruStart: 2, ruHeight: 1 },
      { rackId: "rack-bridge", equipmentId: "dev-18", ruStart: 3, ruHeight: 1 },
      { rackId: "rack-bridge", equipmentId: "dev-11", ruStart: 4, ruHeight: 2 },
      { rackId: "rack-saloon", equipmentId: "dev-21", ruStart: 1, ruHeight: 1 },
      { rackId: "rack-saloon", equipmentId: "dev-19", ruStart: 2, ruHeight: 2 },
      { rackId: "rack-saloon", equipmentId: "dev-20", ruStart: 4, ruHeight: 2 },
      { rackId: "rack-saloon", equipmentId: "dev-22", ruStart: 7, ruHeight: 2 },
      { rackId: "rack-engine", equipmentId: "dev-10", ruStart: 1, ruHeight: 2 },
      { rackId: "rack-engine", equipmentId: "dev-4", ruStart: 5, ruHeight: 3 },
    ],
    created_date: new Date().toISOString(),
  };
}

const DEVICE_STATUS_POOL = ["online", "online", "online", "online", "warning", "offline"];

function normalizeEquipmentRow(e, idx = 0) {
  const status = e.status || DEVICE_STATUS_POOL[idx % DEVICE_STATUS_POOL.length];
  const meta = enrichEquipmentMeta({ ...e, status });
  return {
    ...e,
    status,
    ...meta,
    telemetry: e.telemetry || meta.telemetry,
  };
}

function getMockDevices() {
  const devices = db.equipment.map((e, idx) => {
    const status = e.status || DEVICE_STATUS_POOL[idx % DEVICE_STATUS_POOL.length];
    const meta = enrichEquipmentMeta({ ...e, status });
    return {
      id: e.id,
      name: e.name,
      ip: e.ip,
      mac: e.mac || `00:1A:${String((idx * 17) % 255).padStart(2, "0")}:${String((idx * 31) % 255).padStart(2, "0")}:${String((idx * 47) % 255).padStart(2, "0")}:${String((idx * 61) % 255).padStart(2, "0")}`,
      hostname: e.name.toLowerCase().replace(/\s+/g, "-"),
      vendor: e.model.split(" ")[0],
      model: e.model,
      category: e.category,
      status,
      location: e.location,
      serial: e.serial,
      firmware: e.firmware || "",
      notes: e.notes || "",
      subnet: e.ip?.includes(".") ? e.ip.substring(0, e.ip.lastIndexOf(".")) + ".0/24" : "",
      openPorts: [22, 80, 443, 161, ...(e.category === "Camera" ? [554, 37777] : []), ...(e.category === "AV" ? [1702] : [])],
      responseTimeMs: Math.floor(Math.random() * 80 + 1),
      firstSeen: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
      ruHeight: meta.ruHeight,
      defaultWatts: meta.defaultWatts,
      controlType: meta.controlType,
      avRole: meta.avRole,
      telemetry: meta.telemetry,
    };
  });
  return devices;
}

function equipmentToTopologyNode(e) {
  return {
    id: e.id,
    name: e.name,
    category: e.category || "Unknown",
    model: e.model || e.vendor || "Unknown",
    ip: e.ip,
    mac: e.mac || "",
    status: e.status || "online",
    location: e.location || "",
    serial: e.serial || "",
    firmware: e.firmware || "",
    notes: e.notes || "",
    hostname: e.name,
    vendor: e.vendor || "",
    openPorts: e.openPorts || [],
  };
}

/** Merge registered monitored/inventory equipment into a topology scan result. */
function mergeRegisteredEquipmentIntoTopology(scanResult) {
  const registered = db.equipment.filter(
    (e) =>
      e.ip &&
      (e.waveguardClassification === "monitored" || e.waveguardClassification === "inventory")
  );
  const byIp = new Map((scanResult.devices || []).map((d) => [d.ip, d]));
  for (const eq of registered) {
    const node = equipmentToTopologyNode(eq);
    if (byIp.has(eq.ip)) {
      byIp.set(eq.ip, { ...byIp.get(eq.ip), ...node, id: eq.id });
    } else {
      byIp.set(eq.ip, node);
    }
  }
  const devices = [...byIp.values()];
  return {
    ...scanResult,
    devices,
    connections: buildTopologyConnections(devices),
    stats: {
      online: devices.filter((d) => d.status === "online").length,
      warning: devices.filter((d) => d.status === "warning").length,
      offline: devices.filter((d) => d.status === "offline").length,
      active_connections: buildTopologyConnections(devices).length,
    },
  };
}

function getTopologyScanResult() {
  const devices = getMockDevices();
  const connections = [];
  const pairs = [
    ["dev-3", "dev-1"], ["dev-1", "dev-2"], ["dev-2", "dev-6"], ["dev-2", "dev-7"],
    ["dev-1", "dev-8"], ["dev-1", "dev-9"], ["dev-1", "dev-10"], ["dev-3", "dev-4"],
    ["dev-3", "dev-5"], ["dev-4", "dev-11"], ["dev-17", "dev-12"], ["dev-17", "dev-13"],
    ["dev-17", "dev-14"], ["dev-1", "dev-15"], ["dev-3", "dev-16"],
  ];
  for (const [src, dst] of pairs) {
    const srcDev = devices.find(d => d.id === src);
    const dstDev = devices.find(d => d.id === dst);
    if (srcDev && dstDev) {
      connections.push({
        id: `conn-${src}-${dst}`,
        source: src,
        target: dst,
        source_id: src,
        target_id: dst,
        type: Math.random() > 0.5 ? "cable" : "wireless",
        label: srcDev.name + " ↔ " + dstDev.name,
      });
    }
  }
  return {
    success: true,
    devices,
    connections,
    stats: {
      online: devices.filter(d => d.status === "online").length,
      warning: devices.filter(d => d.status === "warning").length,
      offline: devices.filter(d => d.status === "offline").length,
      active_connections: connections.length,
    },
    scanned_at: new Date().toISOString(),
  };
}

// ============================================================
// AUTH
// ============================================================
function findUserByIdentifier(identifier) {
  const id = (identifier || "").trim().toLowerCase();
  return db.users.find(
    (u) =>
      u.email?.toLowerCase() === id ||
      u.username?.toLowerCase() === id
  );
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

app.post("/api/apps/:appId/auth/login", (req, res) => {
  const { email, password, username } = req.body;
  const identifier = email || username;
  const user = findUserByIdentifier(identifier);
  if (!user || password !== user.password) {
    return res.status(401).json({ message: "Invalid username or password", code: "auth_error" });
  }
  const token = "mock-access-token-" + Date.now();
  db.sessions[token] = user.id;
  res.json({ access_token: token, user: sanitizeUser(user), expires_in: 86400 });
});

app.post("/api/apps/:appId/auth/register", (req, res) => {
  const { email, password } = req.body;
  const user = { id: "user-" + Date.now(), email, name: email.split("@")[0], role: "user", created_date: new Date().toISOString() };
  db.users.push(user);
  res.json({ message: "Registration successful. Please verify your email.", user_id: user.id });
});

app.post("/api/apps/:appId/auth/verify-otp", (req, res) => {
  res.json({ access_token: "mock-access-token-" + Date.now(), message: "Email verified successfully" });
});

app.post("/api/apps/:appId/auth/resend-otp", (req, res) => {
  res.json({ message: "OTP resent successfully" });
});

app.post("/api/apps/:appId/auth/reset-password-request", (req, res) => {
  res.json({ message: "If the email exists, a reset link has been sent." });
});

app.post("/api/apps/:appId/auth/reset-password", (req, res) => {
  res.json({ message: "Password has been reset successfully." });
});

app.post("/api/apps/:appId/auth/change-password", (req, res) => {
  res.json({ message: "Password changed successfully." });
});

app.get("/api/apps/:appId/entities/User/me", (req, res) => {
  const user = getRequestUser(req);
  res.json(sanitizeUser(user || db.users[0]));
});

app.put("/api/apps/:appId/entities/User/me", (req, res) => {
  Object.assign(db.users[0], req.body);
  res.json(db.users[0]);
});

app.post("/api/apps/:appId/runtime/users/invite-user", (req, res) => {
  const { user_email, userEmail, role } = req.body;
  const email = user_email || userEmail;
  const user = { id: "user-" + Date.now(), email, name: email.split("@")[0], role: role || "user", created_date: new Date().toISOString() };
  db.users.push(user);
  res.json({ message: "Invitation sent", user, data: user });
});

app.post("/api/apps/:appId/users/invite-user", (req, res) => {
  const { userEmail, role } = req.body;
  const user = { id: "user-" + Date.now(), email: userEmail, name: userEmail.split("@")[0], role: role || "user", created_date: new Date().toISOString() };
  db.users.push(user);
  res.json({ message: "Invitation sent", user });
});

// ============================================================
// FUNCTIONS
// ============================================================
function getDiscoverySettings() {
  const row = db.systemSettings.find((s) => s.key === "discovery");
  const v = row?.value && typeof row.value === "object" ? row.value : {};
  return {
    subnets: v.subnets || ["192.168.10.0/24"],
    scanType: v.scanType || "ping",
    autoDetectLocalSubnets: v.autoDetectLocalSubnets !== false,
    snmpEnabled: v.snmpEnabled !== false,
    snmpCommunity: v.snmpCommunity || db.systemSettings.find((s) => s.key === "snmp_community")?.value || "public",
    snmpVersion: v.snmpVersion || "2c",
    maxConcurrent: v.maxConcurrent || 64,
    timeoutMs: v.timeoutMs || 1500,
    agentUrl: v.agentUrl || "",
  };
}

function mergeScanOptions(body = {}) {
  const saved = getDiscoverySettings();
  let subnets = body.subnets?.length ? body.subnets : saved.subnets;
  const autoDetect = body.autoDetectLocalSubnets ?? saved.autoDetectLocalSubnets;
  if (autoDetect) {
    const local = detectLocalSubnets();
    if (local.length) subnets = [...new Set([...(subnets || []), ...local])];
  }
  if (!subnets?.length) {
    const local = detectLocalSubnets();
    if (local.length) subnets = local;
  }
  return {
    subnets,
    scanType: body.scanType || saved.scanType,
    target: body.target,
    maxConcurrent: body.maxConcurrent ?? saved.maxConcurrent,
    timeoutMs: body.timeoutMs ?? saved.timeoutMs,
    snmpEnabled: body.snmpEnabled ?? saved.snmpEnabled,
    snmpCommunity: body.snmpCommunity || saved.snmpCommunity,
    snmpVersion: body.snmpVersion || saved.snmpVersion,
  };
}

app.get("/api/apps/:appId/scanner/health", (_req, res) => {
  res.json(getHealth());
});

app.post("/api/apps/:appId/functions/discoverSubnets", (_req, res) => {
  const subnets = detectLocalSubnets();
  res.json({ success: true, subnets, scanInterface: getHealth().scanInterface });
});

function mapMockDiscoveryDevices(rawDevices, scanType, scanSubnets) {
  const subnet = scanSubnets?.[0] || "192.168.10.0/24";
  return rawDevices.map((d, idx) => ({
    id: d.id || `disc-${String(d.ip || idx).replace(/\./g, "-")}`,
    ip: d.ip,
    hostname: d.hostname || d.name || d.ip,
    mac: d.mac || "",
    vendor: d.vendor || (d.model ? String(d.model).split(" ")[0] : ""),
    model: d.model || "",
    category: d.category || "Unknown",
    openPorts:
      d.openPorts ||
      (scanType === "full" ? [22, 80, 443, 161] : scanType === "arp" ? [80] : []),
    responseTimeMs: d.responseTimeMs ?? Math.floor(Math.random() * 40 + 5),
    status: "discovered",
    classification: "unclassified",
    firstSeen: d.firstSeen || new Date().toISOString(),
    subnet: d.subnet || subnet,
  }));
}

app.post("/api/apps/:appId/functions/networkScan", async (req, res) => {
  if (USE_MOCK_SCAN) {
    const { subnets, scanType, target } = req.body;
    const scanSubnets = subnets || ["192.168.10.0/24"];
    const mode = scanType || "ping";
    const raw = getMockDevices();
    const devices = mapMockDiscoveryDevices(raw, mode, scanSubnets);
    if (target) {
      const device =
        devices.find((d) => d.ip === target) ||
        mapMockDiscoveryDevices(
          [
            {
              id: "scan-" + Date.now(),
              name: target,
              ip: target,
              hostname: target,
              category: "Network",
              openPorts: mode === "full" ? [22, 80, 443] : [],
              responseTimeMs: Math.floor(Math.random() * 40 + 5),
            },
          ],
          mode,
          scanSubnets
        )[0];
      return res.json({
        success: true,
        devices: [device],
        target,
        totalFound: 1,
        scanInterface: "eth0",
        durationMs: mode === "full" ? 1200 : 200,
        subnets: scanSubnets,
        scanType: mode,
        scannedAt: new Date().toISOString(),
      });
    }
    return res.json({
      success: true,
      devices,
      totalFound: devices.length,
      scanInterface: "eth0",
      durationMs: mode === "full" ? 2500 : 1500,
      subnets: scanSubnets,
      scanType: mode,
      scannedAt: new Date().toISOString(),
    });
  }

  try {
    const result = await scan(mergeScanOptions(req.body));
    res.json(result);
  } catch (err) {
    console.error("[networkScan]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/apps/:appId/functions/snmpTopologyScan", async (req, res) => {
  if (USE_MOCK_SCAN) {
    const result = mergeRegisteredEquipmentIntoTopology(getTopologyScanResult());
    return setTimeout(() => res.json(result), 800);
  }

  try {
    const result = mergeRegisteredEquipmentIntoTopology(
      await scanTopology(mergeScanOptions(req.body))
    );
    res.json(result);
  } catch (err) {
    console.error("[snmpTopologyScan]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/apps/:appId/functions/registerDiscoveredDevice", (req, res) => {
  try {
    const { device, classification } = req.body || {};
    if (!device?.ip) {
      return res.status(400).json({ success: false, error: "device.ip is required" });
    }
    if (!classification || classification === "unclassified") {
      return res.json({ success: true, skipped: true });
    }

    const stableId = `eq-${String(device.ip).replace(/\./g, "-")}`;
    const name =
      device.hostname && device.hostname !== device.ip
        ? device.hostname
        : `${device.vendor || "Device"} ${device.ip}`;

    let record = db.equipment.find((e) => e.ip === device.ip || e.id === stableId);
    const payload = {
      id: stableId,
      name,
      model: device.model || device.vendor || "Unknown",
      category: device.category || "Unknown",
      ip: device.ip,
      mac: device.mac || "",
      location: device.location || "",
      serial: "",
      condition: "Good",
      waveguardClassification: classification,
      monitoringEnabled: classification === "monitored",
      inventoryOnly: classification === "inventory",
      vendor: device.vendor || "",
      openPorts: device.openPorts || [],
      status: "online",
      ...enrichEquipmentMeta({
        name,
        model: device.model || device.vendor,
        category: device.category || "Unknown",
        status: "online",
      }),
    };

    if (record) {
      Object.assign(record, payload, { updated_date: new Date().toISOString() });
    } else {
      record = {
        ...payload,
        notes: `Discovered on ${device.subnet || "network scan"}`,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      db.equipment.push(record);
    }

    const groupsUpdated = [];
    if (classification === "monitored" || classification === "inventory") {
      const cat = (record.category || "").toLowerCase();
      const loc = (record.location || "").toLowerCase();
      for (const group of db.deviceGroups) {
        const hay = `${group.name} ${group.description || ""} ${group.icon || ""}`.toLowerCase();
        let hit = false;
        if (cat === "camera" && (hay.includes("cctv") || hay.includes("camera"))) hit = true;
        if (cat === "network" && hay.includes("network")) hit = true;
        if (cat === "av" && hay.includes("av")) hit = true;
        if (loc && hay.split(" ").some((w) => loc.includes(w) && w.length > 3)) hit = true;
        if (hit) {
          if (!group.device_ids.includes(record.id)) {
            group.device_ids.push(record.id);
            groupsUpdated.push(group.id);
          }
        }
      }
    } else if (classification === "ignored") {
      for (const group of db.deviceGroups) {
        group.device_ids = (group.device_ids || []).filter((id) => id !== record.id);
      }
    }

    res.json({ success: true, equipment: record, groupsUpdated, classification });
  } catch (err) {
    console.error("[registerDiscoveredDevice]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function getSnmpSwitchesState() {
  const row = db.systemSettings.find((s) => s.key === SNMP_SWITCHES_SETTINGS_KEY);
  let raw = row?.value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return normalizeSnmpSwitchesState(raw || { profiles: [] });
}

/** Ensure Router-WAN is registered in Core Network with polled Peplink WAN ports. */
function ensureDefaultWanRouterProfile() {
  const routerEq = db.equipment.find((e) => /router-wan/i.test(e.name || ""));
  if (!routerEq) return;

  const state = getSnmpSwitchesState();
  let profile = state.profiles.find((p) => p.equipmentId === routerEq.id);
  if (!profile) {
    const defaults = buildDefaultProfileFields(routerEq);
    profile = normalizeSnmpSwitchProfile({
      equipmentId: routerEq.id,
      location: routerEq.location || "",
      ...defaults,
      enabled: true,
    });
    state.profiles.push(profile);
  }

  const hasWanPorts = (profile.lastPoll?.ports || []).some(
    (p) => p.meta?.type === "wan" || p.meta?.type === "cellular" || /wan|cell/i.test(p.name || "")
  );
  if (!hasWanPorts) {
    const ip = equipmentIp(routerEq);
    const pep = buildMockPeplinkPoll(routerEq.model, ip);
    const poll = {
      ...pep,
      sysName: routerEq.name,
      ports: (pep.ports || []).map((p) => normalizeSnmpPort(p)).filter(Boolean),
    };
    const updated = mergePollIntoProfile(profile, poll, { equipment: routerEq });
    const idx = state.profiles.findIndex((p) => p.id === updated.id);
    if (idx >= 0) state.profiles[idx] = updated;
    else state.profiles.push(updated);
    saveSnmpSwitchesState(state);
  }
}

function resolveWanProfile(profileId) {
  const state = getSnmpSwitchesState();
  let profile = state.profiles.find((p) => p.id === profileId);
  if (profile) return { profile, state };

  const equipmentId = String(profileId || "").replace(/^snmp-sw-/, "");
  const eq = db.equipment.find((e) => e.id === equipmentId);
  if (!eq) return { profile: null, state };

  const defaults = buildDefaultProfileFields(eq);
  profile = normalizeSnmpSwitchProfile({
    id: profileIdForEquipment(eq.id),
    equipmentId: eq.id,
    location: eq.location || "",
    ...defaults,
    enabled: true,
  });
  return { profile, state };
}

function saveSnmpSwitchesState(state) {
  const normalized = normalizeSnmpSwitchesState(state);
  const row = db.systemSettings.find((s) => s.key === SNMP_SWITCHES_SETTINGS_KEY);
  if (row) row.value = normalized;
  else {
    db.systemSettings.push({
      id: `setting-${Date.now()}`,
      key: SNMP_SWITCHES_SETTINGS_KEY,
      value: normalized,
    });
  }
  return normalized;
}

function syncProfileEquipmentLocation(profile) {
  const eq = db.equipment.find((e) => e.id === profile.equipmentId);
  if (!eq) return;
  if (profile.deckId != null) eq.deckId = profile.deckId;
  if (profile.roomId != null) eq.roomId = profile.roomId;
  if (profile.location != null) eq.location = profile.location;
  eq.updated_date = new Date().toISOString();
}

function equipmentIp(eq) {
  return String(eq?.ip ?? eq?.ip_address ?? eq?.ipAddress ?? "").trim();
}

function resolveProfilePollOpts(profile) {
  const eq = db.equipment.find((e) => e.id === profile.equipmentId);
  const disc = getDiscoverySettings();
  return {
    ip: equipmentIp(eq),
    name: eq?.name || profile.id,
    community: profile.snmpCommunity || disc.snmpCommunity,
    version: profile.snmpVersion || disc.snmpVersion,
    timeoutMs: disc.timeoutMs,
    portCount: portCountFromModel(eq?.model, profile.portCount),
    equipmentList: db.equipment,
    counterSnapshot: profile.counterSnapshot,
    lastPollAt: profile.lastPollAt,
    forceMock: !disc.snmpEnabled,
  };
}

function getPeplinkCredentials() {
  const row = db.systemSettings.find((s) => s.key === PEPLINK_CREDENTIALS_KEY);
  let raw = row?.value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return raw || {
    incontrolClientId: process.env.PEPLINK_INCONTROL_CLIENT_ID || "",
    incontrolClientSecret: process.env.PEPLINK_INCONTROL_CLIENT_SECRET || "",
    incontrolOrgId: process.env.PEPLINK_INCONTROL_ORG_ID || "",
  };
}

function savePeplinkCredentials(creds) {
  const row = db.systemSettings.find((s) => s.key === PEPLINK_CREDENTIALS_KEY);
  if (row) row.value = creds;
  else {
    db.systemSettings.push({
      id: `setting-peplink-${Date.now()}`,
      key: PEPLINK_CREDENTIALS_KEY,
      value: creds,
    });
  }
  return creds;
}

async function pollProfileAndSave(profile) {
  const opts = resolveProfilePollOpts(profile);
  if (!opts.ip) {
    return { profile, poll: null, error: "Device has no IP address in Equipment" };
  }
  const eq = db.equipment.find((e) => e.id === profile.equipmentId);
  const disc = getDiscoverySettings();
  let poll = await pollSwitchPorts(opts.ip, opts);

  const usePeplink =
    profile.pollMethod === "peplink_hybrid" || profile.integrationVendor === "peplink";
  if (usePeplink) {
    try {
      const pep = await fetchPeplinkStatus(profile, {
        ip: opts.ip,
        equipment: eq,
        forceMock: !disc.snmpEnabled || process.env.PEPLINK_USE_MOCK === "1",
        globalPeplinkCreds: getPeplinkCredentials(),
      });
      poll = mergePeplinkIntoPoll(poll, pep);
    } catch (err) {
      console.warn("[pollProfileAndSave] Peplink enrich failed:", err.message);
      if (!poll?.ports?.length) {
        poll = { ...poll, error: err.message };
      }
    }
  }

  const useCisco =
    profile.pollMethod === "cisco_ssh" || profile.integrationVendor === "cisco";
  if (useCisco) {
    try {
      const ciscoConn = resolveCiscoConnectionForProfile(profile, eq);
      if (ciscoConn) {
        const client = getCiscoSwitchClient(ciscoConn);
        const snapshot = await client.pollAll({
          snmpCommunity: profile.snmpCommunity || disc.snmpCommunity,
          snmpVersion: profile.snmpVersion === "3" ? "3" : "2c",
        });
        poll = mergeCiscoIntoPoll(poll, snapshot, eq);
      }
    } catch (err) {
      console.warn("[pollProfileAndSave] Cisco enrich failed:", err.message);
      if (!poll?.ports?.length) {
        poll = { ...poll, error: err.message };
      }
    }
  }

  const global = getSnmpSwitchesState().global;
  const updated = mergePollIntoProfile(profile, poll, {
    trafficHistorySamples: global?.trafficHistorySamples,
    equipment: eq,
  });
  return { profile: updated, poll, error: poll.error };
}

app.get("/api/apps/:appId/snmp/switches", (_req, res) => {
  res.json(getSnmpSwitchesState());
});

app.put("/api/apps/:appId/snmp/switches", (req, res) => {
  const state = saveSnmpSwitchesState(req.body);
  for (const p of state.profiles) syncProfileEquipmentLocation(p);
  res.json(state);
});

app.post("/api/apps/:appId/functions/snmpPollSwitch", async (req, res) => {
  try {
    const { equipmentId, ip } = req.body || {};
    const state = getSnmpSwitchesState();
    let profile = state.profiles.find((p) => p.equipmentId === equipmentId);
    if (!profile && ip) {
      const eq = db.equipment.find((e) => e.ip === ip);
      if (eq) profile = state.profiles.find((p) => p.equipmentId === eq.id);
    }
    if (!profile) {
      return res.status(404).json({ success: false, error: "Managed switch profile not found" });
    }
    const { profile: updated, poll, error } = await pollProfileAndSave(profile);
    const idx = state.profiles.findIndex((p) => p.id === updated.id);
    if (idx >= 0) state.profiles[idx] = updated;
    saveSnmpSwitchesState(state);
    res.json({
      success: true,
      profile: updated,
      poll,
      snmpWalkAvailable: await isSnmpWalkAvailable(),
      source: poll.source,
      error,
    });
  } catch (err) {
    console.error("[snmpPollSwitch]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/apps/:appId/functions/snmpPollAll", async (_req, res) => {
  try {
    const state = getSnmpSwitchesState();
    const enabled = state.profiles.filter((p) => p.enabled !== false);
    const pollResults = [];
    for (const profile of enabled) {
      const { profile: updated, poll, error } = await pollProfileAndSave(profile);
      const idx = state.profiles.findIndex((p) => p.id === updated.id);
      if (idx >= 0) state.profiles[idx] = updated;
      const eq = db.equipment.find((e) => e.id === profile.equipmentId);
      if (poll) {
        pollResults.push({
          ...poll,
          ip: poll.ip || equipmentIp(eq),
          name: poll.name || eq?.name,
          location: updated.location || eq?.location,
          deckId: updated.deckId,
          roomId: updated.roomId,
          equipmentId: profile.equipmentId,
          error: error || poll.error,
        });
      }
    }
    saveSnmpSwitchesState(state);
    const aggregate = buildPollAllResponse(pollResults);
    res.json({
      ...aggregate,
      profiles: state.profiles,
      snmpWalkAvailable: await isSnmpWalkAvailable(),
    });
  } catch (err) {
    console.error("[snmpPollAll]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function getCredentialsVault() {
  const row = db.systemSettings.find((s) => s.key === CREDENTIALS_VAULT_KEY);
  let raw = row?.value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return normalizeCredentialsVault(raw || []);
}

function saveCredentialsVault(credentials) {
  const normalized = normalizeCredentialsVault(credentials);
  const row = db.systemSettings.find((s) => s.key === CREDENTIALS_VAULT_KEY);
  if (row) row.value = normalized;
  else {
    db.systemSettings.push({
      id: `setting-cred-vault-${Date.now()}`,
      key: CREDENTIALS_VAULT_KEY,
      value: normalized,
    });
  }
  return normalized;
}

app.get("/api/apps/:appId/credentials/vault", (_req, res) => {
  res.json(getCredentialsVault());
});

app.put("/api/apps/:appId/credentials/vault", (req, res) => {
  const saved = saveCredentialsVault(req.body);
  res.json(saved);
});

app.get("/api/apps/:appId/peplink/credentials", (_req, res) => {
  const creds = getPeplinkCredentials();
  res.json({
    incontrolOrgId: creds.incontrolOrgId || "",
    incontrolClientId: creds.incontrolClientId ? "••••••••" : "",
    hasClientSecret: !!creds.incontrolClientSecret,
  });
});

app.put("/api/apps/:appId/peplink/credentials", (req, res) => {
  const existing = getPeplinkCredentials();
  const body = req.body || {};
  savePeplinkCredentials({
    incontrolOrgId: body.incontrolOrgId ?? existing.incontrolOrgId,
    incontrolClientId: body.incontrolClientId || existing.incontrolClientId,
    incontrolClientSecret:
      body.incontrolClientSecret || existing.incontrolClientSecret,
  });
  res.json({ success: true });
});

app.post("/api/apps/:appId/functions/peplinkTestConnection", async (req, res) => {
  try {
    const { equipmentId, profile: draft } = req.body || {};
    const state = getSnmpSwitchesState();
    let profile = state.profiles.find((p) => p.equipmentId === equipmentId);
    if (draft?.equipmentId) profile = { ...profile, ...draft };
    if (!profile) {
      return res.status(404).json({ success: false, error: "Managed device profile not found" });
    }
    const eq = db.equipment.find((e) => e.id === profile.equipmentId);
    const disc = getDiscoverySettings();
    const result = await testPeplinkConnection(profile, {
      ip: equipmentIp(eq),
      equipment: eq,
      forceMock: !disc.snmpEnabled || process.env.PEPLINK_USE_MOCK === "1",
      globalPeplinkCreds: getPeplinkCredentials(),
    });
    res.json(result);
  } catch (err) {
    console.error("[peplinkTestConnection]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/apps/:appId/functions/wanSpeedTest", async (req, res) => {
  try {
    const { profileId, portIndex, portName } = req.body || {};
    const { profile } = resolveWanProfile(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: "WAN management router not found" });
    }
    const eq = db.equipment.find((e) => e.id === profile.equipmentId);
    const disc = getDiscoverySettings();
    const result = await runWanSpeedTest(profile, {
      ip: equipmentIp(eq),
      equipment: eq,
      wanIndex: Number(portIndex) || 1,
      portName: portName || "",
      forceMock: !disc.snmpEnabled || process.env.PEPLINK_USE_MOCK === "1",
    });
    res.json({ ...result, profileId: profile.id, portIndex: Number(portIndex) || 1 });
  } catch (err) {
    console.error("[wanSpeedTest]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Lighting engines (mock + live) ──────────────────────────────────────
const lutronEngine = buildMockLutronEngine();
const knxEngine = buildMockKnxEngine();
const daliEngine = buildMockDaliEngine();
const dmxEngine = buildMockDmxEngine();

function engineForSystemType(systemType) {
  switch (systemType) {
    case "knx": return knxEngine;
    case "dali": return daliEngine;
    case "dmx": return dmxEngine;
    default: return lutronEngine;
  }
}

/** Pull the saved Lutron processor connection from the in-memory settings. */
function getStoredLutronConnection() {
  const row = db.systemSettings.find((s) => s.key === LIGHTING_LUTRON_CONNECTION_KEY);
  let raw = row?.value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return raw && typeof raw === "object" ? raw : null;
}

/** Pull the stored generic lighting connection by systemType. */
function getStoredLightingConnection(systemType) {
  const row = db.systemSettings.find((s) => s.key === LIGHTING_CONNECTION_KEY);
  let raw = row?.value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const conn = raw && typeof raw === "object" ? raw : null;
  if (!conn) return null;
  if (systemType && conn.systemType !== systemType) return null;
  return conn;
}

/**
 * Decide whether the live integration should handle a command. We
 * honour any per-request override (so the connection-test modal can validate
 * draft values without saving) and otherwise fall back to the stored
 * connection.
 */
function resolveLiveConnection(reqBody = {}) {
  const systemType = reqBody.systemType || "lutron";
  const override = reqBody.host
    ? {
        enabled: true,
        host: reqBody.host,
        port: reqBody.port,
        protocol: reqBody.protocol || "telnet",
        username: reqBody.username,
        password: reqBody.password,
      }
    : null;
  const stored =
    systemType === "lutron"
      ? getStoredLutronConnection()
      : getStoredLightingConnection(systemType);
  const conn = override || stored;
  if (!conn?.enabled || !conn.host) return null;
  const protocol = conn.protocol === "leap" ? "leap" : conn.protocol || "telnet";
  // LEAP uses TLS certificate authentication — username/password not required
  if (protocol !== "leap" && !conn.username) return null;
  return {
    enabled: true,
    host: conn.host,
    port: Number(conn.port) || defaultPortForProtocol(protocol, systemType),
    protocol,
    username: conn.username,
    password: conn.password,
  };
}

// ── Cisco helpers (per-host singleton lookup + cred resolution) ─────────

function getStoredCiscoSwitches() {
  const row = db.systemSettings.find((s) => s.key === NETWORK_CISCO_SWITCHES_KEY);
  let raw = row?.value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return normalizeCiscoSwitches(raw || { switches: [] });
}

function findStoredCiscoSwitch(hostOrId) {
  if (!hostOrId) return null;
  const stored = getStoredCiscoSwitches();
  const needle = String(hostOrId).toLowerCase().trim();
  return (
    stored.switches.find(
      (s) =>
        s.host.toLowerCase() === needle ||
        s.id === hostOrId ||
        s.equipmentId === hostOrId
    ) || null
  );
}

function saveStoredCiscoSwitches(payload) {
  const normalized = normalizeCiscoSwitches(payload);
  const row = db.systemSettings.find((s) => s.key === NETWORK_CISCO_SWITCHES_KEY);
  if (row) row.value = normalized;
  else {
    db.systemSettings.push({
      id: `setting-${Date.now()}`,
      key: NETWORK_CISCO_SWITCHES_KEY,
      value: normalized,
    });
  }
  return normalized;
}

function updateCiscoSwitchPollMeta(host, { snapshot = null, error = null } = {}) {
  if (!host) return;
  const stored = getStoredCiscoSwitches();
  const idx = stored.switches.findIndex(
    (s) => s.host.toLowerCase() === String(host).toLowerCase()
  );
  if (idx < 0) return;
  stored.switches[idx] = {
    ...stored.switches[idx],
    system: snapshot?.system || stored.switches[idx].system,
    lastConnectedAt: error ? stored.switches[idx].lastConnectedAt : new Date().toISOString(),
    lastError: error,
    updatedAt: new Date().toISOString(),
  };
  saveStoredCiscoSwitches(stored);
}

async function pollStoredCiscoSwitch(sw) {
  const client = getCiscoSwitchClient(sw);
  if (!client) return null;
  try {
    const snapshot = await client.pollAll({
      snmpCommunity: sw.snmpCommunity,
      snmpVersion: sw.snmpVersion,
    });
    updateCiscoSwitchPollMeta(sw.host, { snapshot });
    return snapshot;
  } catch (err) {
    updateCiscoSwitchPollMeta(sw.host, { error: err?.message || String(err) });
    throw err;
  }
}

async function pollAllStoredCiscoSwitches() {
  const stored = getStoredCiscoSwitches();
  for (const sw of stored.switches.filter((s) => s.enabled !== false && s.host)) {
    try {
      await pollStoredCiscoSwitch(sw);
    } catch (err) {
      console.warn(`[ciscoPoll] ${sw.host} failed:`, err?.message || err);
    }
  }
}

function resolveCiscoConnection(reqBody = {}) {
  // Per-request override wins so the modal "Test connection" path doesn't
  // need a saved switch first.
  if (reqBody.host && (reqBody.sshPassword || reqBody.password)) {
    return normalizeCiscoSwitch({
      host: reqBody.host,
      sshPort: reqBody.sshPort,
      sshUsername: reqBody.sshUsername || reqBody.username || "cisco",
      sshPassword: reqBody.sshPassword || reqBody.password,
      enablePassword: reqBody.enablePassword,
      snmpPort: reqBody.snmpPort,
      snmpVersion: reqBody.snmpVersion,
      snmpCommunity: reqBody.snmpCommunity,
      snmpv3User: reqBody.snmpv3User,
      snmpv3AuthProto: reqBody.snmpv3AuthProto,
      snmpv3AuthPass: reqBody.snmpv3AuthPass,
      snmpv3PrivProto: reqBody.snmpv3PrivProto,
      snmpv3PrivPass: reqBody.snmpv3PrivPass,
    });
  }
  return findStoredCiscoSwitch(reqBody.host || reqBody.switchId);
}

function resolveCiscoConnectionForProfile(profile, equipment) {
  const host = equipment?.ip || equipment?.ipAddress || null;
  if (!host) return null;
  const stored = findStoredCiscoSwitch(host);
  if (stored) return stored;
  // Fall back to whatever creds the operator put on the SNMP profile —
  // useful for the demo path where the fleet profile carries SSH login
  // info even before the operator opens the Cisco Switches page.
  const ciscoCfg = profile.ciscoConfig || {};
  if (!ciscoCfg.sshPassword) return null;
  return normalizeCiscoSwitch({
    host,
    sshPort: ciscoCfg.sshPort,
    sshUsername: ciscoCfg.sshUsername || "cisco",
    sshPassword: ciscoCfg.sshPassword,
    enablePassword: ciscoCfg.enablePassword,
    snmpCommunity: profile.snmpCommunity,
    snmpVersion: profile.snmpVersion,
  });
}

/** Best-effort scene number from the scene name in the integration report. */
function sceneNumberFromName(name = "") {
  if (/off\s+scene/i.test(name)) return 0;
  const m = /(\d+)/.exec(String(name));
  return m ? Math.min(16, Math.max(1, parseInt(m[1], 10))) : null;
}

app.post("/api/apps/:appId/functions/lutronCommand", async (req, res) => {
  try {
    const {
      op,
      zoneHref,
      zoneKind,
      sceneHref,
      sceneName,
      sceneAreaId,
      buttonHref,
      deviceHref,
      componentNumber,
      level,
      fadeSeconds,
      sceneZones,
      scene,
      hrefs,
      host,
      port,
      protocol: bodyProtocol,
      username,
      systemType: bodySystemType,
    } = req.body || {};

    const systemType = bodySystemType || "lutron";
    const engine = engineForSystemType(systemType);

    const live = resolveLiveConnection(req.body);
    // Diagnostic logging
    const storedConn = getStoredLutronConnection();
    console.log(`[lutronCommand] op=${op} systemType=${systemType} live=${live ? "yes" : "no"} stored=${storedConn ? "yes" : "no"} storedHost=${storedConn?.host || "none"} storedProtocol=${storedConn?.protocol || "none"} storedEnabled=${storedConn?.enabled}`);
    // Live client based on system type
    let liveClient = null;
    if (live) {
      if (systemType === "lutron" && live.protocol === "telnet") {
        liveClient = getLutronClient(live);
      } else if (systemType === "lutron" && live.protocol === "leap") {
        liveClient = getLeapClient(live);
        console.log(`[lutronCommand] getLeapClient(${live.host}) returned ${liveClient ? "client" : "NULL (certs not found)"}`);
        if (liveClient) {
          console.log(`[lutronCommand] LEAP client state=${liveClient.state} host=${liveClient.host} port=${liveClient.port}`);
        }
      } else if (systemType === "knx") {
        liveClient = getKnxClient(live);
      } else if (systemType === "dali") {
        liveClient = getDaliClient(live);
      } else if (systemType === "dmx") {
        liveClient = getDmxClient(live);
      }
    }
    // For testProcessor we let the dedicated branch handle connectivity so it
    // can run the port scan and produce a precise recommendation even when
    // the Telnet socket refuses to open. For every other op we eagerly try
    // to connect here so a transient disconnection retries cleanly.
    if (liveClient && op !== "testProcessor") {
      try {
        console.log(`[lutronCommand] calling ${liveClient.constructor?.name || "client"}.connect()...`);
        await liveClient.connect();
        console.log(`[lutronCommand] connect() succeeded, state=${liveClient.state}`);
      } catch (err) {
        console.warn(`[lutronCommand] connect failed: ${err.message}`, err.stack?.split("\n").slice(0, 4).join("\n"));
        return res.json({
          success: false,
          mode: "live",
          error: `LEAP connect failed: ${err.message}`,
        });
      }
    } else if (op !== "testProcessor") {
      console.log(`[lutronCommand] liveClient unavailable: live=${!!live}, mode will be MOCK`);
    }

    switch (op) {
      case "setZoneLevel": {
        if (!zoneHref) {
          return res.status(400).json({ success: false, error: "zoneHref required" });
        }
        if (liveClient) {
          const integrationId = integrationIdFromHref(zoneHref);
          if (!integrationId) {
            return res.json({
              success: false,
              mode: "live",
              error: `Cannot extract Lutron integration ID from href ${zoneHref}`,
            });
          }
          const result = await liveClient.setOutput(
            integrationId,
            level,
            fadeSeconds || 0,
            zoneKind || null
          );
          return res.json({
            success: true,
            mode: "live",
            zone: {
              href: zoneHref,
              integrationId,
              level: result.level,
              on: result.on,
              kind: result.kind,
              fade: fadeSeconds || 0,
              updatedAt: result.updatedAt,
            },
          });
        }
        const zone = engine.setZoneLevel(zoneHref, level, fadeSeconds || 0);
        return res.json({ success: true, mode: "mock", zone });
      }

      case "raiseLowerStop": {
        if (!zoneHref) {
          return res.status(400).json({ success: false, error: "zoneHref required" });
        }
        const action = req.body?.action || "stop";
        if (liveClient) {
          const integrationId = integrationIdFromHref(zoneHref);
          if (!integrationId) {
            return res.json({
              success: false,
              mode: "live",
              error: `Cannot extract Lutron integration ID from href ${zoneHref}`,
            });
          }
          await liveClient.raiseLower(integrationId, action, zoneKind || null);
          return res.json({ success: true, mode: "live", href: zoneHref, action });
        }
        const zone = engine.raiseLower(zoneHref, action);
        return res.json({ success: true, mode: "mock", zone });
      }

      case "activateScene": {
        if (!sceneHref) {
          return res.status(400).json({ success: false, error: "sceneHref required" });
        }
        const zonesList = Array.isArray(sceneZones) ? sceneZones : [];
        if (liveClient) {
          // Prefer the dedicated #AREA scene command when we have an area
          // integration ID and a usable scene number from the report.
          const areaId = sceneAreaId ? String(sceneAreaId) : null;
          const sceneNumber = sceneNumberFromName(sceneName || "");
          const results = [];
          let areaCommandIssued = false;
          if (areaId && sceneNumber !== null) {
            try {
              await liveClient.activateAreaScene(areaId, sceneNumber);
              areaCommandIssued = true;
            } catch (err) {
              console.warn("[lutronCommand] activateAreaScene failed:", err.message);
            }
          }
          // Always also apply per-zone targets so the platform's commanded
          // levels match what the operator sees on the slider, regardless of
          // whether the processor's saved scene levels are in sync.
          for (const z of zonesList) {
            const id = integrationIdFromHref(z.href);
            if (!id) continue;
            try {
              const r = await liveClient.setOutput(
                id,
                z.level,
                z.fadeSeconds || 0,
                z.kind || null
              );
              results.push({
                href: z.href,
                integrationId: id,
                level: r.level,
                on: r.on,
                kind: r.kind,
                updatedAt: r.updatedAt,
              });
            } catch (err) {
              results.push({ href: z.href, error: err.message });
            }
          }
          return res.json({
            success: true,
            mode: "live",
            sceneHref,
            areaCommandIssued,
            zones: results,
          });
        }
        const result = engine.activateScene(sceneHref, zonesList);
        return res.json({ success: true, mode: "mock", ...result });
      }

      case "pressButton": {
        const targetHref = buttonHref || deviceHref;
        if (!targetHref) {
          return res.status(400).json({ success: false, error: "buttonHref required" });
        }
        if (liveClient) {
          // The integration report exposes a button as `/button/<componentId>`
          // and the parent device as `/device/<deviceId>`; both are needed for
          // a #DEVICE press. The frontend passes them via componentNumber +
          // deviceHref; if only buttonHref is supplied we fall back to it.
          const deviceId = deviceHref ? integrationIdFromHref(deviceHref) : null;
          const componentId = componentNumber != null
            ? String(componentNumber)
            : integrationIdFromHref(buttonHref);
          if (!deviceId || !componentId) {
            return res.json({
              success: false,
              mode: "live",
              error:
                "deviceHref + componentNumber required to press a button on a live processor",
            });
          }
          const entry = await liveClient.pressButton(deviceId, componentId);
          return res.json({ success: true, mode: "live", buttonHref: targetHref, ...entry });
        }
        const entry = engine.pressButton(targetHref);
        return res.json({ success: true, mode: "mock", ...entry });
      }

      case "customScene": {
        // User-authored scene from the Scenes page. Three kinds:
        //   area_scene     → { areaId, sceneN }
        //   leap_href      → { href: "/area/<id>/scene/<n>" }
        //   phantom_button → { deviceHref, componentNumber }
        if (!scene || typeof scene !== "object") {
          return res
            .status(400)
            .json({ success: false, error: "scene payload required" });
        }
        const kind = scene.kind || "leap_href";

        // Derive (areaId, sceneN) for area_scene + leap_href dispatch.
        let areaId = null;
        let sceneN = null;
        if (kind === "area_scene") {
          areaId = scene.areaId ? String(scene.areaId).trim() : null;
          sceneN = Number(scene.sceneN);
        } else if (kind === "leap_href") {
          const m = String(scene.href || "").match(/\/area\/(\d+)\/scene\/(\d+)/i);
          if (m) {
            areaId = m[1];
            sceneN = Number(m[2]);
          }
        }

        if (kind === "area_scene" || kind === "leap_href") {
          if (!areaId || !Number.isFinite(sceneN)) {
            return res.status(400).json({
              success: false,
              error:
                "area_scene / leap_href requires an Area ID and Scene number (got href '" +
                (scene.href || `${scene.areaId}/${scene.sceneN}`) +
                "').",
            });
          }
          if (liveClient) {
            try {
              await liveClient.activateAreaScene(areaId, sceneN);
              return res.json({
                success: true,
                mode: "live",
                scene,
                areaId,
                sceneN,
              });
            } catch (err) {
              console.warn("[lutronCommand] customScene activateAreaScene failed:", err.message);
              return res.json({
                success: false,
                mode: "live",
                scene,
                error: err.message || "Processor rejected scene activation",
              });
            }
          }
          // No live client — simulate via the local engine if it has
          // a matching scene href, otherwise just report success.
          const fakeHref = `/area/${areaId}/scene/${sceneN}`;
          try {
            const result = engine.activateScene(fakeHref, []);
            return res.json({ success: true, mode: "mock", scene, ...result });
          } catch {
            return res.json({ success: true, mode: "mock", scene });
          }
        }

        if (kind === "phantom_button") {
          const deviceId = scene.deviceHref
            ? integrationIdFromHref(scene.deviceHref)
            : null;
          const componentId =
            scene.componentNumber != null ? String(scene.componentNumber) : null;
          if (!deviceId || !componentId) {
            return res.status(400).json({
              success: false,
              error:
                "phantom_button requires a Device href and Component number",
            });
          }
          if (liveClient) {
            try {
              const entry = await liveClient.pressButton(deviceId, componentId);
              return res.json({
                success: true,
                mode: "live",
                scene,
                deviceId,
                componentId,
                ...entry,
              });
            } catch (err) {
              console.warn("[lutronCommand] customScene pressButton failed:", err.message);
              return res.json({
                success: false,
                mode: "live",
                scene,
                error: err.message || "Processor rejected button press",
              });
            }
          }
          const entry = engine.pressButton(scene.deviceHref || `/device/${deviceId}`);
          return res.json({ success: true, mode: "mock", scene, ...entry });
        }

        return res
          .status(400)
          .json({ success: false, error: `Unknown scene kind '${kind}'` });
      }

      case "pollZones": {
        const wanted = Array.isArray(hrefs) ? hrefs : [];
        if (liveClient && wanted.length) {
          const ids = wanted
            .map((h) => ({ href: h, id: integrationIdFromHref(h) }))
            .filter((row) => !!row.id);
          await liveClient.pollOutputs(ids.map((row) => row.id));
          const zones = ids.map((row) => {
            const cached = liveClient.lastLevels.get(row.id);
            return {
              href: row.href,
              integrationId: row.id,
              level: cached?.level ?? 0,
              on: cached?.on ?? false,
              updatedAt: cached?.updatedAt || new Date().toISOString(),
            };
          });
          return res.json({ success: true, mode: "live", zones });
        }
        const zones = engine.pollZones(wanted);
        return res.json({ success: true, mode: "mock", zones });
      }

      case "snapshot":
        return res.json({ success: true, mode: liveClient ? "live" : "mock", ...engine.snapshot() });

      case "testProcessor": {
        const resolvedProtocol = (bodyProtocol || live?.protocol) || "telnet";
        const defaultPort = defaultPortForProtocol(resolvedProtocol, systemType);
        const effectivePort = port || live?.port || defaultPort;
        const targetHost = host || live?.host || "";
        const target = targetHost ? `${targetHost}:${effectivePort}` : "(mock)";
        const api = (resolvedProtocol || "").toUpperCase().replace(/-/g, " ");
        const effectiveUser = username || live?.username || "";

        if (!targetHost) {
          return res.json({
            success: true,
            mode: "mock",
            processor: target,
            protocol: resolvedProtocol,
            product: `${systemType.toUpperCase()} Engine (mock)`,
            firmware: "1.0.0",
            api,
            message: "Local mock engine active — no host configured.",
          });
        }

        // Lutron-specific probing (Telnet port scan, LEAP detection)
        if (systemType === "lutron") {
          const availablePorts = await probeLutronPorts(targetHost);
          const openPorts = availablePorts.filter((p) => p.open).map((p) => p.port);
          const recommendation = recommendationFromPorts(availablePorts, resolvedProtocol);
          const buildResponse = (overrides) => ({
            processor: target,
            protocol: resolvedProtocol,
            api,
            availablePorts,
            openPorts,
            recommendation,
            ...overrides,
          });

          if (!effectiveUser && resolvedProtocol !== "leap") {
            return res.json(
              buildResponse({
                success: false,
                mode: "live",
                message: "Integration username is required by the processor.",
              })
            );
          }

          const probeRole = resolvedProtocol === "leap" ? "leap" : "telnet";
          const probed = availablePorts.find((p) => p.role === probeRole);
          const portProbeFailed = probed && !probed.open;

          if (liveClient) {
            try {
              await liveClient.connect();
              await liveClient.ping();
              const msg = portProbeFailed
                ? `Connected to ${target} (${probeRole} probe showed closed — connection succeeded anyway).`
                : `Connected to ${target} and authenticated as ${effectiveUser}.`;
              return res.json(
                buildResponse({
                  success: true,
                  mode: "live",
                  authenticatedAs: effectiveUser,
                  product: "Lutron HomeWorks processor",
                  message: msg,
                })
              );
            } catch (err) {
              return res.json(
                buildResponse({
                  success: false,
                  mode: "live",
                  message: err.message,
                  recommendation: portProbeFailed
                    ? recommendation
                    : `${resolvedProtocol === "leap" ? "LEAP" : "Telnet"} connection to ${target} failed: ${err.message}. Verify the processor IP, port ${resolvedProtocol === "leap" ? "8081 (LEAP) / 8083 (pairing)" : "23"} is open, and integration is enabled in Lutron Designer.`,
                })
              );
            }
          }
          // LEAP with no paired certificates — tell the user to pair first
          if (resolvedProtocol === "leap") {
            const paired = isPaired(targetHost);
            return res.json(
              buildResponse({
                success: false,
                mode: "live",
                message: paired
                  ? `Certificates found for ${targetHost} but connection failed. Verify the processor is online and reachable on port ${effectivePort}.`
                  : `No LEAP certificates found for ${targetHost}. Use the LEAP Pairing workflow to generate a certificate by pressing the physical button on the processor.`,
                recommendation: paired
                  ? `Delete the existing certificates for ${targetHost} and re-pair, or verify network connectivity.`
                  : `Navigate to Lighting Settings → LEAP Pairing, enter ${targetHost}, and press the processor's physical button when prompted.`,
              })
            );
          }

          // Telnet with no liveClient — report port scan findings
          return res.json(
            buildResponse({
              success: false,
              mode: "live",
              message: `Telnet client could not be created for ${target}. Verify the integration username is correct.`,
            })
          );
      } // end if (systemType === "lutron")

      // KNX / DALI / DMX — probe ports and try live client
      async function probeNonLutron() {
        let availablePorts = [];
        if (systemType === "knx") {
          availablePorts = await probeKnxPorts(targetHost);
        } else if (systemType === "dali") {
          availablePorts = await probeDaliPorts(targetHost);
        } else if (systemType === "dmx") {
          availablePorts = await probeDmxPorts(targetHost);
        }
        const openPorts = availablePorts.filter((p) => p.open).map((p) => p.port);
        const recFn = systemType === "knx" ? knxRecommendation : systemType === "dali" ? daliRecommendation : dmxRecommendation;
        const recommendation = recFn(availablePorts, resolvedProtocol);
        if (liveClient) {
          try {
            await liveClient.connect();
            await liveClient.ping();
            return res.json({
              success: true,
              mode: "live",
              processor: target,
              protocol: resolvedProtocol,
              api,
              product: `${systemType.toUpperCase()} controller`,
              firmware: "1.0.0",
              availablePorts,
              openPorts,
              recommendation,
              message: `Connected to ${systemType.toUpperCase()} controller at ${target}.`,
            });
          } catch (err) {
            return res.json({
              success: false,
              mode: "live",
              processor: target,
              protocol: resolvedProtocol,
              api,
              availablePorts,
              openPorts,
              recommendation,
              message: err.message,
            });
          }
        }
        return res.json({
          success: true,
          mode: "mock",
          processor: target,
          protocol: resolvedProtocol,
          product: `${systemType.toUpperCase()} Engine (mock)`,
          firmware: "1.0.0",
          api,
          availablePorts,
          openPorts,
          recommendation,
          message: `Mock ${systemType.toUpperCase()} engine — no host configured.`,
        });
      }
      return probeNonLutron();

      } // end case "testProcessor"

      default:
        return res.status(400).json({ success: false, error: `Unknown lutron op: ${op}` });
    }
  } catch (err) {
    console.error("[lutronCommand]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Live lighting events (SSE) ───────────────────────────────────────────
//
// Server-Sent Events stream that pipes every zone-level change the LEAP /
// Telnet client observes (initial snapshot + wall-keypad presses + scene
// activations + the platform's own commands) back to the browser, so the
// Lighting page reflects the processor's real state without polling.
//
// The browser opens this with `new EventSource(...)`; events are emitted as
//   event: snapshot   → { zones: [{ href, integrationId, level, on, kind, updatedAt }, ...] }
//   event: zoneLevel  → { href, integrationId, level, on, kind, updatedAt }
//   event: ping       → {}
//   event: error      → { message }
app.get("/api/apps/:appId/functions/lutronEvents", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Disable any intermediate buffering (Nginx, Cloudflare, etc.) so single
  // SSE frames are flushed to the browser immediately.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const writeEvent = (event, data) => {
    if (res.writableEnded) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* socket already closed */
    }
  };

  const conn = getStoredLutronConnection();
  if (!conn?.enabled || !conn?.host) {
    writeEvent("error", {
      message: "No Lutron processor configured — open Lighting → Set credentials.",
    });
    res.end();
    return;
  }

  let liveClient = null;
  if (conn.protocol === "leap") {
    liveClient = getLeapClient(conn);
  } else {
    liveClient = getLutronClient(conn);
  }
  if (!liveClient) {
    writeEvent("error", {
      message:
        conn.protocol === "leap"
          ? `No LEAP certificates found for ${conn.host}. Pair the processor first.`
          : `Telnet client could not be created for ${conn.host}.`,
    });
    res.end();
    return;
  }

  try {
    await liveClient.connect();
  } catch (err) {
    writeEvent("error", { message: `Connect failed: ${err.message}` });
    res.end();
    return;
  }

  // Initial snapshot from whatever the subscription/poll cache has so far.
  const snapshot = [];
  for (const [id, entry] of liveClient.lastLevels) {
    snapshot.push({
      href: `/zone/${id}`,
      integrationId: String(id),
      level: entry.level ?? 0,
      on: entry.on ?? false,
      kind: entry.kind || "dimmed",
      updatedAt: entry.updatedAt || new Date().toISOString(),
    });
  }
  writeEvent("snapshot", {
    processor: `${conn.host}:${conn.port || (conn.protocol === "leap" ? 8081 : 23)}`,
    protocol: conn.protocol,
    zones: snapshot,
  });

  // LEAP wrapper emits `zoneLevel`; Telnet client emits `output`. Subscribe
  // to both so this single endpoint speaks every Lutron protocol.
  const forward = (entry) => {
    writeEvent("zoneLevel", {
      href: `/zone/${entry.id}`,
      integrationId: String(entry.id),
      level: entry.level ?? 0,
      on: entry.on != null ? entry.on : (entry.level ?? 0) > 0,
      kind: entry.kind || "dimmed",
      updatedAt: entry.updatedAt || new Date().toISOString(),
    });
  };
  liveClient.on("zoneLevel", forward);
  liveClient.on("output", forward);

  // Periodic keep-alive comment frame; SSE proxies typically close idle
  // connections after ~60s without traffic.
  const keepAlive = setInterval(() => {
    if (res.writableEnded) return;
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    } catch {
      /* */
    }
  }, 25_000);

  const cleanup = () => {
    clearInterval(keepAlive);
    try { liveClient.off("zoneLevel", forward); } catch { /* */ }
    try { liveClient.off("output", forward); } catch { /* */ }
  };
  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("close", cleanup);
});

// ── Cisco Catalyst 1300 / CBS350 SSH+SNMP commands ───────────────────────
//
// Mirrors the Lutron `lutronCommand` endpoint above. Operations:
//   - testSwitch     → probe ports + try SSH login + grab system info
//   - getSystem      → `show version` + `show system` parsed
//   - getInterfaces  → `show interfaces status/description/power inline`
//   - getMacTable    → `show mac address-table dynamic`
//   - getNeighbors   → `show lldp neighbors detail` + `show cdp ...`
//   - pollAll        → all of the above in one call
//   - setPortEnabled → reserved for future write support (returns 501)
//
// Per-request credentials override the stored connection so the modal can
// run a "Test connection" before saving anything.

app.post("/api/apps/:appId/functions/ciscoCommand", async (req, res) => {
  try {
    const { op } = req.body || {};
    const conn = resolveCiscoConnection(req.body);
    if (!conn) {
      return res.status(400).json({
        success: false,
        error: "host + sshPassword required (or save the switch first)",
      });
    }
    const client = getCiscoSwitchClient(conn);
    if (!client) {
      return res.status(500).json({ success: false, error: "client unavailable" });
    }
    switch (op) {
      case "testSwitch": {
        const result = await client.testConnection();
        return res.json(result);
      }
      case "getSystem": {
        const system = await client.getSystem();
        return res.json({ success: true, system });
      }
      case "getInterfaces": {
        const interfaces = await client.getInterfaces();
        return res.json({ success: true, interfaces });
      }
      case "getMacTable": {
        const macs = await client.getMacTable();
        return res.json({ success: true, macs });
      }
      case "getNeighbors": {
        const neighbors = await client.getNeighbors();
        return res.json({ success: true, neighbors });
      }
      case "pollAll": {
        const snapshot = await client.pollAll({
          snmpCommunity: conn.snmpCommunity,
          snmpVersion: conn.snmpVersion,
        });
        updateCiscoSwitchPollMeta(conn.host, { snapshot });
        return res.json({ success: true, host: conn.host, snapshot });
      }
      case "probePorts": {
        const ports = await probeCiscoPorts(conn.host);
        return res.json({
          success: true,
          host: conn.host,
          ports,
          recommendation: ciscoRecommendation(ports),
        });
      }
      case "disconnect": {
        closeCiscoSwitchClient(conn.host);
        return res.json({ success: true, host: conn.host });
      }
      case "setPortEnabled": {
        // Reserved — write support is a follow-up PR.
        return res.status(501).json({
          success: false,
          error: "Port admin shutdown not yet supported. Coming in the next release.",
        });
      }
      default:
        return res.status(400).json({ success: false, error: `unknown op ${op}` });
    }
  } catch (err) {
    console.error("[ciscoCommand]", err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// SSE for live Cisco switch updates — initial `snapshot`, then `portChange`
// events whenever the poller observes a change in interface status.
//
//   event: snapshot   → { host, system, interfaces, macs, neighbors }
//   event: portChange → { host, ifIndex, portName, status, prevStatus }
//   event: ping       → {}
//   event: error      → { message }
app.get("/api/apps/:appId/functions/ciscoEvents", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const writeEvent = (event, data) => {
    if (res.writableEnded) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* socket already closed */
    }
  };

  const hostFilter = (req.query?.host || "").toString().trim();
  const stored = getStoredCiscoSwitches();
  const targets = hostFilter
    ? stored.switches.filter((s) => s.host.toLowerCase() === hostFilter.toLowerCase())
    : stored.switches.filter((s) => s.enabled);

  if (targets.length === 0) {
    writeEvent("error", {
      message: "No Cisco switches configured — open Cisco Switches → Add switch.",
    });
    res.end();
    return;
  }

  // Initial snapshot for each tracked switch. Pull from the in-memory cache
  // if available; otherwise poll once.
  const cleanups = [];
  for (const sw of targets) {
    const client = getCiscoSwitchClient(sw);
    try {
      const snap = client.lastSnapshot || (await pollStoredCiscoSwitch(sw));
      writeEvent("snapshot", { host: sw.host, ...snap });
    } catch (err) {
      writeEvent("error", { host: sw.host, message: err?.message || String(err) });
    }
    // Watch for snapshot/portChange events emitted by the orchestrator.
    const lastStatusByIfIndex = new Map();
    const onSnapshot = (snapshot) => {
      writeEvent("snapshot", { host: sw.host, ...snapshot });
      for (const p of snapshot.interfaces || []) {
        const prev = lastStatusByIfIndex.get(p.index);
        if (prev != null && prev !== p.status) {
          writeEvent("portChange", {
            host: sw.host,
            ifIndex: p.index,
            portName: p.name,
            status: p.status,
            prevStatus: prev,
            ifAlias: p.ifAlias,
            ts: snapshot.polledAt,
          });
        }
        lastStatusByIfIndex.set(p.index, p.status);
      }
    };
    client.on("snapshot", onSnapshot);
    cleanups.push(() => {
      try { client.off("snapshot", onSnapshot); } catch { /* */ }
    });
  }

  const pollTimer = setInterval(async () => {
    if (res.writableEnded) return;
    for (const sw of targets) {
      try {
        await pollStoredCiscoSwitch(sw);
      } catch (err) {
        writeEvent("error", { host: sw.host, message: err?.message || String(err) });
      }
    }
  }, CISCO_LIVE_POLL_INTERVAL_MS);

  const keepAlive = setInterval(() => {
    if (res.writableEnded) return;
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    } catch {
      /* */
    }
  }, 25_000);

  const cleanup = () => {
    clearInterval(keepAlive);
    clearInterval(pollTimer);
    for (const fn of cleanups) {
      try { fn(); } catch { /* */ }
    }
  };
  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("close", cleanup);
});

// ── LEAP certificate pairing ──────────────────────────────────────────────

// Start LEAP pairing — returns IMMEDIATELY ("pairing started"). The pairing
// continues in the background; the client should poll lutronLeapPairingStatus
// every 1-2 seconds for progress updates until status is "paired" or "failed".
app.post("/api/apps/:appId/functions/lutronLeapPair", (req, res) => {
  try {
    const { host, port } = req.body || {};
    if (!host) {
      return res.status(400).json({ success: false, error: "host required" });
    }

    const status = getPairingStatus(host);
    if (status === "pairing") {
      const details = getPairingDetails(host);
      return res.json({
        success: false,
        status: "pairing",
        message: details.message || "Pairing already in progress.",
      });
    }
    if (status === "paired") {
      return res.json({
        success: true,
        status: "paired",
        message: "Already paired with this processor.",
      });
    }

    // Mock mode: generate self-signed certs instantly (no real processor needed)
    if (USE_MOCK_SCAN) {
      mockPairing(host);
      return res.json({
        success: true,
        status: "paired",
        host,
        message: "Mock pairing successful (dev mode — no real processor required).",
      });
    }

    // Real pairing — start it on the pairing port (8083) and return immediately.
    startPairing(host, port || 8083);
    const details = getPairingDetails(host);
    res.json({
      success: true,
      status: "pairing",
      host,
      message: details.message || "Pairing started. Press the physical button on the processor.",
      pollIntervalMs: 1500,
    });
  } catch (err) {
    console.error("[lutronLeapPair]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Detailed pairing status (used for polling during pairing).
app.post("/api/apps/:appId/functions/lutronLeapPairingStatus", (req, res) => {
  const { host } = req.body || {};
  const details = host ? getPairingDetails(host) : { status: "unpaired" };
  const hosts = getPairedHosts();
  res.json({ host, ...details, pairedHosts: hosts });
});

// Cancel an in-progress pairing.
app.post("/api/apps/:appId/functions/lutronLeapCancel", (req, res) => {
  const { host } = req.body || {};
  if (!host) {
    return res.status(400).json({ success: false, error: "host required" });
  }
  cancelPairing(host);
  res.json({ success: true, host, status: getPairingStatus(host) });
});

// Diagnostic: test raw TCP + TLS connectivity (no pairing required).
app.post("/api/apps/:appId/functions/lutronLeapTestConnection", async (req, res) => {
  try {
    const { host } = req.body || {};
    if (!host) {
      return res.status(400).json({ success: false, error: "host required" });
    }
    // Auto-tests both port 8081 (LEAP) and 8083 (pairing)
    const result = await testLeapConnection(host);
    res.json({ success: result.reachable && result.tlsAccepted, ...result });
  } catch (err) {
    console.error("[lutronLeapTestConnection]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/apps/:appId/functions/lutronLeapUnpair", (req, res) => {
  const { host } = req.body || {};
  if (!host) {
    return res.status(400).json({ success: false, error: "host required" });
  }
  removePairedHost(host);
  closeLeapClient();
  res.json({ success: true, host, status: "unpaired" });
});

// Close any active lighting client sockets on process exit so dev restarts don't leak.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.once(sig, () => {
    try { closeLutronClient(); } catch { /* */ }
    try { closeLeapClient(); } catch { /* */ }
    try { closeKnxClient(); } catch { /* */ }
    try { closeDaliClient(); } catch { /* */ }
    try { closeDmxClient(); } catch { /* */ }
    process.exit(0);
  });
}

app.post("/api/apps/:appId/functions/snmpTestInterface", async (req, res) => {
  try {
    const { equipmentId, ifIndex } = req.body || {};
    const state = getSnmpSwitchesState();
    const profile = state.profiles.find((p) => p.equipmentId === equipmentId);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Managed switch profile not found" });
    }
    const opts = resolveProfilePollOpts(profile);
    if (!opts.ip) {
      return res.status(400).json({ success: false, error: "Switch has no IP address" });
    }
    const result = await testSwitchInterface(opts.ip, ifIndex, opts);
    if (result.success && result.port && profile.lastPoll?.ports) {
      const ports = profile.lastPoll.ports.map((p) =>
        p.index === Number(ifIndex) ? { ...p, ...result.port, status: result.port.status } : p
      );
      profile.lastPoll = { ...profile.lastPoll, ports };
      const idx = state.profiles.findIndex((p) => p.id === profile.id);
      if (idx >= 0) state.profiles[idx] = profile;
      saveSnmpSwitchesState(state);
    }
    res.json({ ...result, snmpWalkAvailable: await isSnmpWalkAvailable() });
  } catch (err) {
    console.error("[snmpTestInterface]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/apps/:appId/functions/snmpPortMap", async (_req, res) => {
  try {
    const state = getSnmpSwitchesState();
    const enabled = state.profiles.filter((p) => p.enabled !== false);
    if (!enabled.length) {
      return res.json({
        success: true,
        switches: [],
        connectionMap: [],
        totalConnections: 0,
        disconnectedPorts: 0,
        polledAt: new Date().toISOString(),
        message: "No managed switches registered",
      });
    }
    const pollResults = [];
    for (const profile of enabled) {
      const { profile: updated, poll } = await pollProfileAndSave(profile);
      const idx = state.profiles.findIndex((p) => p.id === updated.id);
      if (idx >= 0) state.profiles[idx] = updated;
      const eq = db.equipment.find((e) => e.id === profile.equipmentId);
      pollResults.push({
        ...poll,
        ip: poll.ip || equipmentIp(eq),
        name: poll.name || eq?.name,
        location: updated.location || eq?.location,
      });
    }
    saveSnmpSwitchesState(state);
    const switches = pollResults.map((r) => ({
      ip: r.ip,
      name: r.name,
      location: r.location,
      portsUp: r.ports?.filter((p) => p.status === "up").length || 0,
      portsDown: r.ports?.filter((p) => p.status === "down").length || 0,
      ports: (r.ports || []).map((p) => ({
        port: p.index,
        ifAlias: p.ifAlias,
        ifOperStatus: p.status,
        ifSpeed: p.speedMbps || p.speed,
        connectedDevice: p.connectedDevice,
        macAddr: p.macAddr,
        vlan: p.vlan,
        poeWatts: p.poeWatts,
      })),
    }));
    const connectionMap = buildConnectionMap(
      switches.map((sw) => ({
        name: sw.name,
        ip: sw.ip,
        ports: sw.ports.map((p) => ({
          index: p.port,
          ifAlias: p.ifAlias,
          status: p.ifOperStatus,
          connectedDevice: p.connectedDevice,
          macAddr: p.macAddr,
          speedMbps: p.ifSpeed,
          vlan: p.vlan,
          poeWatts: p.poeWatts,
        })),
      }))
    );
    res.json({
      success: true,
      switches,
      connectionMap,
      totalConnections: connectionMap.length,
      disconnectedPorts: connectionMap.filter((c) => c.status === "down").length,
      polledAt: new Date().toISOString(),
      snmpWalkAvailable: await isSnmpWalkAvailable(),
    });
  } catch (err) {
    console.error("[snmpPortMap]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/apps/:appId/functions/loadTopologyLayout", (req, res) => {
  let layouts = db.layoutTopology.filter(l => l.is_default);
  if (layouts.length === 0) {
    layouts = [...db.layoutTopology]
      .sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))
      .slice(0, 1);
  }
  res.json({ layout: layouts[0] || null });
});

app.post("/api/apps/:appId/functions/saveTopologyLayout", (req, res) => {
  const { layoutData } = req.body;
  if (!layoutData?.name) {
    return res.status(400).json({ success: false, error: "Layout name is required" });
  }

  if (layoutData.is_default) {
    db.layoutTopology.forEach(l => { l.is_default = false; });
  }

  let savedLayout;
  if (layoutData.id) {
    const idx = db.layoutTopology.findIndex(l => l.id === layoutData.id);
    if (idx >= 0) {
      db.layoutTopology[idx] = {
        ...db.layoutTopology[idx],
        ...layoutData,
        updated_date: new Date().toISOString(),
      };
      savedLayout = db.layoutTopology[idx];
    } else {
      savedLayout = {
        id: layoutData.id,
        ...layoutData,
        created_date: new Date().toISOString(),
      };
      db.layoutTopology.push(savedLayout);
    }
  } else {
    savedLayout = {
      id: "layout-" + Date.now(),
      ...layoutData,
      created_date: new Date().toISOString(),
    };
    db.layoutTopology.push(savedLayout);
  }

  res.json({
    success: true,
    layout: savedLayout,
    message: "Layout saved successfully",
  });
});

app.get("/api/apps/:appId/rack-layout", (req, res) => {
  let layout = db.rackLayouts.find((l) => l.is_default);
  if (!layout && db.rackLayouts.length > 0) layout = db.rackLayouts[0];
  res.json({ layout: layout || null });
});

app.put("/api/apps/:appId/rack-layout", (req, res) => {
  const layoutData = req.body;
  if (!layoutData) {
    return res.status(400).json({ message: "Layout body required" });
  }

  if (layoutData.is_default) {
    db.rackLayouts.forEach((l) => { l.is_default = false; });
  }

  let saved;
  const existingId = layoutData.id;
  if (existingId) {
    const idx = db.rackLayouts.findIndex((l) => l.id === existingId);
    if (idx >= 0) {
      db.rackLayouts[idx] = {
        ...db.rackLayouts[idx],
        ...layoutData,
        updated_date: new Date().toISOString(),
      };
      saved = db.rackLayouts[idx];
    }
  }

  if (!saved) {
    saved = {
      id: existingId || "rack-layout-" + Date.now(),
      ...layoutData,
      is_default: layoutData.is_default !== false,
      created_date: new Date().toISOString(),
    };
    db.rackLayouts.push(saved);
  }

  res.json({ layout: saved, success: true });
});

app.delete("/api/apps/:appId/rack-layout/:id", (req, res) => {
  db.rackLayouts = db.rackLayouts.filter((l) => l.id !== req.params.id);
  res.json({ success: true });
});

app.post("/api/apps/:appId/functions/importDevices", (req, res) => {
  const imported = Math.floor(Math.random() * 6 + 3);
  res.json({ success: true, count: imported, imported, errors: [] });
});

function simulateTraceroute(fromIp, toIp) {
  const hops = [];
  const isLocal = fromIp && toIp &&
    fromIp.split(".").slice(0, 3).join(".") === toIp.split(".").slice(0, 3).join(".");

  if (isLocal) {
    const gateway = fromIp.split(".").slice(0, 3).join(".") + ".1";
    const coreSwitch = fromIp.split(".").slice(0, 3).join(".") + ".10";
    hops.push({ hop: 1, ip: gateway, hostname: "router-wan", latencyMs: Math.round(Math.random() * 2 + 0.5), status: "ok" });
    hops.push({ hop: 2, ip: coreSwitch, hostname: "sw-bridge", latencyMs: Math.round(Math.random() * 3 + 1), status: "ok" });
    hops.push({ hop: 3, ip: toIp, hostname: null, latencyMs: Math.round(Math.random() * 4 + 1), status: "ok" });
  } else {
    hops.push({ hop: 1, ip: "192.168.10.1", hostname: "router-wan", latencyMs: Math.round(Math.random() * 2 + 0.5), status: "ok" });
    hops.push({ hop: 2, ip: "192.168.10.10", hostname: "sw-bridge", latencyMs: Math.round(Math.random() * 3 + 1), status: "ok" });
    hops.push({ hop: 3, ip: "192.168.10.11", hostname: "sw-saloon", latencyMs: Math.round(Math.random() * 4 + 2), status: "ok" });
    if (toIp) hops.push({ hop: 4, ip: toIp, hostname: null, latencyMs: Math.round(Math.random() * 5 + 2), status: "ok" });
  }
  return hops;
}

function simulatePing(ip, count = 5) {
  const base = Math.random() * 8 + 1;
  const results = Array.from({ length: count }, (_, i) => {
    const lost = Math.random() < 0.05;
    return {
      seq: i + 1,
      latencyMs: lost ? null : parseFloat((base + Math.random() * 3).toFixed(2)),
      status: lost ? "timeout" : "ok",
    };
  });
  const received = results.filter(r => r.status === "ok");
  const latencies = received.map(r => r.latencyMs);
  return {
    target: ip,
    transmitted: count,
    received: received.length,
    packetLossPct: parseFloat(((count - received.length) / count * 100).toFixed(1)),
    minMs: latencies.length ? Math.min(...latencies) : null,
    maxMs: latencies.length ? Math.max(...latencies) : null,
    avgMs: latencies.length ? parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)) : null,
    results,
  };
}

app.post("/api/apps/:appId/functions/cablePathDiagnostic", (req, res) => {
  const { fromDevice, toDevice, testType = "both" } = req.body;
  if (!fromDevice || !toDevice) {
    return res.status(400).json({ success: false, error: "fromDevice and toDevice are required" });
  }

  const fromIp = fromDevice.ip || null;
  const toIp = toDevice.ip || null;
  const result = {
    success: true,
    testedAt: new Date().toISOString(),
    fromDevice: { name: fromDevice.name, ip: fromIp },
    toDevice: { name: toDevice.name, ip: toIp },
  };

  if (testType === "traceroute" || testType === "both") {
    result.traceroute = simulateTraceroute(fromIp, toIp);
    result.totalHops = result.traceroute.length;
    result.endToEndLatencyMs = result.traceroute.reduce((acc, h) => acc + (h.latencyMs || 0), 0);
  }

  if (testType === "ping" || testType === "both") {
    if (toIp) {
      result.ping = simulatePing(toIp);
      result.reachable = result.ping.received > 0;
    } else {
      result.ping = null;
      result.reachable = false;
      result.note = "Target IP unknown — ping skipped";
    }
  }

  const avgMs = result.ping?.avgMs || result.endToEndLatencyMs;
  if (!result.reachable && testType !== "traceroute") {
    result.health = "unreachable";
  } else if (avgMs > 50) {
    result.health = "degraded";
  } else if (avgMs > 20) {
    result.health = "fair";
  } else {
    result.health = "good";
  }

  res.json(result);
});

app.post("/api/apps/:appId/functions/generateManualPdf", async (req, res) => {
  try {
    const { jsPDF } = await import("../node_modules/jspdf/dist/jspdf.es.min.js");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFillColor(6, 9, 18);
    doc.rect(0, 0, 210, 297, "F");
    doc.setTextColor(0, 210, 220);
    doc.setFontSize(28);
    doc.text("Wave Guard", 105, 40, { align: "center" });
    doc.setFontSize(14);
    doc.text("Platform Manual", 105, 52, { align: "center" });
    doc.setTextColor(235, 240, 255);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(
      "This PDF was generated from your local WaveGuard instance. Open the Help page in the app for the full interactive documentation covering topology, maintenance, cables, lighting, integrations, and deployment.",
      170
    );
    doc.text(lines, 20, 70);
    doc.setTextColor(120, 140, 170);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 280);
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    res.json({ pdfBase64 });
  } catch (err) {
    console.error("PDF generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/apps/:appId/functions/githubCommitVelocity", (req, res) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) {
    return res.status(400).json({ error: "owner and repo are required" });
  }

  const now = Date.now();
  const velocity = ["v1.2.0", "v1.1.0", "v1.0.0"].map((tag, i) => ({
    tag,
    name: tag,
    publishedAt: new Date(now - i * 45 * 86400000).toISOString(),
    commitCount: [42, 28, 16][i],
    additions: [1200, 840, 320][i],
    deletions: [180, 120, 90][i],
    daysBetween: i === 0 ? null : [45, 60][i - 1],
    commitsPerDay: i === 0 ? null : parseFloat(([42 / 45, 28 / 60][i - 1]).toFixed(2)),
    url: `https://github.com/${owner}/${repo}/releases/tag/${tag}`,
    prerelease: false,
    draft: false,
  }));

  res.json({
    repo: {
      fullName: `${owner}/${repo}`,
      description: `Mock commit velocity data for ${owner}/${repo}`,
      defaultBranch: "main",
      stars: 1284,
      openIssues: 12,
      language: "TypeScript",
    },
    velocity,
    weeklyActivity: Array.from({ length: 12 }, (_, i) => ({
      week: new Date(now - (11 - i) * 7 * 86400000).toISOString().slice(0, 10),
      commits: Math.floor(Math.random() * 30 + 5),
    })),
  });
});

app.post("/api/apps/:appId/functions/updateDevice", (req, res) => {
  const { deviceId, deviceData } = req.body || {};
  let eq = db.equipment.find((e) => e.id === deviceId);
  if (!eq && deviceData?.ip) {
    eq = db.equipment.find((e) => e.ip === deviceData.ip);
  }
  if (!eq && deviceId) {
    eq = {
      id: deviceId,
      created_date: new Date().toISOString(),
      waveguardClassification: "monitored",
      monitoringEnabled: true,
      ...deviceData,
    };
    db.equipment.push(eq);
  } else if (eq) {
    Object.assign(eq, deviceData, { updated_date: new Date().toISOString() });
  }
  res.json({ success: true, device: eq || { id: deviceId, ...deviceData } });
});

// ============================================================
// ENTITIES (generic CRUD)
// ============================================================
const entityHandlers = {
  User: {
    list: () => db.users.map(sanitizeUser),
    get: (id) => sanitizeUser(db.users.find(u => u.id === id)),
    create: (data) => {
      const e = { id: "user-" + Date.now(), ...data, created_date: new Date().toISOString() };
      db.users.push(e);
      return sanitizeUser(e);
    },
    update: (id, data) => {
      const e = db.users.find(u => u.id === id);
      if (e) Object.assign(e, data);
      return sanitizeUser(e);
    },
    delete: (id) => { db.users = db.users.filter(u => u.id !== id); return { success: true }; },
  },
  DeviceGroup: {
    list: () => db.deviceGroups,
    create: (data) => { const e = { id: "group-" + Date.now(), ...data }; db.deviceGroups.push(e); return e; },
    get: (id) => db.deviceGroups.find(g => g.id === id),
    update: (id, data) => { const e = db.deviceGroups.find(g => g.id === id); if (e) Object.assign(e, data); return e; },
    delete: (id) => { db.deviceGroups = db.deviceGroups.filter(g => g.id !== id); return { success: true }; },
  },
  Cable: {
    list: () => db.cables,
    create: (data) => {
      const e = { id: data.id || `cable-${Date.now()}-${db.cables.length}`, ...data };
      db.cables.push(e);
      return e;
    },
    get: (id) => db.cables.find(c => c.id === id),
    update: (id, data) => { const e = db.cables.find(c => c.id === id); if (e) Object.assign(e, data); return e; },
    delete: (id) => { db.cables = db.cables.filter(c => c.id !== id); return { success: true }; },
  },
  MaintenanceTask: {
    list: () => db.maintenanceTasks,
    create: (data) => { const e = { id: "task-" + Date.now(), ...data, status: "pending" }; db.maintenanceTasks.push(e); return e; },
    get: (id) => db.maintenanceTasks.find(t => t.id === id),
    update: (id, data) => { const e = db.maintenanceTasks.find(t => t.id === id); if (e) Object.assign(e, data); return e; },
    delete: (id) => { db.maintenanceTasks = db.maintenanceTasks.filter(t => t.id !== id); return { success: true }; },
  },
  AutomationRule: {
    list: () => db.automationRules,
    create: (data) => { const e = { id: "rule-" + Date.now(), ...data, fire_count: 0, created_date: new Date().toISOString() }; db.automationRules.push(e); return e; },
    get: (id) => db.automationRules.find(r => r.id === id),
    update: (id, data) => { const e = db.automationRules.find(r => r.id === id); if (e) Object.assign(e, data); return e; },
    delete: (id) => { db.automationRules = db.automationRules.filter(r => r.id !== id); return { success: true }; },
  },
  ActionLog: {
    list: () => db.actionLogs,
    create: (data) => { const e = { id: "log-" + Date.now(), ...data, created_date: new Date().toISOString() }; db.actionLogs.push(e); return e; },
    delete: (id) => { db.actionLogs = db.actionLogs.filter(l => l.id !== id); return { success: true }; },
  },
  SystemSettings: {
    filter: (q) => {
      if (q?.key) return db.systemSettings.filter(s => s.key === q.key);
      return db.systemSettings;
    },
    list: () => db.systemSettings,
    create: (data) => { const e = { id: "setting-" + Date.now(), ...data }; db.systemSettings.push(e); return e; },
    update: (id, data) => { const e = db.systemSettings.find(s => s.id === id); if (e) Object.assign(e, data); return e; },
  },
  LayoutTopology: {
    list: () => db.layoutTopology,
    get: (id) => db.layoutTopology.find(l => l.id === id),
    create: (data) => { const e = { id: "layout-" + Date.now(), ...data, created_date: new Date().toISOString() }; db.layoutTopology.push(e); return e; },
    update: (id, data) => { const e = db.layoutTopology.find(l => l.id === id); if (e) Object.assign(e, data); return e; },
    delete: (id) => { db.layoutTopology = db.layoutTopology.filter(l => l.id !== id); return { success: true }; },
  },
  Equipment: {
    list: () => db.equipment.map((e, idx) => normalizeEquipmentRow(e, idx)),
    filter: (q) => {
      let rows = db.equipment.map((e, idx) => normalizeEquipmentRow(e, idx));
      if (q?.ip) rows = rows.filter((e) => e.ip === q.ip);
      if (q?.id) rows = rows.filter((e) => e.id === q.id);
      return rows;
    },
    get: (id) => {
      const e = db.equipment.find((x) => x.id === id);
      return e ? normalizeEquipmentRow(e, db.equipment.indexOf(e)) : null;
    },
    create: (data) => {
      const nameKey = (data.name || "").trim().toLowerCase();
      const existing =
        (data.ip ? db.equipment.find((e) => e.ip === data.ip) : null) ||
        (nameKey ? db.equipment.find((e) => (e.name || "").trim().toLowerCase() === nameKey) : null);
      if (existing) {
        Object.assign(existing, data, enrichEquipmentMeta({ ...existing, ...data }));
        existing.updated_date = new Date().toISOString();
        return existing;
      }
      const e = {
        id: data.id || `dev-${Date.now()}`,
        ...data,
        ...enrichEquipmentMeta(data),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      db.equipment.push(e);
      return e;
    },
    update: (id, data) => {
      const e = db.equipment.find(x => x.id === id);
      if (e) Object.assign(e, data, enrichEquipmentMeta({ ...e, ...data }));
      if (e) e.updated_date = new Date().toISOString();
      return e;
    },
    delete: (id) => {
      db.equipment = db.equipment.filter((e) => e.id !== id);
      return { success: true };
    },
  },
  RackLayout: {
    list: () => db.rackLayouts,
    get: (id) => db.rackLayouts.find(l => l.id === id),
    create: (data) => {
      if (data.is_default) db.rackLayouts.forEach(l => { l.is_default = false; });
      const e = { id: "rack-layout-" + Date.now(), ...data, created_date: new Date().toISOString() };
      db.rackLayouts.push(e);
      return e;
    },
    update: (id, data) => {
      if (data.is_default) db.rackLayouts.forEach(l => { l.is_default = false; });
      const e = db.rackLayouts.find(l => l.id === id);
      if (e) Object.assign(e, data, { updated_date: new Date().toISOString() });
      return e;
    },
    delete: (id) => {
      db.rackLayouts = db.rackLayouts.filter(l => l.id !== id);
      return { success: true };
    },
  },
  SignalLink: {
    list: () => db.signalLinks,
    filter: (q) => {
      let rows = db.signalLinks;
      if (q?.kind) rows = rows.filter(s => s.kind === q.kind);
      return rows;
    },
    get: (id) => db.signalLinks.find(s => s.id === id),
    create: (data) => {
      const e = { id: "sig-" + Date.now(), ...data };
      db.signalLinks.push(e);
      return e;
    },
    delete: (id) => {
      db.signalLinks = db.signalLinks.filter(s => s.id !== id);
      return { success: true };
    },
  },
};

app.all("/api/apps/:appId/entities/:entityName/:id?", (req, res) => {
  const { entityName, id } = req.params;
  const handler = entityHandlers[entityName];
  if (!handler) return res.status(404).json({ message: `Unknown entity: ${entityName}` });

  const method = req.method.toUpperCase();
  try {
    let result;
    if (method === "GET" && id) {
      result = handler.get ? handler.get(id) : handler.list().find(e => e.id === id);
      if (!result) return res.status(404).json({ message: "Not found" });
    } else if (method === "GET") {
      const q = req.query.q ? JSON.parse(req.query.q) : null;
      result = handler.filter ? handler.filter(q) : handler.list();
    } else if (method === "POST" && !id) {
      result = handler.create(req.body);
      if (entityName === "Cable") result = { ...result, ...req.body };
    } else if (method === "PUT" && id) {
      result = handler.update(id, req.body);
    } else if (method === "DELETE" && id) {
      result = handler.delete(id);
    } else if (method === "DELETE" && !id) {
      result = { success: true, deleted: 0 };
    } else if (method === "POST" && req.path.endsWith("/bulk")) {
      result = (req.body || []).map(d => handler.create(d));
    } else {
      return res.status(405).json({ message: "Method not allowed" });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message, code: "server_error" });
  }
});

// Support PATCH for update-many
app.patch("/api/apps/:appId/entities/:entityName/update-many", (req, res) => {
  res.json({ modifiedCount: 1 });
});

// Support PUT for bulk
app.put("/api/apps/:appId/entities/:entityName/bulk", (req, res) => {
  res.json({ modifiedCount: (req.body || []).length });
});

app.post("/api/apps/:appId/functions/importVesselSpreadsheet", async (req, res) => {
  try {
    const { commitVesselImport } = await import("../src/lib/spreadsheet/commitImport.js");
    const { parseAndBuildImport } = await import("../src/lib/spreadsheet/index.js");
    const { payload: bodyPayload, options = {}, fileBase64 } = req.body || {};

    let payload = bodyPayload;
    if (!payload && fileBase64) {
      const buffer = Buffer.from(fileBase64, "base64");
      const { payload: built } = parseAndBuildImport(buffer, {
        enabledGroups: options.enabledGroups,
        floorMap: options.floorMap,
      });
      payload = built;
    }
    if (!payload) {
      return res.status(400).json({ success: false, error: "payload or fileBase64 required" });
    }

    if (options.replace) {
      db.equipment = [];
      db.cables = [];
    }

    const existingByName = new Map(
      db.equipment.map((e) => [(e.name || "").trim().toLowerCase(), e])
    );
    const existingByIp = new Map(db.equipment.filter((e) => e.ip).map((e) => [e.ip, e]));
    const existingCableLabels = new Set(db.cables.map((c) => c.label).filter(Boolean));

    const deps = {
      getExistingByName: async () => existingByName,
      getExistingByIp: async () => existingByIp,
      getExistingCableLabels: async () => existingCableLabels,
      createEquipment: (data) => entityHandlers.Equipment.create(data),
      updateEquipment: (id, data) => entityHandlers.Equipment.update(id, data),
      createCable: (data) => entityHandlers.Cable.create(data),
      bulkCreateCables: (rows) => rows.map((r) => entityHandlers.Cable.create(r)),
      clearEquipment: async () => {
        const n = db.equipment.length;
        db.equipment = [];
        existingByName.clear();
        existingByIp.clear();
        return n;
      },
      clearCables: async () => {
        const n = db.cables.length;
        db.cables = [];
        existingCableLabels.clear();
        return n;
      },
      saveSiteLocations: async (siteLocations) => {
        const key = "site-locations";
        const existing = db.systemSettings.find((s) => s.key === key);
        const value = JSON.stringify(siteLocations);
        if (existing) existing.value = value;
        else db.systemSettings.push({ id: `setting-${Date.now()}`, key, value });
      },
      saveDiscoverySubnets: async (subnets) => {
        const key = "discovery";
        const existing = db.systemSettings.find((s) => s.key === key);
        let parsed = { subnets: [] };
        if (existing?.value) {
          try {
            parsed = typeof existing.value === "string" ? JSON.parse(existing.value) : existing.value;
          } catch {
            parsed = { subnets: [] };
          }
        }
        const toCidr = (entry) => {
          if (!entry) return null;
          if (typeof entry === "string") return entry.trim() || null;
          if (typeof entry === "object" && entry.cidr) return String(entry.cidr).trim() || null;
          return null;
        };
        const merge = (arr) => [...new Set((arr || []).map(toCidr).filter(Boolean))];
        parsed.subnets = merge([...(parsed.subnets || []), ...(subnets || [])]);
        const value = JSON.stringify(parsed);
        if (existing) existing.value = value;
        else db.systemSettings.push({ id: `setting-${Date.now()}`, key, value });
      },
      saveRackLayout: async (layout) => entityHandlers.RackLayout.create(layout),
    };

    const result = await commitVesselImport(deps, payload, options);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[importVesselSpreadsheet]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// INTEGRATIONS
// ============================================================
app.post(
  "/api/apps/:appId/integration-endpoints/Core/UploadFile",
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const file_url = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    res.json({ file_url });
  }
);

app.post("/api/apps/:appId/integration-endpoints/Core/ExtractDataFromUploadedFile", (req, res) => {
  const schema = req.body?.json_schema?.properties || {};
  const wantsDevices = Boolean(schema.devices);
  res.json({
    status: "success",
    output: wantsDevices ? {
      devices: [
        { name: "Router-Core", ip_address: "192.168.10.1", mac_address: "00:1A:2B:3C:4D:5E", category: "Network", location: "Bridge Rack", model: "Cisco ISR 1100", serial_number: "ISR-001", firmware: "17.9.3", notes: "" },
        { name: "SW-Bridge", ip_address: "192.168.10.2", mac_address: "00:1A:2B:3C:4D:5F", category: "Network", location: "Bridge Rack", model: "Cisco CBS350-24P", serial_number: "FOC2241X0AB", firmware: "3.2.1", notes: "" },
        { name: "Cam-Bow-01", ip_address: "192.168.20.10", mac_address: "00:1A:2B:3C:4D:60", category: "Camera", location: "Bow", model: "Dahua IPC-HFW2831T", serial_number: "DAH-001", firmware: "2.820", notes: "" },
      ],
    } : {
      cables: [
        { label: "C-001", type: "Cat6A", system_category: "Network", from_equipment: "Router-WAN", to_equipment: "SW-Bridge", length: "5m", deck: "Bridge", status: "installed", notes: "" },
        { label: "C-002", type: "Cat6", system_category: "Network", from_equipment: "SW-Bridge", to_equipment: "AP-Bridge", length: "12m", deck: "Bridge", status: "installed", notes: "Ceiling run" },
      ],
    },
  });
});

app.post("/api/apps/:appId/integration-endpoints/Core/InvokeLLM", (req, res) => {
  const { prompt, response_json_schema } = req.body;
  const lower = (prompt || "").toLowerCase();
  let response;
  if (response_json_schema || lower.includes("json object")) {
    response = {
      "C-001": { path: ["Router-WAN", "SW-Bridge"], confidence: "high", notes: "Direct patch to switch" },
      "C-002": { path: ["SW-Bridge", "Patch Panel B3", "AP-Bridge"], confidence: "medium", notes: "Assumed via patch panel in bridge rack" },
    };
    return res.json(response);
  }
  if (lower.includes("cable") || lower.includes("path")) {
    response = {
      "C-001": { path: ["Router-WAN", "SW-Bridge"], confidence: "high", notes: "Direct patch to switch" },
      "C-002": { path: ["SW-Bridge", "Patch Panel B3", "AP-Bridge"], confidence: "medium", notes: "Assumed via patch panel in bridge rack" },
    };
    return res.json(response);
  }
  if (lower.includes("poe")) {
    response = "A PoE camera going offline can be caused by:\n\n1. **PoE budget exceeded** — check switch PoE power consumption\n2. **Faulty cable** — test with a cable certifier\n3. **Camera power supply failure** — check the camera's LED indicators\n4. **Switch port issue** — try bouncing the port or moving to a different port\n5. **Firmware bug** — check for known issues with the camera model";
  } else if (lower.includes("cpu") || lower.includes("switch")) {
    response = "High CPU on a managed switch:\n\n1. **Check for loops** — look for STP topology changes\n2. **Broadcast storms** — check port traffic stats\n3. **SNMP polling overload** — reduce polling frequency\n4. **Firmware upgrade** — check vendor release notes\n5. **Hardware fault** — check temperature and error counters";
  } else {
    response = "Based on the system data, I recommend checking the equipment status in the Network Map and reviewing any active alarms in the Dashboard. For specific troubleshooting, please provide more details about the issue you're experiencing.";
  }
  res.json(response);
});

app.post("/api/apps/:appId/integration-endpoints/Core/:endpoint", (req, res) => {
  res.json({ success: true, message: `Mock ${req.params.endpoint} completed`, output: {} });
});

// ============================================================
// APP LOGS
// ============================================================
app.post("/app-logs/:appId/log-user-in-app/:pageName", (req, res) => res.json({}));
app.get("/app-logs/:appId", (req, res) => res.json([]));
app.get("/app-logs/:appId/stats", (req, res) => res.json({ totalLogins: 42 }));

// ============================================================
// ANALYTICS
// ============================================================
app.post("/api/apps/:appId/analytics/track/batch", (req, res) => res.json({}));

// ============================================================
// SOCKET.IO (stub)
// ============================================================
app.get("/ws-user-apps/socket.io/", (req, res) => res.json({}));

// ============================================================
// OAUTH REDIRECTS (local dev stubs)
// ============================================================
app.get("/api/apps/auth/login", (req, res) => {
  const fromUrl = req.query.from_url || "http://localhost:5174";
  res.redirect(`${fromUrl}?access_token=mock-oauth-token-${Date.now()}`);
});

app.get("/api/apps/auth/logout", (req, res) => {
  const fromUrl = req.query.from_url || "http://localhost:5174/login";
  res.redirect(`${fromUrl}`);
});

app.get("/api/apps/auth/:provider/login", (req, res) => {
  const fromUrl = req.query.from_url || "http://localhost:5174";
  res.redirect(`${fromUrl}?access_token=mock-oauth-token-${Date.now()}`);
});

// ============================================================
// SETTINGS API (backups, integrations test, users, AI, docs)
// ============================================================
function collectBackupSnapshot() {
  const settings = db.systemSettings.filter((s) => s.key);
  const users = db.users.map(sanitizeUser);
  return {
    systemSettings: settings,
    users,
    exportedAt: new Date().toISOString(),
  };
}

/** Resolve user from session token; aligns with GET /entities/User/me mock behaviour. */
function getRequestUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  if (token === "mock-dev-token") {
    return db.users.find((u) => u.role === "admin") ?? db.users[0];
  }
  const userId = token ? db.sessions[token] : null;
  if (userId) {
    return db.users.find((u) => u.id === userId) ?? null;
  }
  return db.users.find((u) => u.role === "admin") ?? db.users[0];
}

function getAdminUserFromRequest(req) {
  const user = getRequestUser(req);
  return user?.role === "admin" ? user : null;
}

function handlePlatformReset(req, res) {
  if (!getAdminUserFromRequest(req)) {
    return res.status(403).json({ message: "Administrator access required" });
  }
  const confirm = String(req.body?.confirm || "").trim().toUpperCase();
  if (confirm !== PLATFORM_RESET_CONFIRM) {
    return res.status(400).json({
      message: `Type ${PLATFORM_RESET_CONFIRM} to confirm platform reset`,
    });
  }
  applyFactoryResetToDb(db);
  console.log("[platform] Factory reset applied — operational data cleared");
  res.json({
    success: true,
    message: "Platform reset to factory defaults",
    clearedAt: new Date().toISOString(),
  });
}

app.post("/api/apps/:appId/platform/reset", handlePlatformReset);
app.post("/api/apps/:appId/functions/resetPlatform", handlePlatformReset);

app.get("/api/apps/:appId/backups", (req, res) => {
  res.json({ backups: db.backups });
});

app.get("/api/apps/:appId/backups/:id", (req, res) => {
  const backup = db.backups.find((b) => b.id === req.params.id);
  if (!backup) return res.status(404).json({ message: "Backup not found" });
  res.json(backup);
});

app.post("/api/apps/:appId/backups", (req, res) => {
  const { createdBy } = req.body;
  const snapshot = collectBackupSnapshot();
  const json = JSON.stringify(snapshot);
  const backup = {
    id: "backup-" + Date.now(),
    label: `Backup ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || "Unknown",
    size: json.length,
    snapshot,
  };
  db.backups.unshift(backup);
  res.json({ backup });
});

app.post("/api/apps/:appId/backups/:id/restore", (req, res) => {
  const backup = db.backups.find((b) => b.id === req.params.id);
  if (!backup) return res.status(404).json({ message: "Backup not found" });
  const snap = backup.snapshot;
  if (snap?.systemSettings) {
    snap.systemSettings.forEach((s) => {
      const existing = db.systemSettings.find((x) => x.key === s.key);
      if (existing) Object.assign(existing, s);
      else db.systemSettings.push({ id: "setting-" + Date.now(), ...s });
    });
  }
  res.json({ success: true, message: "Configuration restored" });
});

app.post("/api/apps/:appId/integrations/test", async (req, res) => {
  const { integrationKey, config } = req.body;
  if (!integrationKey) return res.status(400).json({ message: "integrationKey required", ok: false });

  const key = String(integrationKey).toLowerCase();
  const host = config?.host || config?.baseUrl || config?.brokerUrl;

  if (!host && !["snmp", "mqtt"].includes(key)) {
    return res.status(400).json({ message: "Host or URL required", ok: false });
  }

  try {
    const { runIntegrationProbe } = await import("../scanner/integrations/integrationProbes.js");
    const result = await runIntegrationProbe(key, config || {});
    if (!result.ok) {
      return res.status(400).json({ ok: false, message: result.message, detail: result.detail || null });
    }
    return res.json({ ok: true, message: result.message, detail: result.detail || null });
  } catch (err) {
    console.error("[integrations/test]", err);
    return res.status(500).json({ ok: false, message: err.message || "Integration test failed" });
  }
});

app.post("/api/apps/:appId/ai/test-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith("sk-")) {
    return res.status(400).json({ message: "Invalid API key format", ok: false });
  }
  res.json({ ok: true, message: "API key format valid (mock)" });
});

app.post("/api/apps/:appId/documentation/reindex", (req, res) => {
  res.json({
    ok: true,
    message: "Re-index started",
    paths: req.body,
    documentsIndexed: 14,
  });
});

app.get("/api/apps/:appId/users", (req, res) => {
  res.json({ users: db.users.map(sanitizeUser) });
});

app.post("/api/apps/:appId/users", (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }
  if (db.users.some((u) => u.username?.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ message: "Username already exists" });
  }
  const user = {
    id: "user-" + Date.now(),
    username,
    email: `${username}@local`,
    name: username,
    full_name: username,
    role: role || "user",
    password,
    created_date: new Date().toISOString(),
  };
  db.users.push(user);
  res.json({ user: sanitizeUser(user) });
});

app.put("/api/apps/:appId/users/:id", (req, res) => {
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const { role, password } = req.body;
  if (role) user.role = role;
  if (password) user.password = password;
  res.json({ user: sanitizeUser(user) });
});

app.delete("/api/apps/:appId/users/:id", (req, res) => {
  if (req.params.id === "user-admin") {
    return res.status(400).json({ message: "Cannot delete default admin" });
  }
  db.users = db.users.filter((u) => u.id !== req.params.id);
  res.json({ success: true });
});

// ---- Start ----
ensureDefaultWanRouterProfile();
pollAllStoredCiscoSwitches().catch((err) => {
  console.warn("[ciscoPoll] initial fleet poll failed:", err?.message || err);
});
setInterval(() => {
  pollAllStoredCiscoSwitches().catch((err) => {
    console.warn("[ciscoPoll] background fleet poll failed:", err?.message || err);
  });
}, CISCO_BACKGROUND_POLL_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`[mock-base44] Server running at http://localhost:${PORT}`);
  console.log(`[mock-base44] App ID: ${APP_ID}`);
  console.log(`[mock-base44] Endpoints ready:`);
  console.log(`  - Auth: /api/apps/${APP_ID}/auth/*`);
  console.log(`  - Functions: /api/apps/${APP_ID}/functions/*`);
  console.log(`  - Entities: /api/apps/${APP_ID}/entities/*`);
  console.log(`  - Platform reset: POST /api/apps/${APP_ID}/platform/reset`);
  console.log(`  - Integrations: /api/apps/${APP_ID}/integration-endpoints/Core/*`);
  console.log(`  - Network scanner: ${USE_MOCK_SCAN ? "MOCK (demo devices only)" : "LIVE (ping/arp/full on this host)"}`);
  console.log(`  - Scanner health: GET /api/apps/${APP_ID}/scanner/health`);
  console.log(`  - Mock devices: ${db.equipment.length} equipment items`);
  console.log(`  - Mock cables: ${db.cables.length} cables`);
  console.log(`  - Mock tasks: ${db.maintenanceTasks.length} maintenance tasks`);
});
