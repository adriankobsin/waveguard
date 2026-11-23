/** Safe child-process helpers: argument arrays only (no shell), timeouts, size caps. */
import { execFile } from "child_process";

const availability = new Map();

/**
 * Run a binary with an argument array. Never throws for non-zero exit codes —
 * many network tools (ping, nmap) use them for "host down".
 */
export function run(cmd, args = [], { timeoutMs = 30000, maxBuffer = 8 * 1024 * 1024, cwd } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer, windowsHide: true, cwd, env: { ...process.env, LC_ALL: "C" } }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        code: err ? (typeof err.code === "number" ? err.code : -1) : 0,
        timedOut: !!err?.killed,
        missing: err?.code === "ENOENT",
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
        ms: Date.now() - started,
      });
    });
  });
}

/** Is a command on PATH? Cached for 5 minutes. */
export async function hasCommand(cmd) {
  const hit = availability.get(cmd);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.ok;
  const r = await run("sh", ["-c", 'command -v "$1"', "sh", cmd], { timeoutMs: 3000 });
  const ok = r.ok && r.stdout.trim().length > 0;
  availability.set(cmd, { ok, at: Date.now() });
  return ok;
}

const HOST_RE = /^(?!-)[A-Za-z0-9.:%_-]{1,253}$/;
const CIDR_RE = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/;

/** Validate a hostname / IPv4 / IPv6 target. Throws a 400-style error otherwise. */
export function assertHost(value, label = "host") {
  const v = String(value || "").trim();
  if (!HOST_RE.test(v)) throw httpError(400, `Invalid ${label}`);
  return v;
}

/** Validate an IPv4 CIDR with a prefix of /16 or longer (keeps scans bounded). */
export function assertCidr(value, minPrefix = 16) {
  const v = String(value || "").trim();
  const m = v.match(CIDR_RE);
  if (!m || m[1].split(".").some((o) => Number(o) > 255) || Number(m[2]) > 32 || Number(m[2]) < minPrefix) {
    throw httpError(400, `Invalid subnet (use e.g. 192.168.1.0/24, /${minPrefix} or smaller)`);
  }
  return v;
}

export function assertHostOrCidr(value) {
  const v = String(value || "").trim();
  return v.includes("/") ? assertCidr(v) : assertHost(v);
}

export function assertPort(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw httpError(400, "Invalid port");
  return n;
}

export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Wrap an async express handler so thrown errors become JSON responses. */
export const handle = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (out !== undefined && !res.headersSent) res.json(out);
  } catch (err) {
    if (!res.headersSent) res.status(err.status || 500).json({ message: err.message || "Request failed" });
  }
};
