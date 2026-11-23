/**
 * Uptime monitoring + alerting engine (comparable to Uptime Kuma / Domotz alerts).
 *
 * Monitor definitions live in db.monitors (persisted JSON). Every check result
 * ("heartbeat") goes to SQLite (<dataDir>/monitoring.db) so months of history
 * don't bloat the main data file. Status changes create alert events, are
 * pushed to the UI over SSE and sent to the notification channels.
 */
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import path from "path";
import Database from "better-sqlite3";
import { config } from "./config.js";
import { ping, tlsCertificate } from "./netTools.js";
import { dispatchAlert } from "./notifier.js";
import { httpError } from "./exec.js";

export const MONITOR_TYPES = {
  ping: "Ping (ICMP)",
  tcp: "TCP port",
  http: "HTTP(S) / keyword",
  dns: "DNS record",
  cert: "TLS certificate expiry",
};

const HISTORY_DAYS = Number(process.env.WAVEGUARD_MONITOR_HISTORY_DAYS || 30);

// ------------------------------------------------------------------ storage
let hb = null;
function store() {
  if (hb) return hb;
  hb = new Database(path.join(config.dataDir, "monitoring.db"));
  hb.pragma("journal_mode = WAL");
  hb.exec(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      monitor_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      up INTEGER NOT NULL,
      ms REAL,
      message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_hb_monitor_ts ON heartbeats(monitor_id, ts);
  `);
  return hb;
}

function recordHeartbeat(id, up, ms, message) {
  store().prepare("INSERT INTO heartbeats (monitor_id, ts, up, ms, message) VALUES (?, ?, ?, ?, ?)").run(id, Date.now(), up ? 1 : 0, ms ?? null, message ? String(message).slice(0, 300) : null);
}

export function getHistory(id, hours = 24) {
  const since = Date.now() - Math.min(hours, HISTORY_DAYS * 24) * 3600 * 1000;
  return store()
    .prepare("SELECT ts, up, ms, message FROM heartbeats WHERE monitor_id = ? AND ts >= ? ORDER BY ts ASC")
    .all(id, since);
}

export function getUptimeStats(id) {
  const now = Date.now();
  const q = store().prepare("SELECT COUNT(*) AS n, SUM(up) AS ups, AVG(CASE WHEN up = 1 THEN ms END) AS avgMs FROM heartbeats WHERE monitor_id = ? AND ts >= ?");
  const span = (h) => {
    const r = q.get(id, now - h * 3600 * 1000);
    return { checks: r.n, uptimePct: r.n ? Math.round((r.ups / r.n) * 10000) / 100 : null, avgMs: r.avgMs != null ? Math.round(r.avgMs * 10) / 10 : null };
  };
  return { h24: span(24), d7: span(24 * 7), d30: span(24 * 30) };
}

function pruneHistory() {
  try {
    store().prepare("DELETE FROM heartbeats WHERE ts < ?").run(Date.now() - HISTORY_DAYS * 86400 * 1000);
  } catch (err) {
    console.warn("[monitors] prune failed:", err.message);
  }
}

// ------------------------------------------------------------------ definitions
export function normalizeMonitor(raw = {}) {
  const type = MONITOR_TYPES[raw.type] ? raw.type : "ping";
  return {
    id: raw.id || `mon-${crypto.randomUUID()}`,
    name: String(raw.name || raw.target || "Monitor").slice(0, 120),
    type,
    target: String(raw.target || "").trim().slice(0, 500),
    port: raw.port ? Number(raw.port) : null,
    intervalSec: Math.max(15, Math.min(3600, Number(raw.intervalSec) || 60)),
    timeoutMs: Math.max(500, Math.min(30000, Number(raw.timeoutMs) || 5000)),
    retries: Math.max(0, Math.min(10, Number(raw.retries ?? 2))),
    severity: ["info", "warning", "critical"].includes(raw.severity) ? raw.severity : "warning",
    keyword: raw.keyword ? String(raw.keyword).slice(0, 200) : "",
    expectStatus: raw.expectStatus ? String(raw.expectStatus).slice(0, 40) : "200-399",
    dnsType: ["A", "AAAA", "CNAME", "MX", "TXT"].includes(raw.dnsType) ? raw.dnsType : "A",
    dnsExpect: raw.dnsExpect ? String(raw.dnsExpect).slice(0, 200) : "",
    certWarnDays: Math.max(1, Math.min(365, Number(raw.certWarnDays) || 21)),
    ignoreTls: raw.ignoreTls !== false,
    equipmentId: raw.equipmentId || null,
    group: raw.group ? String(raw.group).slice(0, 60) : "",
    enabled: raw.enabled !== false,
    maintenanceUntil: raw.maintenanceUntil || null,
    channelIds: Array.isArray(raw.channelIds) ? raw.channelIds.map(String) : [],
    // runtime state (persisted so a restart doesn't re-alert)
    status: raw.status || "pending",
    lastCheck: raw.lastCheck || null,
    lastChange: raw.lastChange || null,
    lastMs: raw.lastMs ?? null,
    lastMessage: raw.lastMessage || "",
    failCount: raw.failCount || 0,
    lastNotifiedAt: raw.lastNotifiedAt || null,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function validate(m) {
  if (!m.target) throw httpError(400, "Target is required");
  if (m.type === "tcp" && !(m.port >= 1 && m.port <= 65535)) throw httpError(400, "TCP monitors need a port");
  if (m.type === "http") {
    try {
      const u = new URL(m.target);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    } catch {
      throw httpError(400, "HTTP monitors need a full URL, e.g. http://192.168.1.10/");
    }
  }
}

function statusInRange(code, spec) {
  return String(spec || "200-399")
    .split(",")
    .some((part) => {
      const [a, b] = part.split("-").map((x) => Number(x.trim()));
      return b ? code >= a && code <= b : code === a;
    });
}

// ------------------------------------------------------------------ checks
async function runCheck(m) {
  const started = Date.now();
  switch (m.type) {
    case "ping": {
      const r = await ping({ host: m.target, count: 3 });
      return { up: r.alive, ms: r.avg, message: r.alive ? `${r.lossPct}% loss` : "No reply" };
    }
    case "tcp": {
      return new Promise((resolve) => {
        const sock = net.connect({ host: m.target, port: m.port });
        const done = (up, message) => {
          sock.destroy();
          resolve({ up, ms: Date.now() - started, message });
        };
        sock.setTimeout(m.timeoutMs, () => done(false, "Timed out"));
        sock.once("connect", () => done(true, "Port open"));
        sock.once("error", (err) => done(false, err.code || err.message));
      });
    }
    case "http": {
      try {
        const { fetch: ufetch, Agent } = await import("undici");
        const opts = { redirect: "follow", signal: AbortSignal.timeout(m.timeoutMs), headers: { "User-Agent": "WaveGuard-Monitor" } };
        // Most AV/IT gear uses self-signed certificates — optionally accept them.
        if (m.ignoreTls) opts.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
        const res = await ufetch(m.target, opts);
        const ms = Date.now() - started;
        if (!statusInRange(res.status, m.expectStatus)) return { up: false, ms, message: `HTTP ${res.status}` };
        if (m.keyword) {
          const body = await res.text();
          if (!body.includes(m.keyword)) return { up: false, ms, message: `Keyword "${m.keyword}" not found` };
        } else {
          await res.body?.cancel?.();
        }
        return { up: true, ms, message: `HTTP ${res.status}` };
      } catch (err) {
        return { up: false, ms: null, message: err.name === "TimeoutError" ? "Timed out" : err.cause?.code || err.message };
      }
    }
    case "dns": {
      try {
        const answers = await dns.resolve(m.target, m.dnsType);
        const flat = answers.map((a) => (typeof a === "string" ? a : a.exchange || JSON.stringify(a))).flat();
        const ok = !m.dnsExpect || flat.some((a) => String(a).includes(m.dnsExpect));
        return { up: ok, ms: Date.now() - started, message: ok ? flat.join(", ").slice(0, 200) : `Expected ${m.dnsExpect}, got ${flat.join(", ")}` };
      } catch (err) {
        return { up: false, ms: null, message: err.code || err.message };
      }
    }
    case "cert": {
      try {
        const c = await tlsCertificate({ host: m.target, port: m.port || 443, timeoutMs: m.timeoutMs });
        const up = c.daysLeft >= m.certWarnDays;
        return { up, ms: Date.now() - started, message: `Expires in ${c.daysLeft} days (${c.validTo.slice(0, 10)})` };
      } catch (err) {
        return { up: false, ms: null, message: err.message };
      }
    }
    default:
      return { up: false, ms: null, message: "Unknown monitor type" };
  }
}

// ------------------------------------------------------------------ engine
export function createMonitorEngine({ db, queueSave, broadcast, getVesselName }) {
  if (!Array.isArray(db.monitors)) db.monitors = [];
  if (!Array.isArray(db.notificationChannels)) db.notificationChannels = [];
  if (!Array.isArray(db.alertEvents)) db.alertEvents = [];
  db.monitors = db.monitors.map(normalizeMonitor);

  const timers = new Map();
  const running = new Set();

  function inMaintenance(m) {
    const global = db.systemSettings?.find((s) => s.key === "maintenance-window")?.value;
    const until = [m.maintenanceUntil, global?.until].filter(Boolean).map((d) => new Date(d).getTime());
    return until.some((t) => t > Date.now());
  }

  function addEvent(evt) {
    db.alertEvents.unshift(evt);
    if (db.alertEvents.length > 1000) db.alertEvents.length = 1000;
    broadcast?.("alert-event", evt);
  }

  async function notify(m, alert) {
    const channels = m.channelIds.length ? db.notificationChannels.filter((c) => m.channelIds.includes(c.id)) : db.notificationChannels;
    const results = await dispatchAlert(channels, alert);
    if (results.length) {
      const evt = db.alertEvents.find((e) => e.id === alert.eventId);
      if (evt) evt.deliveries = results;
      queueSave();
    }
  }

  async function check(m) {
    if (running.has(m.id)) return;
    running.add(m.id);
    try {
      const r = await runCheck(m);
      recordHeartbeat(m.id, r.up, r.ms, r.message);
      const prevStatus = m.status;
      m.lastCheck = new Date().toISOString();
      m.lastMs = r.ms != null ? Math.round(r.ms * 10) / 10 : null;
      m.lastMessage = r.message || "";

      let next = prevStatus;
      if (r.up) {
        m.failCount = 0;
        next = "up";
      } else {
        m.failCount += 1;
        if (m.failCount > m.retries) next = "down";
        else if (prevStatus === "pending") next = "pending";
      }
      const maintenance = inMaintenance(m);
      if (next !== prevStatus) {
        m.status = next;
        m.lastChange = m.lastCheck;
        broadcast?.("monitor-status", { id: m.id, status: next, message: m.lastMessage });
        const isAlert = next === "down" || (next === "up" && prevStatus === "down");
        if (isAlert) {
          const recovery = next === "up";
          const evt = {
            id: `evt-${crypto.randomUUID()}`,
            ts: m.lastCheck,
            monitorId: m.id,
            monitorName: m.name,
            target: m.target,
            severity: recovery ? "info" : m.severity,
            recovery,
            status: next,
            message: recovery ? `${m.name} is back up (${m.lastMessage})` : `${m.name} is DOWN — ${m.lastMessage}`,
            maintenance,
          };
          addEvent(evt);
          if (!maintenance) {
            m.lastNotifiedAt = recovery ? null : m.lastCheck;
            notify(m, {
              eventId: evt.id,
              title: recovery ? `RECOVERED: ${m.name}` : `DOWN: ${m.name}`,
              message: `${evt.message}\nTarget: ${m.target}${m.port ? `:${m.port}` : ""}\nType: ${MONITOR_TYPES[m.type]}`,
              severity: evt.severity,
              recovery,
              source: "monitor",
              vessel: getVesselName?.(),
              ts: evt.ts,
            });
          }
        }
      } else if (next === "down" && !maintenance) {
        // Reminder notifications for channels that ask for them.
        const reminders = db.notificationChannels.filter((c) => c.remindMinutes > 0 && (!m.channelIds.length || m.channelIds.includes(c.id)));
        const last = m.lastNotifiedAt ? new Date(m.lastNotifiedAt).getTime() : 0;
        const due = reminders.filter((c) => Date.now() - last >= c.remindMinutes * 60000);
        if (due.length) {
          m.lastNotifiedAt = new Date().toISOString();
          dispatchAlert(due, {
            title: `STILL DOWN: ${m.name}`,
            message: `${m.name} has been down since ${m.lastChange}. Last result: ${m.lastMessage}`,
            severity: m.severity,
            recovery: false,
            source: "monitor",
            vessel: getVesselName?.(),
            ts: m.lastNotifiedAt,
          });
        }
      }
      broadcast?.("monitor-heartbeat", { id: m.id, up: r.up, ms: m.lastMs, ts: m.lastCheck });
      queueSave();
    } catch (err) {
      console.warn(`[monitors] ${m.name}: ${err.message}`);
    } finally {
      running.delete(m.id);
    }
  }

  function schedule(m) {
    unschedule(m.id);
    if (!m.enabled) {
      m.status = "paused";
      return;
    }
    if (m.status === "paused") m.status = "pending";
    // Spread first checks over a few seconds so 100 monitors don't fire at once.
    const first = setTimeout(() => check(m), 1000 + Math.random() * 5000);
    const every = setInterval(() => check(m), m.intervalSec * 1000);
    timers.set(m.id, [first, every]);
  }
  function unschedule(id) {
    for (const t of timers.get(id) || []) {
      clearTimeout(t);
      clearInterval(t);
    }
    timers.delete(id);
  }

  function start() {
    db.monitors.forEach(schedule);
    pruneHistory();
    setInterval(pruneHistory, 6 * 3600 * 1000).unref();
    console.log(`[monitors] ${db.monitors.filter((m) => m.enabled).length} monitor(s) active`);
  }

  // ---------------------------------------------------------------- API helpers
  function list() {
    return db.monitors.map((m) => ({ ...m, uptime: getUptimeStats(m.id) }));
  }
  function create(data) {
    const m = normalizeMonitor({ ...data, id: undefined, status: "pending", failCount: 0 });
    validate(m);
    db.monitors.push(m);
    schedule(m);
    queueSave();
    return m;
  }
  function update(id, data) {
    const idx = db.monitors.findIndex((m) => m.id === id);
    if (idx < 0) throw httpError(404, "Monitor not found");
    const cur = db.monitors[idx];
    const merged = normalizeMonitor({ ...cur, ...data, id: cur.id, status: cur.status, failCount: cur.failCount, lastCheck: cur.lastCheck, lastChange: cur.lastChange });
    validate(merged);
    db.monitors[idx] = merged;
    schedule(merged);
    queueSave();
    return merged;
  }
  function remove(id) {
    unschedule(id);
    db.monitors = db.monitors.filter((m) => m.id !== id);
    try {
      store().prepare("DELETE FROM heartbeats WHERE monitor_id = ?").run(id);
    } catch {
      /* ignore */
    }
    queueSave();
  }
  async function checkNow(id) {
    const m = db.monitors.find((x) => x.id === id);
    if (!m) throw httpError(404, "Monitor not found");
    await check(m);
    return m;
  }

  /** Create ping monitors for every equipment item with an IP that isn't monitored yet. */
  function importFromEquipment({ categories } = {}) {
    const existing = new Set(db.monitors.filter((m) => m.type === "ping").map((m) => m.target));
    const created = [];
    for (const eq of db.equipment || []) {
      const ip = String(eq.ip || eq.ip_address || "").trim();
      if (!ip || existing.has(ip) || !net.isIP(ip)) continue;
      if (categories?.length && !categories.includes(eq.category)) continue;
      const critical = /switch|router|firewall|core|nvr|processor|server|ups/i.test(`${eq.category} ${eq.name} ${eq.model}`);
      const m = normalizeMonitor({
        name: eq.name || ip,
        type: "ping",
        target: ip,
        equipmentId: eq.id,
        group: eq.category || "",
        severity: critical ? "critical" : "warning",
        intervalSec: critical ? 30 : 60,
      });
      db.monitors.push(m);
      existing.add(ip);
      schedule(m);
      created.push(m);
    }
    queueSave();
    return created;
  }

  function summary() {
    const counts = { up: 0, down: 0, pending: 0, paused: 0 };
    for (const m of db.monitors) counts[m.status] = (counts[m.status] || 0) + 1;
    return { total: db.monitors.length, ...counts, recentEvents: db.alertEvents.slice(0, 10) };
  }

  function reload() {
    for (const id of [...timers.keys()]) unschedule(id);
    db.monitors = (db.monitors || []).map(normalizeMonitor);
    if (!Array.isArray(db.notificationChannels)) db.notificationChannels = [];
    if (!Array.isArray(db.alertEvents)) db.alertEvents = [];
    db.monitors.forEach(schedule);
  }

  return { start, reload, list, create, update, remove, checkNow, importFromEquipment, summary, addEvent, notifyRaw: (alert) => dispatchAlert(db.notificationChannels, alert) };
}
