/**
 * Live AV Flow: Crestron DM-NVX (REST API on each endpoint), Dante (mDNS),
 * PTP/SAP (passive listen) and the Cisco switches' MAC + IGMP tables, joined
 * into one picture by src/lib/av/avFlowModel.js.
 *
 * NVX REST API (firmware 5.x+, same login as the endpoint's web page):
 *   GET  /userlogin.html                     → TRACKID cookie
 *   POST /userlogin.html  login=..&passwd=.. → session cookies + CREST-XSRF-TOKEN
 *   GET  /Device/DeviceInfo | /Device/DeviceSpecific | /Device/StreamTransmit | /Device/StreamReceive
 *   POST /Device/StreamReceive  {"Device":{"StreamReceive":{"Streams":[{"StreamLocation": "<tx rtsp url>"}]}}}
 * Field names vary slightly between firmware versions, so reads use a
 * case-insensitive deep search rather than fixed paths.
 */
import https from "https";
import { httpError, hasCommand, run } from "./exec.js";
import * as tools from "./netTools.js";
import { buildAvFlow } from "../../src/lib/av/avFlowModel.js";

export const AV_FLOW_SETTINGS_KEY = "av-flow-settings";
const REQ_TIMEOUT_MS = 5000;

// ------------------------------------------------------------------ tiny HTTPS client with a cookie jar
function request(host, path, { method = "GET", body, headers = {}, jar } = {}) {
  return new Promise((resolve, reject) => {
    const cookie = jar && jar.size ? [...jar].map(([k, v]) => `${k}=${v}`).join("; ") : undefined;
    const req = https.request(
      {
        host,
        port: 443,
        path,
        method,
        rejectUnauthorized: false, // NVX ships a self-signed certificate
        timeout: REQ_TIMEOUT_MS,
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}), ...headers },
      },
      (res) => {
        for (const c of res.headers["set-cookie"] || []) {
          const [pair] = c.split(";");
          const i = pair.indexOf("=");
          if (i > 0 && jar) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
        }
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Case-insensitive deep search for the first value under any of `keys`. */
export function pick(obj, ...keys) {
  const wanted = keys.map((k) => k.toLowerCase());
  const seen = new Set();
  const stack = [obj];
  while (stack.length) {
    const node = stack.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    for (const [k, v] of Object.entries(node)) {
      if (wanted.includes(k.toLowerCase()) && v != null && v !== "" && typeof v !== "object") return v;
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") stack.push(v);
  }
  return null;
}

function firstStream(json, section) {
  const s = json?.Device?.[section]?.Streams;
  return Array.isArray(s) ? s[0] || {} : s && typeof s === "object" ? Object.values(s)[0] || {} : json?.Device?.[section] || {};
}

class NvxSession {
  constructor(ip, { username, password }) {
    this.ip = ip;
    this.username = username || "admin";
    this.password = password || "";
    this.jar = new Map();
    this.xsrf = null;
  }

  async login() {
    await request(this.ip, "/userlogin.html", { jar: this.jar }).catch(() => null);
    const body = `login=${encodeURIComponent(this.username)}&&passwd=${encodeURIComponent(this.password)}`;
    const res = await request(this.ip, "/userlogin.html", {
      method: "POST",
      body,
      jar: this.jar,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: `https://${this.ip}`, Referer: `https://${this.ip}/userlogin.html` },
    });
    this.xsrf = res.headers["crest-xsrf-token"] || this.jar.get("CREST-XSRF-TOKEN") || null;
    if (res.status === 403 || res.status === 401 || (!this.jar.has("AuthByPasswd") && !this.jar.has("userstr") && !this.xsrf)) {
      throw new Error("NVX login refused — check the NVX username/password in AV Flow settings");
    }
  }

  async get(path) {
    if (!this.jar.size) await this.login();
    let res = await request(this.ip, path, { jar: this.jar, headers: this.xsrf ? { "X-CREST-XSRF-TOKEN": this.xsrf } : {} });
    if (res.status === 401 || res.status === 403 || /userlogin/i.test(res.headers.location || "")) {
      await this.login();
      res = await request(this.ip, path, { jar: this.jar, headers: this.xsrf ? { "X-CREST-XSRF-TOKEN": this.xsrf } : {} });
    }
    if (res.status >= 400) throw new Error(`${path} → HTTP ${res.status}`);
    try {
      return JSON.parse(res.body);
    } catch {
      return {};
    }
  }

  async post(path, payload) {
    if (!this.jar.size) await this.login();
    const res = await request(this.ip, path, {
      method: "POST",
      body: JSON.stringify(payload),
      jar: this.jar,
      headers: { "Content-Type": "application/json", ...(this.xsrf ? { "X-CREST-XSRF-TOKEN": this.xsrf } : {}) },
    });
    if (res.status >= 400) throw new Error(`${path} → HTTP ${res.status}: ${res.body.slice(0, 200)}`);
    return res.body ? JSON.parse(res.body || "{}") : {};
  }
}

export async function readNvx(ip, creds) {
  const s = new NvxSession(ip, creds);
  try {
    try {
      await s.login();
    } catch (err) {
      if (/login refused/i.test(err.message)) return { ip, online: true, authFailed: true, error: err.message };
      throw err;
    }
    const [info, specific, tx, rx, avio] = await Promise.all([
      s.get("/Device/DeviceInfo").catch(() => ({})),
      s.get("/Device/DeviceSpecific").catch(() => ({})),
      s.get("/Device/StreamTransmit").catch(() => null),
      s.get("/Device/StreamReceive").catch(() => null),
      s.get("/Device/AudioVideoInputOutput").catch(() => null),
    ]);
    const modeRaw = String(pick(specific, "DeviceMode", "Mode") || "").toLowerCase();
    const mode = modeRaw.includes("rec") ? "rx" : modeRaw.includes("trans") ? "tx" : rx && !tx ? "rx" : "tx";
    const stream = mode === "rx" ? firstStream(rx, "StreamReceive") : firstStream(tx, "StreamTransmit");
    const sync = avio ? pick(avio, "IsSyncDetected", "SyncDetected") : null;
    return {
      ip,
      online: true,
      mode,
      name: pick(info, "Name", "DeviceName", "HostName") || null,
      model: pick(info, "Model", "ModelName") || null,
      firmware: pick(info, "DeviceVersion", "FirmwareVersion", "PufVersion") || null,
      mac: pick(info, "MacAddress", "MACAddress") || null,
      serial: pick(info, "SerialNumber") || null,
      multicast: pick(stream, "MulticastAddress") || null,
      streamLocation: pick(stream, "StreamLocation", "SessionInitiationAddress") || null,
      status: pick(stream, "Status", "StreamStatus") || null,
      resolution: pick(stream, "Resolution") || (avio ? [pick(avio, "HorizontalResolution"), pick(avio, "VerticalResolution")].filter(Boolean).join("x") || null : null),
      inputSync: sync == null ? null : sync === true || String(sync).toLowerCase() === "true",
      hdcp: avio ? pick(avio, "HdcpState", "HdcpReceiverCapability") : null,
    };
  } catch (err) {
    return { ip, online: false, error: err.message };
  }
}

/** Route an NVX decoder to an encoder (same as picking it in the decoder's web page). */
export async function routeNvx({ rxIp, txIp, creds }) {
  const tx = await readNvx(txIp, creds);
  if (!tx.online) throw httpError(502, `Encoder ${txIp}: ${tx.error}`);
  const location = tx.streamLocation || (tx.multicast ? `rtsp://${txIp}:554/live.sdp` : null);
  if (!location) throw httpError(409, `Encoder ${txIp} isn't advertising a stream`);
  const s = new NvxSession(rxIp, creds);
  await s.post("/Device/StreamReceive", { Device: { StreamReceive: { Streams: [{ StreamLocation: location }] } } });
  return { rxIp, txIp, streamLocation: location };
}

// ------------------------------------------------------------------ Dante (mDNS)
const DANTE_TYPES = ["_netaudio-arc._udp", "_netaudio-cmc._udp", "_netaudio-chan._udp", "_netaudio-dbc._udp"];

function txtValue(txt, key) {
  const m = String(txt || "").match(new RegExp(`"${key}=([^"]*)"`, "i"));
  return m ? m[1] : null;
}

export async function discoverDante({ seconds = 4 } = {}) {
  if (!(await hasCommand("avahi-browse"))) return { devices: [], note: "avahi-utils not installed — Dante devices can't be discovered (sudo apt install avahi-utils)." };
  const results = await Promise.all(
    DANTE_TYPES.map((t) =>
      run("timeout", [String(seconds), "avahi-browse", "-r", "-p", "-t", t], { timeoutMs: (seconds + 4) * 1000 }).catch(() => ({ stdout: "" }))
    )
  );
  const byIp = new Map();
  for (const r of results) {
    for (const line of (r.stdout || "").split("\n")) {
      const p = line.split(";");
      if (p[0] !== "=" || p.length < 9 || p[2] !== "IPv4") continue;
      const ip = p[7];
      const d = byIp.get(ip) || { ip, name: null, channels: new Set() };
      const type = p[4];
      const name = p[3].replace(/\\032/g, " ").replace(/\\(\d{3})/g, (_m, n) => String.fromCharCode(Number(n)));
      const txt = p[9] || "";
      if (type === "_netaudio-arc._udp" || !d.name) d.name = name.split("@")[0];
      if (type === "_netaudio-cmc._udp") {
        d.mac = txtValue(txt, "id") || d.mac;
        d.manufacturer = txtValue(txt, "mf") || d.manufacturer;
        d.model = txtValue(txt, "model") || d.model;
      }
      if (type === "_netaudio-chan._udp") {
        d.channels.add(name.split("@")[0]);
        d.sampleRate = Number(txtValue(txt, "rate")) || d.sampleRate;
      }
      byIp.set(ip, d);
    }
  }
  return {
    devices: [...byIp.values()].map(({ channels, ...d }) => ({ ...d, txChannels: channels.size || null })),
  };
}

// ------------------------------------------------------------------ gather
export function createAvFlow({ db, getSettingValue, getCiscoTargets }) {
  const settings = () => ({ nvxUsername: "admin", nvxPassword: "", extraNvxIps: [], ...(getSettingValue?.(AV_FLOW_SETTINGS_KEY) || {}) });
  const creds = () => ({ username: settings().nvxUsername, password: settings().nvxPassword });

  function nvxCandidates() {
    const fromEquipment = (db.equipment || [])
      .filter((e) => /nvx|dm-nvx|d80|e30|e760/i.test(`${e.model || ""} ${e.name || ""}`) || (e.controlType === "Crestron-CIP" && /encoder|decoder/.test(e.avRole || "")))
      .map((e) => e.ip || e.ipAddress)
      .filter(Boolean);
    return [...new Set([...fromEquipment, ...(settings().extraNvxIps || [])])];
  }

  async function scan({ listenSeconds = 4 } = {}) {
    const notes = [];
    const nvxIps = nvxCandidates();
    if (!nvxIps.length) notes.push({ title: "No NVX endpoints configured", detail: "Add NVX encoders/decoders in Equipment (model containing \"NVX\") or list their IPs in AV Flow settings." });
    else if (!creds().password) notes.push({ title: "NVX password not set", detail: "Set the NVX login in AV Flow → Settings so WaveGuard can read stream status." });

    const [nvx, dante, ptp, neigh, switches] = await Promise.all([
      Promise.all(nvxIps.map((ip) => readNvx(ip, creds()))),
      discoverDante({ seconds: Math.min(6, listenSeconds) }).catch((err) => ({ devices: [], note: err.message })),
      tools.avNetworkScan({ seconds: Math.max(3, listenSeconds) }).catch(() => null),
      tools.neighbours().catch(() => ({ neighbours: [] })),
      getCiscoTargets ? getCiscoTargets().catch(() => []) : [],
    ]);
    if (dante.note) notes.push({ title: "Dante discovery", detail: dante.note });
    if (!switches.length) notes.push({ title: "No Cisco switch connected", detail: "Connect your switches under Core Network → Cisco Switches to see ports, IGMP groups and link speeds." });
    return buildAvFlow({ nvx, dante: dante.devices, ptp, switches, neighbours: neigh.neighbours, equipment: db.equipment || [], notes });
  }

  return {
    scan,
    settings: () => {
      const s = settings();
      return { ...s, nvxPassword: s.nvxPassword ? "********" : "" };
    },
    route: ({ rxIp, txIp }) => routeNvx({ rxIp, txIp, creds: creds() }),
  };
}
