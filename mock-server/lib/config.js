/**
 * Central runtime configuration for the WaveGuard local server.
 *
 * Every value can be overridden with an environment variable. On a standalone
 * Debian install these live in /etc/waveguard/waveguard.env (see deploy/).
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, "..");
const REPO_DIR = path.resolve(SERVER_DIR, "..");

function envBool(name, fallback) {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function envList(name) {
  return String(process.env[name] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const dataDir = path.resolve(SERVER_DIR, process.env.WAVEGUARD_DATA_DIR || "data");
fs.mkdirSync(dataDir, { recursive: true });

const defaultStatic = path.join(REPO_DIR, "dist");

export const config = {
  serverDir: SERVER_DIR,
  repoDir: REPO_DIR,
  port: Number(process.env.PORT || process.env.WAVEGUARD_PORT || 3002),
  host: process.env.HOST || process.env.WAVEGUARD_HOST || "0.0.0.0",
  dataDir,
  dataPath: process.env.WAVEGUARD_DATA_PATH || path.join(dataDir, "waveguard-data.json"),
  uploadsDir: process.env.WAVEGUARD_UPLOADS_DIR || path.join(dataDir, "uploads"),
  capturesDir: process.env.WAVEGUARD_CAPTURES_DIR || path.join(dataDir, "captures"),
  configBackupsDir: path.join(dataDir, "config-backups"),
  /** Built front end (npm run build). Served by this process when present. */
  staticDir: process.env.WAVEGUARD_STATIC_DIR || defaultStatic,
  /** Extra browser origins allowed to call the API (dev servers, remote dashboards). */
  corsOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...envList("WAVEGUARD_CORS_ORIGINS"),
  ],
  /** Set true when the UI is served over HTTPS so session cookies are Secure. */
  secureCookies: envBool("WAVEGUARD_SECURE_COOKIES", false),
  sessionTtlHours: Number(process.env.WAVEGUARD_SESSION_TTL_HOURS || 24 * 14),
  /** Optional machine-to-machine token (Authorization: Bearer <token>) with admin rights. */
  apiToken: process.env.WAVEGUARD_API_TOKEN || "",
  /**
   * Disable the login requirement entirely. Only for isolated bench testing —
   * never on a vessel network.
   */
  authDisabled: envBool("WAVEGUARD_AUTH_DISABLED", false),
  useMockScan: envBool("WAVEGUARD_USE_MOCK_SCAN", false),
  version: readVersion(),
};

function readVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_DIR, "package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.capturesDir, { recursive: true });
fs.mkdirSync(config.configBackupsDir, { recursive: true });
