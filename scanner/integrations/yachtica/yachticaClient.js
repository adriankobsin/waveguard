import net from "node:net";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 5000;
const CONNECT_TIMEOUT_MS = 5000;
const RESPONSE_TIMEOUT_MS = 3000;

const CHANNEL_COUNT = 8;
const STATUS_RESPONSE_LENGTH = 9;
const STATUS_HEADER = 0xff;

const CHANNEL_MASKS = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];
const MEMORY_BASE = 0x58;
const MEMORY_BANK_SIZE = 8;
const MEMORY_BANK_COUNT = 7;

let activeClient = null;

class YachticaTcpClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.socket = null;
    this.state = "disconnected";
    this.disposed = false;
    this.pendingPoll = null;
    this.buffer = Buffer.alloc(0);
    this.connectTimeoutMs = opts.connectTimeoutMs || CONNECT_TIMEOUT_MS;
    this.responseTimeoutMs = opts.responseTimeoutMs || RESPONSE_TIMEOUT_MS;
  }

  get key() {
    return `${this.host}:${this.port}`;
  }

  isReady() {
    return this.state === "ready" && !!this.socket;
  }

  async connect() {
    if (this.disposed) throw new Error("Yachtica client disposed");
    if (this.state === "ready") return;
    if (this.state !== "disconnected") {
      await this.waitForState("ready", this.connectTimeoutMs);
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
        fail(new Error(`Yachtica connection timed out at ${this.host}:${this.port}`));
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

  waitForState(targetState, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (this.state === targetState) return resolve();
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for state ${targetState}`)), timeoutMs);
      this.once(targetState, () => {
        clearTimeout(timer);
        resolve();
      });
      this.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= STATUS_RESPONSE_LENGTH) {
      if (this.buffer[0] === STATUS_HEADER) {
        const frame = this.buffer.subarray(0, STATUS_RESPONSE_LENGTH);
        this.buffer = this.buffer.subarray(STATUS_RESPONSE_LENGTH);

        const channels = [];
        for (let i = 1; i < STATUS_RESPONSE_LENGTH; i++) {
          channels.push(frame[i]);
        }

        if (this.pendingPoll) {
          clearTimeout(this.pendingPoll.timer);
          const resolve = this.pendingPoll.resolve;
          this.pendingPoll = null;
          resolve(channels);
        }
      } else {
        this.buffer = this.buffer.subarray(1);
      }
    }
  }

  sendRaw(data) {
    if (!this.isReady()) {
      return Promise.reject(new Error("Yachtica client not ready"));
    }
    return new Promise((resolve, reject) => {
      try {
        this.socket?.write(data, () => resolve());
      } catch (err) {
        reject(err);
      }
    });
  }

  pollStatus(address) {
    const buf = Buffer.from([address, 0x87, 0x00]);
    if (!this.isReady()) {
      return Promise.reject(new Error("Yachtica client not ready"));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingPoll) {
          this.pendingPoll = null;
          reject(new Error(`Yachtica status poll timeout (addr=${address})`));
        }
      }, this.responseTimeoutMs);

      this.pendingPoll = { resolve, reject, timer };

      try {
        this.socket?.write(buf);
      } catch (err) {
        clearTimeout(timer);
        this.pendingPoll = null;
        reject(err);
      }
    });
  }

  setOutput({ address, channelIndex, level }) {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    const buf = Buffer.from([address, 0x30, channelIndex, clamped]);
    return this.sendRaw(buf).then(() => this.pollStatus(address));
  }

  pressInput({ address, channelIndex }) {
    const mask = CHANNEL_MASKS[channelIndex];
    const pressBuf = Buffer.from([address, 0x00, 0x19, mask]);
    return this.sendRaw(pressBuf);
  }

  releaseInput({ address, channelIndex }) {
    const mask = CHANNEL_MASKS[channelIndex];
    const releaseBuf = Buffer.from([address, 0x10, 0x19, mask]);
    return this.sendRaw(releaseBuf);
  }

  pressAndReleaseInput({ address, channelIndex, holdMs = 50 }) {
    const mask = CHANNEL_MASKS[channelIndex];
    const pressBuf = Buffer.from([address, 0x00, 0x19, mask]);
    const releaseBuf = Buffer.from([address, 0x10, 0x19, mask]);
    return this.sendRaw(pressBuf).then(() => new Promise((r) => setTimeout(r, holdMs))).then(() => this.sendRaw(releaseBuf));
  }

  recallScene({ address, sceneIndex }) {
    return this.setScene({ address, sceneIndex, save: false });
  }

  saveScene({ address, sceneIndex }) {
    return this.setScene({ address, sceneIndex, save: true });
  }

  setScene({ address, sceneIndex, save }) {
    const bankIndex = Math.floor(sceneIndex / MEMORY_BANK_SIZE);
    const bitIndex = sceneIndex % MEMORY_BANK_SIZE;
    const cmdByte = MEMORY_BASE + bankIndex;
    const mask = CHANNEL_MASKS[bitIndex];
    const prefix = save ? 0x10 : 0x00;
    const buf = Buffer.from([address, prefix, cmdByte, mask]);
    return this.sendRaw(buf);
  }

  async ping() {
    await this.pollStatus(0);
  }

  dispose() {
    this.disposed = true;
    if (this.pendingPoll) {
      clearTimeout(this.pendingPoll.timer);
      this.pendingPoll.reject(new Error("Yachtica client disposed"));
      this.pendingPoll = null;
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

export function getYachticaClient(conn) {
  if (!conn?.host) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
  activeClient = new YachticaTcpClient({ host: conn.host, port: conn.port });
  return activeClient;
}

export function closeYachticaClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
}

export async function probeYachticaPorts(host) {
  if (!host) return [];
  const sock = new net.Socket();
  return new Promise((resolve) => {
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { }
      resolve([{ port: 5000, label: "Yachtica Gateway", role: "yachtica-tcp", open }]);
    };
    sock.setTimeout(2000);
    sock.on("connect", () => {
      const probe = Buffer.from([0x00, 0x87, 0x00]);
      sock.write(probe);
      const timer = setTimeout(() => finish(true), 1500);
      sock.once("data", (data) => {
        clearTimeout(timer);
        finish(data.length >= 9 && data[0] === 0xff);
      });
    });
    sock.on("error", () => finish(false));
    sock.on("timeout", () => finish(false));
    try { sock.connect(5000, host); } catch { finish(false); }
  });
}

export function recommendationFromPorts(ports, _protocol) {
  const y = ports.find((p) => p.role === "yachtica-tcp")?.open;
  if (!y) {
    return "Yachtica gateway port 5000 is not responding. Verify the gateway is powered and reachable, and check firewall rules for TCP 5000.";
  }
  return null;
}

export { CHANNEL_COUNT, CHANNEL_MASKS, STATUS_RESPONSE_LENGTH, YachticaTcpClient };
