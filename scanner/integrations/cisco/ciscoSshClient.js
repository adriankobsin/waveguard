/**
 * Cisco Catalyst 1300 / CBS350 SSH client.
 *
 * The C1300 / CBS350 family does NOT publish an on-switch REST API, so we
 * drive the CLI directly. SSH is enabled by default with admin credentials;
 * once authenticated we run a small set of `show` commands and parse the
 * structured output into the shape WaveGuard already uses for the Core
 * Network fleet (system info + ports + connected devices).
 *
 * The class is event-emitter based and exposes:
 *   - connect()           Open the SSH connection. Auto-reconnects on disconnect.
 *   - runCommand(cmd)     Run a single `show` command, return raw text.
 *   - getSystem()         Parsed system info (model, serial, firmware, uptime, PoE budget).
 *   - getInterfaces()     Parsed interfaces (status, speed, duplex, VLAN, PoE, alias).
 *   - getMacTable()       Parsed dynamic MAC address table.
 *   - getNeighbors()      Parsed LLDP + CDP neighbors.
 *   - pollAll()           One-shot snapshot — calls all of the above in parallel.
 *   - ping()              Lightweight liveness check used by the connection test.
 *   - dispose()           Close the SSH connection.
 *
 * Events:
 *   - 'ready'             Connection is up and authenticated.
 *   - 'error'             Connection failed.
 *   - 'snapshot'          New pollAll() result available.
 *
 * `ssh2` is required at runtime; if it is missing the client falls back to
 * a "not installed" error from `connect()` so the rest of the platform keeps
 * working.
 */

import { EventEmitter } from "node:events";

let SshClientCtor = null;
async function loadSshClient() {
  if (SshClientCtor) return SshClientCtor;
  try {
    const mod = await import("ssh2");
    SshClientCtor = mod.Client || mod.default?.Client;
    if (!SshClientCtor) throw new Error("ssh2 module shape unexpected — missing Client");
    return SshClientCtor;
  } catch (err) {
    const reason = err?.message || String(err);
    throw new Error(`ssh2 is not installed (${reason}). Run \`npm install\` inside scanner/.`);
  }
}

function log(msg, ...rest) {
   
  console.log(`[ciscoSsh] ${msg}`, ...rest);
}

const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 12_000;
// SMB OS sometimes prints a "More: <space>" pager prompt. We turn paging off
// with `terminal datadump` on session open, but keep a defensive splitter
// here too.
const PAGER_PATTERNS = [/More:\s*<space>,/i, /--More--/i];

export class CiscoSshClient extends EventEmitter {
  constructor(connection) {
    super();
    // Failed SSH auth emits 'error'; without a listener Node exits the process.
    this.on("error", (err) => {
      log(`${this.key} error: ${err?.message || err}`);
    });
    this.host = connection.host;
    this.port = Number(connection.port) || 22;
    this.username = connection.username || "cisco";
    this.password = connection.password || "";
    this.enablePassword = connection.enablePassword || "";
    this.platformPref = connection.platform || "auto";
    this._platform = null; // resolved: ios-xe | smb
    this.timeoutMs = connection.timeoutMs || DEFAULT_COMMAND_TIMEOUT_MS;
    this._client = null;
    this._connected = false;
    this._connecting = null;
    this._shell = null;
    this._prompt = null;
    this._cmdQueue = Promise.resolve();
    this._disposed = false;
  }

  get key() {
    return `${this.host}:${this.port}:${this.username}`;
  }

  isReady() {
    return this._connected && !!this._shell;
  }

  /** Open the SSH connection. Idempotent — concurrent callers share the same promise. */
  async connect() {
    if (this._disposed) throw new Error("client disposed");
    if (this._connected) return;
    if (this._connecting) return this._connecting;
    this._connecting = this._doConnect().finally(() => {
      this._connecting = null;
    });
    return this._connecting;
  }

  async _doConnect() {
    const Client = await loadSshClient();
    return new Promise((resolve, reject) => {
      const client = new Client();
      this._client = client;

      let settled = false;
      const settle = (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      const onError = (err) => {
        this._connected = false;
        try {
          client.end();
        } catch {
          /* */
        }
        settle(err);
      };

      const onClose = () => {
        this._connected = false;
        this._shell = null;
        log(`${this.key} disconnected`);
      };

      client.on("error", onError);
      client.on("close", onClose);
      client.on("ready", () => {
        log(`${this.key} authenticated`);
        client.shell({ term: "xterm" }, (err, stream) => {
          if (err) return settle(err);
          this._shell = stream;
          this._connected = true;
          stream.on("close", () => {
            this._connected = false;
            this._shell = null;
          });
          // Drain banner / login prompt, then disable paging.
          this._readUntilPrompt(stream, 4000)
            .then(async (banner) => {
              this._prompt = detectPrompt(banner);
              await this._prepareSession();
              this.emit("ready");
              settle(null);
            })
            .catch((shellErr) => settle(shellErr));
        });
      });

      try {
        client.connect({
          host: this.host,
          port: this.port,
          username: this.username,
          password: this.password,
          readyTimeout: DEFAULT_CONNECT_TIMEOUT_MS,
          // SMB switches use legacy KEX/cipher algorithms — be permissive.
          algorithms: {
            kex: [
              "curve25519-sha256",
              "curve25519-sha256@libssh.org",
              "ecdh-sha2-nistp256",
              "ecdh-sha2-nistp384",
              "ecdh-sha2-nistp521",
              "diffie-hellman-group14-sha256",
              "diffie-hellman-group14-sha1",
              "diffie-hellman-group1-sha1",
              "diffie-hellman-group-exchange-sha256",
            ],
            cipher: [
              "aes128-gcm@openssh.com",
              "aes256-gcm@openssh.com",
              "aes128-ctr",
              "aes192-ctr",
              "aes256-ctr",
              "aes128-cbc",
              "aes256-cbc",
              "3des-cbc",
            ],
            hmac: [
              "hmac-sha2-256",
              "hmac-sha2-512",
              "hmac-sha1",
            ],
            serverHostKey: [
              "ssh-rsa",
              "rsa-sha2-256",
              "rsa-sha2-512",
              "ecdsa-sha2-nistp256",
              "ecdsa-sha2-nistp384",
              "ecdsa-sha2-nistp521",
              "ssh-ed25519",
            ],
          },
        });
      } catch (err) {
        settle(err);
      }
    });
  }

  /** Disable paging and enter privileged mode when required (IOS-XE). */
  async _prepareSession() {
    if (this._prompt?.endsWith(">")) {
      try {
        const out = await this._sendRaw("enable\n", 4000);
        if (this.enablePassword) {
          await this._sendRaw(`${this.enablePassword}\n`, 4000);
        } else {
          await this._sendRaw("\n", 1000);
        }
        const m = (out || "").match(/([A-Za-z0-9._-]+#)\s*$/);
        if (m) this._prompt = m[1];
      } catch {
        /* user may already be privilege 15 */
      }
    }
    const plat = this._platform || this.platformPref;
    if (plat === "ios-xe" || plat === "auto") {
      try {
        await this._sendRaw("terminal length 0\n", 2000);
        await this._sendRaw("terminal width 0\n", 2000);
      } catch {
        /* */
      }
    }
    if (plat === "smb") {
      try {
        await this._sendRaw("terminal datadump\n", 2000);
      } catch {
        /* CBS350 quirk */
      }
    }
  }

  _resolvePlatform(versionText = "") {
    if (this.platformPref === "ios-xe" || this.platformPref === "smb") {
      this._platform = this.platformPref;
      return this._platform;
    }
    const v = String(versionText);
    if (/IOS-XE|C9200|C9300|C9500|Catalyst 9/i.test(v)) {
      this._platform = "ios-xe";
    } else {
      this._platform = "smb";
    }
    return this._platform;
  }

  _isIosXe() {
    return (this._platform || this.platformPref) === "ios-xe";
  }

  /** Run a single command. Serialized — each command waits for the previous one. */
  runCommand(command, timeoutMs) {
    const run = this._cmdQueue.then(() => this._runCommandInner(command, timeoutMs));
    // Keep the queue alive after a failure, but let the caller see the error.
    this._cmdQueue = run.catch((err) => {
      console.warn(`[ciscoSsh] Command "${String(command).split("\n")[0]}" failed: ${err.message}`);
    });
    return run;
  }

  /** Resolve IOS-XE vs SMB once per session (was re-running `show version` 3× per poll). */
  async ensurePlatform() {
    if (!this._connected) await this.connect();
    if (this._platform) return this._platform;
    if (this.platformPref === "ios-xe" || this.platformPref === "smb") return this._resolvePlatform("");
    this._versionText = await this.runCommand("show version").catch(() => "");
    return this._resolvePlatform(this._versionText);
  }

  async _runCommandInner(command, timeoutMs) {
    if (!this._connected || !this._shell) {
      await this.connect();
    }
    if (!this._shell) throw new Error("SSH shell not ready");
    return this._sendRaw(`${command}\n`, timeoutMs || this.timeoutMs);
  }

  _sendRaw(line, timeoutMs) {
    return new Promise((resolve, reject) => {
      const stream = this._shell;
      if (!stream) return reject(new Error("shell closed"));

      let buf = "";
      let done = false;
      const finish = (err, value) => {
        if (done) return;
        done = true;
        cleanup();
        if (err) reject(err);
        else resolve(value);
      };
      const onData = (chunk) => {
        const text = chunk.toString("utf8");
        buf += text;
        // Strip pager prompts if they appear.
        for (const re of PAGER_PATTERNS) {
          if (re.test(buf)) {
            try { stream.write(" "); } catch { /* */ }
            buf = buf.replace(re, "");
          }
        }
        if (this._prompt && buf.includes(this._prompt) && hasPromptAtEnd(buf, this._prompt)) {
          finish(null, stripEcho(buf, line, this._prompt));
        }
      };
      const onClose = () => finish(new Error("shell closed during command"));
      const onErr = (err) => finish(err);
      const cleanup = () => {
        try { stream.off("data", onData); } catch { /* */ }
        try { stream.off("close", onClose); } catch { /* */ }
        try { stream.off("error", onErr); } catch { /* */ }
        clearTimeout(timer);
      };

      stream.on("data", onData);
      stream.on("close", onClose);
      stream.on("error", onErr);

      const timer = setTimeout(() => {
        // On timeout, return whatever we have — better than nothing for
        // diagnostic display.
        if (buf.length > 0) finish(null, stripEcho(buf, line, this._prompt));
        else finish(new Error(`Command timed out after ${timeoutMs}ms: ${line.trim()}`));
      }, timeoutMs);

      try { stream.write(line); } catch (err) { finish(err); }
    });
  }

  _readUntilPrompt(stream, timeoutMs) {
    return new Promise((resolve) => {
      let buf = "";
      const onData = (chunk) => {
        buf += chunk.toString("utf8");
        if (/[>#]\s*$/.test(buf)) finish(buf);
      };
      const finish = (value) => {
        try { stream.off("data", onData); } catch { /* */ }
        clearTimeout(timer);
        resolve(value);
      };
      stream.on("data", onData);
      const timer = setTimeout(() => finish(buf), timeoutMs);
    });
  }

  /** Lightweight liveness check used by the connection tester. */
  async ping() {
    const out = await this.runCommand("show clock");
    return { ok: !!out, raw: out };
  }

  async getSystem() {
    const plat = await this.ensurePlatform();
    const version = this._versionText || (await this.runCommand("show version").catch(() => ""));
    this._versionText = version;
    const hostnameCmd =
      plat === "ios-xe"
        ? this.runCommand("show running-config | include ^hostname").catch(() => "")
        : this.runCommand("show running-config | include hostname").catch(() => "");
    const systemCmd =
      plat === "ios-xe"
        ? Promise.resolve("")
        : this.runCommand("show system").catch(() => "");
    const [system, hostname] = await Promise.all([systemCmd, hostnameCmd]);
    return parseSystem({ version, system, hostname, host: this.host, platform: plat });
  }

  async getInterfaces() {
    await this.ensurePlatform();
    const [status, description, power] = await Promise.all([
      this.runCommand("show interfaces status").catch(() => ""),
      this.runCommand("show interfaces description").catch(() => ""),
      this.runCommand("show power inline").catch(() => ""),
    ]);
    return parseInterfaces({ status, description, power, platform: this._platform });
  }

  async getMacTable() {
    await this.ensurePlatform();
    const cmd = this._isIosXe()
      ? "show mac address-table"
      : "show mac address-table dynamic";
    const raw = await this.runCommand(cmd).catch(() => "");
    return parseMacTable(raw, { platform: this._platform });
  }

  async getNeighbors() {
    if (!this._connected) await this.connect();
    const [lldp, cdp] = await Promise.all([
      this.runCommand("show lldp neighbors detail").catch(() => ""),
      this.runCommand("show cdp neighbors detail").catch(() => ""),
    ]);
    return {
      lldp: parseLldpNeighbors(lldp),
      cdp: parseCdpNeighbors(cdp),
    };
  }

  async getVlans() {
    const plat = await this.ensurePlatform();
    const raw = await this.runCommand(plat === "ios-xe" ? "show vlan brief" : "show vlan");
    return parseVlans(raw);
  }

  /**
   * IGMP snooping state, querier and joined groups — the things that decide
   * whether NVX video and Dante multicast reach only the ports that asked
   * for them, or flood every port on the VLAN.
   */
  async getMulticast() {
    await this.ensurePlatform();
    const [status, querier, groups] = await Promise.all([
      this.runCommand("show ip igmp snooping").catch(() => ""),
      this.runCommand("show ip igmp snooping querier").catch(() => ""),
      this.runCommand("show ip igmp snooping groups").catch(() => ""),
    ]);
    return parseMulticast({ status, querier, groups });
  }

  async getErrorCounters() {
    await this.ensurePlatform();
    const raw = await this.runCommand("show interfaces counters errors");
    return parseErrorCounters(raw);
  }

  /**
   * Run configuration lines in one `configure terminal` session and return
   * to exec mode. Lines are validated by the caller (see portAction()).
   */
  async configure(lines) {
    await this.ensurePlatform();
    const block = ["configure terminal", ...lines, "end"].join("\n");
    const out = await this.runCommand(block, 20_000);
    const bad = String(out || "").match(/^%\s*(Invalid|Incomplete|Ambiguous|Unrecognized|Error)[^\n]*/im);
    if (bad) throw new Error(`Switch rejected the change: ${bad[0].replace(/^%\s*/, "")}`);
    return out;
  }

  async saveConfig() {
    const plat = await this.ensurePlatform();
    // SMB OS asks "Overwrite file [startup-config]? (Y/N)" — answer it in the same write.
    const out = plat === "ios-xe"
      ? await this.runCommand("write memory", 30_000)
      : await this.runCommand("copy running-config startup-config\nY", 30_000);
    return { saved: !/error|fail/i.test(out || ""), output: String(out || "").slice(-300) };
  }

  /**
   * The everyday port jobs an ETO needs, without typing IOS:
   *   bounce | shutdown | enable | poeCycle | setVlan | setDescription
   */
  async portAction({ action, port, vlan, description }) {
    const iface = assertPortName(port);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    switch (action) {
      case "shutdown":
        await this.configure([`interface ${iface}`, "shutdown"]);
        break;
      case "enable":
        await this.configure([`interface ${iface}`, "no shutdown"]);
        break;
      case "bounce":
        await this.configure([`interface ${iface}`, "shutdown"]);
        await wait(3000);
        await this.configure([`interface ${iface}`, "no shutdown"]);
        break;
      case "poeCycle":
        await this.configure([`interface ${iface}`, "power inline never"]);
        await wait(5000);
        await this.configure([`interface ${iface}`, "power inline auto"]);
        break;
      case "setVlan": {
        const v = Number(vlan);
        if (!Number.isInteger(v) || v < 1 || v > 4094) throw new Error("VLAN must be 1–4094");
        await this.configure([`interface ${iface}`, "switchport mode access", `switchport access vlan ${v}`]);
        break;
      }
      case "setDescription": {
        const d = String(description ?? "").replace(/[^\x20-\x7e]/g, "").trim().slice(0, 64);
        await this.configure([`interface ${iface}`, d ? `description ${d}` : "no description"]);
        break;
      }
      default:
        throw new Error(`Unknown port action "${action}"`);
    }
    return { port: iface, action, done: true };
  }

  async pollAll() {
    if (!this._connected) {
      // Force an explicit connection up-front so the orchestrator can
      // distinguish "switch unreachable" (→ throw → mock fallback in demo)
      // from "switch online but `show` output is unusual".
      await this.connect();
    }
    await this.ensurePlatform();
    const [system, interfaces, macs, neighbors, vlans, multicast, errors] = await Promise.all([
      this.getSystem(),
      this.getInterfaces(),
      this.getMacTable(),
      this.getNeighbors(),
      this.getVlans().catch(() => []),
      this.getMulticast().catch(() => null),
      this.getErrorCounters().catch(() => []),
    ]);
    // Attach error counters to their ports so the UI shows them in one row.
    const errByPort = new Map(errors.map((e) => [shortPortName(e.port), e]));
    for (const p of interfaces) {
      const e = errByPort.get(shortPortName(p.name));
      if (e) p.errors = { in: e.inErrors, out: e.outErrors, fcs: e.fcs };
    }
    const snapshot = {
      system,
      interfaces,
      macs,
      neighbors,
      vlans,
      multicast,
      polledAt: new Date().toISOString(),
    };
    this.emit("snapshot", snapshot);
    return snapshot;
  }

  dispose() {
    this._disposed = true;
    try { this._shell?.end(); } catch { /* */ }
    try { this._client?.end(); } catch { /* */ }
    this._connected = false;
    this._shell = null;
    this._client = null;
  }
}

// ── Prompt + buffer helpers ─────────────────────────────────────────────

function detectPrompt(banner) {
  // SMB OS prompt is typically "<hostname>#" or "<hostname>(config)#".
  // We extract the last contiguous non-whitespace token ending in # or >.
  const m = banner.match(/([A-Za-z0-9._-]+)([>#])\s*$/);
  if (!m) return "#";
  return `${m[1]}${m[2]}`;
}

function hasPromptAtEnd(buf, prompt) {
  if (!prompt) return false;
  // The prompt should appear on its own line at the end (allow trailing spaces).
  const re = new RegExp(`(^|\\n)${escapeRegex(prompt)}\\s*$`);
  return re.test(buf.trimEnd() + "");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripEcho(buf, sentLine, prompt) {
  // Remove the echoed command (first line), and the trailing prompt.
  const lines = buf.split(/\r?\n/);
  // Drop the first echoed command line if it matches what we sent.
  const sent = sentLine.trim();
  if (lines[0] && lines[0].trim().endsWith(sent)) lines.shift();
  // Drop trailing prompt + blanks.
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (!last) lines.pop();
    else if (prompt && last === prompt) lines.pop();
    else break;
  }
  return lines.join("\n");
}

// ── Parsers (canonical SMB-OS / IOS-XE output shapes) ───────────────────

function parseSystem({ version, system, hostname, host, platform = "smb" }) {
  const out = {
    host,
    model: null,
    serial: null,
    firmware: null,
    uptime: null,
    uptimeSec: null,
    hostname: null,
    mac: null,
    description: null,
    poeBudgetW: null,
    poeUsedW: null,
  };

  // `show version` on SMB OS:
  //   Active-image:   flash://system/images/image_tesla_1.4.0.30.bin
  //   Version:        4.0.0.10
  //   MD5 Digest:     XXX
  //   Date:           23-Jul-2023
  //   Boot version:   1.0.5.04
  //   System SN:      PSZxxxxxxxx
  //   System Description: Cisco Catalyst 1300 48-Port Gigabit PoE Switch with 4 10G SFP+ Uplinks
  //   System Up Time: 14 days, 22 hours, 18 minutes
  //   HW version:     V01
  //   PID:            C1300-48FP-4G
  // (IOS-XE `show version` has a different format; we cover both.)
  const m1 = version.match(/Version:?\s*([0-9A-Za-z._-]+)/);
  if (m1) out.firmware = m1[1];
  const m2 = version.match(/(?:System\s+S\/?N|S\/?N|Serial\s+Number)\s*:?\s*([A-Z0-9]+)/i);
  if (m2) out.serial = m2[1];
  const m3 = version.match(/(?:PID|Model\s*Number|Model)\s*:?\s*([A-Z0-9-]+)/i);
  if (m3) out.model = m3[1];
  const m3b = version.match(/\bcisco\s+(C\d[\w-]+)\s+\(/i);
  if (!out.model && m3b) out.model = m3b[1];
  const m4 = version.match(/System\s+Description:?\s*(.+)$/im);
  if (m4) out.description = m4[1].trim();
  const m5 = version.match(/System\s+Up\s*Time:?\s*(.+)$/im);
  if (m5) {
    out.uptime = m5[1].trim();
    out.uptimeSec = parseUptimeToSeconds(out.uptime);
  }
  if (platform === "ios-xe") {
    const iosUptime = version.match(/uptime is\s+(.+)$/im);
    if (iosUptime) {
      out.uptime = iosUptime[1].trim();
      out.uptimeSec = parseUptimeToSeconds(out.uptime);
    }
    const iosVer = version.match(/Version\s+([0-9A-Za-z().]+)/);
    if (iosVer) out.firmware = iosVer[1];
    const iosSn = version.match(/System\s+Serial\s+Number\s*:?\s*(\S+)/i);
    if (iosSn) out.serial = iosSn[1];
  }

  // `show system` typically contains:
  //   System Description: ...
  //   System Up Time (days,hour:min:sec): ...
  //   System Contact: ...
  //   System Name: <hostname>
  //   System Location: ...
  //   System MAC Address:  74-86-0b-aa-bb-cc
  //   System Object ID:    ...
  //   Unit  Power Status
  //   1     OK
  //
  //   Unit  Type Type Description     Power Type    Power Type Description     Power Source
  //   1     PoE  PoE+ at maximum 740W  AC            AC Power Source             AC
  if (!out.uptime) {
    const u = system.match(/System\s+Up\s*Time[^:]*:?\s*(.+)$/im);
    if (u) {
      out.uptime = u[1].trim();
      out.uptimeSec = parseUptimeToSeconds(out.uptime);
    }
  }
  const mac = system.match(/System\s+MAC\s+Address\s*:?\s*([0-9a-fA-F:.-]+)/);
  if (mac) out.mac = normaliseMac(mac[1]);
  const sysName = system.match(/System\s+Name\s*:?\s*(.+)$/im);
  if (sysName) out.hostname = sysName[1].trim();
  if (!out.description) {
    const sd = system.match(/System\s+Description:?\s*(.+)$/im);
    if (sd) out.description = sd[1].trim();
  }
  // PoE budget line — "PoE+ at maximum 740W" or similar.
  const poe = system.match(/(\d+)\s*W/i);
  if (poe) out.poeBudgetW = Number(poe[1]) || null;

  if (!out.hostname && hostname) {
    const h = hostname.match(/hostname\s+(\S+)/i);
    if (h) out.hostname = h[1];
  }

  // Fallback model from description when PID line is missing.
  if (!out.model && out.description) {
    const dm = out.description.match(
      /(C9200L?-\d+(?:[A-Z]+)?-?\d*[XGU]?|C9300L?-\d+(?:[A-Z]+)?-?\d*[XGU]?|C1300-\d+(?:[A-Z]+)?-?\d*[GX]?|CBS\d+-\d+[PT]?|SG\d+-\d+|Catalyst\s+1300)/i
    );
    if (dm) out.model = dm[1].replace(/\s+/g, "");
  }

  out.platform = platform;
  return out;
}

function parseUptimeToSeconds(text) {
  if (!text) return null;
  // "14 days, 22 hours, 18 minutes" or "1d23h" or "1:23:45" formats.
  let seconds = 0;
  const days = text.match(/(\d+)\s*day/i);
  const hrs = text.match(/(\d+)\s*hour/i);
  const min = text.match(/(\d+)\s*min/i);
  const sec = text.match(/(\d+)\s*sec/i);
  if (days) seconds += Number(days[1]) * 86400;
  if (hrs) seconds += Number(hrs[1]) * 3600;
  if (min) seconds += Number(min[1]) * 60;
  if (sec) seconds += Number(sec[1]);
  if (seconds > 0) return seconds;
  const compact = text.match(/(\d+):(\d+):(\d+)/);
  if (compact) {
    return Number(compact[1]) * 3600 + Number(compact[2]) * 60 + Number(compact[3]);
  }
  return null;
}

function normaliseMac(mac) {
  return String(mac)
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .replace(/(.{2})(?=.)/g, "$1:")
    .slice(0, 17);
}

function parseInterfaces({ status, description, power, platform = "smb" }) {
  const out = [];

  const lines = status.split(/\r?\n/);
  let index = 0;
  for (const line of lines) {
    if (platform === "ios-xe") {
      const ix = line.match(
        /^\s*(Gi|Te|Fa|Po|Hu|Tw|Fo)(\d+\/\d+\/\d+|\d+)\s+(.*?)\s*\b(connected|notconnect|disabled|err-disabled|suspended|monitoring|inactive)\S*\s+(\d+|trunk|routed)\s+(\S+)\s+(\S+)\s*(.*)$/i
      );
      if (ix) {
        index += 1;
        const name = `${ix[1]}${ix[2]}`;
        const linkState = ix[4].toLowerCase();
        const speedMbps = parseIosXeSpeed(ix[7]);
        const isUplink = /^(Te|Hu|Tw)/i.test(ix[1]);
        out.push({
          index,
          name,
          ifAlias: (ix[3] || "").trim(),
          status: linkState === "connected" ? "up" : linkState === "err-disabled" ? "err-disabled" : "down",
          adminDown: linkState === "disabled",
          speed: speedMbps,
          speedMbps,
          duplex: ix[6] === "auto" ? null : ix[6],
          type: ix[8]?.trim() || "",
          mtu: 1500,
          vlan: Number(ix[5]) || null,
          trunk: /trunk/i.test(ix[5]),
          poeWatts: null,
          poeStatus: null,
          isUplink,
          portRole: isUplink ? "uplink" : "lan",
        });
        continue;
      }
    }

    const m = line.match(/^\s*((?:gi|te|fa|po|xg|tw)\d+\/\d+\/\d+|(?:Gi|Te|Fa|Po|Xg|Tw)\d+\/\d+\/\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (!m) continue;
    index += 1;
    const name = m[1];
    const type = m[2];
    const duplex = m[3] === "--" ? null : m[3];
    const speedMbps = m[4] === "--" ? 0 : Number(m[4]) || 0;
    const linkState = (m[7] || "").toLowerCase();
    const isUplink = /^(?:Te|te|Xg|xg|Tw|tw)/.test(name);
    out.push({
      index,
      name,
      ifAlias: "",
      status: linkState === "up" ? "up" : linkState === "down" ? "down" : "unknown",
      speed: speedMbps,
      speedMbps,
      duplex,
      type,
      mtu: 1500,
      vlan: null,
      poeWatts: null,
      poeStatus: null,
      isUplink,
      portRole: isUplink ? "uplink" : "lan",
    });
  }

  // `show interfaces description` shape:
  // Port      Description
  // --------- -----------------
  // gi1/0/1   Bridge AP
  // gi1/0/2
  const descByName = new Map();
  for (const line of description.split(/\r?\n/)) {
    const m = line.match(/^\s*((?:gi|te|fa|po|xg|tw|hu|fo)\d+(?:\/\d+\/\d+)?)\s+(.+)$/i);
    if (!m) continue;
    // IOS-XE: "Gi1/0/1   up   up   Saloon NVX"  (strip Status / Protocol columns)
    const rest = m[2].replace(/^(?:admin down|up|down)\s+(?:up|down)\s*/i, "").trim();
    if (rest) descByName.set(shortPortName(m[1]), rest);
  }
  for (const p of out) {
    const d = descByName.get(shortPortName(p.name));
    if (d) p.ifAlias = d;
  }

  // `show power inline` shape:
  // Port     Powered Device   State        Priority Class Power [mW] Power [mW]
  // -------- ---------------- ------------ -------- ----- ---------- ----------
  // gi1/0/1                   On           Low      4     5400       5500
  // gi1/0/2                   Off          Low      0     0          0
  for (const line of power.split(/\r?\n/)) {
    // IOS-XE: "Gi1/0/3   auto   on    15.4    Ieee PD    4    30.0"
    const x = line.match(/^\s*((?:Gi|Te|Tw|Fa)\d+\/\d+\/\d+)\s+(auto|off|static|never)\s+(on|off|faulty|power-deny|err-disable)\s+([\d.]+)\s+(.*?)\s+(\S+)\s+([\d.]+)\s*$/i);
    if (x) {
      const i = out.findIndex((p) => shortPortName(p.name) === shortPortName(x[1]));
      if (i >= 0) {
        out[i].poeStatus = x[3].toLowerCase();
        out[i].poeWatts = Number(x[4]) || 0;
        out[i].poeDevice = x[5].trim() === "n/a" ? null : x[5].trim();
      }
      continue;
    }
    const m = line.match(/^\s*((?:gi|te|fa|po|xg|tw)\d+\/\d+\/\d+)\s+(.*?)\s+(On|Off|Searching|Test|Fault)\s+\S+\s+(\d+)\s+(\d+)\s+(\d+)/i);
    if (!m) continue;
    const idx = out.findIndex((p) => p.name.toLowerCase() === m[1].toLowerCase());
    if (idx < 0) continue;
    const state = m[3];
    const mW = Number(m[6]) || 0;
    out[idx].poeStatus = state.toLowerCase();
    out[idx].poeWatts = mW > 0 ? Math.round((mW / 1000) * 10) / 10 : 0;
  }

  return out;
}

function parseIosXeSpeed(token) {
  const t = String(token || "").toLowerCase();
  // Longest first — "10000" also contains "1000" and "100".
  const g = t.match(/(\d+(?:\.\d+)?)g/);
  if (g) return Math.round(Number(g[1]) * 1000);
  if (t.includes("10000")) return 10000;
  if (t.includes("5000")) return 5000;
  if (t.includes("2500")) return 2500;
  if (t.includes("1000")) return 1000;
  if (t.includes("100")) return 100;
  if (/(^|-)10$/.test(t)) return 10;
  if (t === "auto" || t === "--") return 0;
  const n = Number(t.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseMacTable(raw, { platform = "smb" } = {}) {
  // SMB OS shape:
  //   Vlan      Mac Address      Port            Type
  //   ----  --------------------  ----------  ---------
  //   1     74:86:0b:aa:bb:cc   gi1/0/3     dynamic
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s+([0-9a-fA-F:.-]{12,})\s+(\S+)\s+(\S+)/);
    if (!m) continue;
    const mac = normaliseMac(m[2]);
    if (!mac || mac.replace(/:/g, "").length !== 12) continue;
    // SMB: Vlan Mac Port Type — IOS-XE: Vlan Mac Type Ports. Tell them apart by which column is a type word.
    const typeFirst = /^(dynamic|static|secure|self|management)$/i.test(m[3]);
    const port = typeFirst ? m[4] : m[3];
    const type = (typeFirst ? m[3] : m[4]).toLowerCase();
    if (/^cpu$/i.test(port)) continue;
    out.push({ vlan: Number(m[1]) || null, mac, port, type });
  }
  return out;
}

function parseLldpNeighbors(raw) {
  // SMB-OS `show lldp neighbors detail` blocks are separated by `Local port`.
  // Each block looks like:
  //   Local port: gi1/0/3
  //   Chassis ID subtype: MAC address
  //   Chassis ID: 00:11:22:33:44:55
  //   Port ID subtype: Locally assigned
  //   Port ID: 1
  //   System Name: AP-Bridge
  //   System description: Aruba AP-535
  //   Port description: ge-0/0/1
  //   ...
  const out = [];
  const blocks = raw.split(/(?=Local\s*port\s*:)/i);
  for (const block of blocks) {
    if (!/Local\s*port\s*:/i.test(block)) continue;
    const port = pickValue(block, /Local\s*port\s*:\s*(\S+)/i);
    if (!port) continue;
    out.push({
      port,
      chassisId: pickValue(block, /Chassis\s*ID\s*:\s*([0-9a-fA-F:.-]+)/) || null,
      portId: pickValue(block, /Port\s*ID\s*:\s*(.+)$/m) || null,
      systemName: pickValue(block, /System\s*Name\s*:\s*(.+)$/m) || null,
      systemDescription: pickValue(block, /System\s*Description\s*:\s*(.+)$/im) || null,
      portDescription: pickValue(block, /Port\s*Description\s*:\s*(.+)$/im) || null,
      capabilities: pickValue(block, /Capabilities\s*:\s*(.+)$/im) || null,
    });
  }
  return out;
}

function parseCdpNeighbors(raw) {
  // Each block separated by ------- or by `Device ID:`
  const out = [];
  const blocks = raw.split(/(?=Device\s*ID\s*:)/i);
  for (const block of blocks) {
    if (!/Device\s*ID\s*:/i.test(block)) continue;
    const deviceId = pickValue(block, /Device\s*ID\s*:\s*(.+)$/m);
    if (!deviceId) continue;
    out.push({
      deviceId: deviceId.trim(),
      ip: pickValue(block, /IP\s*address\s*:\s*([0-9.]+)/i) || null,
      platform: pickValue(block, /Platform\s*:\s*([^,\n]+)/) || null,
      port: pickValue(block, /Interface\s*:\s*([^,\n]+)/) || null,
      remotePort: pickValue(block, /Port\s*ID\s*\(outgoing\s*port\)\s*:\s*(.+)$/im) || null,
      capabilities: pickValue(block, /Capabilities\s*:\s*(.+)$/im) || null,
      version: pickValue(block, /Version\s*:\s*(.+)$/im) || null,
    });
  }
  return out;
}

/** "GigabitEthernet1/0/3" / "gi1/0/3" / "Gi1/0/3" → "gi1/0/3" for matching across commands. */
export function shortPortName(name) {
  const n = String(name || "").trim().toLowerCase();
  const m = n.match(/^([a-z]+?)(?:abitethernet|gigabitethernet|ethernet|igabitethernet|e)?(\d.*)$/);
  if (!m) return n;
  const map = { gigabitethernet: "gi", gi: "gi", tengigabitethernet: "te", te: "te", twogigabitethernet: "tw", tw: "tw", fastethernet: "fa", fa: "fa", port: "po", po: "po", xg: "xg", hu: "hu" };
  const word = n.match(/^[a-z-]+/)?.[0] || m[1];
  const prefix = map[word] || map[word.slice(0, 2)] || word.slice(0, 2);
  return `${prefix}${n.slice(word.length)}`;
}

/** Only accept real interface names — they're spliced into config mode. */
export function assertPortName(port) {
  const p = String(port || "").trim();
  if (!/^(?:gi|te|tw|fa|xg|hu|fo|po)[a-z]*\d+(?:\/\d+){0,2}$/i.test(p)) {
    throw new Error(`"${p}" is not a valid switch port name`);
  }
  return p;
}

function parseVlans(raw) {
  const out = [];
  for (const line of String(raw || "").split(/\r?\n/)) {
    // IOS-XE: "10   AV-NVX      active    Gi1/0/1, Gi1/0/2"  SMB: "10   AV-NVX   gi1/0/1-4   ...  Static"
    const m = line.match(/^\s*(\d{1,4})\s+(\S+)\s*(.*)$/);
    if (!m) continue;
    const id = Number(m[1]);
    if (id < 1 || id > 4094 || out.some((v) => v.id === id)) continue;
    const rest = m[3] || "";
    if (/^(act\/unsup|suspended)/i.test(rest) && id >= 1002 && id <= 1005) continue;
    out.push({ id, name: m[2], active: !/suspend|act\/lshut/i.test(rest) });
  }
  return out;
}

function parseMulticast({ status = "", querier = "", groups = "" }) {
  const result = { snoopingEnabled: null, vlans: [], queriers: [], groups: [], querierChecked: /querier|vlan/i.test(querier) && !/^%/m.test(querier) };
  const g = status.match(/IGMP\s+snooping\s*(?:is|:|status\s*:?)\s*(Enabled|Disabled)/i);
  if (g) result.snoopingEnabled = /enabled/i.test(g[1]);
  // IOS-XE prints a block per VLAN: "Vlan 10:\n--------\nIGMP snooping : Enabled"
  for (const block of status.split(/(?=^\s*Vlan\s+\d+\s*:?)/im)) {
    const v = block.match(/^\s*Vlan\s+(\d+)/i);
    if (!v) continue;
    const en = block.match(/IGMP\s+snooping\s*(?:status)?\s*:\s*(Enabled|Disabled)/i);
    const imm = block.match(/immediate\s*leave\s*:\s*(Enabled|Disabled)/i);
    result.vlans.push({ vlan: Number(v[1]), snooping: en ? /enabled/i.test(en[1]) : null, immediateLeave: imm ? /enabled/i.test(imm[1]) : null });
  }
  if (result.snoopingEnabled == null && result.vlans.length) result.snoopingEnabled = result.vlans.some((v) => v.snooping);
  for (const line of querier.split(/\r?\n/)) {
    const q = line.match(/^\s*(\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(?:v?(\d))?\s*(\S+)?/i);
    if (q) result.queriers.push({ vlan: Number(q[1]), address: q[2], version: q[3] ? Number(q[3]) : null, port: q[4] || null });
  }
  for (const line of groups.split(/\r?\n/)) {
    // IOS-XE: "10    239.255.0.1    igmp    v2    Gi1/0/3, Gi1/0/7"
    // SMB:    "10    239.255.0.1    *    gi1/0/3 gi1/0/7"
    const m = line.match(/^\s*(\d+)\s+(2(?:2[4-9]|3\d)\.\d+\.\d+\.\d+)\s+(.*)$/);
    if (!m) continue;
    const ports = (m[3].match(/\b(?:gi|te|tw|fa|xg|po)\d+(?:\/\d+){0,2}\b/gi) || []);
    result.groups.push({ vlan: Number(m[1]), group: m[2], ports });
  }
  return result;
}

function parseErrorCounters(raw) {
  const out = [];
  for (const line of String(raw || "").split(/\r?\n/)) {
    // IOS-XE: "Port  Align-Err  FCS-Err  Xmit-Err  Rcv-Err  UnderSize  OutDiscards"
    const m = line.match(/^\s*((?:gi|te|tw|fa|xg)\S*\d)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?(?:\s+(\d+))?/i);
    if (!m) continue;
    out.push({ port: m[1], fcs: Number(m[3]), outErrors: Number(m[4]), inErrors: Number(m[5]) + Number(m[2]) });
  }
  return out;
}

export const __test = { parseInterfaces, parseMacTable, parseVlans, parseMulticast, parseErrorCounters, parseIosXeSpeed };

function pickValue(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  return (m[1] || "").trim();
}

// ── Per-host singleton ───────────────────────────────────────────────────

const clients = new Map();

export function getCiscoSshClient(connection) {
  if (!connection?.host) return null;
  const key = `${connection.host}:${connection.port || 22}:${connection.username || "cisco"}`;
  const existing = clients.get(key);
  if (existing && !existing._disposed) return existing;
  // Dispose any stale client with the same host but different creds.
  for (const [k, c] of clients) {
    if (c.host === connection.host && k !== key) {
      c.dispose();
      clients.delete(k);
    }
  }
  const client = new CiscoSshClient(connection);
  clients.set(key, client);
  return client;
}

export function closeCiscoSshClient(host) {
  for (const [k, c] of clients) {
    if (!host || c.host === host) {
      c.dispose();
      clients.delete(k);
    }
  }
}
