import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", process.env.WAVEGUARD_DATA_DIR || "data");
const DB_PATH = path.join(DATA_DIR, "integrations.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db = null;

export function getDb() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_types (
      id          TEXT PRIMARY KEY,
      category    TEXT NOT NULL,
      label       TEXT NOT NULL,
      description TEXT,
      protocols   TEXT DEFAULT '[]',
      default_port INTEGER,
      phase       INTEGER DEFAULT 2,
      docs_url    TEXT,
      icon        TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS integration_configs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type_id       TEXT NOT NULL REFERENCES integration_types(id),
      label         TEXT NOT NULL,
      host          TEXT,
      port          INTEGER,
      username      TEXT,
      password      TEXT,
      api_key       TEXT,
      api_url       TEXT,
      options       TEXT DEFAULT '{}',
      enabled       INTEGER DEFAULT 1,
      health_status TEXT DEFAULT 'unknown',
      last_polled_at TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS integration_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id  INTEGER,
      level      TEXT NOT NULL DEFAULT 'info',
      message    TEXT NOT NULL,
      details    TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}

export function seedTypes() {
  const d = getDb();
  const count = d.prepare("SELECT COUNT(*) as c FROM integration_types").get();
  if (count.c > 0) return;

  const insert = d.prepare(`
    INSERT OR IGNORE INTO integration_types (id, category, label, description, protocols, default_port, phase, docs_url, icon)
    VALUES (@id, @category, @label, @description, @protocols, @default_port, @phase, @docs_url, @icon)
  `);

  const seed = [
    {
      id: "draytek", category: "router", label: "DrayTek Router",
      description: "DrayTek Vigor series routers — WAN management, VPN, bandwidth monitoring.",
      protocols: JSON.stringify(["snmp", "rest"]), default_port: 443, phase: 2,
      docs_url: "https://www.draytek.com/support/", icon: "router",
    },
    {
      id: "netgear", category: "router", label: "Netgear Router / Switch",
      description: "Netgear ProSAFE / Insight managed switches and Nighthawk routers.",
      protocols: JSON.stringify(["snmp", "rest"]), default_port: 443, phase: 2,
      docs_url: "https://www.netgear.com/support/", icon: "router",
    },
    {
      id: "tplink", category: "router", label: "TP-Link Router / Switch",
      description: "TP-Link Omada / Archer routers and JetStream switches. Also Kasa smart home.",
      protocols: JSON.stringify(["snmp", "rest"]), default_port: 443, phase: 2,
      docs_url: "https://www.tp-link.com/support/", icon: "router",
    },
    {
      id: "knx", category: "lighting", label: "KNX (EIB / KNX IP)",
      description: "KNX building automation — lighting, blinds, HVAC via KNX IP gateway.",
      protocols: JSON.stringify(["knx-ip", "knx-tunnelling"]), default_port: 3671, phase: 1,
      docs_url: "https://www.knx.org/", icon: "lighting",
    },
    {
      id: "philips_hue", category: "lighting", label: "Philips Hue",
      description: "Philips Hue Bridge — Zigbee-based smart lighting control via REST API.",
      protocols: JSON.stringify(["rest"]), default_port: 80, phase: 2,
      docs_url: "https://developers.meethue.com/", icon: "lighting",
    },
    {
      id: "heatmiser", category: "hvac", label: "Heatmiser Thermostat",
      description: "Heatmiser Neo thermostats — WiFi/ModeBUS temperature control for underfloor heating.",
      protocols: JSON.stringify(["modbus", "rest"]), default_port: 80, phase: 2,
      docs_url: "https://www.heatmiser.com/", icon: "thermostat",
    },
    {
      id: "coolmaster", category: "hvac", label: "CoolMaster HVAC Bridge",
      description: "CoolMasterNet bridge — centralised control of Mitsubishi, Daikin, LG, Fujitsu split AC units.",
      protocols: JSON.stringify(["rest", "modbus"]), default_port: 80, phase: 2,
      docs_url: "https://www.coolmaster.com.au/", icon: "hvac",
    },
    {
      id: "modbus", category: "protocol", label: "ModBUS (RTU / TCP)",
      description: "ModBUS industrial protocol — PLCs, sensors, power meters, HVAC controllers.",
      protocols: JSON.stringify(["modbus-tcp", "modbus-rtu"]), default_port: 502, phase: 2,
      docs_url: "https://modbus.org/", icon: "protocol",
    },
    {
      id: "rs485", category: "protocol", label: "RS-485 Serial Bus",
      description: "RS-485 serial bus adapter — generic device polling over USB-to-RS485 adapters.",
      protocols: JSON.stringify(["serial"]), default_port: 0, phase: 2,
      docs_url: null, icon: "protocol",
    },
    {
      id: "iot_generic", category: "iot", label: "IoT Devices (Generic)",
      description: "Generic IoT device integration — MQTT, HTTP, WebSocket, CoAP.",
      protocols: JSON.stringify(["mqtt", "http", "websocket"]), default_port: 1883, phase: 2,
      docs_url: null, icon: "iot",
    },
    {
      id: "ifttt", category: "automation", label: "IFTTT Webhooks",
      description: "IFTTT Maker Webhooks — trigger applets and receive events from any IFTTT-connected service.",
      protocols: JSON.stringify(["webhook"]), default_port: 443, phase: 2,
      docs_url: "https://ifttt.com/maker_webhooks", icon: "automation",
    },
    {
      id: "mqtt_broker", category: "protocol", label: "MQTT Broker",
      description: "MQTT message broker — publish/subscribe for IoT sensor data and device commands.",
      protocols: JSON.stringify(["mqtt", "mqtts"]), default_port: 1883, phase: 2,
      docs_url: "https://mqtt.org/", icon: "protocol",
    },
    {
      id: "bacnet", category: "protocol", label: "BACnet (Building Automation)",
      description: "BACnet/IP — HVAC, lighting, access control in commercial buildings.",
      protocols: JSON.stringify(["bacnet-ip"]), default_port: 47808, phase: 2,
      docs_url: "https://bacnet.org/", icon: "protocol",
    },
  ];

  const tx = d.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  tx(seed);
}

export function listTypes(category) {
  const d = getDb();
  if (category) {
    return d.prepare("SELECT * FROM integration_types WHERE category = ? ORDER BY label").all(category);
  }
  return d.prepare("SELECT * FROM integration_types ORDER BY category, label").all();
}

export function listConfigs(typeId) {
  const d = getDb();
  if (typeId) {
    return d.prepare(`
      SELECT c.*, t.label as type_label, t.category, t.icon
      FROM integration_configs c
      JOIN integration_types t ON t.id = c.type_id
      WHERE c.type_id = ?
      ORDER BY c.updated_at DESC
    `).all(typeId);
  }
  return d.prepare(`
    SELECT c.*, t.label as type_label, t.category, t.icon
    FROM integration_configs c
    JOIN integration_types t ON t.id = c.type_id
    ORDER BY t.category, c.label
  `).all();
}

export function getConfig(id) {
  const d = getDb();
  return d.prepare(`
    SELECT c.*, t.label as type_label, t.category, t.icon
    FROM integration_configs c
    JOIN integration_types t ON t.id = c.type_id
    WHERE c.id = ?
  `).get(id);
}

export function createConfig({ type_id, label, host, port, username, password, api_key, api_url, options }) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO integration_configs (type_id, label, host, port, username, password, api_key, api_url, options)
    VALUES (@type_id, @label, @host, @port, @username, @password, @api_key, @api_url, @options)
  `);
  const r = stmt.run({ type_id, label, host, port, username, password, api_key, api_url, options: options || "{}" });
  return getConfig(r.lastInsertRowid);
}

export function updateConfig(id, fields) {
  const d = getDb();
  const allowed = ["label", "host", "port", "username", "password", "api_key", "api_url", "options", "enabled", "health_status"];
  const sets = [];
  const vals = { id };
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      sets.push(`${k} = @${k}`);
      vals[k] = fields[k];
    }
  }
  if (sets.length === 0) return getConfig(id);
  sets.push("updated_at = datetime('now')");
  d.prepare(`UPDATE integration_configs SET ${sets.join(", ")} WHERE id = @id`).run(vals);
  return getConfig(id);
}

export function deleteConfig(id) {
  const d = getDb();
  d.prepare("DELETE FROM integration_configs WHERE id = ?").run(id);
}

export function logEvent(configId, level, message, details) {
  const d = getDb();
  d.prepare("INSERT INTO integration_logs (config_id, level, message, details) VALUES (?, ?, ?, ?)")
    .run(configId, level, message, details || "{}");
}

export function getLogs(configId, limit = 50) {
  const d = getDb();
  if (configId) {
    return d.prepare("SELECT * FROM integration_logs WHERE config_id = ? ORDER BY created_at DESC LIMIT ?").all(configId, limit);
  }
  return d.prepare("SELECT * FROM integration_logs ORDER BY created_at DESC LIMIT ?").all(limit);
}

export function getCategories() {
  const d = getDb();
  return d.prepare("SELECT DISTINCT category FROM integration_types ORDER BY category").all().map(r => r.category);
}

export function getDashboardStats() {
  const d = getDb();
  return {
    total_types: d.prepare("SELECT COUNT(*) as c FROM integration_types").get().c,
    total_configs: d.prepare("SELECT COUNT(*) as c FROM integration_configs").get().c,
    enabled: d.prepare("SELECT COUNT(*) as c FROM integration_configs WHERE enabled = 1").get().c,
    online: d.prepare("SELECT COUNT(*) as c FROM integration_configs WHERE health_status = 'online'").get().c,
    offline: d.prepare("SELECT COUNT(*) as c FROM integration_configs WHERE health_status = 'offline'").get().c,
    by_category: d.prepare(`
      SELECT t.category, COUNT(c.id) as count
      FROM integration_types t
      LEFT JOIN integration_configs c ON c.type_id = t.id
      GROUP BY t.category
      ORDER BY t.category
    `).all(),
  };
}
