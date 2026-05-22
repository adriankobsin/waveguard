import dgram from "node:dgram";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 3671;
const CONNECTION_TIMEOUT_MS = 5000;
const KNX_PORT = 3671;

let activeClient = null;

class KnxTunnellingClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.localPort = opts.localPort || 0;
    this.socket = null;
    this.channelId = null;
    this.sequence = 0;
    this.state = "disconnected";
    this.disposed = false;
    this.connectTimeoutMs = opts.connectTimeoutMs || CONNECTION_TIMEOUT_MS;
    this.lastLevels = new Map();
  }

  get key() {
    return `${this.host}:${this.port}`;
  }

  isReady() {
    return this.state === "ready" && !!this.socket;
  }

  async connect() {
    if (this.disposed) throw new Error("KNX client disposed");
    if (this.state === "ready") return;

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

      const sock = dgram.createSocket("udp4");
      this.socket = sock;

      const timer = setTimeout(() => {
        fail(new Error(`KNX connection timed out at ${this.host}:${this.port}`));
      }, this.connectTimeoutMs);

      sock.on("error", (err) => fail(err));
      sock.on("message", (msg) => {
        clearTimeout(timer);
        this.handleMessage(msg);
      });

      sock.bind(this.localPort, () => {
        this.sendConnectionRequest();
      });

      this.once("ready", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });
      this.once("error", () => clearTimeout(timer));
    });
  }

  sendConnectionRequest() {
    const req = buildConnectionRequest();
    this.socket?.send(req, this.port, this.host);
  }

  handleMessage(msg) {
    if (msg.length < 6) return;
    const headerLen = msg.readUInt8(0);
    if (headerLen !== 6) return;
    const serviceId = msg.readUInt16BE(2);
    if (serviceId === 0x0206 && msg.length >= 10) {
      this.channelId = msg.readUInt8(6);
      this.state = "ready";
      this.emit("ready");
    } else if (serviceId === 0x0421 && msg.length >= 10) {
      this.handleTunnellingAck(msg);
    }
  }

  handleTunnellingAck(msg) {
    const status = msg.readUInt8(7);
    if (status !== 0) {
      this.emit("warning", `KNX tunnelling status: 0x${status.toString(16)}`);
    }
    this.emit("ack", msg.readUInt8(6));
  }

  async writeGroupValue(groupAddr, value) {
    if (!this.isReady()) {
      const ready = await tryConnectWithRetry(this, 3);
      if (!ready) throw new Error("KNX client not ready");
    }
    const seq = this.sequence++ % 256;
    const frame = buildTunnellingRequest(this.channelId, seq, groupAddr, value);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`KNX write timeout for ${groupAddr}`)),
        this.connectTimeoutMs
      );
      const onAck = (s) => {
        if (s === seq) {
          clearTimeout(timer);
          this.off("ack", onAck);
          resolve({ groupAddr, value, writtenAt: new Date().toISOString() });
        }
      };
      this.on("ack", onAck);
      try {
        this.socket?.send(frame, this.port, this.host);
      } catch (err) {
        clearTimeout(timer);
        this.off("ack", onAck);
        reject(err);
      }
    });
  }

  setOutput(id, level, fadeSeconds = 0) {
    const lvl = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    const knxValue = Math.round((lvl / 100) * 255);
    const groupAddr = id.replace(/_/g, "/");
    return this.writeGroupValue(groupAddr, knxValue).then(() => {
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
    await this.writeGroupValue("0/0/0", 0);
  }

  dispose() {
    this.disposed = true;
    if (this.channelId != null) {
      try {
        const disc = buildDisconnectRequest(this.channelId);
        this.socket?.send(disc, this.port, this.host);
      } catch {
        /* ignore */
      }
    }
    this.cleanup();
    this.state = "disconnected";
  }

  cleanup() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
  }
}

function buildConnectionRequest() {
  const buf = Buffer.alloc(26);
  let off = 0;
  buf.writeUInt8(6, off++); off += 3;
  buf.writeUInt16BE(0x0205, off); off += 2;
  buf.writeUInt8(4, off++); off += 1;
  buf.writeUInt8(0x02, off++); off += 1;
  buf.writeUInt8(0, off++); off += 1;
  buf.writeUInt8(0x4b, off++); off += 1; off += 2;
  buf.writeUInt16BE(0x08, off); off += 2; off += 2;
  buf.writeUInt16BE(0x0801, off); off += 2; off += 2;
  buf.writeUInt32BE(0, off); off += 4;
  buf.writeUInt16BE(0x4b00, off); off += 2;
  return buf;
}

function buildTunnellingRequest(channelId, seq, groupAddr, value) {
  const parts = String(groupAddr).split("/");
  const main = parseInt(parts[0], 10) || 0;
  const middle = parseInt(parts[1], 10) || 0;
  const sub = parseInt(parts[2], 10) || 0;

  const addr = (main << 11) | (middle << 8) | sub;
  const buf = Buffer.alloc(22);
  let off = 0;
  buf.writeUInt8(6, off++); off += 3;
  buf.writeUInt16BE(0x0420, off); off += 2;
  buf.writeUInt8(4, off++); off += 1;
  buf.writeUInt8(channelId, off++);
  buf.writeUInt8(seq, off++);
  buf.writeUInt8(0, off++); off += 1;
  buf.writeUInt8(0x29, off++);
  buf.writeUInt8(0x00, off++);
  buf.writeUInt16BE(addr, off); off += 2;
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(0x80, off++);
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(value, off++);
  return buf;
}

function buildDisconnectRequest(channelId) {
  const buf = Buffer.alloc(16);
  let off = 0;
  buf.writeUInt8(6, off++); off += 3;
  buf.writeUInt16BE(0x0209, off); off += 2;
  buf.writeUInt8(4, off++); off += 1;
  buf.writeUInt8(channelId, off++);
  buf.writeUInt8(0, off++); off += 4;
  buf.writeUInt8(0x4b, off++); off += 1;
  buf.writeUInt16BE(0x0801, off); off += 2;
  return buf;
}

async function tryConnectWithRetry(client, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.connect();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

export function getKnxClient(conn) {
  if (!conn?.host) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
  activeClient = new KnxTunnellingClient({ host: conn.host, port: conn.port });
  return activeClient;
}

export function closeKnxClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
}

function probeTcpOrUdpPort(host, port, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      try { sock.close(); } catch { /* */ }
      resolve(open);
    };
    sock.on("error", () => finish(false));
    sock.on("message", () => finish(true));
    sock.bind(0, () => {
      const probe = Buffer.alloc(6);
      probe.writeUInt8(6, 0);
      probe.writeUInt16BE(0x0201, 2);
      sock.send(probe, port, host, (err) => {
        if (err) finish(false);
        else setTimeout(() => finish(false), timeoutMs);
      });
    });
  });
}

export async function probeKnxPorts(host) {
  if (!host) return [];
  return [
    { port: 3671, label: "KNX IP", role: "knx-ip", open: await probeTcpOrUdpPort(host, 3671) },
  ];
}

export function recommendationFromPorts(ports, protocol) {
  const knx = ports.find((p) => p.role === "knx-ip")?.open;
  if (protocol === "knx-ip" && !knx) {
    return "KNX IP port 3671 is not responding. Verify the KNX IP gateway is powered and connected to the network, and that your subnet allows UDP multicast (224.0.23.12).";
  }
  return null;
}
