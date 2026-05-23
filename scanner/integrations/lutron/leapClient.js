import http from "node:http";
import https from "node:https";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 8081;
const REQUEST_TIMEOUT_MS = 6000;

let activeClient = null;

class LutronLeapClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.useTls = opts.tls !== false && (this.port === 443 || this.port === 8083 || opts.tls === true);
    this.username = opts.username;
    this.password = opts.password;
    this.requestTimeoutMs = opts.requestTimeoutMs || REQUEST_TIMEOUT_MS;
    this.lastLevels = new Map();
    this.disposed = false;
    this.state = "disconnected";
  }

  get key() {
    return `${this.host}:${this.port}:${this.username}`;
  }

  isReady() {
    return this.state === "ready";
  }

  async connect() {
    if (this.disposed) throw new Error("LEAP client disposed");
    if (this.state === "ready") return;
    this.state = "connecting";
    try {
      await this.ping();
      this.state = "ready";
      this.emit("ready");
    } catch (err) {
      this.state = "disconnected";
      this.emit("error", err);
      throw err;
    }
  }

  authHeader() {
    const encoded = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    return `Basic ${encoded}`;
  }

  async leapRequest(method, path, body) {
    const mod = this.useTls ? https : http;
    const opts = {
      hostname: this.host,
      port: this.port,
      path,
      method: method || "GET",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };
    if (body) {
      opts.headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body));
    }
    return new Promise((resolve, reject) => {
      const req = mod.request(opts, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`LEAP ${method} ${path} returned ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch {
              resolve(data);
            }
          }
        });
      });
      req.on("error", (err) => reject(new Error(`LEAP request failed: ${err.message}`)));
      req.setTimeout(this.requestTimeoutMs, () => {
        req.destroy();
        reject(new Error(`LEAP request timed out after ${this.requestTimeoutMs}ms`));
      });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  buildCommandBody(commandType, params) {
    return {
      CommuniqueType: "CreateRequest",
      Header: { Url: "/commandprocessor" },
      Body: {
        Command: {
          CommandType: commandType,
          Parameter: params || [],
        },
      },
    };
  }

  async setOutput(id, level, fadeSeconds = 0) {
    const lvl = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    const fade = fadeSeconds > 0 ? `00:00:${String(Math.round(fadeSeconds)).padStart(2, "0")}` : "00:00:00";
    const body = this.buildCommandBody("GoToLevel", [
      { Type: "Level", Value: lvl },
      { Type: "Fade", Value: fade },
    ]);
    await this.leapRequest("PUT", `/zone/${id}/commandprocessor`, body);
    const updatedAt = new Date().toISOString();
    const next = { id: String(id), level: lvl, on: lvl > 0, updatedAt };
    this.lastLevels.set(String(id), next);
    return next;
  }

  async raiseLower(id, action) {
    const cmdType = action === "raise" ? "Raise" : action === "lower" ? "Lower" : "StopRaisingOrLowering";
    const body = this.buildCommandBody(cmdType);
    await this.leapRequest("PUT", `/zone/${id}/commandprocessor`, body);
    const updatedAt = new Date().toISOString();
    return { id, action, updatedAt };
  }

  async pressButton(deviceId, componentId) {
    const body = this.buildCommandBody("PressAndRelease");
    const path = `/device/${deviceId}/button/${componentId}/commandprocessor`;
    await this.leapRequest("PUT", path, body);
    return { deviceId, componentId, pressedAt: new Date().toISOString() };
  }

  async activateAreaScene(areaId, sceneNumber) {
    const body = {
      CommuniqueType: "CreateRequest",
      Header: { Url: "/commandprocessor" },
      Body: {
        Command: {
          CommandType: "ActivateScene",
          Parameter: [{ Type: "SceneNumber", Value: Math.max(0, Math.min(16, Math.round(Number(sceneNumber) || 0))) }],
        },
      },
    };
    await this.leapRequest("PUT", `/area/${areaId}/commandprocessor`, body);
    return { areaId, sceneNumber, activatedAt: new Date().toISOString() };
  }

  async getOutput(id) {
    try {
      const resp = await this.leapRequest("GET", `/zone/${id}/status`);
      if (resp?.Body?.ZoneStatus?.Level !== undefined) {
        const level = Number(resp.Body.ZoneStatus.Level);
        const updatedAt = new Date().toISOString();
        const entry = { id, level, on: level > 0, updatedAt };
        this.lastLevels.set(String(id), entry);
        return entry;
      }
    } catch {
      // fall through to cached value
    }
    return this.lastLevels.get(String(id)) || { id: String(id), level: 0, on: false };
  }

  async pollOutputs(ids) {
    const results = [];
    for (const id of ids) {
      try {
        results.push(await this.getOutput(id));
      } catch (err) {
        results.push({ id, level: 0, on: false, error: err.message });
      }
    }
    return results;
  }

  async ping() {
    await this.leapRequest("GET", "/zone/0/status");
  }

  dispose() {
    this.disposed = true;
    this.state = "disconnected";
    this.lastLevels.clear();
  }
}

export function getLeapClient(conn) {
  if (!conn?.host || !conn?.username) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}:${conn.username}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    activeClient.password = conn.password;
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
  activeClient = new LutronLeapClient({
    host: conn.host,
    port: conn.port,
    tls: conn.tls,
    username: conn.username,
    password: conn.password,
  });
  return activeClient;
}

export function closeLeapClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
}
