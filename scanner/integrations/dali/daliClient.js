import net from "node:net";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 5582;
const CONNECT_TIMEOUT_MS = 5000;
const COMMAND_TIMEOUT_MS = 3000;

let activeClient = null;

class DaliIpClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.socket = null;
    this.buffer = "";
    this.state = "disconnected";
    this.disposed = false;
    this.pending = null;
    this.connectTimeoutMs = opts.connectTimeoutMs || CONNECT_TIMEOUT_MS;
    this.commandTimeoutMs = opts.commandTimeoutMs || COMMAND_TIMEOUT_MS;
    this.lastLevels = new Map();
  }

  get key() {
    return `${this.host}:${this.port}`;
  }

  isReady() {
    return this.state === "ready" && !!this.socket;
  }

  async connect() {
    if (this.disposed) throw new Error("DALI client disposed");
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
        fail(new Error(`DALI IP bridge connection timed out at ${this.host}:${this.port}`));
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

      const onReady = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      this.once("ready", onReady);
      this.once("error", () => clearTimeout(timer));
    });
  }

  handleData(chunk) {
    this.buffer += chunk.toString("utf8");

    if (this.state === "connecting") {
      if (this.buffer.includes(">") || this.buffer.includes("OK")) {
        this.buffer = "";
        this.state = "ready";
        this.emit("ready");
        return;
      }
    }

    let nl;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, "").trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line && this.pending) {
        const p = this.pending;
        this.pending = null;
        clearTimeout(p.timer);
        p.resolve({ raw: line, parsed: parseDaliResponse(line) });
      }
      const readyMatch = line.match(/[>]\s*$/);
      if (readyMatch && this.pending) {
        const p = this.pending;
        this.pending = null;
        clearTimeout(p.timer);
        p.resolve({ raw: line, parsed: null });
      }
    }

    if (!this.pending && this.buffer.includes(">")) {
      this.buffer = "";
    }
  }

  sendCommand(cmd) {
    if (!this.isReady()) {
      return Promise.reject(new Error("DALI client not ready"));
    }
    return new Promise((resolve, reject) => {
      if (this.pending) {
        reject(new Error("DALI command already in progress"));
        return;
      }
      this.pending = { resolve, reject, timer: null };
      this.pending.timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`DALI command timed out: ${cmd}`));
      }, this.commandTimeoutMs);
      try {
        this.socket?.write(`${cmd}\r\n`);
      } catch (err) {
        this.pending = null;
        reject(err);
      }
    });
  }

  writeDali(shortAddr, value) {
    const addr = Math.max(0, Math.min(63, Math.round(Number(shortAddr))));
    const dir = 0;
    const cmd = (addr << 1) | dir;
    const cmdStr = `#${cmd.toString(16).padStart(2, "0")} ${value.toString(16).padStart(2, "0")}`;
    return this.sendCommand(cmdStr);
  }

  setOutput(id, level, fadeSeconds = 0) {
    const lvl = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    const arcPower = Math.round((lvl / 100) * 254);
    const addr = String(id).replace(/\D/g, "") || "0";
    return this.writeDali(addr, arcPower).then(() => {
      const updatedAt = new Date().toISOString();
      const next = { id: String(id), level: lvl, on: lvl > 0, updatedAt };
      this.lastLevels.set(String(id), next);
      return next;
    });
  }

  async getOutput(id) {
    return this.lastLevels.get(String(id)) || { id: String(id), level: 0, on: false };
  }

  async pollOutputs(ids) {
    return (ids || []).map((id) => this.getOutput(id));
  }

  async ping() {
    await this.writeDali(0, 0);
  }

  dispose() {
    this.disposed = true;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error("DALI client disposed"));
      this.pending = null;
    }
    this.cleanup();
    this.state = "disconnected";
  }

  cleanup() {
    if (this.socket) {
      try {
        this.socket.write("LOGOUT\r\n");
      } catch { /* */ }
      try { this.socket.destroy(); } catch { /* */ }
      this.socket = null;
    }
  }
}

function parseDaliResponse(line) {
  const m = line.match(/([0-9a-fA-F]+)/);
  return m ? parseInt(m[1], 16) : null;
}

export function getDaliClient(conn) {
  if (!conn?.host) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
  activeClient = new DaliIpClient({ host: conn.host, port: conn.port });
  return activeClient;
}

export function closeDaliClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
}

function probeTcpPort(host, port, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { /* */ }
      resolve(open);
    };
    sock.setNoDelay(true);
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => finish(true));
    sock.on("timeout", () => finish(false));
    sock.on("error", () => finish(false));
  });
}

export async function probeDaliPorts(host) {
  if (!host) return [];
  return [
    { port: 5582, label: "DALI IP", role: "dali-ip", open: await probeTcpPort(host, 5582) },
  ];
}

export function recommendationFromPorts(ports, protocol) {
  const dali = ports.find((p) => p.role === "dali-ip")?.open;
  if (protocol === "dali-ip" && !dali) {
    return "DALI IP port 5582 is not responding. Verify the DALI IP bridge is powered and connected, and that its IP address is reachable from this host.";
  }
  return null;
}
