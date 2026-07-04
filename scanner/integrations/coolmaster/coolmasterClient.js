import net from "node:net";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 10102;
const CONNECT_TIMEOUT_MS = 5000;
const RESPONSE_TIMEOUT_MS = 3000;

let activeClient = null;

class CoolmasterClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.socket = null;
    this.state = "disconnected";
    this.disposed = false;
    this.buffer = "";
    this.pending = null;
    this.connectTimeoutMs = opts.connectTimeoutMs || CONNECT_TIMEOUT_MS;
    this.responseTimeoutMs = opts.responseTimeoutMs || RESPONSE_TIMEOUT_MS;
    this.unitId = opts.unitId || 0;
  }

  get key() {
    return `${this.host}:${this.port}`;
  }

  isReady() {
    return this.state === "ready" && !!this.socket;
  }

  async connect() {
    if (this.disposed) throw new Error("Coolmaster client disposed");
    if (this.state === "ready") return;
    if (this.state !== "disconnected") {
      await new Promise((resolve, reject) => {
        const onReady = () => { this.off("error", onErr); resolve(); };
        const onErr = (err) => { this.off("ready", onReady); reject(err); };
        this.once("ready", onReady);
        this.once("error", onErr);
      });
      return;
    }

    this.state = "connecting";

    await new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        this.state = "disconnected";
        this.cleanup();
        this.emit("error", err);
        reject(err);
      };

      const sock = net.createConnection({ host: this.host, port: this.port });
      this.socket = sock;

      const timer = setTimeout(() => {
        fail(new Error(`Coolmaster connection timed out at ${this.host}:${this.port}`));
      }, this.connectTimeoutMs);

      sock.setNoDelay(true);
      sock.once("connect", () => { clearTimeout(timer); });
      sock.on("error", (err) => fail(err));
      sock.on("close", () => {
        clearTimeout(timer);
        const wasReady = this.state === "ready";
        this.state = "disconnected";
        this.cleanup();
        if (wasReady) this.emit("disconnected");
      });
      sock.on("data", (chunk) => this.handleData(chunk));

      this.once("ready", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });
      this.once("error", () => clearTimeout(timer));
    });
  }

  handleData(chunk) {
    this.buffer += chunk.toString("utf8");

    let nl;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, "").trim();
      this.buffer = this.buffer.slice(nl + 1);

      if (this.state === "connecting") {
        this.state = "ready";
        this.emit("ready");
      }

      if (line && this.pending) {
        const p = this.pending;
        this.pending = null;
        clearTimeout(p.timer);
        p.resolve(line);
      }
    }
  }

  sendCommand(cmd) {
    if (!this.isReady()) {
      return Promise.reject(new Error("Coolmaster client not ready"));
    }
    return new Promise((resolve, reject) => {
      if (this.pending) {
        reject(new Error("Command already in progress"));
        return;
      }
      this.pending = { resolve, reject, timer: null };
      this.pending.timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`Coolmaster command timed out: ${cmd.trim()}`));
      }, this.responseTimeoutMs);
      try {
        this.socket?.write(cmd);
      } catch (err) {
        this.pending = null;
        reject(err);
      }
    });
  }

  parseResponse(line) {
    if (!line || !line.startsWith("#")) return null;
    const parts = line.slice(1).split(",");
    if (parts.length < 3) return null;
    return {
      id: parseInt(parts[0], 10),
      unit: parseInt(parts[1], 10),
      command: parseInt(parts[2], 10),
      value: parts.length > 3 ? parseInt(parts[3], 10) : null,
      raw: line,
    };
  }

  async queryUnit(unitId) {
    const cmd = `#${this.unitId},${unitId},0,\r\n`;
    const resp = await this.sendCommand(cmd);
    return this.parseResponse(resp);
  }

  async setTemperature(unitId, tempC) {
    const val = Math.round(tempC);
    const cmd = `#${this.unitId},${unitId},1,${val}\r\n`;
    await this.sendCommand(cmd);
    return { unitId, temperature: val };
  }

  async setMode(unitId, mode) {
    const modeMap = { cool: 1, heat: 2, fan: 3, dry: 4, auto: 5 };
    const val = modeMap[mode] || 1;
    const cmd = `#${this.unitId},${unitId},2,${val}\r\n`;
    await this.sendCommand(cmd);
    return { unitId, mode };
  }

  async setFanSpeed(unitId, speed) {
    const speedMap = { low: 1, medium: 2, high: 3, auto: 4 };
    const val = speedMap[speed] || 4;
    const cmd = `#${this.unitId},${unitId},3,${val}\r\n`;
    await this.sendCommand(cmd);
    return { unitId, speed };
  }

  async setPower(unitId, on) {
    const cmd = `#${this.unitId},${unitId},4,${on ? 1 : 0}\r\n`;
    await this.sendCommand(cmd);
    return { unitId, on };
  }

  async getTemperature(unitId) {
    const resp = await this.queryUnit(unitId);
    if (!resp) return null;
    return resp.value;
  }

  async ping() {
    await this.queryUnit(0);
  }

  setOutput(id, level, fadeSeconds = 0) {
    if (String(id).startsWith("temp:")) {
      const uid = parseInt(id.replace("temp:", ""), 10);
      return this.setTemperature(uid, level).then(() => ({
        id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(),
      }));
    }
    if (String(id).startsWith("power:")) {
      const uid = parseInt(id.replace("power:", ""), 10);
      return this.setPower(uid, level > 0).then(() => ({
        id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(),
      }));
    }
    const uid = parseInt(String(id).replace(/\D/g, "") || "0", 10);
    return this.setTemperature(uid, level).then(() => ({
      id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(),
    }));
  }

  async getOutput(id) {
    return { id: String(id), level: 0, on: false };
  }

  async pollOutputs(ids) {
    return (ids || []).map((id) => this.getOutput(id));
  }

  dispose() {
    this.disposed = true;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error("Coolmaster client disposed"));
      this.pending = null;
    }
    this.cleanup();
    this.state = "disconnected";
  }

  cleanup() {
    if (this.socket) {
      try { this.socket.destroy(); } catch { }
      this.socket = null;
    }
  }
}

export function getCoolmasterClient(conn) {
  if (!conn?.host) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
  activeClient = new CoolmasterClient({ host: conn.host, port: conn.port, unitId: conn.unitId || 0 });
  return activeClient;
}

export function closeCoolmasterClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
}

export async function probeCoolmasterPorts(host) {
  if (!host) return [];
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (open, detail) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { }
      resolve([{ port: 10102, label: "Coolmaster Net", role: "coolmaster", open, detail }]);
    };
    sock.setTimeout(3000);
    sock.on("connect", () => {
      const timer = setTimeout(() => finish(true, "port open, no response"), 2000);
      sock.once("data", (data) => {
        clearTimeout(timer);
        const resp = data.toString("utf8").trim();
        finish(resp.startsWith("#"), resp);
      });
      sock.write("#0,0,0,\r\n");
    });
    sock.on("error", () => finish(false));
    sock.on("timeout", () => finish(false));
    try { sock.connect(10102, host); } catch { finish(false); }
  });
}

export function recommendationFromPorts(ports, protocol) {
  const cm = ports.find((p) => p.role === "coolmaster")?.open;
  if (protocol === "coolmaster" && !cm) {
    return "Coolmaster port 10102 is not responding. Verify the Coolmaster controller is powered and reachable on the network.";
  }
  return null;
}
