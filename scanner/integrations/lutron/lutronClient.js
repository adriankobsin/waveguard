/**
 * Live Lutron HomeWorks QSX / RadioRA 3 integration client.
 *
 * Opens a persistent Telnet socket to the processor on port 23, authenticates
 * with the integration username/password configured in Lutron Designer, and
 * exposes a small command queue for the rest of the platform:
 *
 *   - `setOutput(id, level, fadeSeconds)`  → `#OUTPUT,<id>,1,<level>,<fade>`
 *   - `getOutput(id)`                      → `?OUTPUT,<id>,1`
 *   - `pressButton(deviceId, componentId)` → `#DEVICE,<dev>,<comp>,3` + ,4
 *   - `activateAreaScene(areaId, scene)`   → `#AREA,<area>,6,<scene>`
 *
 * Integration IDs are the numeric IDs embedded in the LEAP hrefs that the
 * Lutron Integration Report uses (`/zone/<id>` → output integration id, etc.),
 * so the parser's `id` field can be passed straight through.
 *
 * The client maintains a singleton keyed by `host:port:username` so the rest
 * of the server can ask for a client without managing connections itself. It
 * subscribes to `#MONITORING,2,1` (zone output) so every change made anywhere
 * (wall keypad, time clock, app) is reflected in `lastLevels` for polling.
 *
 * NOTE: LEAP / Athena (TLS on 8081 with certificate pairing) is not handled
 * here — the platform falls back to a clear error so the operator can switch
 * to Telnet or pair certificates externally.
 */

import net from "node:net";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 23;
const DEFAULT_TIMEOUT_MS = 6000;
const RECONNECT_DELAY_MS = 5000;
const PROMPT_GRACE_MS = 250;

const LOGIN_PROMPT_RE = /login:\s*$/i;
const PASSWORD_PROMPT_RE = /password:\s*$/i;
const READY_PROMPT_RE = /(?:^|[\r\n])\s*(?:GNET|QNET|HOMEWORKS|HWQS|RNET)>\s*$/i;
const ERROR_LINE_RE = /^~ERROR,(\d+)/;
const OUTPUT_RESPONSE_RE = /^~OUTPUT,(\d+),1,([-\d.]+)/;

let activeClient = null;

class LutronTelnetClient extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || DEFAULT_PORT;
    this.username = opts.username;
    this.password = opts.password;
    this.connectTimeoutMs = opts.connectTimeoutMs || DEFAULT_TIMEOUT_MS;
    this.socket = null;
    this.buffer = "";
    this.state = "disconnected"; // disconnected | connecting | auth-user | auth-pass | ready
    this.pending = null;
    this.queue = [];
    this.reconnectTimer = null;
    this.lastError = null;
    this.lastLevels = new Map(); // integrationId → { level, on, updatedAt }
    this.disposed = false;
  }

  get key() {
    return `${this.host}:${this.port}:${this.username}`;
  }

  isReady() {
    return this.state === "ready" && !!this.socket;
  }

  /** Connect, authenticate and resolve when the processor is ready for commands. */
  async connect() {
    if (this.disposed) throw new Error("Lutron client has been disposed");
    if (this.state === "ready") return;
    if (this.state !== "disconnected") {
      await new Promise((resolve, reject) => {
        const onReady = () => {
          this.off("error", onErr);
          resolve();
        };
        const onErr = (err) => {
          this.off("ready", onReady);
          reject(err);
        };
        this.once("ready", onReady);
        this.once("error", onErr);
      });
      return;
    }

    this.state = "connecting";
    this.buffer = "";
    this.lastError = null;

    await new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        this.lastError = err.message;
        this.state = "disconnected";
        try {
          this.socket?.destroy();
        } catch {
          /* ignore */
        }
        this.socket = null;
        this.emit("error", err);
        reject(err);
      };

      const sock = net.createConnection({
        host: this.host,
        port: this.port,
      });
      this.socket = sock;

      const connectTimer = setTimeout(() => {
        fail(new Error(`Timed out connecting to Lutron processor at ${this.host}:${this.port}`));
      }, this.connectTimeoutMs);

      sock.setNoDelay(true);
      sock.once("connect", () => {
        clearTimeout(connectTimer);
      });
      sock.on("error", (err) => fail(err));
      sock.on("close", () => {
        clearTimeout(connectTimer);
        const wasReady = this.state === "ready";
        this.state = "disconnected";
        this.socket = null;
        if (this.pending) {
          const p = this.pending;
          this.pending = null;
          clearTimeout(p.timer);
          p.reject(new Error("Lutron connection closed"));
        }
        if (wasReady) this.scheduleReconnect();
        if (!settled) fail(new Error("Lutron processor closed the connection"));
      });
      sock.on("data", (chunk) => this.handleData(chunk));

      const onReady = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        resolve();
      };
      this.once("ready", onReady);
      this.once("error", () => clearTimeout(connectTimer));
    });

    await this.subscribeMonitoring();
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.disposed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect()
        .then(() => this.emit("reconnected"))
        .catch(() => this.scheduleReconnect());
    }, RECONNECT_DELAY_MS);
  }

  handleData(chunk) {
    this.buffer += chunk.toString("utf8");

    // Strip Telnet IAC negotiation bytes (0xFF ...) the processor may send.
    this.buffer = stripTelnetIac(this.buffer);

    // Login phase — prompts arrive without trailing newlines.
    if (this.state === "connecting") {
      if (LOGIN_PROMPT_RE.test(this.buffer)) {
        this.buffer = "";
        this.state = "auth-user";
        try {
          this.socket?.write(`${this.username}\r\n`);
        } catch (err) {
          this.emit("error", err);
        }
        return;
      }
    }
    if (this.state === "auth-user") {
      if (PASSWORD_PROMPT_RE.test(this.buffer)) {
        this.buffer = "";
        this.state = "auth-pass";
        try {
          this.socket?.write(`${this.password}\r\n`);
        } catch (err) {
          this.emit("error", err);
        }
        return;
      }
    }

    // Process complete lines for monitoring updates.
    let nl;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, "").trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line) this.handleLine(line);
    }

    // Detect ready prompt at tail (no newline after it).
    if (READY_PROMPT_RE.test(this.buffer) || /[GQH][NWQ]?[QW]?S?T?>\s*$/.test(this.buffer)) {
      if (this.state === "auth-pass" || this.state === "auth-user") {
        this.state = "ready";
        this.emit("ready");
      }
      // Resolve pending command on ready prompt after a short grace period so
      // monitoring responses queued ahead of the prompt are captured.
      if (this.pending) {
        const p = this.pending;
        if (!p.promptTimer) {
          p.promptTimer = setTimeout(() => {
            if (this.pending !== p) return;
            this.pending = null;
            clearTimeout(p.timer);
            p.resolve(p.responseLines);
            this.processQueue();
          }, PROMPT_GRACE_MS);
        }
      }
      // Trim any consumed prompt fragments to avoid re-matching.
      this.buffer = this.buffer.replace(/(?:GNET|QNET|HOMEWORKS|HWQS|RNET)>\s*$/i, "");
    }
  }

  handleLine(line) {
    if (/login\s+incorrect|authentication\s+failed|access\s+denied|bad\s+login/i.test(line)) {
      const err = new Error(
        "Lutron processor rejected the integration credentials. " +
          "Check the username/password in Lutron Designer › Integration."
      );
      this.lastError = err.message;
      try {
        this.socket?.destroy();
      } catch {
        /* ignore */
      }
      this.emit("error", err);
      return;
    }

    if (this.pending) this.pending.responseLines.push(line);

    const errMatch = ERROR_LINE_RE.exec(line);
    if (errMatch && this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      clearTimeout(p.promptTimer);
      p.reject(new Error(`Lutron processor returned error code ${errMatch[1]}`));
      this.processQueue();
      return;
    }

    const outMatch = OUTPUT_RESPONSE_RE.exec(line);
    if (outMatch) {
      const id = outMatch[1];
      const level = Number(outMatch[2]);
      const updatedAt = new Date().toISOString();
      this.lastLevels.set(id, { id, level, on: level > 0, updatedAt });
      this.emit("output", { id, level, updatedAt });
    }
  }

  sendCommand(cmd, { timeoutMs = DEFAULT_TIMEOUT_MS, expectResponse = false } = {}) {
    if (this.disposed) {
      return Promise.reject(new Error("Lutron client has been disposed"));
    }
    return new Promise((resolve, reject) => {
      const entry = {
        cmd,
        timeoutMs,
        expectResponse,
        resolve,
        reject,
        responseLines: [],
        timer: null,
        promptTimer: null,
      };
      this.queue.push(entry);
      this.processQueue();
    });
  }

  processQueue() {
    if (this.pending || !this.queue.length) return;
    if (this.state !== "ready") {
      // The connection will be re-established by `connect()` calls or the
      // reconnect timer; pending entries wait here. Time them out via their
      // own timer below.
      const entry = this.queue[0];
      if (!entry.timer) {
        entry.timer = setTimeout(() => {
          this.queue = this.queue.filter((e) => e !== entry);
          entry.reject(new Error(`Lutron command timed out (not connected): ${entry.cmd}`));
        }, entry.timeoutMs);
      }
      return;
    }
    const entry = this.queue.shift();
    this.pending = entry;
    entry.timer = setTimeout(() => {
      if (this.pending !== entry) return;
      this.pending = null;
      clearTimeout(entry.promptTimer);
      entry.reject(new Error(`Lutron command timed out: ${entry.cmd}`));
      this.processQueue();
    }, entry.timeoutMs);
    try {
      this.socket.write(`${entry.cmd}\r\n`);
    } catch (err) {
      this.pending = null;
      clearTimeout(entry.timer);
      entry.reject(err);
      this.processQueue();
    }
  }

  async subscribeMonitoring() {
    if (!this.isReady()) return;
    try {
      // 2 = zone monitoring (output level changes). Enable so the processor
      // pushes ~OUTPUT events for any local change.
      await this.sendCommand("#MONITORING,2,1", { timeoutMs: 3000 });
    } catch (err) {
      // Monitoring subscription is non-fatal; commands will still work.
      this.emit("warning", err.message);
    }
  }

  setOutput(id, level, fadeSeconds = 0) {
    const lvl = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    const fade = formatFade(fadeSeconds);
    return this.sendCommand(`#OUTPUT,${id},1,${lvl},${fade}`).then(() => {
      const updatedAt = new Date().toISOString();
      const next = { id: String(id), level: lvl, on: lvl > 0, updatedAt };
      this.lastLevels.set(String(id), next);
      return next;
    });
  }

  raiseLower(id, action) {
    // 2 = raise start, 3 = lower start, 4 = stop (HomeWorks QSX output actions).
    const code = action === "raise" ? 2 : action === "lower" ? 3 : 4;
    return this.sendCommand(`#OUTPUT,${id},${code}`);
  }

  async getOutput(id) {
    await this.sendCommand(`?OUTPUT,${id},1`, { expectResponse: true, timeoutMs: 3000 });
    return this.lastLevels.get(String(id)) || { id: String(id), level: 0, on: false };
  }

  async pressButton(deviceId, componentId) {
    await this.sendCommand(`#DEVICE,${deviceId},${componentId},3`);
    await this.sendCommand(`#DEVICE,${deviceId},${componentId},4`);
    return { deviceId, componentId, pressedAt: new Date().toISOString() };
  }

  /** Activate an area scene. `sceneNumber` is the 0-16 number Lutron uses;
   *  pass 0 for the dedicated Off Scene. */
  activateAreaScene(areaId, sceneNumber) {
    const n = Math.max(0, Math.min(16, Math.round(Number(sceneNumber) || 0)));
    return this.sendCommand(`#AREA,${areaId},6,${n}`);
  }

  async pollOutputs(ids) {
    const list = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    const results = [];
    for (const id of list) {
      try {
        const out = await this.getOutput(id);
        results.push(out);
      } catch (err) {
        results.push({ id, level: 0, on: false, error: err.message });
      }
    }
    return results;
  }

  async ping() {
    // Lightweight probe: ask the processor for its system date. Confirms the
    // connection is alive and that integration access is enabled.
    return this.sendCommand("?SYSTEM,1", { expectResponse: true, timeoutMs: 3000 });
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    for (const entry of this.queue) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Lutron client disposed"));
    }
    this.queue = [];
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      clearTimeout(p.promptTimer);
      p.reject(new Error("Lutron client disposed"));
    }
    if (this.socket) {
      try {
        this.socket.write("LOGOUT\r\n");
      } catch {
        /* ignore */
      }
      try {
        this.socket.destroy();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.state = "disconnected";
  }
}

function formatFade(fadeSeconds) {
  const s = Math.max(0, Math.round(Number(fadeSeconds) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function stripTelnetIac(buf) {
  // Telnet IAC negotiation: 0xFF followed by 2 bytes (or longer for sub-negotiation).
  // We strip simple 3-byte sequences and any DO/DONT/WILL/WONT responses we'd otherwise mis-render.
  if (!buf.includes("\xff")) return buf;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    if (buf.charCodeAt(i) === 0xff) {
      i += 2; // skip command + option
      continue;
    }
    out += buf[i];
  }
  return out;
}

/**
 * Get (or replace) the singleton client for the provided connection. Passing
 * a different host/port/username disposes the previous client so we never
 * pile up sockets when the operator edits the credentials.
 */
export function getLutronClient(conn) {
  if (!conn?.host || !conn?.username) return null;
  const key = `${conn.host}:${conn.port || DEFAULT_PORT}:${conn.username}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    // Keep password in sync (Designer may rotate it).
    activeClient.password = conn.password;
    return activeClient;
  }
  if (activeClient) {
    try {
      activeClient.dispose();
    } catch {
      /* ignore */
    }
    activeClient = null;
  }
  activeClient = new LutronTelnetClient({
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password,
  });
  return activeClient;
}

export function closeLutronClient() {
  if (activeClient) {
    try {
      activeClient.dispose();
    } catch {
      /* ignore */
    }
    activeClient = null;
  }
}

/** Extract the numeric integration ID from a LEAP href like `/zone/5384`. */
export function integrationIdFromHref(href) {
  if (!href) return null;
  const m = /\/(?:zone|area|areascene|device|button|led)\/(\d+)/.exec(String(href));
  return m ? m[1] : String(href).split("/").filter(Boolean).pop() || null;
}

/** Open a TCP socket and resolve to true once it connects (or false on timeout/error). */
function probeTcpPort(host, port, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
      resolve(open);
    };
    sock.setNoDelay(true);
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => finish(true));
    sock.on("timeout", () => finish(false));
    sock.on("error", () => finish(false));
  });
}

/**
 * Probe the standard Lutron processor integration ports so the UI can tell
 * the operator exactly which interface is reachable on their processor.
 * This is the only reliable way to disambiguate a HomeWorks QSX that hasn't
 * had Telnet enabled in Designer from a HomeWorks Athena (LEAP-only).
 */
export async function probeLutronPorts(host) {
  if (!host) return [];
  const candidates = [
    { port: 23, label: "Telnet", role: "telnet" },
    { port: 8081, label: "LEAP", role: "leap" },
    { port: 8083, label: "LEAP HTTPS (pairing)", role: "leap-pair" },
    { port: 2147, label: "Legacy Telnet", role: "telnet-legacy" },
    { port: 443, label: "Web admin", role: "web" },
  ];
  return Promise.all(
    candidates.map(async (c) => ({ ...c, open: await probeTcpPort(host, c.port) }))
  );
}

/**
 * Build a recommendation string for the operator based on the port scan
 * result. The mock-server hands this back in the test response so the modal
 * can render it next to the failure chip.
 */
export function recommendationFromPorts(ports, protocol) {
  const byRole = (role) => ports.find((p) => p.role === role);
  const telnet = byRole("telnet")?.open;
  const leap = byRole("leap")?.open;
  if (protocol === "telnet" && !telnet && leap) {
    return (
      "Telnet (port 23) is closed on this processor but LEAP (port 8081) is " +
      "open. In Lutron Designer open Settings › Integration and tick " +
      '"Enable Telnet Integration", then transfer the program to the ' +
      "processor. (HomeWorks Athena no longer supports Telnet — use the LEAP " +
      "protocol via the Connect app to pair Wave Guard.)"
    );
  }
  if (protocol === "telnet" && !telnet && !leap) {
    return (
      "Neither Telnet (23) nor LEAP (8081) is open. The processor is reachable " +
      "by ping but integration access is fully disabled. Open Lutron Designer " +
      "→ Settings → Integration and enable Telnet (or LEAP), then transfer."
    );
  }
  if (protocol === "leap" && !leap) {
    return "LEAP (port 8081) is closed — verify the processor's integration settings.";
  }
  return null;
}
