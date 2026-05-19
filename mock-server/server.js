import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  ],
  layoutTopology: [],
  equipment: generateMockEquipment(17),
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

function generateMockEquipment(count) {
  const items = [
    { name: "SW-Bridge", model: "Cisco CBS350-24P", category: "Network", ip: "192.168.10.2", location: "Bridge Rack", serial: "FOC2241X0AB", condition: "Excellent" },
    { name: "SW-CCTV", model: "Cisco CBS350-8P", category: "Network", ip: "192.168.10.3", location: "Bridge Rack", serial: "FOC2241X0AC", condition: "Good" },
    { name: "Router-WAN", model: "Cisco ISR 1100", category: "Network", ip: "10.0.0.1", location: "Bridge Rack", serial: "ISR1100-001", condition: "Excellent" },
    { name: "UPS-Main", model: "APC SRT 3000", category: "Power", ip: "192.168.10.100", location: "Engine Room", serial: "APC-SRT-001", condition: "Good" },
    { name: "Cam-Bow-01", model: "Dahua IPC-HFW2831T", category: "Camera", ip: "192.168.20.10", location: "Bow - External", serial: "DAHUA-001", condition: "Fair" },
    { name: "Cam-Stern-01", model: "Dahua IPC-HFW2831T", category: "Camera", ip: "192.168.20.11", location: "Stern - External", serial: "DAHUA-002", condition: "Excellent" },
    { name: "Cam-Saloon-01", model: "Dahua IPC-HDW2831T", category: "Camera", ip: "192.168.20.12", location: "Saloon Ceiling", serial: "DAHUA-003", condition: "Good" },
    { name: "AP-Bridge", model: "Ubiquiti U6 Pro", category: "Network", ip: "192.168.10.50", location: "Bridge Ceiling", serial: "U6PRO-001", condition: "Excellent" },
    { name: "AP-Saloon", model: "Ubiquiti U6 Pro", category: "Network", ip: "192.168.10.51", location: "Saloon Ceiling", serial: "U6PRO-002", condition: "Good" },
    { name: "NAS-Main", model: "Synology DS1621+", category: "Network", ip: "192.168.10.20", location: "Bridge Rack", serial: "SYNO-001", condition: "Excellent" },
    { name: "Q-SYS-Core", model: "QSC Core 110f", category: "AV", ip: "192.168.30.2", location: "AV Rack", serial: "QSC-001", condition: "Excellent" },
    { name: "TV-Saloon-01", model: "Samsung QLED 75\"", category: "AV", ip: "192.168.30.10", location: "Saloon Wall", serial: "SAM-001", condition: "Good" },
    { name: "TV-Saloon-02", model: "Samsung QLED 55\"", category: "AV", ip: "192.168.30.11", location: "Saloon Wall", serial: "SAM-002", condition: "Good" },
    { name: "Lighting-Controller", model: "Lutron QS", category: "Lighting", ip: "192.168.40.2", location: "AV Rack", serial: "LUT-001", condition: "Good" },
    { name: "Sirius-Weather", model: "Sirius XM Weather", category: "Other", ip: "192.168.10.200", location: "Bridge Console", serial: "SIRIUS-001", condition: "Excellent" },
    { name: "Starlink", model: "Starlink Standard", category: "Network", ip: "10.0.0.2", location: "Upper Deck", serial: "SLINK-001", condition: "Good" },
    { name: "SW-AV-Rack", model: "Cisco CBS350-8P", category: "Network", ip: "192.168.30.1", location: "AV Rack", serial: "FOC2241X0AD", condition: "Excellent" },
  ];
  return items.map((item, i) => ({
    id: `dev-${i + 1}`,
    ...item,
    notes: "",
    created_date: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
    updated_date: new Date().toISOString(),
  }));
}

function getMockDevices() {
  const devices = db.equipment.map(e => ({
    id: e.id,
    name: e.name,
    ip: e.ip,
    mac: `00:1A:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}`,
    hostname: e.name.toLowerCase(),
    vendor: e.model.split(" ")[0],
    model: e.model,
    category: e.category,
    status: ["online", "online", "online", "online", "warning", "offline"][Math.floor(Math.random() * 6)],
    location: e.location,
    subnet: e.ip.substring(0, e.ip.lastIndexOf(".")) + ".0/24",
    openPorts: [22, 80, 443, 161, ...(e.category === "Camera" ? [554, 37777] : []), ...(e.category === "AV" ? [1702] : [])],
    responseTimeMs: Math.floor(Math.random() * 80 + 1),
    firstSeen: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
  }));
  return devices;
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
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  const userId = db.sessions[token];
  const user = userId ? db.users.find((u) => u.id === userId) : db.users[0];
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
app.post("/api/apps/:appId/functions/networkScan", (req, res) => {
  const { subnets, scanType, target } = req.body;
  const devices = getMockDevices();
  const scanSubnets = subnets || ["192.168.10.0/24"];

  if (target) {
    const device = devices.find(d => d.ip === target) || {
      id: "scan-" + Date.now(),
      name: target,
      ip: target,
      status: "online",
      category: "Network",
      responseTimeMs: Math.floor(Math.random() * 40 + 5),
    };
    return res.json({
      success: true,
      devices: [device],
      target,
      totalFound: 1,
      scanInterface: "eth0",
      durationMs: Math.floor(Math.random() * 800 + 200),
      subnets: scanSubnets,
      scanType: scanType || "ping",
    });
  }

  res.json({
    success: true,
    devices,
    totalFound: devices.length,
    scanInterface: "eth0",
    durationMs: Math.floor(Math.random() * 3000 + 1500),
    subnets: scanSubnets,
    scanType: scanType || "ping",
  });
});

app.post("/api/apps/:appId/functions/snmpTopologyScan", (req, res) => {
  const result = getTopologyScanResult();
  setTimeout(() => res.json(result), 800);
});

app.post("/api/apps/:appId/functions/snmpPortMap", (req, res) => {
  const switches = db.equipment.filter(e => e.model && e.model.includes("CBS"));
  const connectionMap = switches.map(sw => ({
    name: sw.name,
    ip: sw.ip,
    portsUp: Math.floor(Math.random() * 10 + 4),
    portsDown: Math.floor(Math.random() * 2),
    ports: Array.from({ length: Math.floor(Math.random() * 12 + 8) }, (_, i) => ({
      port: i + 1,
      ifOperStatus: Math.random() > 0.15 ? "up" : "down",
      ifAlias: `Port ${i + 1}`,
      connectedDevice: Math.random() > 0.4 ? `device-${Math.floor(Math.random() * 20 + 1)}` : null,
      macAddr: `00:1A:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}:${String(Math.floor(Math.random() * 255)).padStart(2, "0")}`,
      ifSpeed: ["10M", "100M", "1G", "10G"][Math.floor(Math.random() * 4)],
      vlan: Math.floor(Math.random() * 10 + 1) * 100,
    })),
  }));
  res.json({
    success: true,
    connectionMap,
    totalConnections: connectionMap.reduce((a, s) => a + s.ports.filter(p => p.connectedDevice).length, 0),
    disconnectedPorts: connectionMap.reduce((a, s) => a + s.portsDown, 0),
    switches: connectionMap,
    polledAt: new Date().toISOString(),
  });
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
  const { deviceId, deviceData } = req.body;
  const eq = db.equipment.find(e => e.id === deviceId);
  if (eq) Object.assign(eq, deviceData);
  res.json({ success: true, device: eq || { id: deviceId } });
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
    create: (data) => { const e = { id: "cable-" + Date.now(), ...data }; db.cables.push(e); return e; },
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

app.post("/api/apps/:appId/integrations/test", (req, res) => {
  const { integrationKey, config } = req.body;
  if (!integrationKey) return res.status(400).json({ message: "integrationKey required" });
  const host = config?.host || config?.baseUrl || config?.brokerUrl;
  if (!host && integrationKey !== "snmp") {
    return res.status(400).json({ message: "Host or URL required", ok: false });
  }
  res.json({ ok: true, message: `${integrationKey} connection test succeeded (mock)` });
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
app.listen(PORT, () => {
  console.log(`[mock-base44] Server running at http://localhost:${PORT}`);
  console.log(`[mock-base44] App ID: ${APP_ID}`);
  console.log(`[mock-base44] Endpoints ready:`);
  console.log(`  - Auth: /api/apps/${APP_ID}/auth/*`);
  console.log(`  - Functions: /api/apps/${APP_ID}/functions/*`);
  console.log(`  - Entities: /api/apps/${APP_ID}/entities/*`);
  console.log(`  - Integrations: /api/apps/${APP_ID}/integration-endpoints/Core/*`);
  console.log(`  - Mock devices: ${db.equipment.length} equipment items`);
  console.log(`  - Mock cables: ${db.cables.length} cables`);
  console.log(`  - Mock tasks: ${db.maintenanceTasks.length} maintenance tasks`);
});
