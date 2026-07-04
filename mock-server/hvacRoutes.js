import express from "express";

const HVAC_STATE = {
  owner_cabin: {
    id: "owner_cabin", name: "Owner Cabin", deck: "Main Deck", room: "Owner Suite",
    manufacturer: "frigomar", protocol: "modbus_rtu", online: true,
    currentTemperature: 22.5, targetTemperature: 22, humidity: 52,
    mode: "cool", fanSpeed: "medium", powerState: "on",
    valveStatus: 65, compressorStatus: true, alarmStatus: false, alarmCode: "0",
  },
  vip_cabin: {
    id: "vip_cabin", name: "VIP Cabin", deck: "Main Deck", room: "VIP Suite",
    manufacturer: "dometic", protocol: "modbus_tcp", online: true,
    currentTemperature: 23.0, targetTemperature: 23, humidity: 48,
    mode: "auto", fanSpeed: "low", powerState: "on",
    valveStatus: 45, compressorStatus: true, alarmStatus: false, alarmCode: "0",
  },
  guest_cabin_port: {
    id: "guest_cabin_port", name: "Guest Cabin Port", deck: "Lower Deck", room: "Guest Cabin Port",
    manufacturer: "condaria", protocol: "bacnet_ip", online: true,
    currentTemperature: 21.0, targetTemperature: 22, humidity: 55,
    mode: "heat", fanSpeed: "auto", powerState: "on",
    valveStatus: 30, compressorStatus: false, alarmStatus: false, alarmCode: "0",
  },
  guest_cabin_stbd: {
    id: "guest_cabin_stbd", name: "Guest Cabin Starboard", deck: "Lower Deck", room: "Guest Cabin Starboard",
    manufacturer: "frigomar", protocol: "modbus_rtu", online: false,
    currentTemperature: 19.5, targetTemperature: 22, humidity: null,
    mode: "off", fanSpeed: "auto", powerState: "off",
    valveStatus: 0, compressorStatus: false, alarmStatus: true, alarmCode: "E-02",
  },
  main_saloon: {
    id: "main_saloon", name: "Main Saloon", deck: "Main Deck", room: "Saloon",
    manufacturer: "condaria", protocol: "bacnet_ip", online: true,
    currentTemperature: 24.0, targetTemperature: 24, humidity: 45,
    mode: "cool", fanSpeed: "high", powerState: "on",
    valveStatus: 80, compressorStatus: true, alarmStatus: false, alarmCode: "0",
  },
  bridge: {
    id: "bridge", name: "Bridge", deck: "Upper Deck", room: "Wheelhouse",
    manufacturer: "dometic", protocol: "modbus_tcp", online: true,
    currentTemperature: 25.0, targetTemperature: 24, humidity: 40,
    mode: "cool", fanSpeed: "auto", powerState: "on",
    valveStatus: 55, compressorStatus: true, alarmStatus: false, alarmCode: "0",
  },
  crew_mess: {
    id: "crew_mess", name: "Crew Mess", deck: "Lower Deck", room: "Crew Mess",
    manufacturer: "frigomar", protocol: "modbus_rtu", online: true,
    currentTemperature: 20.0, targetTemperature: 21, humidity: 58,
    mode: "heat", fanSpeed: "low", powerState: "on",
    valveStatus: 25, compressorStatus: false, alarmStatus: false, alarmCode: "0",
  },
  galley: {
    id: "galley", name: "Galley", deck: "Main Deck", room: "Galley",
    manufacturer: "generic", protocol: "modbus_rtu", online: true,
    currentTemperature: 26.0, targetTemperature: 24, humidity: 60,
    mode: "cool", fanSpeed: "high", powerState: "on",
    valveStatus: 90, compressorStatus: true, alarmStatus: false, alarmCode: "0",
  },
  owner_cabin_crestron: {
    id: "owner_cabin_crestron", name: "Owner Cabin (Crestron)", deck: "Main Deck", room: "Owner Suite",
    manufacturer: "frigomar", protocol: "crestron_gateway", online: true,
    currentTemperature: 22.5, targetTemperature: 22, humidity: 52,
    mode: "cool", fanSpeed: "medium", powerState: "on",
    valveStatus: 65, compressorStatus: true, alarmStatus: false, alarmCode: "0",
  },
  vip_cabin_crestron: {
    id: "vip_cabin_crestron", name: "VIP Cabin (Crestron)", deck: "Main Deck", room: "VIP Suite",
    manufacturer: "dometic", protocol: "crestron_gateway", online: true,
    currentTemperature: 23.0, targetTemperature: 23, humidity: 48,
    mode: "auto", fanSpeed: "low", powerState: "on",
    valveStatus: 45, compressorStatus: true, alarmStatus: false, alarmCode: "0",
  },
};

let pollInterval = null;

function simulateTemperatureChanges() {
  for (const zone of Object.values(HVAC_STATE)) {
    if (zone.online && zone.powerState === "on") {
      const drift = (Math.random() - 0.5) * 0.3;
      if (zone.currentTemperature != null) {
        zone.currentTemperature = Math.round((zone.currentTemperature + drift) * 10) / 10;
      }
      if (zone.humidity != null) {
        zone.humidity = Math.round((zone.humidity + (Math.random() - 0.5) * 2) * 10) / 10;
      }
    }
  }
}

function startSimulation() {
  if (pollInterval) return;
  pollInterval = setInterval(simulateTemperatureChanges, 4000);
}

function stopSimulation() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

startSimulation();

export default function createHVACRouter() {
  const router = express.Router();

  // GET /api/hvac/zones
  router.get("/zones", (_req, res) => {
    res.json(Object.values(HVAC_STATE));
  });

  // GET /api/hvac/zones/:id
  router.get("/zones/:id", (req, res) => {
    const zone = HVAC_STATE[req.params.id];
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    res.json(zone);
  });

  // POST /api/hvac/zones/:id/power
  router.post("/zones/:id/power", (req, res) => {
    const zone = HVAC_STATE[req.params.id];
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    const { power } = req.body;
    if (typeof power !== "boolean") return res.status(400).json({ error: "power must be boolean" });
    if (Math.random() < 0.08) return res.status(503).json({ error: "Simulated HVAC write failure" });
    zone.powerState = power ? "on" : "off";
    zone.online = true;
    res.json({ success: true, zoneId: req.params.id, power });
  });

  // POST /api/hvac/zones/:id/setpoint
  router.post("/zones/:id/setpoint", (req, res) => {
    const zone = HVAC_STATE[req.params.id];
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    const temp = Number(req.body.temperature);
    if (!Number.isFinite(temp)) return res.status(400).json({ error: "temperature must be a number" });
    if (temp < 16 || temp > 30) return res.status(400).json({ error: "Setpoint must be between 16°C and 30°C" });
    zone.targetTemperature = temp;
    res.json({ success: true, zoneId: req.params.id, temperature: temp });
  });

  // POST /api/hvac/zones/:id/mode
  router.post("/zones/:id/mode", (req, res) => {
    const zone = HVAC_STATE[req.params.id];
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    const { mode } = req.body;
    const valid = ["off", "cool", "heat", "auto", "dry", "fan_only"];
    if (!valid.includes(mode)) return res.status(400).json({ error: `Invalid mode "${mode}"` });
    zone.mode = mode;
    res.json({ success: true, zoneId: req.params.id, mode });
  });

  // POST /api/hvac/zones/:id/fan
  router.post("/zones/:id/fan", (req, res) => {
    const zone = HVAC_STATE[req.params.id];
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    const { fanSpeed } = req.body;
    const valid = ["auto", "low", "medium", "high"];
    if (!valid.includes(fanSpeed)) return res.status(400).json({ error: `Invalid fanSpeed "${fanSpeed}"` });
    zone.fanSpeed = fanSpeed;
    res.json({ success: true, zoneId: req.params.id, fanSpeed });
  });

  // GET /api/hvac/zones/:id/diagnostics
  router.get("/zones/:id/diagnostics", (req, res) => {
    const zone = HVAC_STATE[req.params.id];
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    res.json({
      zoneId: req.params.id,
      protocol: zone.protocol,
      manufacturer: zone.manufacturer,
      lastCommunicationTime: new Date().toISOString(),
      lastSuccessfulRead: new Date().toISOString(),
      lastWriteTime: null,
      lastWriteSuccess: null,
      lastErrorMessage: null,
      rawValues: { ...zone },
      retryCount: 0,
      connectionState: "connected",
    });
  });

  // GET /api/hvac/system/status
  router.get("/system/status", (_req, res) => {
    const zones = Object.values(HVAC_STATE);
    const totalZones = zones.length;
    const onlineZones = zones.filter((z) => z.online).length;
    const offlineZones = totalZones - onlineZones;
    const alarmZones = zones.filter((z) => z.alarmStatus).length;
    let overall = "healthy";
    if (onlineZones === 0) overall = "offline";
    else if (offlineZones > 0 || alarmZones > 0) overall = "degraded";

    res.json({
      overall,
      totalZones,
      onlineZones,
      offlineZones,
      alarmZones,
      lastPollTime: new Date().toISOString(),
      adapters: Object.fromEntries(
        zones.map((z) => [z.id, { connected: z.online, lastError: null }])
      ),
    });
  });

  return router;
};
