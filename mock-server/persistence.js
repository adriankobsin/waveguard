import fs from "fs";
import path from "path";
import { pingHost } from "../scanner/ping.js";

const DATA_PATH = process.env.WAVEGUARD_DATA_PATH || "./data/waveguard-data.json";

let saveTimer = null;
let pendingDb = null;

export function extractPersistentState(db) {
  return {
    equipment: db.equipment || [],
    cables: db.cables || [],
    actionLogs: db.actionLogs || [],
    maintenanceTasks: db.maintenanceTasks || [],
    automationRules: db.automationRules || [],
    systemSettings: db.systemSettings || [],
    layoutTopology: db.layoutTopology || [],
    rackLayouts: db.rackLayouts || [],
    signalLinks: db.signalLinks || [],
    deviceGroups: db.deviceGroups || [],
    speedTests: db.speedTests || [],
  };
}

function doSave(db) {
  try {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = DATA_PATH + ".tmp";
    const serializable = extractPersistentState(db);
    fs.writeFileSync(tmp, JSON.stringify(serializable, null, 2), "utf-8");
    fs.renameSync(tmp, DATA_PATH);
  } catch (err) {
    console.error("[persistence] Write failed:", err.message);
  }
}

export function queueSave(db) {
  pendingDb = db;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (pendingDb) doSave(pendingDb);
    pendingDb = null;
  }, 500);
}

export function loadPersistedDb() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      console.log(`[persistence] Restored from ${DATA_PATH}`);
      return parsed;
    }
  } catch (err) {
    console.error("[persistence] Load failed:", err.message);
  }
  console.log("[persistence] No data file found, starting fresh");
  return null;
}

export async function pingAllOnStartup(equipment, maxConcurrent = 20) {
  const withIp = equipment.filter(e => e.ip);
  if (!withIp.length) return;
  console.log(`[persistence] Pinging ${withIp.length} devices to refresh status…`);
  const batches = [];
  for (let i = 0; i < withIp.length; i += maxConcurrent) {
    batches.push(withIp.slice(i, i + maxConcurrent));
  }
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async (eq) => {
        try {
          const result = await pingHost(eq.ip);
          eq.status = result.alive ? "online" : "offline";
          if (result.ms != null) eq.responseTimeMs = result.ms;
        } catch {
          eq.status = "offline";
        }
      })
    );
  }
  const online = equipment.filter(e => e.status === "online").length;
  const offline = equipment.filter(e => e.status === "offline").length;
  console.log(`[persistence] Status refresh complete: ${online} online, ${offline} offline`);
}
