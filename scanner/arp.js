import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);
const isWin = process.platform === "win32";

async function readFromProcNetArp() {
  const data = await fs.readFile("/proc/net/arp", "utf8");
  const lines = data.split("\n");
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const ip = parts[0];
    const flags = parts[2];
    const mac = parts[3];
    if (flags === "0x2" && mac && mac !== "00:00:00:00:00:00") {
      map.set(ip, normalizeMac(mac));
    }
  }
  return map;
}

async function commandExists(cmd) {
  try {
    await execFileAsync("which", [cmd], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function readFromIpNeigh() {
  const { stdout } = await execFileAsync("ip", ["neigh", "show"], { timeout: 10000 });
  const map = new Map();
  for (const line of stdout.toString().split("\n")) {
    const m = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+.*lladdr\s+([0-9a-f:]{17})/i);
    if (m) map.set(m[1], normalizeMac(m[2]));
  }
  return map;
}

async function readFromArpAn() {
  const { stdout } = await execFileAsync("arp", ["-an"], { timeout: 10000 });
  const map = new Map();
  for (const line of stdout.toString().split("\n")) {
    const m = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]{17})/i);
    if (m) map.set(m[1], normalizeMac(m[2]));
  }
  return map;
}

export async function readArpTable() {
  if (isWin) {
    try {
      return await readFromArpAn();
    } catch (err) {
      console.warn("[scanner] ARP table read failed:", err.message);
      return new Map();
    }
  }

  try {
    return await readFromProcNetArp();
  } catch {
    /* /proc/net/arp not available, try next method */
  }

  try {
    return await readFromIpNeigh();
  } catch {
    /* ip neigh not available, try arp fallback */
  }

  try {
    if (await commandExists("arp")) {
      return await readFromArpAn();
    }
  } catch {
    /* arp command not available */
  }

  console.warn("[scanner] No method available to read ARP table");
  return new Map();
}

function normalizeMac(mac) {
  return mac.replace(/-/g, ":").toUpperCase();
}
