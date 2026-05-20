import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const isWin = process.platform === "win32";

/** Read ARP/neighbor table into Map<ip, mac>. */
export async function readArpTable() {
  const map = new Map();
  try {
    if (isWin) {
      const { stdout } = await execFileAsync("arp", ["-a"], { windowsHide: true, timeout: 10000 });
      const lines = stdout.toString().split("\n");
      for (const line of lines) {
        const m = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]{17})/i);
        if (m) map.set(m[1], normalizeMac(m[2]));
      }
    } else {
      try {
        const { stdout } = await execFileAsync("ip", ["neigh", "show"], { timeout: 10000 });
        for (const line of stdout.toString().split("\n")) {
          const m = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+dev\s+\S+\s+lladdr\s+([0-9a-f:]{17})/i);
          if (m) map.set(m[1], normalizeMac(m[2]));
        }
      } catch {
        const { stdout } = await execFileAsync("arp", ["-an"], { timeout: 10000 });
        for (const line of stdout.toString().split("\n")) {
          const m = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]{17})/i);
          if (m) map.set(m[1], normalizeMac(m[2]));
        }
      }
    }
  } catch (err) {
    console.warn("[scanner] ARP table read failed:", err.message);
  }
  return map;
}

function normalizeMac(mac) {
  return mac.replace(/-/g, ":").toUpperCase();
}
