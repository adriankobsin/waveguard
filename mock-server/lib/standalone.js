/**
 * Standalone-server features: monitoring + alerts, notification channels,
 * network tools, host health, configuration backups, data export/import,
 * self-update, and serving the built web UI.
 */
import express from "express";
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { handle, httpError, run } from "./exec.js";
import * as tools from "./netTools.js";
import { createMonitorEngine, getHistory, getUptimeStats, MONITOR_TYPES } from "./monitors.js";
import { CHANNEL_TYPES, normalizeChannel, maskChannel, mergeChannel, sendToChannel, dispatchAlert } from "./notifier.js";
import { hostHealth, gitInfo } from "./hostHealth.js";
import { createConfigBackups } from "./configBackups.js";
import { extractPersistentState } from "../persistence.js";
import { createAvFlow, AV_FLOW_SETTINGS_KEY } from "./avFlow.js";

export function registerStandaloneFeatures(app, { db, auth, queueSave, broadcast, getCiscoSwitchClient, getSettingValue, getCiscoTargets }) {
  const save = () => queueSave(db);
  const vesselName = () => getSettingValue?.("general")?.name || "";
  const tech = auth.requireRole("admin", "technician");
  const admin = auth.requireAdmin;

  // ---------------------------------------------------------------- AV flow (NVX + Dante + network)
  const avFlow = createAvFlow({ db, getSettingValue, getCiscoTargets });
  app.post("/api/av-flow/scan", handle((req) => avFlow.scan({ listenSeconds: Math.min(10, Number(req.body?.seconds) || 4) })));
  app.get("/api/av-flow/settings", handle(() => ({ settings: avFlow.settings() })));
  app.put("/api/av-flow/settings", tech, handle((req) => {
    const prev = getSettingValue?.(AV_FLOW_SETTINGS_KEY) || {};
    const b = req.body || {};
    const ips = Array.isArray(b.extraNvxIps) ? b.extraNvxIps : String(b.extraNvxIps || "").split(/[\s,]+/);
    const value = {
      nvxUsername: String(b.nvxUsername ?? prev.nvxUsername ?? "admin").slice(0, 64),
      nvxPassword: b.nvxPassword && b.nvxPassword !== "********" ? String(b.nvxPassword) : prev.nvxPassword || "",
      extraNvxIps: ips.map((x) => x.trim()).filter((x) => /^\d{1,3}(\.\d{1,3}){3}$/.test(x)).slice(0, 200),
    };
    const row = db.systemSettings.find((r) => r.key === AV_FLOW_SETTINGS_KEY);
    if (row) row.value = value;
    else db.systemSettings.push({ id: "setting-av-flow", key: AV_FLOW_SETTINGS_KEY, category: "av", value });
    save();
    return { settings: avFlow.settings() };
  }));
  app.post("/api/av-flow/nvx/route", tech, handle(async (req) => {
    const { rxIp, txIp } = req.body || {};
    const ip = /^\d{1,3}(\.\d{1,3}){3}$/;
    if (!ip.test(rxIp || "") || !ip.test(txIp || "")) throw httpError(400, "rxIp and txIp must be IPv4 addresses");
    return avFlow.route({ rxIp, txIp });
  }));

  // ---------------------------------------------------------------- health
  app.get("/api/health", (_req, res) => res.json({ ok: true, version: config.version, uptimeSec: Math.round(process.uptime()) }));

  // ---------------------------------------------------------------- monitors
  const monitors = createMonitorEngine({ db, queueSave: save, broadcast, getVesselName: vesselName });
  monitors.start();

  app.get("/api/monitors", handle(() => ({ monitors: monitors.list(), types: MONITOR_TYPES })));
  app.get("/api/monitors/summary", handle(() => monitors.summary()));
  app.post("/api/monitors", tech, handle((req) => ({ monitor: monitors.create(req.body || {}) })));
  app.post("/api/monitors/import-equipment", tech, handle((req) => ({ created: monitors.importFromEquipment(req.body || {}) })));
  app.put("/api/monitors/:id", tech, handle((req) => ({ monitor: monitors.update(req.params.id, req.body || {}) })));
  app.delete("/api/monitors/:id", tech, handle((req) => {
    monitors.remove(req.params.id);
    return { success: true };
  }));
  app.post("/api/monitors/:id/check", handle(async (req) => ({ monitor: await monitors.checkNow(req.params.id) })));
  app.get("/api/monitors/:id/history", handle((req) => ({
    history: getHistory(req.params.id, Math.min(24 * 30, Number(req.query.hours) || 24)),
    uptime: getUptimeStats(req.params.id),
  })));

  app.get("/api/alerts", handle((req) => {
    const limit = Math.min(1000, Number(req.query.limit) || 200);
    return { events: db.alertEvents.slice(0, limit) };
  }));
  app.delete("/api/alerts", admin, handle(() => {
    db.alertEvents = [];
    save();
    return { success: true };
  }));

  // Maintenance window: silences notifications (events are still logged).
  app.get("/api/maintenance-window", handle(() => ({ window: getSettingValue?.("maintenance-window") || null })));
  app.put("/api/maintenance-window", tech, handle((req) => {
    const minutes = Math.max(0, Math.min(7 * 24 * 60, Number(req.body?.minutes) || 0));
    const value = minutes ? { until: new Date(Date.now() + minutes * 60000).toISOString(), reason: String(req.body?.reason || "").slice(0, 200), setBy: req.user?.username } : null;
    const row = db.systemSettings.find((s) => s.key === "maintenance-window");
    if (row) row.value = value;
    else db.systemSettings.push({ id: "setting-maintenance-window", key: "maintenance-window", category: "monitoring", value });
    save();
    return { window: value };
  }));

  // ---------------------------------------------------------------- notification channels
  app.get("/api/notifications/channels", handle(() => ({ channels: db.notificationChannels.map(maskChannel), types: CHANNEL_TYPES })));
  app.post("/api/notifications/channels", admin, handle((req) => {
    const ch = normalizeChannel({ ...(req.body || {}), id: undefined });
    db.notificationChannels.push(ch);
    save();
    return { channel: maskChannel(ch) };
  }));
  app.put("/api/notifications/channels/:id", admin, handle((req) => {
    const idx = db.notificationChannels.findIndex((c) => c.id === req.params.id);
    if (idx < 0) throw httpError(404, "Channel not found");
    db.notificationChannels[idx] = mergeChannel(db.notificationChannels[idx], req.body || {});
    save();
    return { channel: maskChannel(db.notificationChannels[idx]) };
  }));
  app.delete("/api/notifications/channels/:id", admin, handle((req) => {
    db.notificationChannels = db.notificationChannels.filter((c) => c.id !== req.params.id);
    save();
    return { success: true };
  }));
  app.post("/api/notifications/channels/:id/test", admin, handle(async (req) => {
    const ch = db.notificationChannels.find((c) => c.id === req.params.id);
    if (!ch) throw httpError(404, "Channel not found");
    try {
      await sendToChannel(ch, {
        title: "Test notification",
        message: `This is a test from WaveGuard on ${vesselName() || "this vessel"}. If you can read this, alerts will reach you.`,
        severity: "info",
        vessel: vesselName(),
        ts: new Date().toISOString(),
      });
      return { ok: true };
    } catch (err) {
      throw httpError(502, err.message);
    }
  }));

  // ---------------------------------------------------------------- network tools
  app.get("/api/tools/inventory", handle(async () => ({ tools: await tools.toolInventory(), nmapProfiles: tools.nmapProfiles, commonPorts: tools.COMMON_AV_PORTS })));
  app.post("/api/tools/ping", handle((req) => tools.ping(req.body || {})));
  app.post("/api/tools/traceroute", handle((req) => tools.traceroute(req.body || {})));
  app.post("/api/tools/mtr", handle((req) => tools.mtr(req.body || {})));
  app.post("/api/tools/dns", handle((req) => tools.dnsLookup(req.body || {})));
  app.post("/api/tools/ports", handle((req) => tools.portCheck(req.body || {})));
  app.post("/api/tools/tls", handle((req) => tools.tlsCertificate(req.body || {})));
  app.post("/api/tools/nmap", tech, handle((req) => tools.nmapScan(req.body || {})));
  app.post("/api/tools/arp-scan", tech, handle((req) => tools.arpScan(req.body || {})));
  app.get("/api/tools/neighbours", handle(() => tools.neighbours()));
  app.get("/api/tools/interfaces", handle(() => tools.interfaces()));
  app.get("/api/tools/lldp", handle(() => tools.lldpNeighbours()));
  app.post("/api/tools/mdns", handle((req) => tools.mdnsBrowse(req.body || {})));
  app.post("/api/tools/wol", tech, handle((req) => tools.wakeOnLan(req.body || {})));
  app.post("/api/tools/iperf", tech, handle((req) => tools.iperf(req.body || {})));
  app.post("/api/tools/av-network", handle((req) => tools.avNetworkScan(req.body || {})));
  app.get("/api/tools/multicast", handle(() => tools.multicastGroups()));
  app.get("/api/tools/mac-vendor/:mac", handle((req) => ({ mac: req.params.mac, vendor: tools.macVendor(req.params.mac) })));

  // ---------------------------------------------------------------- config backups
  const cfg = createConfigBackups({
    db,
    queueSave: save,
    getCiscoSwitchClient,
    addEvent: monitors.addEvent,
    notify: (alert) => dispatchAlert(db.notificationChannels, { ...alert, vessel: vesselName() }),
  });
  cfg.startSchedule();
  app.get("/api/config-backups", handle(() => ({ backups: cfg.list(), devices: cfg.switches().map((s) => ({ host: s.host, name: s.name || s.host })) })));
  app.post("/api/config-backups/run", tech, handle(async (req) => {
    if (req.body?.host) {
      const sw = cfg.switches().find((s) => s.host === req.body.host);
      if (!sw) throw httpError(404, "Switch not configured");
      return { results: [await cfg.backupSwitch(sw)] };
    }
    return { results: await cfg.backupAll() };
  }));
  app.get("/api/config-backups/:id", tech, handle((req) => cfg.get(req.params.id)));
  app.get("/api/config-backups/:id/diff", tech, handle((req) => cfg.diff(req.params.id, req.query.against)));

  // ---------------------------------------------------------------- host / system
  app.get("/api/system/health", handle(() => hostHealth()));

  app.get("/api/system/export", admin, (req, res) => {
    const state = extractPersistentState(db);
    delete state.sessions;
    const name = `waveguard-backup-${(vesselName() || "vessel").replace(/[^A-Za-z0-9_-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.send(JSON.stringify({ format: "waveguard-backup", version: 1, exportedAt: new Date().toISOString(), app: config.version, data: state }, null, 2));
  });

  app.post("/api/system/import", admin, express.json({ limit: "100mb" }), handle((req) => {
    const body = req.body || {};
    if (body.format !== "waveguard-backup" || !body.data) throw httpError(400, "Not a WaveGuard backup file");
    const allowed = ["equipment", "cables", "maintenanceTasks", "automationRules", "systemSettings", "layoutTopology", "rackLayouts", "signalLinks", "deviceGroups", "documents", "monitors", "notificationChannels", "configBackups"];
    const restored = [];
    for (const key of allowed) {
      if (Array.isArray(body.data[key])) {
        db[key] = body.data[key];
        restored.push(key);
      }
    }
    if (req.body?.includeUsers && Array.isArray(body.data.users) && body.data.users.some((u) => u.role === "admin" && u.passwordHash)) {
      db.users = body.data.users;
      restored.push("users");
    }
    save();
    monitors.reload();
    return { success: true, restored, note: "Data restored. Reload the page; restart the service to reconnect integrations." };
  }));

  // Self-update: the web UI drops a flag file; the root-owned waveguard-update.path
  // systemd unit (installed by deploy/install.sh) sees it and runs deploy/update.sh.
  const updateFlag = path.join(config.dataDir, "update-requested");
  const updateLog = path.join(config.dataDir, "update.log");
  app.get("/api/system/update", admin, handle(async () => {
    const info = gitInfo();
    let remote = null;
    let error = null;
    if (info.branch) {
      const r = await run("git", ["ls-remote", "origin", `refs/heads/${info.branch}`], { cwd: config.repoDir, timeoutMs: 15000 });
      if (r.ok) remote = r.stdout.split(/\s/)[0] || null;
      else error = (r.stderr || "Could not reach GitHub").trim().slice(0, 300);
    }
    let log = null;
    try {
      log = fs.readFileSync(updateLog, "utf-8").split("\n").slice(-60).join("\n");
    } catch {
      /* no log yet */
    }
    return {
      current: info.commit,
      branch: info.branch,
      remote,
      updateAvailable: !!(remote && info.commit && remote !== info.commit),
      pending: fs.existsSync(updateFlag),
      error,
      log,
    };
  }));
  app.post("/api/system/update", admin, handle((req) => {
    fs.writeFileSync(updateFlag, JSON.stringify({ requestedBy: req.user?.username, at: new Date().toISOString() }));
    return { requested: true, message: "Update requested. WaveGuard will restart in a minute or two when it finishes." };
  }));

  return { reload: () => monitors.reload() };
}

/** Serve the built SPA (dist/) with history-API fallback. */
export function serveFrontend(app) {
  const index = path.join(config.staticDir, "index.html");
  if (!fs.existsSync(index)) {
    console.log(`[waveguard] No built UI at ${config.staticDir} — run "npm run build" (API-only mode)`);
    return;
  }
  app.use("/assets", express.static(path.join(config.staticDir, "assets"), { immutable: true, maxAge: "365d", index: false }));
  app.use(express.static(config.staticDir, { index: false, maxAge: "1h" }));
  const API = /^\/(api|chat|functions|uploads|cws|ws-user-apps)(\/|$)/;
  app.get("*", (req, res, next) => {
    if (API.test(req.path)) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(index);
  });
  console.log(`[waveguard] Serving web UI from ${config.staticDir}`);
}
