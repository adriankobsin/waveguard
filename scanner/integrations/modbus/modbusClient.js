import net from "node:net";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 502;
const CONNECT_TIMEOUT_MS = 5000;
const RESPONSE_TIMEOUT_MS = 3000;
const RETRIES = 2;

const FC_READ_HOLDING_REGISTERS = 0x03;
const FC_WRITE_SINGLE_REGISTER = 0x06;
const FC_WRITE_MULTIPLE_REGISTERS = 0x10;
const FC_READ_COILS = 0x01;
const FC_WRITE_SINGLE_COIL = 0x05;
const FC_WRITE_MULTIPLE_COILS = 0x0f;
const FC_READ_INPUT_REGISTERS = 0x04;
const FC_READ_DISCRETE_INPUTS = 0x02;

const EXCEPTIONS = {
  0x01: "Illegal Function",
  0x02: "Illegal Data Address",
  0x03: "Illegal Data Value",
  0x04: "Slave Device Failure",
  0x05: "Acknowledge",
  0x06: "Slave Device Busy",
  0x08: "Memory Parity Error",
  0x0a: "Gateway Path Unavailable",
  0x0b: "Gateway Target Device Failed to Respond",
};

let activeClient = null;

class ModbusTcpClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.unitId = opts.unitId || 1;
    this.socket = null;
    this.state = "disconnected";
    this.disposed = false;
    this.transactionId = 0;
    this.pending = new Map();
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
    if (this.disposed) throw new Error("Modbus client disposed");
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
        fail(new Error(`Modbus connection timed out at ${this.host}:${this.port}`));
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

    while (this.buffer.length >= 8) {
      const pduLen = this.buffer.readUInt16BE(4);
      const frameLen = 6 + 2 + pduLen;

      if (this.buffer.length < frameLen) break;

      const frame = this.buffer.subarray(0, frameLen);
      this.buffer = this.buffer.subarray(frameLen);

      const transId = frame.readUInt16BE(0);
      const unitId = frame.readUInt8(6);
      const funcCode = frame.readUInt8(7);
      const isError = (funcCode & 0x80) !== 0;

      const pending = this.pending.get(transId);
      if (!pending) continue;

      clearTimeout(pending.timer);
      this.pending.delete(transId);

      if (isError) {
        const excCode = frame.readUInt8(8);
        const excMsg = EXCEPTIONS[excCode] || `Unknown exception 0x${excCode.toString(16)}`;
        pending.reject(new Error(`Modbus exception: ${excMsg} (function 0x${(funcCode & 0x7f).toString(16)})`));
      } else {
        pending.resolve({ unitId, funcCode, data: frame.subarray(8) });
      }
    }
  }

  sendRequest(funcCode, data) {
    if (!this.isReady()) {
      return Promise.reject(new Error("Modbus client not ready"));
    }

    const transId = ++this.transactionId % 65536;
    const bodyLen = 1 + 1 + data.length;
    const frame = Buffer.alloc(8 + bodyLen);

    let off = 0;
    frame.writeUInt16BE(transId, off); off += 2;
    frame.writeUInt16BE(0, off); off += 2;
    frame.writeUInt16BE(bodyLen, off); off += 2;
    frame.writeUInt8(this.unitId, off); off += 1;
    frame.writeUInt8(funcCode, off); off += 1;
    data.copy(frame, off);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(transId);
        reject(new Error(`Modbus response timeout (transId=${transId}, func=0x${funcCode.toString(16)})`));
      }, this.responseTimeoutMs);

      this.pending.set(transId, { resolve, reject, timer });
      try {
        this.socket?.write(frame);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(transId);
        reject(err);
      }
    });
  }

  async readHoldingRegisters(address, count = 1) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(count, 2);
    const resp = await this.sendRequest(FC_READ_HOLDING_REGISTERS, data);
    const registers = [];
    for (let i = 0; i < resp.data.length - 1; i += 2) {
      registers.push(resp.data.readUInt16BE(i + 1));
    }
    return registers;
  }

  async readInputRegisters(address, count = 1) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(count, 2);
    const resp = await this.sendRequest(FC_READ_INPUT_REGISTERS, data);
    const registers = [];
    for (let i = 0; i < resp.data.length - 1; i += 2) {
      registers.push(resp.data.readUInt16BE(i + 1));
    }
    return registers;
  }

  async readCoils(address, count = 1) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(count, 2);
    const resp = await this.sendRequest(FC_READ_COILS, data);
    const values = [];
    for (let i = 0; i < count; i++) {
      const byteIdx = 1 + Math.floor(i / 8);
      const bitIdx = i % 8;
      values.push(((resp.data[byteIdx] >> bitIdx) & 1) === 1);
    }
    return values;
  }

  async readDiscreteInputs(address, count = 1) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(count, 2);
    const resp = await this.sendRequest(FC_READ_DISCRETE_INPUTS, data);
    const values = [];
    for (let i = 0; i < count; i++) {
      const byteIdx = 1 + Math.floor(i / 8);
      const bitIdx = i % 8;
      values.push(((resp.data[byteIdx] >> bitIdx) & 1) === 1);
    }
    return values;
  }

  async writeSingleRegister(address, value) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(value, 2);
    await this.sendRequest(FC_WRITE_SINGLE_REGISTER, data);
    return { address, value };
  }

  async writeMultipleRegisters(address, values) {
    const count = values.length;
    const byteCount = count * 2;
    const data = Buffer.alloc(6 + byteCount);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(count, 2);
    data.writeUInt8(byteCount, 4);
    for (let i = 0; i < count; i++) {
      data.writeUInt16BE(values[i], 6 + i * 2);
    }
    await this.sendRequest(FC_WRITE_MULTIPLE_REGISTERS, data);
    return { address, values };
  }

  async writeSingleCoil(address, value) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(value ? 0xff00 : 0x0000, 2);
    await this.sendRequest(FC_WRITE_SINGLE_COIL, data);
    return { address, on: !!value };
  }

  async writeMultipleCoils(address, values) {
    const count = values.length;
    const byteCount = Math.ceil(count / 8);
    const data = Buffer.alloc(5 + byteCount);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(count, 2);
    data.writeUInt8(byteCount, 4);
    let byteVal = 0;
    for (let i = 0; i < count; i++) {
      if (values[i]) byteVal |= (1 << (i % 8));
      if ((i % 8) === 7 || i === count - 1) {
        data.writeUInt8(byteVal, 5 + Math.floor(i / 8));
        byteVal = 0;
      }
    }
    await this.sendRequest(FC_WRITE_MULTIPLE_COILS, data);
    return { address, values };
  }

  async setHvacSetpoint(register, temperatureC) {
    const scaled = Math.round(temperatureC * 10);
    return this.writeSingleRegister(register, scaled);
  }

  async getHvacSetpoint(register) {
    const vals = await this.readHoldingRegisters(register, 1);
    if (!vals.length) return null;
    return vals[0] / 10;
  }

  async setHvacMode(register, mode) {
    const modeMap = { off: 0, heat: 1, cool: 2, auto: 3, fanOnly: 4, emergency: 5 };
    return this.writeSingleRegister(register, modeMap[mode] || 0);
  }

  async getHvacMode(register) {
    const modeMap = ["off", "heat", "cool", "auto", "fanOnly", "emergency"];
    const vals = await this.readHoldingRegisters(register, 1);
    if (!vals.length) return null;
    return modeMap[vals[0]] || "unknown";
  }

  async getHvacTemperature(inputRegister) {
    const vals = await this.readInputRegisters(inputRegister, 1);
    if (!vals.length) return null;
    return vals[0] / 10;
  }

  async ping() {
    await this.readHoldingRegisters(0, 1);
  }

  setOutput(id, level, fadeSeconds = 0) {
    if (String(id).startsWith("coil:")) {
      const coilAddr = parseInt(id.replace("coil:", ""), 10);
      return this.writeSingleCoil(coilAddr, level > 0).then(() => ({
        id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(),
      }));
    }
    if (String(id).startsWith("hvac_temp:")) {
      const reg = parseInt(id.replace("hvac_temp:", ""), 10);
      return this.setHvacSetpoint(reg, level).then(() => ({
        id: String(id), level, on: level > 0, updatedAt: new Date().toISOString(),
      }));
    }
    const regAddr = parseInt(String(id).replace(/\D/g, "") || "0", 10);
    const scaled = Math.round((Math.max(0, Math.min(100, Number(level) || 0)) / 100) * 65535);
    return this.writeSingleRegister(regAddr, scaled).then(() => ({
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
    for (const [transId, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("Modbus client disposed"));
    }
    this.pending.clear();
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

export function getModbusClient(conn) {
  if (!conn?.host) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
  activeClient = new ModbusTcpClient({ host: conn.host, port: conn.port, unitId: conn.unitId || 1 });
  return activeClient;
}

export function closeModbusClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { }
    activeClient = null;
  }
}

export async function probeModbusPorts(host) {
  if (!host) return [];
  const sock = new net.Socket();
  return new Promise((resolve) => {
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { }
      resolve([{ port: 502, label: "Modbus TCP", role: "modbus-tcp", open }]);
    };
    sock.setTimeout(2000);
    sock.on("connect", () => {
      const mbap = Buffer.alloc(12);
      mbap.writeUInt16BE(1, 0);
      mbap.writeUInt16BE(0, 2);
      mbap.writeUInt16BE(2, 4);
      mbap.writeUInt8(1, 6);
      mbap.writeUInt8(0x03, 7);
      mbap.writeUInt16BE(0, 8);
      mbap.writeUInt16BE(1, 10);
      sock.write(mbap);
      const timer = setTimeout(() => finish(true), 1000);
      sock.once("data", () => { clearTimeout(timer); finish(true); });
    });
    sock.on("error", () => finish(false));
    sock.on("timeout", () => finish(false));
    try { sock.connect(502, host); } catch { finish(false); }
  });
}

export function recommendationFromPorts(ports, protocol) {
  const mb = ports.find((p) => p.role === "modbus-tcp")?.open;
  if (protocol === "modbus-tcp" && !mb) {
    return "Modbus TCP port 502 is not responding. Verify the Modbus gateway/controller is powered and reachable, and that your firewall allows TCP 502.";
  }
  return null;
}
