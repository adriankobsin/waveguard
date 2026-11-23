/**
 * Switch configuration backups with change detection (comparable to Domotz /
 * Oxidized config management). Pulls `show running-config` over SSH from every
 * Cisco switch configured under Core Network → Cisco Switches, stores each
 * version on disk, and raises an alert when the configuration changes.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createTwoFilesPatch, diffLines } from "diff";
import { config } from "./config.js";
import { httpError } from "./exec.js";

const CISCO_KEY = "network-cisco-switches";

/** Remove lines that change on every pull so only real edits register as changes. */
export function normalizeConfig(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => !/^\s*(! Last configuration change|! NVRAM config last updated|Current configuration\s*:|Building configuration|ntp clock-period|show running-config|#\s*$)/i.test(l))
    .filter((l) => !/^\S+[#>]\s*(show|terminal)\b/i.test(l))
    .join("\n")
    .trim();
}

function safeName(s) {
  return String(s).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}

export function createConfigBackups({ db, queueSave, getCiscoSwitchClient, notify, addEvent }) {
  if (!Array.isArray(db.configBackups)) db.configBackups = [];
  let runningAll = null;

  function switches() {
    const v = db.systemSettings?.find((s) => s.key === CISCO_KEY)?.value;
    const list = Array.isArray(v) ? v : v?.switches || [];
    return list.filter((s) => s && s.host && s.enabled !== false);
  }

  function latestFor(host) {
    return db.configBackups.find((b) => b.host === host) || null;
  }

  async function backupSwitch(sw, { trigger = "manual" } = {}) {
    const client = getCiscoSwitchClient({ ...sw, allowMock: false });
    if (!client?._ssh) throw httpError(500, "SSH client unavailable");
    await client._ssh.connect();
    const raw = await client._ssh.runCommand("show running-config");
    if (!raw || raw.length < 50) throw httpError(502, `No configuration returned by ${sw.host}`);
    const cfg = normalizeConfig(raw);
    const sha = crypto.createHash("sha256").update(cfg).digest("hex");
    const prev = latestFor(sw.host);
    const changed = !prev || prev.sha256 !== sha;
    const ts = new Date().toISOString();
    if (!changed) {
      prev.lastVerifiedAt = ts;
      queueSave();
      return { ...prev, changed: false };
    }
    const dir = path.join(config.configBackupsDir, safeName(sw.host));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${ts.replace(/[:.]/g, "-")}.cfg`);
    fs.writeFileSync(file, cfg + "\n", { mode: 0o600 });
    let added = 0;
    let removed = 0;
    if (prev) {
      const prevText = readBackup(prev);
      for (const part of diffLines(prevText, cfg)) {
        if (part.added) added += part.count || 0;
        if (part.removed) removed += part.count || 0;
      }
    }
    const entry = {
      id: `cfg-${crypto.randomUUID()}`,
      host: sw.host,
      name: sw.name || sw.hostname || sw.host,
      vendor: "cisco",
      ts,
      lastVerifiedAt: ts,
      trigger,
      sha256: sha,
      size: cfg.length,
      lines: cfg.split("\n").length,
      file: path.relative(config.configBackupsDir, file),
      previousId: prev?.id || null,
      added,
      removed,
    };
    db.configBackups.unshift(entry);
    // Keep the newest 60 versions per device.
    const perHost = db.configBackups.filter((b) => b.host === sw.host);
    for (const old of perHost.slice(60)) {
      try {
        fs.rmSync(path.join(config.configBackupsDir, old.file), { force: true });
      } catch {
        /* ignore */
      }
      db.configBackups = db.configBackups.filter((b) => b.id !== old.id);
    }
    queueSave();
    if (prev) {
      const message = `Configuration of ${entry.name} (${sw.host}) changed: +${added} / -${removed} lines`;
      addEvent?.({ id: `evt-${crypto.randomUUID()}`, ts, source: "config", severity: "warning", recovery: false, monitorName: entry.name, target: sw.host, message });
      notify?.({ title: `Config changed: ${entry.name}`, message, severity: "warning", recovery: false, source: "config", ts });
    }
    return { ...entry, changed: true };
  }

  function readBackup(entry) {
    try {
      return fs.readFileSync(path.join(config.configBackupsDir, entry.file), "utf-8").trimEnd();
    } catch {
      return "";
    }
  }

  async function backupAll({ trigger = "manual" } = {}) {
    if (runningAll) return runningAll;
    runningAll = (async () => {
      const results = [];
      for (const sw of switches()) {
        try {
          const r = await backupSwitch(sw, { trigger });
          results.push({ host: sw.host, ok: true, changed: r.changed, id: r.id });
        } catch (err) {
          results.push({ host: sw.host, ok: false, error: err.message });
        }
      }
      return results;
    })();
    try {
      return await runningAll;
    } finally {
      runningAll = null;
    }
  }

  function list() {
    return db.configBackups.map(({ file, ...rest }) => rest);
  }

  function get(id) {
    const e = db.configBackups.find((b) => b.id === id);
    if (!e) throw httpError(404, "Backup not found");
    return { ...e, content: readBackup(e) };
  }

  function diff(id, againstId) {
    const a = db.configBackups.find((b) => b.id === id);
    if (!a) throw httpError(404, "Backup not found");
    const b = db.configBackups.find((x) => x.id === (againstId || a.previousId));
    if (!b) return { id, againstId: null, patch: "", note: "No earlier version to compare with" };
    return {
      id,
      againstId: b.id,
      patch: createTwoFilesPatch(`${b.name} ${b.ts}`, `${a.name} ${a.ts}`, readBackup(b), readBackup(a), "", "", { context: 3 }),
    };
  }

  /** Daily automatic backup at the configured hour (default 03:00 server time). */
  function startSchedule() {
    let lastRunDay = null;
    setInterval(() => {
      const s = db.systemSettings?.find((x) => x.key === "config-backup-schedule")?.value || {};
      if (s.enabled === false) return;
      const hour = Number.isInteger(s.hour) ? s.hour : 3;
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      if (now.getHours() === hour && lastRunDay !== day && switches().length) {
        lastRunDay = day;
        backupAll({ trigger: "schedule" }).then((r) => console.log(`[config-backup] Scheduled run: ${r.filter((x) => x.ok).length}/${r.length} ok`));
      }
    }, 5 * 60 * 1000).unref();
  }

  return { switches, backupSwitch, backupAll, list, get, diff, startSchedule };
}
