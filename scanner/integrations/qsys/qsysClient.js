import net from "net";

let requestId = 0;

function nextId() {
  requestId += 1;
  return requestId;
}

function buildRequest(method, params = {}) {
  return (
    JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method,
      params,
    }) + "\0"
  );
}

export class QsysClient {
  constructor({ host, port = 1710, username, password } = {}) {
    this.host = host;
    this.port = port;
    this.username = username || "";
    this.password = password || "";
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.buffer = "";
    this.pending = new Map();
    this.keepAliveTimer = null;
    this.onEvent = null;
  }

  setEventHandler(handler) {
    this.onEvent = handler;
  }

  async connect() {
    if (this.connected) return;
    return new Promise((resolve, reject) => {
      try {
        this.socket = new net.Socket();
        this.socket.setNoDelay(true);
        this.socket.on("data", (data) => this._onData(data));
        this.socket.on("close", () => this._onClose());
        this.socket.on("error", (err) => {
          this._onError(err);
          reject(err);
        });

        this.socket.connect(this.port, this.host, async () => {
          this.connected = true;
          try {
            if (this.username) {
              await this._authenticate();
            }
            this._startKeepAlive();
            resolve();
          } catch (authErr) {
            reject(authErr);
          }
        });

        setTimeout(() => {
          if (!this.connected) {
            reject(
              new Error(
                `Connection to ${this.host}:${this.port} timed out`
              )
            );
          }
        }, 10000);
      } catch (err) {
        reject(err);
      }
    });
  }

  async _authenticate() {
    const result = await this.send("Logon", {
      User: this.username,
      Password: this.password,
    });
    if (result?.error) {
      throw new Error(
        `QRC authentication failed: ${
          result.error.message || JSON.stringify(result.error)
        }`
      );
    }
    this.authenticated = true;
  }

  async send(method, params = {}) {
    const request = buildRequest(method, params);
    const parsed = JSON.parse(request.slice(0, -1));
    const id = parsed.id;

    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error("Not connected"));
        return;
      }

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`QRC request ${method} timed out`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timeout, method });

      try {
        this.socket.write(request);
      } catch (err) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  _onData(data) {
    this.buffer += data.toString("utf8");

    while (this.buffer.includes("\0")) {
      const nullIndex = this.buffer.indexOf("\0");
      const message = this.buffer.slice(0, nullIndex);
      this.buffer = this.buffer.slice(nullIndex + 1);

      try {
        this._handleMessage(JSON.parse(message));
      } catch (err) {
        console.warn(
          "[qsysClient] failed to parse message:",
          message,
          err
        );
      }
    }
  }

  _handleMessage(msg) {
    if (msg.method === "EngineStatus") {
      this.onEvent?.({ type: "EngineStatus", ...msg.params });
      return;
    }
    if (msg.method === "LoopPlayer.Error") {
      this.onEvent?.({ type: "LoopPlayer.Error", ...msg.params });
      return;
    }
    if (msg.id != null) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(
            new Error(
              msg.error.message || JSON.stringify(msg.error)
            )
          );
        } else {
          pending.resolve(msg.result || msg.params);
        }
      }
    }
  }

  _onClose() {
    this.connected = false;
    this.authenticated = false;
    this._stopKeepAlive();
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pending.clear();
    this.onEvent?.({ type: "Disconnected" });
  }

  _onError(err) {
    console.warn("[qsysClient] socket error:", err.message);
    this.onEvent?.({ type: "Error", message: err.message });
  }

  _startKeepAlive() {
    this._stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.connected) {
        this.send("NoOp", {}).catch(() => {});
      }
    }, 45000);
  }

  _stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  async disconnect() {
    this._stopKeepAlive();
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
    this.buffer = "";
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Client disconnected"));
    }
    this.pending.clear();
  }
}

export async function probeQsysPorts(host, timeoutMs = 3000) {
  const results = [];
  const ports = [
    { port: 1710, label: "QRC (JSON-RPC)", role: "control" },
    { port: 1702, label: "ECP (Legacy)", role: "control-legacy" },
    { port: 443, label: "Management API", role: "management" },
    { port: 80, label: "Management API (HTTP)", role: "management" },
  ];

  for (const { port, label, role } of ports) {
    try {
      await new Promise((resolve, reject) => {
        const s = new net.Socket();
        s.setTimeout(timeoutMs);
        s.on("connect", () => {
          s.destroy();
          resolve();
        });
        s.on("error", () => {
          s.destroy();
          reject();
        });
        s.on("timeout", () => {
          s.destroy();
          reject();
        });
        s.connect(port, host);
      });
      results.push({ port, label, role, open: true });
    } catch {
      results.push({ port, label, role, open: false });
    }
  }

  return results;
}

export function recommendationFromPorts(ports) {
  const qrc = ports.find((p) => p.port === 1710 && p.open);
  if (qrc) return "qrc";
  const ecp = ports.find((p) => p.port === 1702 && p.open);
  if (ecp) return "ecp-legacy";
  return null;
}
