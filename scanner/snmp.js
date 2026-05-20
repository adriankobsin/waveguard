import { execFile } from "child_process";
import { promisify } from "util";
import { parseSysDescr } from "./enrich.js";

const execFileAsync = promisify(execFile);

/**
 * SNMP GET via snmpget CLI if available; returns { sysName, sysDescr, vendor, model } or null.
 */
export async function snmpProbe(ip, options = {}) {
  const community = options.community || "public";
  const version = options.version === "3" ? "3" : "2c";
  const timeoutSec = Math.ceil((options.timeoutMs || 2000) / 1000);

  const args =
    version === "2c"
      ? ["-v2c", "-c", community, "-t", String(timeoutSec), "-r", "0", ip, "1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.1.0"]
      : ["-v3", "-c", community, "-t", String(timeoutSec), "-r", "0", ip, "1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.1.0"];

  try {
    const { stdout } = await execFileAsync("snmpget", args, {
      timeout: (timeoutSec + 1) * 1000,
      windowsHide: true,
    });
    const lines = stdout.toString().split("\n").filter(Boolean);
    let sysName = "";
    let sysDescr = "";
    for (const line of lines) {
      if (line.includes("1.3.6.1.2.1.1.5.0")) {
        sysName = extractSnmpValue(line);
      } else if (line.includes("1.3.6.1.2.1.1.1.0")) {
        sysDescr = extractSnmpValue(line);
      }
    }
    const { vendor, model } = parseSysDescr(sysDescr);
    return { sysName, sysDescr, vendor, model };
  } catch {
    return null;
  }
}

function extractSnmpValue(line) {
  const idx = line.indexOf("STRING:");
  if (idx >= 0) return line.slice(idx + 8).trim().replace(/^"|"$/g, "");
  const parts = line.split("=", 2);
  return parts[1]?.trim().replace(/^"|"$/g, "") || "";
}

export function isSnmpAvailable() {
  return execFileAsync("snmpget", ["-h"], { timeout: 3000, windowsHide: true })
    .then(() => true)
    .catch(() => false);
}
