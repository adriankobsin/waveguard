/**
 * Live integration connection probes used by Settings → Integrations and
 * POST /integrations/test on the mock-server.
 *
 * Each probe returns { ok, message, detail? }. Probes prefer real protocol
 * handshakes where cheap; otherwise they validate reachability on the
 * vendor's canonical port(s).
 */

import net from "node:net";
import { snmpProbe } from "../snmp.js";
import { probeCiscoPorts } from "./cisco/probeCiscoPorts.js";
import { getCiscoSwitchClient } from "./cisco/ciscoSwitchClient.js";

const DEFAULT_TIMEOUT_MS = 4000;

function parseHost(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    if (/^https?:\/\//i.test(s)) return new URL(s).hostname;
    if (s.includes(":")) return s.split(":")[0].trim();
  } catch {
    /* fall through */
  }
  return s;
}

function parsePort(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < 65536 ? Math.floor(n) : fallback;
}

function tcpProbe(host, port, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (open, error) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch {
        /* */
      }
      resolve({ open, error: error?.message || null });
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("error", (err) => finish(false, err));
    sock.once("timeout", () => finish(false, new Error("timeout")));
    try {
      sock.connect(port, host);
    } catch (err) {
      finish(false, err);
    }
  });
}

function tcpExchange(host, port, payload, { timeoutMs = DEFAULT_TIMEOUT_MS, expect = () => true } = {}) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let buf = "";
    let done = false;
    const finish = (err, result) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch {
        /* */
      }
      if (err) reject(err);
      else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error("timeout")), timeoutMs);
    sock.setTimeout(timeoutMs);
    sock.once("error", (err) => {
      clearTimeout(timer);
      finish(err);
    });
    sock.connect(port, host, () => {
      if (payload) sock.write(payload);
    });
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      if (expect(buf)) {
        clearTimeout(timer);
        finish(null, buf);
      }
    });
    sock.once("close", () => {
      if (!done && buf) {
        clearTimeout(timer);
        finish(null, buf);
      }
    });
  });
}

async function probeSnmp(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const community = config?.community || "public";
  const version = config?.version || "2c";
  const result = await snmpProbe(host, { community, version, timeoutMs: 3000 });
  if (!result) {
    const port161 = await tcpProbe(host, 161, 2000);
    return {
      ok: false,
      message: port161.open
        ? `SNMP port open on ${host} but snmpget failed — install Net-SNMP tools or check community string "${community}".`
        : `SNMP unreachable at ${host}:161`,
    };
  }
  return {
    ok: true,
    message: `SNMP OK — ${result.sysName || host}${result.model ? ` (${result.vendor || ""} ${result.model})`.trim() : ""}`,
    detail: result,
  };
}

async function probeCisco(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  if (!config?.password && !config?.sshPassword) {
    const ports = await probeCiscoPorts(host);
    const ssh = ports.find((p) => p.role === "ssh");
    if (!ssh?.open) {
      return { ok: false, message: `SSH (port 22) closed on ${host}. Enable SSH on the switch.` };
    }
    return {
      ok: true,
      message: `SSH port open on ${host}. Add SSH password and manage switches under Core Network → Cisco Switches.`,
    };
  }
  const client = getCiscoSwitchClient({
    host,
    sshPort: parsePort(config?.sshPort || config?.port, 22),
    sshUsername: config?.user || config?.sshUsername || "cisco",
    sshPassword: config?.password || config?.sshPassword,
    enablePassword: config?.enablePassword || "",
    allowMock: false,
  });
  const result = await client.testConnection();
  if (!result.success) {
    return { ok: false, message: result.message || result.error || "Cisco SSH test failed" };
  }
  const label = result.system?.hostname || result.system?.model || host;
  return {
    ok: true,
    message: result.message || `Connected to ${label}`,
    detail: result.system,
  };
}

async function probeCrestron(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const cip = await tcpProbe(host, 41794, 3000);
  const https = await tcpProbe(host, 443, 2000);
  if (cip.open) {
    return {
      ok: true,
      message: `Crestron CIP port 41794 open on ${host} (CP/NVX/control processors).`,
    };
  }
  if (https.open) {
    return {
      ok: true,
      message: `HTTPS open on ${host}. Device may be NVX or web-managed Crestron gear (CIP 41794 closed).`,
    };
  }
  return {
    ok: false,
    message: `Crestron CIP (41794) and HTTPS (443) closed on ${host}. Check IP and firewall.`,
  };
}

async function probeQsys(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const port = parsePort(config?.port, 1702);
  try {
    const resp = await tcpExchange(
      host,
      port,
      JSON.stringify({ jsonrpc: "2.0", method: "NoOp", id: 1 }) + "\n",
      {
        timeoutMs: 4000,
        expect: (buf) => buf.includes("jsonrpc") || buf.includes("result") || buf.includes("error"),
      }
    );
    if (/result|"error"/i.test(resp)) {
      return { ok: true, message: `Q-SYS QRC responded on ${host}:${port}` };
    }
  } catch {
    /* fall through */
  }
  const open = await tcpProbe(host, port);
  if (open.open) {
    return {
      ok: true,
      message: `TCP ${port} open on ${host}. QRC handshake inconclusive — verify Q-SYS Core is running.`,
    };
  }
  return { ok: false, message: `Q-SYS QRC port ${port} closed on ${host}` };
}

async function probeDahua(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const sdk = await tcpProbe(host, 37777, 3000);
  const http = await tcpProbe(host, 80, 2000);
  if (sdk.open) {
    return { ok: true, message: `Dahua SDK port 37777 open on ${host}` };
  }
  if (http.open) {
    return { ok: true, message: `HTTP open on ${host} — device may expose ONVIF/HTTP API (SDK port 37777 closed).` };
  }
  return { ok: false, message: `Dahua SDK (37777) and HTTP (80) closed on ${host}` };
}

async function probeMqtt(config) {
  const raw = config?.brokerUrl || config?.host;
  if (!raw) return { ok: false, message: "Broker URL required" };
  let host = parseHost(raw);
  let port = 1883;
  try {
    if (/^mqtts?:\/\//i.test(String(raw))) {
      const u = new URL(raw);
      host = u.hostname;
      port = u.port ? parsePort(u.port, u.protocol === "mqtts:" ? 8883 : 1883) : u.protocol === "mqtts:" ? 8883 : 1883;
    } else if (String(raw).includes(":")) {
      const [, p] = String(raw).split(":");
      port = parsePort(p, 1883);
    }
  } catch {
    /* use defaults */
  }
  if (!host) return { ok: false, message: "Invalid broker URL" };
  const probe = await tcpProbe(host, port);
  if (!probe.open) {
    return { ok: false, message: `MQTT broker unreachable at ${host}:${port}` };
  }
  return { ok: true, message: `MQTT broker port open at ${host}:${port}` };
}

async function probeModbus(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const port = parsePort(config?.port, 502);
  const unitId = parsePort(config?.unitId, 1);
  const open = await tcpProbe(host, port, 2000);
  if (!open.open) {
    return { ok: false, message: `Modbus TCP port ${port} closed on ${host}` };
  }
  const handshake = await modbusHandshake(host, port, unitId);
  if (handshake) {
    return { ok: true, message: `Modbus TCP OK on ${host}:${port} (unit ${unitId}) — holding register read confirmed`, detail: { unitId } };
  }
  return { ok: true, message: `Modbus TCP port ${port} open on ${host}. Protocol handshake inconclusive — verify unit ID (${unitId}) and register addresses.` };
}

function modbusHandshake(host, port, unitId) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { }
      resolve(ok);
    };
    sock.setTimeout(3000);
    sock.on("connect", () => {
      const mbap = Buffer.alloc(12);
      mbap.writeUInt16BE(1, 0);
      mbap.writeUInt16BE(0, 2);
      mbap.writeUInt16BE(2, 4);
      mbap.writeUInt8(unitId, 6);
      mbap.writeUInt8(0x03, 7);
      mbap.writeUInt16BE(0, 8);
      mbap.writeUInt16BE(1, 10);
      sock.write(mbap);
      const timer = setTimeout(() => finish(true), 2000);
      sock.once("data", (data) => {
        clearTimeout(timer);
        finish(data.length >= 8);
      });
    });
    sock.on("error", () => finish(false));
    sock.on("timeout", () => finish(false));
    try { sock.connect(port, host); } catch { finish(false); }
  });
}

async function probeCoolmaster(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const port = parsePort(config?.port, 10102);
  try {
    const resp = await tcpExchange(host, port, "#0,0,0,\r\n", {
      timeoutMs: 4000,
      expect: (buf) => buf.includes("#"),
    });
    return { ok: true, message: `Coolmaster Net controller responded on ${host}:${port} — ${resp.slice(0, 40).trim()}` };
  } catch {
    const open = await tcpProbe(host, port);
    if (open.open) {
      return { ok: true, message: `Coolmaster Net port ${port} open on ${host}. Protocol handshake inconclusive — verify the controller model.` };
    }
    return { ok: false, message: `Coolmaster Net port ${port} closed on ${host}. Default port is 10102.` };
  }
}

async function probeRs485(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const port = parsePort(config?.port, 4001);
  const open = await tcpProbe(host, port);
  if (!open.open) {
    const altPorts = [4001, 4002, 4003, 4004, 4005, 8899, 2000, 2001];
    const results = await Promise.all(altPorts.map((p) => tcpProbe(host, p, 1500)));
    const openPorts = altPorts.filter((_, i) => results[i].open);
    if (openPorts.length) {
      return {
        ok: true,
        message: `RS485-to-TCP bridge ports open on ${host}: ${openPorts.join(", ")}. Configure baud rate (9600/19200/38400/115200), data bits, parity, stop bits to match your HVAC device.`,
        detail: { openPorts },
      };
    }
    return { ok: false, message: `RS485 bridge port ${port} closed on ${host}. Also checked ports 4001-4005, 8899, 2000, 2001.` };
  }
  return { ok: true, message: `RS485-to-TCP bridge reachable at ${host}:${port}. Configure serial parameters to match your HVAC bus.` };
}

async function probeUnifi(config) {
  const host = parseHost(config?.host || config?.baseUrl);
  if (!host) return { ok: false, message: "Controller host required" };
  const port = parsePort(config?.port, 8443);
  const https = await tcpProbe(host, port, 3000);
  if (!https.open) {
    const alt = await tcpProbe(host, 443, 2000);
    if (!alt.open) {
      return { ok: false, message: `UniFi controller HTTPS (${port}/443) closed on ${host}` };
    }
    return { ok: true, message: `HTTPS open on ${host}:443 — verify UniFi Network application is running.` };
  }
  if (config?.user && config?.password) {
    try {
      const { default: https } = await import("node:https");
      const body = JSON.stringify({ username: config.user, password: config.password });
      const loginResult = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: host,
            port,
            path: "/api/auth/login",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            },
            rejectUnauthorized: false,
            timeout: 5000,
          },
          (res) => {
            let data = "";
            res.on("data", (c) => {
              data += c;
            });
            res.on("end", () => {
              try {
                resolve({ status: res.statusCode, data: JSON.parse(data) });
              } catch {
                resolve({ status: res.statusCode, data: {} });
              }
            });
          }
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy(new Error("timeout"));
        });
        req.write(body);
        req.end();
      });
      if (loginResult.status === 200 && loginResult.data?.meta?.rc === "ok") {
        return { ok: true, message: `UniFi login OK on ${host}:${port}` };
      }
      return {
        ok: false,
        message: loginResult.data?.meta?.msg || `UniFi login failed (${loginResult.status})`,
      };
    } catch (err) {
      return {
        ok: true,
        message: `HTTPS open on ${host}:${port} but API login could not be verified: ${err.message}`,
      };
    }
  }
  return { ok: true, message: `UniFi controller HTTPS open on ${host}:${port}. Add user/password to verify login.` };
}

async function probeDante(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const ports = [8700, 4440, 443];
  const results = await Promise.all(ports.map((p) => tcpProbe(host, p, 2000)));
  const open = ports.filter((_, i) => results[i].open);
  if (open.length) {
    return {
      ok: true,
      message: `Dante/mDNS-adjacent ports open on ${host}: ${open.join(", ")}. Use Dante Controller for full discovery.`,
    };
  }
  return {
    ok: false,
    message: `No Dante service ports (8700/4440/443) open on ${host}. Dante devices are usually discovered via mDNS on the LAN.`,
  };
}

async function probeSymetrix(config) {
  const host = parseHost(config?.host);
  if (!host) return { ok: false, message: "Host required" };
  const port = parsePort(config?.port, 48630);
  const open = await tcpProbe(host, port);
  if (open.open) {
    return { ok: true, message: `Symetrix TCP port ${port} open on ${host}` };
  }
  const alt = await tcpProbe(host, 80, 2000);
  if (alt.open) {
    return { ok: true, message: `HTTP open on ${host} — Symetrix Composer web UI may be available.` };
  }
  return { ok: false, message: `Symetrix ports ${port}/80 closed on ${host}` };
}

const PROBE_HANDLERS = {
  snmp: probeSnmp,
  cisco: probeCisco,
  crestron: probeCrestron,
  qsys: probeQsys,
  dahua: probeDahua,
  mqtt: probeMqtt,
  modbus: probeModbus,
  coolmaster: probeCoolmaster,
  rs485: probeRs485,
  unifi: probeUnifi,
  dante: probeDante,
  symetrix: probeSymetrix,
};

/**
 * Run a live integration probe.
 * @param {string} integrationKey
 * @param {object} config
 * @returns {Promise<{ ok: boolean, message: string, detail?: object }>}
 */
export async function runIntegrationProbe(integrationKey, config = {}) {
  const key = String(integrationKey || "").toLowerCase();
  const handler = PROBE_HANDLERS[key];
  if (!handler) {
    return { ok: false, message: `No live probe implemented for "${key}"` };
  }
  try {
    return await handler(config);
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
}

export { tcpProbe, parseHost, parsePort };
