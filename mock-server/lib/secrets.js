/**
 * At-rest encryption for credential fields in the WaveGuard data file.
 *
 * The server keeps plain values in memory (it needs them to talk to switches,
 * Lutron processors, routers…). When the data file is written, every string
 * field whose *name* looks like a secret is replaced by "enc:v1:<iv>:<tag>:<ct>"
 * (AES-256-GCM). Loading reverses it. The key lives outside the data file:
 *   - WAVEGUARD_SECRET_KEY (64 hex chars), or
 *   - <dataDir>/secret.key, created on first run with mode 0600.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config } from "./config.js";

const PREFIX = "enc:v1:";

/** Field names treated as secrets. `key` is deliberately NOT included (SystemSettings rows use it). */
const SECRET_FIELD =
  /(password|passwd|passphrase|secret|community|token|apikey|api_key|authkey|privkey|privatekey|psk|wpakey)$/i;

let cachedKey = null;

export function getSecretKey() {
  if (cachedKey) return cachedKey;
  const envKey = process.env.WAVEGUARD_SECRET_KEY;
  if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) {
    cachedKey = Buffer.from(envKey, "hex");
    return cachedKey;
  }
  const keyPath = path.join(config.dataDir, "secret.key");
  if (fs.existsSync(keyPath)) {
    const hex = fs.readFileSync(keyPath, "utf-8").trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      cachedKey = Buffer.from(hex, "hex");
      return cachedKey;
    }
  }
  const fresh = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, fresh.toString("hex") + "\n", { mode: 0o600 });
  console.log(`[secrets] Generated new encryption key at ${keyPath}`);
  cachedKey = fresh;
  return cachedKey;
}

export function encryptValue(plain) {
  if (typeof plain !== "string" || plain === "" || plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptValue(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value;
  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getSecretKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf-8");
  } catch (err) {
    console.error("[secrets] Could not decrypt a stored value (wrong key?):", err.message);
    return "";
  }
}

function transform(node, fn, depth = 0) {
  if (depth > 40 || node == null) return node;
  if (Array.isArray(node)) return node.map((v) => transform(v, fn, depth + 1));
  if (typeof node !== "object") return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string" && SECRET_FIELD.test(k)) out[k] = fn(v);
    else out[k] = transform(v, fn, depth + 1);
  }
  return out;
}

/** Deep copy of `state` with secret-named string fields encrypted. */
export function encryptSecrets(state) {
  return transform(state, encryptValue);
}

/** Deep copy of `state` with any encrypted fields decrypted. */
export function decryptSecrets(state) {
  return transform(state, decryptValue);
}

export const __test = { SECRET_FIELD, PREFIX };
