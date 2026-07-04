import net from "node:net";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 4001;
const CONNECT_TIMEOUT_MS = 5000;
const RESPONSE_TIMEOUT_MS = 3000;
const DEFAULT_BAUD = 9600;
const DEFAULT_DATA_BITS = 8;
const DEFAULT_PARITY = "none";
const DEFAULT_STOP_BITS = 1;

let activeClient = null;

class Rs485BridgeClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.baud = opts.baud || DEFAULT_BAUD;
    this.dataBits = opts.dataBits || DEFAULT_DATA_BITS;
    this.parity = opts.parity || DEFAULT_PARITY;
    this.stopBits = opts.stopBits || DEFAULT_STOP_BITS;
    this.socket = null;
    this.state = "disconnected";
    this.disposed = false;
    this.buffer = "";
    this.pending = null;
    this.responseTimeoutMs = opts.responseTimeoutMs || RESPONSE_TIMEOUT_MS;
    this.connectTimeoutMs = opts.connectTimeoutMs || CONNECT_TIMEOUT_MS;
    this.encoding = opts.encoding || "ascii";
    this.lineTerminator = opts.lineTerminator || "\r\n";
    this.commandTerminator = opts.commandTerminator || "\r\n";
  }

  get key() {
    return `${this.host}:${this.port}`;
  }

  isReady() {
    return this.state === "ready" && !!this.socket;
  }

  async connect() {
    if (this.disposed) throw new Error("RS485 client disposed");
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
        fail(new Error(`RS485 bridge connection timed out at ${this.host}:${this.port}`));
      }, this.connectTimeoutMs);

      sock.setNoDelay(true);
      sock.once("connect", () => {
        clearTimeout(timer);
        this.configureBridge();
      });
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

  configureBridge() {
    this.state = "ready";
    this.emit("ready");
  }

  handleData(chunk) {
    const str = this.encoding === "hex"
      ? chunk.toString("hex").toUpperCase()
      : chunk.toString("utf8");

    this.buffer += str;

    const term = this.encoding === "hex" ? "" : this.lineTerminator;
    if (term) {
      let idx;
      while ((idx = this.buffer.indexOf(term)) >= 0) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + term.length);
        this.handleLine(line);
      }
    } else if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.resolve(this.buffer);
      this.buffer = "";
    }
  }

  handleLine(line) {
    const trimmed = line.replace(/\r$/, "").trim();
    if (!trimmed) return;
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.resolve(trimmed);
    } else {
      this.emit("data", trimmed);
    }
  }

  async sendRaw(data) {
    if (!this.isReady()) {
      return Promise.reject(new Error("RS485 client not ready"));
    }
    const payload = typeof data === "string"
      ? data + this.commandTerminator
      : data;

    return new Promise((resolve, reject) => {
      if (this.pending) {
        reject(new Error("Command already in progress"));
        return;
      }
      this.pending = { resolve, reject, timer: null };
      this.pending.timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`RS485 response timeout: ${String(data).trim()}`));
      }, this.responseTimeoutMs);
      try {
        this.socket?.write(payload);
      } catch (err) {
        this.pending = null;
        reject(err);
      }
    });
  }

  async sendHex(hexStr) {
    const buf = Buffer.from(hexStr.replace(/\s+/g, ""), "hex");
    return this.sendRaw(buf);
  }

  async ping() {
    await this.sendRaw("\r\n");
  }

  setOutput(id, level, fadeSeconds = 0) {
    const cmd = String(id).startsWith("hex:")
      ? String(id).replace("hex:", "")
      : `${id} ${Math.round(level)}\r\n`;
    if (String(id).startsWith("hex:")) {
      return this.sendHex(cmd).then(() => ({
        id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(),
      }));
    }
    return this.sendRaw(cmd).then(() => ({
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
      this.pending.reject(new Error("RS485 client disposed"));
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

export function getRs485Client(conn) {
  if (!conn?.host) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
  activeClient = new Rs485BridgeClient({
    host: conn.host,
    port: conn.port,
    baud: conn.baud,
    dataBits: conn.dataBits,
    parity: conn.parity,
    stopBits: conn.stopBits,
    encoding: conn.encoding || "ascii",
    lineTerminator: conn.lineTerminator || "\r\n",
    commandTerminator: conn.commandTerminator || "\r\n",
  });
  return activeClient;
}

export function closeRs485Client() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
}

export async function probeRs485Ports(host) {
  if (!host) return [];
  const commonPorts = [4001, 4002, 4003, 4004, 4005, 4010, 4020, 8899, 2000, 2001];
  const results = await Promise.all(commonPorts.map((port) => probeTcp(host, port)));
  return commonPorts
    .map((port, i) => ({
      port,
      label: `RS485 Bridge (TCP ${port})`,
      role: "rs485",
      open: results[i],
    }))
    .filter((p) => p.open);
}

function probeTcp(host, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1200);
    sock.on("connect", () => { try { sock.destroy(); } catch { } resolve(true); });
    sock.on("error", () => resolve(false));
    sock.on("timeout", () => resolve(false));
    try { sock.connect(port, host); } catch { resolve(false); }
  });
}

export function recommendationFromPorts(ports, protocol) {
  const rs485 = ports.filter((p) => p.role === "rs485");
  if (protocol === "rs485" && rs485.length === 0) {
    return "No RS485-to-TCP bridge ports found. Common ports are 4001-4005 (USR-N510), 8899, 2000, 2001. Verify the serial bridge is powered and the IP address is correct.";
  }
  if (protocol === "rs485" && rs485.length > 0) {
    const ports = rs485.map((p) => p.port).join(", ");
    return `RS485 bridge reachable on port(s): ${ports}. Configure baud rate, data bits, parity, and stop bits to match your HVAC device.`;
  }
  return null;
}
