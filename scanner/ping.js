import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const isWin = process.platform === "win32";

export async function pingHost(ip, timeoutMs = 1500) {
  const args = isWin
    ? ["-n", "1", "-w", String(Math.min(timeoutMs, 5000)), ip]
    : ["-c", "1", "-W", String(Math.ceil(timeoutMs / 1000)), ip];

  const start = Date.now();
  try {
    const { stdout } = await execFileAsync("ping", args, {
      timeout: timeoutMs + 500,
      windowsHide: true,
    });
    const text = stdout.toString();
    const alive =
      (isWin && (text.includes("TTL=") || text.includes("ttl="))) ||
      (!isWin && text.includes("1 received"));
    if (!alive) return { alive: false, ms: null };
    const msMatch = text.match(/(?:time[=<])(\d+)/i);
    return { alive: true, ms: msMatch ? parseInt(msMatch[1], 10) : Date.now() - start };
  } catch {
    return { alive: false, ms: null };
  }
}
