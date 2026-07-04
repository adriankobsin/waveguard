import express from "express";

const BASE_PATH = "/cws/api";
const PROGRAM_SLOT = 1;

const ZONE_REGISTERS = {
  owner_cabin: 100,
  vip_cabin: 200,
  guest_cabin_port: 300,
  guest_cabin_stbd: 400,
  main_saloon: 500,
  bridge: 600,
  crew_mess: 700,
  galley: 800,
};

const ZONE_STATE = {};

function initState() {
  for (const [zoneId, base] of Object.entries(ZONE_REGISTERS)) {
    const regs = {};
    for (let i = 0; i < 50; i++) regs[base + i] = 0;
    regs[base + 1] = 225;   // current temp (22.5 * 10)
    regs[base + 2] = 220;   // target temp (22.0 * 10)
    regs[base + 3] = 1;     // power (on)
    regs[base + 4] = 1;     // mode (cool)
    regs[base + 5] = 2;     // fan (medium)
    regs[base + 10] = 0;    // alarm code
    regs[base + 11] = 65;   // valve %
    regs[base + 12] = 1;    // compressor on
    regs[base + 13] = 520;  // humidity 52.0
    ZONE_STATE[zoneId] = { regs, online: true };
  }

  ZONE_STATE.guest_cabin_stbd.regs[ZONE_REGISTERS.guest_cabin_stbd + 1] = 195;
  ZONE_STATE.guest_cabin_stbd.regs[ZONE_REGISTERS.guest_cabin_stbd + 2] = 220;
  ZONE_STATE.guest_cabin_stbd.regs[ZONE_REGISTERS.guest_cabin_stbd + 3] = 0;
  ZONE_STATE.guest_cabin_stbd.regs[ZONE_REGISTERS.guest_cabin_stbd + 4] = 0;
  ZONE_STATE.guest_cabin_stbd.regs[ZONE_REGISTERS.guest_cabin_stbd + 10] = 2;
  ZONE_STATE.guest_cabin_stbd.online = false;
}

initState();

function simulateZoneDrift() {
  for (const [zoneId, state] of Object.entries(ZONE_STATE)) {
    if (!state.online) continue;
    const base = ZONE_REGISTERS[zoneId];
    const power = state.regs[base + 3];
    if (!power) continue;
    const drift = Math.round((Math.random() - 0.5) * 3);
    const current = state.regs[base + 1] + drift;
    state.regs[base + 1] = Math.max(50, Math.min(400, current));
    const humDrift = Math.round((Math.random() - 0.5) * 20);
    state.regs[base + 13] = Math.max(200, Math.min(800, (state.regs[base + 13] || 500) + humDrift));
  }
}

setInterval(simulateZoneDrift, 4000);

function analogValue(zoneId, address) {
  const base = ZONE_REGISTERS[zoneId];
  return ZONE_STATE[zoneId]?.regs[address] ?? 0;
}

function setAnalog(zoneId, address, value) {
  if (!ZONE_STATE[zoneId]?.online) return false;
  ZONE_STATE[zoneId].regs[address] = value;
  return true;
}

export default function createCrestronGatewayRouter() {
  const router = express.Router();

  router.get("/device/info", (_req, res) => {
    res.json({
      DeviceModel: "CP4",
      FirmwareVersion: "2.8000.00081",
      MACAddress: "00:10:7F:AA:BB:CC",
      SerialNumber: "SN12345678",
    });
  });

  router.get("/device/status", (_req, res) => {
    res.json({ Status: "Running", Uptime: "14d 6h 32m" });
  });

  router.get(`/program/${PROGRAM_SLOT}/analog/:address`, (req, res) => {
    const addr = parseInt(req.params.address, 10);
    let value = 0;
    for (const zoneId of Object.keys(ZONE_REGISTERS)) {
      const base = ZONE_REGISTERS[zoneId];
      if (addr >= base && addr < base + 50) {
        value = analogValue(zoneId, addr);
        break;
      }
    }
    res.json({ Value: value });
  });

  router.post(`/program/${PROGRAM_SLOT}/analog/:address`, (req, res) => {
    const addr = parseInt(req.params.address, 10);
    const value = req.body?.Value;
    if (value === undefined || value === null) {
      return res.status(400).json({ error: "Value is required" });
    }
    let found = false;
    for (const zoneId of Object.keys(ZONE_REGISTERS)) {
      const base = ZONE_REGISTERS[zoneId];
      if (addr >= base && addr < base + 50) {
        found = true;
        if (addr === base + 3) {
          ZONE_STATE[zoneId].online = true;
        }
        setAnalog(zoneId, addr, value);
        break;
      }
    }
    if (!found) return res.status(404).json({ error: "Register address not mapped to any zone" });
    res.json({ success: true });
  });

  router.get(`/program/${PROGRAM_SLOT}/digital/:address`, (_req, res) => {
    res.json({ Value: 0 });
  });

  router.post(`/program/${PROGRAM_SLOT}/digital/:address`, (req, res) => {
    res.json({ success: true });
  });

  router.get("/zones/summary", (_req, res) => {
    const zones = [];
    for (const [zoneId, state] of Object.entries(ZONE_STATE)) {
      const base = ZONE_REGISTERS[zoneId];
      zones.push({
        id: zoneId,
        online: state.online,
        registerBase: base,
        currentTemperature: state.regs[base + 1] / 10,
        targetTemperature: state.regs[base + 2] / 10,
        power: !!state.regs[base + 3],
        mode: state.regs[base + 4],
        alarm: state.regs[base + 10],
      });
    }
    res.json(zones);
  });

  return router;
};
