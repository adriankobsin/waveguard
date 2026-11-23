/** Health of the WaveGuard host itself (the mini PC in the rack). */
import fs from "fs";
import os from "os";
import path from "path";
import { config } from "./config.js";
import { run } from "./exec.js";

function readFile(p) {
  try {
    return fs.readFileSync(p, "utf-8").trim();
  } catch {
    return null;
  }
}

function temperatures() {
  const out = [];
  try {
    for (const zone of fs.readdirSync("/sys/class/thermal")) {
      if (!zone.startsWith("thermal_zone")) continue;
      const t = Number(readFile(`/sys/class/thermal/${zone}/temp`));
      if (!Number.isFinite(t) || t <= 0) continue;
      out.push({ sensor: readFile(`/sys/class/thermal/${zone}/type`) || zone, celsius: Math.round(t / 100) / 10 });
    }
  } catch {
    /* not Linux or no thermal zones */
  }
  return out;
}

function disk(p) {
  try {
    const s = fs.statfsSync(p);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    return { path: p, totalBytes: total, freeBytes: free, usedPct: total ? Math.round(((total - free) / total) * 1000) / 10 : null };
  } catch {
    return null;
  }
}

let lastCpu = null;
function cpuUsagePct() {
  const cpus = os.cpus();
  const totals = cpus.reduce(
    (acc, c) => {
      const t = Object.values(c.times).reduce((a, b) => a + b, 0);
      return { idle: acc.idle + c.times.idle, total: acc.total + t };
    },
    { idle: 0, total: 0 }
  );
  let pct = null;
  if (lastCpu) {
    const dIdle = totals.idle - lastCpu.idle;
    const dTotal = totals.total - lastCpu.total;
    pct = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 1000) / 10 : null;
  }
  lastCpu = totals;
  return pct;
}
cpuUsagePct();

export function gitInfo() {
  const gitDir = path.join(config.repoDir, ".git");
  const head = readFile(path.join(gitDir, "HEAD"));
  if (!head) return { commit: null, branch: null };
  if (head.startsWith("ref: ")) {
    const ref = head.slice(5);
    let commit = readFile(path.join(gitDir, ref));
    if (!commit) {
      const packed = readFile(path.join(gitDir, "packed-refs")) || "";
      commit = (packed.split("\n").find((l) => l.endsWith(` ${ref}`)) || "").split(" ")[0] || null;
    }
    return { commit, branch: ref.replace("refs/heads/", "") };
  }
  return { commit: head, branch: null };
}

export async function hostHealth() {
  const mem = { totalBytes: os.totalmem(), freeBytes: os.freemem() };
  const meminfo = readFile("/proc/meminfo");
  const avail = meminfo?.match(/MemAvailable:\s+(\d+) kB/);
  if (avail) mem.freeBytes = Number(avail[1]) * 1024;
  mem.usedPct = Math.round(((mem.totalBytes - mem.freeBytes) / mem.totalBytes) * 1000) / 10;

  let osName = `${os.type()} ${os.release()}`;
  const rel = readFile("/etc/os-release");
  const pretty = rel?.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
  if (pretty) osName = pretty[1];

  const temps = temperatures();
  const svc = await run("systemctl", ["is-active", "waveguard"], { timeoutMs: 3000 });

  const warnings = [];
  const dataDisk = disk(config.dataDir);
  if (dataDisk?.usedPct > 90) warnings.push({ severity: "critical", message: `Disk ${dataDisk.usedPct}% full` });
  else if (dataDisk?.usedPct > 80) warnings.push({ severity: "warning", message: `Disk ${dataDisk.usedPct}% full` });
  if (mem.usedPct > 92) warnings.push({ severity: "warning", message: `Memory ${mem.usedPct}% used` });
  const hottest = Math.max(0, ...temps.map((t) => t.celsius));
  if (hottest > 85) warnings.push({ severity: "critical", message: `CPU temperature ${hottest} °C` });
  else if (hottest > 75) warnings.push({ severity: "warning", message: `CPU temperature ${hottest} °C` });

  return {
    hostname: os.hostname(),
    os: osName,
    kernel: os.release(),
    arch: os.arch(),
    node: process.version,
    uptimeSec: Math.round(os.uptime()),
    processUptimeSec: Math.round(process.uptime()),
    cpu: { model: os.cpus()[0]?.model || null, cores: os.cpus().length, load: os.loadavg().map((l) => Math.round(l * 100) / 100), usagePct: cpuUsagePct() },
    memory: mem,
    disks: [dataDisk, config.dataDir.startsWith("/var") ? disk("/") : null].filter(Boolean),
    temperatures: temps,
    service: svc.ok ? svc.stdout.trim() : "not managed by systemd",
    waveguard: { version: config.version, ...gitInfo(), dataDir: config.dataDir, pid: process.pid },
    warnings,
  };
}
