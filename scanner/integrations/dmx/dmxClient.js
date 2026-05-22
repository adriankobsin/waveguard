import dgram from "node:dgram";
import { EventEmitter } from "node:events";

const ARTNET_PORT = 6454;
const SACN_PORT = 5568;
const DEFAULT_UNIVERSE = 0;
const CONNECT_TIMEOUT_MS = 3000;

let activeClient = null;

class DmxArtNetClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || ARTNET_PORT;
    this.protocol = (opts.protocol || "art-net").toLowerCase();
    this.universe = Number(opts.universe) || DEFAULT_UNIVERSE;
    this.socket = null;
    this.state = "disconnected";
    this.disposed = false;
    this.lastLevels = new Map();
    this.sequence = 0;
  }

  get key() {
    return `${this.host}:${this.port}:${this.protocol}:${this.universe}`;
  }

  isReady() {
    return this.state === "ready" && !!this.socket;
  }

  async connect() {
    if (this.disposed) throw new Error("DMX client disposed");
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

      sock.on("error", (err) => fail(err));

      sock.bind(0, () => {
        this.state = "ready";
        settled = true;
        this.emit("ready");
        resolve();
      });

      setTimeout(() => {
        if (!settled) fail(new Error("DMX client failed to bind UDP socket"));
      }, 2000);
    });
  }

  sendDmx(channels) {
    if (!this.isReady()) {
      this.connect().catch(() => {});
      return Promise.reject(new Error("DMX client not ready"));
    }

    const dmx = new Uint8Array(512);
    for (const [ch, val] of Object.entries(channels)) {
      const idx = Math.max(0, Math.min(511, Number(ch) - 1));
      dmx[idx] = Math.max(0, Math.min(255, Math.round(Number(val))));
    }

    try {
      if (this.protocol === "sacn") {
        const packet = buildSacnPacket(this.universe, this.sequence++, dmx);
        this.socket?.send(packet, SACN_PORT, this.host);
      } else {
        const packet = buildArtNetPacket(this.universe, this.sequence++, dmx);
        this.socket?.send(packet, ARTNET_PORT, this.host);
      }
      return Promise.resolve({ universe: this.universe, channels, sentAt: new Date().toISOString() });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  setOutput(id, level, fadeSeconds = 0) {
    const lvl = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    const dmxVal = Math.round((lvl / 100) * 255);
    const ch = String(id).replace(/\D/g, "") || "1";
    return this.sendDmx({ [ch]: dmxVal }).then(() => {
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
    await this.sendDmx({ 1: 0 });
  }

  dispose() {
    this.disposed = true;
    this.cleanup();
    this.state = "disconnected";
  }

  cleanup() {
    if (this.socket) {
      try { this.socket.close(); } catch { /* */ }
      this.socket = null;
    }
  }
}

function buildArtNetPacket(universe, sequence, dmx) {
  const net = 0;
  const subUni = universe & 0xff;
  const buf = Buffer.alloc(530);
  let off = 0;
  buf.write("Art-Net\0", off, 8, "ascii"); off += 8;
  buf.writeUInt16BE(0x5000, off); off += 2;
  buf.writeUInt16BE(14, off); off += 2;
  buf.writeUInt8(sequence, off++);
  buf.writeUInt8(0, off++);
  buf.writeUInt8(net, off++);
  buf.writeUInt8(subUni, off++);
  buf.writeUInt16BE(512, off); off += 2;
  buf.writeUInt8(0, off++);
  for (let i = 0; i < 512; i++) {
    buf.writeUInt8(dmx[i], off++);
  }
  return buf;
}

function buildSacnPacket(universe, sequence, dmx) {
  const cid = Buffer.alloc(16);
  const sourceName = "WaveGuard\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
  const buf = Buffer.alloc(638);
  let off = 0;
  buf.write("ASCP", off); off += 4;
  buf.writeUInt16BE(0x0014, off); off += 2;
  buf.writeUInt8(0x10, off++);
  buf.writeUInt8(0x02, off++);
  buf.writeUInt16BE(universe & 0xffff, off); off += 2;
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(0x00, off++);
  cid.copy(buf, off); off += 16;
  off += 2;
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(sequence, off++);
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(0x01, off++);
  buf.write(sourceName, off, 64, "ascii"); off += 64;
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(0x01, off++);
  buf.writeUInt16BE(universe & 0xffff, off); off += 2;
  buf.writeUInt16BE(0x0201, off); off += 2;
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(0xa1, off++);
  buf.writeUInt8(0x00, off++);
  buf.writeUInt8(0x00, off++);
  const props = Buffer.alloc(513);
  props.writeUInt8(0x00, 0);
  for (let i = 0; i < 512; i++) {
    props.writeUInt8(dmx[i], i + 1);
  }
  props.copy(buf, off); off += 513;
  return buf.slice(0, off);
}

export function getDmxClient(conn) {
  if (!conn?.host) return null;
  const universe = Number(conn.universe) || DEFAULT_UNIVERSE;
  const protocol = (conn.protocol || "art-net").toLowerCase();
  const port = protocol === "sacn" ? SACN_PORT : ARTNET_PORT;
  const key = `${conn.host}:${port}:${protocol}:${universe}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
  activeClient = new DmxArtNetClient({ host: conn.host, port, protocol, universe });
  return activeClient;
}

export function closeDmxClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
}

function probeUdpPort(host, port, timeoutMs = 1800) {
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
    sock.bind(0, () => {
      const probe = Buffer.alloc(2);
      sock.send(probe, port, host, (err) => {
        if (err) finish(false);
        else setTimeout(() => finish(false), timeoutMs);
      });
    });
  });
}

export async function probeDmxPorts(host) {
  if (!host) return [];
  return Promise.all([
    { port: 6454, label: "Art-Net", role: "art-net", open: await probeUdpPort(host, 6454) },
    { port: 5568, label: "sACN", role: "sacn", open: await probeUdpPort(host, 5568) },
  ]);
}

export function recommendationFromPorts(ports, protocol) {
  const artNet = ports.find((p) => p.role === "art-net")?.open;
  const sacn = ports.find((p) => p.role === "sacn")?.open;
  if (protocol === "art-net" && !artNet) {
    return "Art-Net port 6454 (UDP) is not responding. Ensure the DMX Art-Net node is powered and reachable, and that UDP traffic is not blocked.";
  }
  if (protocol === "sacn" && !sacn) {
    return "sACN port 5568 (UDP) is not responding. Verify the sACN source and multicast configuration.";
  }
  return null;
}
