/**
 * Network troubleshooting tools for the WaveGuard server (comparable to the
 * ping / traceroute / port-scan / terminal tools in OvrC Pro and Domotz).
 *
 * Everything runs on the WaveGuard host itself, so results reflect what the
 * vessel network looks like from the rack — not from the cloud.
 */
import dgram from "dgram";
import dns from "dns/promises";
import fs from "fs";
import net from "net";
import os from "os";
import tls from "tls";
import { run, hasCommand, assertHost, assertCidr, assertHostOrCidr, assertPort, clampInt, httpError } from "./exec.js";

// ------------------------------------------------------------------ OUI vendor lookup
let ouiMap = null;
const OUI_FILES = [
  "/usr/share/nmap/nmap-mac-prefixes",
  "/usr/share/arp-scan/ieee-oui.txt",
  "/usr/share/ieee-data/oui.txt",
];

function loadOui() {
  if (ouiMap) return ouiMap;
  ouiMap = new Map();
  for (const file of OUI_FILES) {
    try {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf-8");
      for (const line of text.split("\n")) {
        if (!line || line.startsWith("#")) continue;
        let m = line.match(/^([0-9A-Fa-f]{6})\s+(.+)$/); // nmap / arp-scan format
        if (!m) m = line.match(/^([0-9A-Fa-f]{2})-([0-9A-Fa-f]{2})-([0-9A-Fa-f]{2})\s+\(hex\)\s+(.+)$/);
        if (!m) continue;
        const prefix = (m.length === 3 ? m[1] : m[1] + m[2] + m[3]).toUpperCase();
        const vendor = (m.length === 3 ? m[2] : m[4]).trim();
        if (!ouiMap.has(prefix)) ouiMap.set(prefix, vendor);
      }
    } catch {
      /* ignore unreadable file */
    }
  }
  return ouiMap;
}

export function macVendor(mac) {
  const hex = String(mac || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (hex.length < 6) return null;
  // Locally administered (randomised) addresses — phones, VMs.
  if (parseInt(hex[1], 16) & 0x2) return "Private / randomised MAC";
  return loadOui().get(hex.slice(0, 6)) || null;
}

// ------------------------------------------------------------------ ping
export async function ping({ host, count = 4 }) {
  const target = assertHost(host);
  const c = clampInt(count, 1, 20, 4);
  const r = await run("ping", ["-c", String(c), "-W", "2", "-i", "0.3", target], { timeoutMs: c * 2500 + 5000 });
  if (r.missing) throw httpError(501, "ping is not installed on this server");
  const out = r.stdout + r.stderr;
  const loss = out.match(/([\d.]+)% packet loss/);
  const rtt = out.match(/= ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/);
  const replies = [...out.matchAll(/icmp_seq=(\d+) ttl=(\d+) time=([\d.]+) ms/g)].map((m) => ({
    seq: Number(m[1]),
    ttl: Number(m[2]),
    ms: Number(m[3]),
  }));
  return {
    host: target,
    alive: replies.length > 0,
    sent: c,
    received: replies.length,
    lossPct: loss ? Number(loss[1]) : 100,
    min: rtt ? Number(rtt[1]) : null,
    avg: rtt ? Number(rtt[2]) : null,
    max: rtt ? Number(rtt[3]) : null,
    jitter: rtt ? Number(rtt[4]) : null,
    replies,
    raw: out.trim(),
  };
}

// ------------------------------------------------------------------ traceroute
export async function traceroute({ host, maxHops = 20 }) {
  const target = assertHost(host);
  const hops = clampInt(maxHops, 1, 30, 20);
  let r;
  if (await hasCommand("traceroute")) {
    r = await run("traceroute", ["-n", "-w", "2", "-q", "2", "-m", String(hops), target], { timeoutMs: hops * 6000 + 5000 });
  } else if (await hasCommand("tracepath")) {
    r = await run("tracepath", ["-n", "-m", String(hops), target], { timeoutMs: hops * 6000 + 5000 });
  } else {
    throw httpError(501, "traceroute is not installed (apt install traceroute)");
  }
  const lines = r.stdout.split("\n").slice(1);
  const parsed = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const ip = (m[2].match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{3,})/i) || [])[1] || null;
    const times = [...m[2].matchAll(/([\d.]+)\s*ms/g)].map((t) => Number(t[1]));
    parsed.push({ hop: Number(m[1]), ip: m[2].trim().startsWith("*") && !ip ? null : ip, ms: times.length ? Math.min(...times) : null, raw: m[2].trim() });
  }
  return { host: target, hops: parsed, raw: (r.stdout + r.stderr).trim() };
}

// ------------------------------------------------------------------ mtr
export async function mtr({ host, cycles = 10 }) {
  const target = assertHost(host);
  if (!(await hasCommand("mtr"))) throw httpError(501, "mtr is not installed (apt install mtr-tiny)");
  const c = clampInt(cycles, 1, 30, 10);
  const r = await run("mtr", ["-r", "-n", "-w", "-j", "-c", String(c), target], { timeoutMs: c * 3000 + 20000 });
  try {
    const json = JSON.parse(r.stdout);
    const hubs = json?.report?.hubs || [];
    return {
      host: target,
      hops: hubs.map((h) => ({ hop: h.count, ip: h.host === "???" ? null : h.host, lossPct: h["Loss%"], avg: h.Avg, best: h.Best, worst: h.Wrst, stdev: h.StDev, sent: h.Snt })),
    };
  } catch {
    return { host: target, hops: [], raw: (r.stdout + r.stderr).trim() };
  }
}

// ------------------------------------------------------------------ DNS
const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "PTR", "SOA"];
export async function dnsLookup({ name, type = "A", server }) {
  const rrtype = DNS_TYPES.includes(String(type).toUpperCase()) ? String(type).toUpperCase() : "A";
  const resolver = new dns.Resolver({ timeout: 4000, tries: 2 });
  if (server) resolver.setServers([assertHost(server, "DNS server")]);
  const started = Date.now();
  try {
    if (rrtype === "PTR" || net.isIP(String(name))) {
      const ip = assertHost(name);
      const names = await resolver.reverse(ip);
      return { name: ip, type: "PTR", answers: names, ms: Date.now() - started, servers: resolver.getServers() };
    }
    const host = assertHost(name, "name");
    try {
      const answers = await resolver.resolve(host, rrtype);
      return { name: host, type: rrtype, answers, ms: Date.now() - started, servers: resolver.getServers() };
    } catch (err) {
      // Fall back to the system resolver (hosts file, mDNS .local names) for A/AAAA.
      if (!server && (rrtype === "A" || rrtype === "AAAA")) {
        const found = await dns.lookup(host, { all: true, family: rrtype === "A" ? 4 : 6 }).catch(() => []);
        if (found.length) return { name: host, type: rrtype, answers: found.map((f) => f.address), ms: Date.now() - started, servers: ["system resolver"] };
      }
      throw err;
    }
  } catch (err) {
    return { name, type: rrtype, answers: [], error: err.code || err.message, ms: Date.now() - started, servers: resolver.getServers() };
  }
}

// ------------------------------------------------------------------ TCP port check
export const COMMON_AV_PORTS = [
  { port: 22, service: "SSH" },
  { port: 23, service: "Telnet / Lutron integration" },
  { port: 80, service: "HTTP" },
  { port: 443, service: "HTTPS" },
  { port: 161, service: "SNMP (UDP — not tested by TCP)" , udp: true },
  { port: 502, service: "Modbus TCP" },
  { port: 554, service: "RTSP (cameras)" },
  { port: 1710, service: "Q-SYS QRC" },
  { port: 3389, service: "RDP" },
  { port: 4998, service: "Global Caché" },
  { port: 5582, service: "DALI-IP" },
  { port: 8080, service: "HTTP alt" },
  { port: 8081, service: "Lutron LEAP" },
  { port: 8083, service: "Lutron LEAP pairing" },
  { port: 41794, service: "Crestron CIP" },
  { port: 41795, service: "Crestron CTP console" },
  { port: 41796, service: "Crestron CIP secure" },
  { port: 49200, service: "Crestron XiO / web" },
];

function tcpProbe(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const sock = net.connect({ host, port });
    let done = false;
    const finish = (state, extra = {}) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({ port, state, ms: Date.now() - started, ...extra });
    };
    sock.setTimeout(timeoutMs, () => finish("filtered"));
    sock.once("connect", () => finish("open"));
    sock.once("error", (err) => finish(err.code === "ECONNREFUSED" ? "closed" : "filtered", { error: err.code }));
  });
}

export async function portCheck({ host, ports, timeoutMs = 1500 }) {
  const target = assertHost(host);
  let list;
  if (!ports || ports === "common") list = COMMON_AV_PORTS.filter((p) => !p.udp).map((p) => p.port);
  else {
    list = [];
    for (const part of String(ports).split(",")) {
      const [a, b] = part.split("-").map((x) => x.trim());
      if (b) {
        const lo = assertPort(a), hi = assertPort(b);
        for (let p = lo; p <= hi && list.length <= 1024; p++) list.push(p);
      } else if (a) list.push(assertPort(a));
    }
  }
  if (list.length > 1024) throw httpError(400, "At most 1024 ports per check");
  const t = clampInt(timeoutMs, 200, 10000, 1500);
  const results = [];
  for (let i = 0; i < list.length; i += 64) {
    results.push(...(await Promise.all(list.slice(i, i + 64).map((p) => tcpProbe(target, p, t)))));
  }
  const names = new Map(COMMON_AV_PORTS.map((p) => [p.port, p.service]));
  return {
    host: target,
    open: results.filter((r) => r.state === "open").map((r) => ({ ...r, service: names.get(r.port) || null })),
    results: results.map((r) => ({ ...r, service: names.get(r.port) || null })),
  };
}

// ------------------------------------------------------------------ nmap
function parseNmapXml(xml) {
  const hosts = [];
  for (const block of xml.split("<host ").slice(1)) {
    const status = (block.match(/<status state="(\w+)"/) || [])[1];
    const ip = (block.match(/<address addr="([^"]+)" addrtype="ipv4"/) || [])[1];
    const macM = block.match(/<address addr="([^"]+)" addrtype="mac"(?: vendor="([^"]*)")?/);
    const hostname = (block.match(/<hostname name="([^"]+)"/) || [])[1] || null;
    const osMatch = (block.match(/<osmatch name="([^"]+)" accuracy="(\d+)"/) || []);
    const ports = [...block.matchAll(/<port protocol="(\w+)" portid="(\d+)">([\s\S]*?)<\/port>/g)].map((m) => {
      const state = (m[3].match(/<state state="(\w+)"/) || [])[1];
      const svc = m[3].match(/<service name="([^"]*)"(?: product="([^"]*)")?(?: version="([^"]*)")?/);
      return { protocol: m[1], port: Number(m[2]), state, service: svc?.[1] || null, product: svc?.[2] || null, version: svc?.[3] || null };
    });
    hosts.push({
      ip,
      status,
      hostname,
      mac: macM?.[1] || null,
      vendor: macM?.[2] || (macM?.[1] ? macVendor(macM[1]) : null),
      os: osMatch[1] ? { name: osMatch[1], accuracy: Number(osMatch[2]) } : null,
      ports: ports.filter((p) => p.state === "open"),
    });
  }
  return hosts;
}

const NMAP_PROFILES = {
  sweep: { label: "Ping sweep (find live hosts)", args: ["-sn"], timeoutMs: 180000 },
  quick: { label: "Quick — top 100 ports", args: ["-T4", "--top-ports", "100", "--open"], timeoutMs: 300000 },
  services: { label: "Services — top 1000 ports + versions", args: ["-T4", "-sV", "--version-light", "--open"], timeoutMs: 900000 },
  av: {
    label: "AV / control ports",
    args: ["-T4", "--open", "-sV", "--version-light", "-p", "22,23,80,443,502,554,1710,4998,5582,8080,8081,8083,41794,41795,41796,49200"],
    timeoutMs: 300000,
  },
};
export const nmapProfiles = Object.fromEntries(Object.entries(NMAP_PROFILES).map(([k, v]) => [k, v.label]));

export async function nmapScan({ target, profile = "quick" }) {
  const t = assertHostOrCidr(target);
  const prof = NMAP_PROFILES[profile] || NMAP_PROFILES.quick;
  if (!(await hasCommand("nmap"))) throw httpError(501, "nmap is not installed (apt install nmap)");
  const args = [...prof.args, "-oX", "-", t];
  // With CAP_NET_RAW (granted by the systemd unit) nmap can do ARP/SYN discovery and see MACs.
  if (process.getuid && process.getuid() !== 0) args.unshift("--privileged");
  let r = await run("nmap", args, { timeoutMs: prof.timeoutMs });
  if (!r.ok && /requires root|Operation not permitted|dnet: Failed/i.test(r.stderr)) {
    r = await run("nmap", args.filter((a) => a !== "--privileged"), { timeoutMs: prof.timeoutMs });
  }
  if (!r.stdout.includes("<nmaprun")) throw httpError(500, (r.stderr || "nmap failed").trim().slice(0, 500));
  const hosts = parseNmapXml(r.stdout).filter((h) => h.status === "up");
  return { target: t, profile, hosts, ms: r.ms };
}

// ------------------------------------------------------------------ ARP / neighbours
export async function arpScan({ subnet, iface }) {
  const args = ["--retry=2", "--timeout=500", "--plain", "--format=${ip}\t${mac}\t${vendor}"];
  if (iface) {
    if (!/^[A-Za-z0-9._-]{1,15}$/.test(iface)) throw httpError(400, "Invalid interface");
    args.push(`--interface=${iface}`);
  }
  args.push(subnet ? assertCidr(subnet, 20) : "--localnet");
  if (!(await hasCommand("arp-scan"))) throw httpError(501, "arp-scan is not installed (apt install arp-scan)");
  const r = await run("arp-scan", args, { timeoutMs: 120000 });
  if (!r.ok && !r.stdout) throw httpError(500, (r.stderr || "arp-scan failed").trim().slice(0, 400));
  const hosts = r.stdout
    .split("\n")
    .map((l) => l.split("\t"))
    .filter((p) => p.length >= 2 && net.isIP(p[0]))
    .map(([ip, mac, vendor]) => ({ ip, mac, vendor: vendor && vendor !== "(Unknown)" ? vendor : macVendor(mac) }));
  return { subnet: subnet || "local", hosts };
}

export async function neighbours() {
  const r = await run("ip", ["-j", "neigh", "show"], { timeoutMs: 5000 });
  let rows = [];
  try {
    rows = JSON.parse(r.stdout || "[]");
  } catch {
    /* ignore */
  }
  return {
    neighbours: rows
      .filter((n) => n.lladdr)
      .map((n) => ({ ip: n.dst, mac: n.lladdr, iface: n.dev, state: (n.state || []).join(","), vendor: macVendor(n.lladdr) })),
  };
}

// ------------------------------------------------------------------ interfaces / routes
function readSys(p) {
  try {
    return fs.readFileSync(p, "utf-8").trim();
  } catch {
    return null;
  }
}

export async function interfaces() {
  const r = await run("ip", ["-j", "addr", "show"], { timeoutMs: 5000 });
  let rows = [];
  try {
    rows = JSON.parse(r.stdout || "[]");
  } catch {
    rows = Object.entries(os.networkInterfaces()).map(([ifname, addrs]) => ({
      ifname,
      address: addrs[0]?.mac,
      operstate: "UNKNOWN",
      addr_info: addrs.map((a) => ({ local: a.address, prefixlen: Number((a.cidr || "/0").split("/")[1]), family: a.family === "IPv4" ? "inet" : "inet6" })),
    }));
  }
  const routes = await run("ip", ["-j", "route", "show"], { timeoutMs: 5000 });
  let routeRows = [];
  try {
    routeRows = JSON.parse(routes.stdout || "[]");
  } catch {
    /* ignore */
  }
  return {
    interfaces: rows.map((i) => {
      const base = `/sys/class/net/${i.ifname}`;
      const speed = Number(readSys(`${base}/speed`));
      return {
        name: i.ifname,
        mac: i.address,
        state: i.operstate,
        mtu: i.mtu,
        speedMbps: Number.isFinite(speed) && speed > 0 ? speed : null,
        duplex: readSys(`${base}/duplex`),
        rxBytes: Number(readSys(`${base}/statistics/rx_bytes`)) || 0,
        txBytes: Number(readSys(`${base}/statistics/tx_bytes`)) || 0,
        rxErrors: Number(readSys(`${base}/statistics/rx_errors`)) || 0,
        txErrors: Number(readSys(`${base}/statistics/tx_errors`)) || 0,
        rxDropped: Number(readSys(`${base}/statistics/rx_dropped`)) || 0,
        addresses: (i.addr_info || []).map((a) => `${a.local}/${a.prefixlen}`),
      };
    }),
    routes: routeRows.map((r) => ({ dst: r.dst, gateway: r.gateway || null, dev: r.dev, metric: r.metric ?? null, src: r.prefsrc || null })),
  };
}

// ------------------------------------------------------------------ LLDP (needs lldpd running)
export async function lldpNeighbours() {
  if (!(await hasCommand("lldpctl"))) throw httpError(501, "lldpd is not installed (apt install lldpd)");
  const r = await run("lldpctl", ["-f", "json"], { timeoutMs: 8000 });
  let json = {};
  try {
    json = JSON.parse(r.stdout || "{}");
  } catch {
    return { neighbours: [], raw: r.stdout + r.stderr };
  }
  const ifaces = json?.lldp?.interface;
  const list = Array.isArray(ifaces) ? ifaces : ifaces ? Object.entries(ifaces).map(([name, v]) => ({ [name]: v })) : [];
  const neighbours = [];
  for (const entry of list) {
    for (const [localPort, v] of Object.entries(entry)) {
      const chassis = v.chassis ? Object.entries(v.chassis)[0] : null;
      const c = chassis?.[1] || {};
      neighbours.push({
        localPort,
        systemName: chassis?.[0] || null,
        description: c.descr || null,
        mgmtIp: Array.isArray(c["mgmt-ip"]) ? c["mgmt-ip"][0] : c["mgmt-ip"] || null,
        remotePort: v.port?.id?.value || null,
        remotePortDescr: v.port?.descr || null,
        vlan: v.vlan?.["vlan-id"] || null,
      });
    }
  }
  return { neighbours };
}

// ------------------------------------------------------------------ mDNS / Bonjour
export async function mdnsBrowse({ seconds = 5 } = {}) {
  if (!(await hasCommand("avahi-browse"))) throw httpError(501, "avahi-utils is not installed (apt install avahi-utils)");
  const s = clampInt(seconds, 2, 20, 5);
  const r = await run("timeout", [String(s), "avahi-browse", "-a", "-r", "-p", "-t"], { timeoutMs: (s + 5) * 1000 });
  const services = [];
  const seen = new Set();
  for (const line of r.stdout.split("\n")) {
    const p = line.split(";");
    if (p[0] !== "=" || p.length < 9) continue;
    const key = `${p[3]}|${p[4]}|${p[7]}|${p[8]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    services.push({ iface: p[1], protocol: p[2], name: p[3].replace(/\\032/g, " "), type: p[4], host: p[6], ip: p[7], port: Number(p[8]), txt: p[9] || "" });
  }
  return { services };
}

// ------------------------------------------------------------------ Wake-on-LAN
export async function wakeOnLan({ mac, broadcast = "255.255.255.255", port = 9 }) {
  const hex = String(mac || "").replace(/[^0-9a-f]/gi, "");
  if (hex.length !== 12) throw httpError(400, "Invalid MAC address");
  const bcast = assertHost(broadcast, "broadcast address");
  const macBuf = Buffer.from(hex, "hex");
  const packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(macBuf)]);
  await new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    sock.once("error", reject);
    sock.bind(() => {
      sock.setBroadcast(true);
      sock.send(packet, 0, packet.length, assertPort(port), bcast, (err) => {
        sock.close();
        err ? reject(err) : resolve();
      });
    });
  });
  return { sent: true, mac: hex.match(/../g).join(":").toUpperCase(), broadcast: bcast };
}

// ------------------------------------------------------------------ iperf3
export async function iperf({ host, seconds = 5, reverse = false, udp = false, bandwidth }) {
  const target = assertHost(host);
  if (!(await hasCommand("iperf3"))) throw httpError(501, "iperf3 is not installed (apt install iperf3)");
  const t = clampInt(seconds, 1, 30, 5);
  const args = ["-c", target, "-t", String(t), "-J", "--connect-timeout", "4000"];
  if (reverse) args.push("-R");
  if (udp) args.push("-u", "-b", /^\d+[KMG]?$/i.test(String(bandwidth || "")) ? String(bandwidth) : "100M");
  const r = await run("iperf3", args, { timeoutMs: (t + 15) * 1000 });
  let json;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    throw httpError(500, (r.stderr || r.stdout || "iperf3 failed").trim().slice(0, 400));
  }
  if (json.error) throw httpError(502, `iperf3: ${json.error} (is "iperf3 -s" running on ${target}?)`);
  const end = json.end || {};
  const sum = end.sum_received || end.sum || {};
  return {
    host: target,
    mbps: sum.bits_per_second ? Math.round(sum.bits_per_second / 1e4) / 100 : null,
    retransmits: end.sum_sent?.retransmits ?? null,
    jitterMs: sum.jitter_ms ?? null,
    lostPct: sum.lost_percent ?? null,
    seconds: t,
    reverse: !!reverse,
    udp: !!udp,
  };
}

// ------------------------------------------------------------------ TLS certificate
export function tlsCertificate({ host, port = 443, timeoutMs = 6000 }) {
  const target = assertHost(host);
  const p = assertPort(port);
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host: target, port: p, servername: net.isIP(target) ? undefined : target, rejectUnauthorized: false, timeout: timeoutMs }, () => {
      const cert = sock.getPeerCertificate();
      const authorized = sock.authorized;
      const authError = sock.authorizationError || null;
      sock.end();
      if (!cert || !cert.valid_to) return reject(httpError(502, "No certificate presented"));
      const expires = new Date(cert.valid_to);
      resolve({
        host: target,
        port: p,
        subject: cert.subject?.CN || null,
        issuer: cert.issuer?.CN || cert.issuer?.O || null,
        validFrom: new Date(cert.valid_from).toISOString(),
        validTo: expires.toISOString(),
        daysLeft: Math.floor((expires.getTime() - Date.now()) / 86400000),
        selfSigned: cert.issuer && cert.subject && JSON.stringify(cert.issuer) === JSON.stringify(cert.subject),
        trusted: authorized,
        trustError: authError,
        fingerprint256: cert.fingerprint256,
      });
    });
    sock.once("timeout", () => {
      sock.destroy();
      reject(httpError(504, "TLS handshake timed out"));
    });
    sock.once("error", (err) => reject(httpError(502, err.message)));
  });
}

// ------------------------------------------------------------------ AV network: PTP + SAP (Dante / AES67)
function macFromClockId(buf) {
  // EUI-64 clock identity: first 3 + last 3 bytes are usually the MAC.
  const b = [...buf];
  if (b[3] === 0xff && b[4] === 0xfe) return [b[0], b[1], b[2], b[5], b[6], b[7]].map((x) => x.toString(16).padStart(2, "0")).join(":");
  return null;
}

function parsePtp(msg) {
  if (msg.length < 34) return null;
  const versionPtp = msg[1] & 0x0f;
  if (versionPtp === 2) {
    const messageType = msg[0] & 0x0f;
    const domain = msg[4];
    const info = { version: 2, domain, messageType };
    if (messageType === 0x0b && msg.length >= 64) {
      const gmId = msg.subarray(53, 61);
      info.announce = {
        priority1: msg[47],
        clockClass: msg[48],
        clockAccuracy: msg[49],
        priority2: msg[52],
        grandmasterId: [...gmId].map((x) => x.toString(16).padStart(2, "0")).join(""),
        grandmasterMac: macFromClockId(gmId),
        stepsRemoved: msg.readUInt16BE(61),
        timeSource: msg[63],
      };
    }
    return info;
  }
  if (msg.readUInt16BE(0) === 1) {
    // PTPv1 (Dante default). Control field at byte 32: 0 = Sync, 1 = Delay_Req, 2 = Follow_Up.
    const subdomain = msg.subarray(4, 20).toString("ascii").replace(/\0+$/, "");
    const uuid = msg.subarray(22, 28);
    return { version: 1, subdomain, control: msg[32], sourceMac: [...uuid].map((x) => x.toString(16).padStart(2, "0")).join(":") };
  }
  return null;
}

function parseSdp(text) {
  const get = (re) => (text.match(re) || [])[1] || null;
  return {
    sessionName: get(/^s=(.*)$/m),
    origin: get(/^o=(.*)$/m),
    connection: get(/^c=IN IP4 ([^/\s]+)/m),
    media: get(/^m=(.*)$/m),
    rtpmap: get(/^a=rtpmap:(.*)$/m),
    ptime: get(/^a=ptime:(.*)$/m),
    clock: get(/^a=ts-refclk:(.*)$/m),
  };
}

/**
 * Listen passively for PTP (UDP 319/320 on 224.0.1.129) and SAP/SDP announcements
 * (UDP 9875 on 239.255.255.255) for a few seconds. Shows which device is the
 * PTP grandmaster/leader, which PTP domains are active and which AES67 streams
 * are being advertised — the first things to check when Dante/AES67 audio drops.
 */
export async function avNetworkScan({ seconds = 8, iface } = {}) {
  const s = clampInt(seconds, 3, 30, 8);
  const localAddr = iface ? Object.values(os.networkInterfaces()[iface] || {}).find((a) => a.family === "IPv4")?.address : undefined;
  const ptp = new Map();
  const announces = new Map();
  const sap = new Map();
  const errors = [];
  const sockets = [];

  function listen(port, group, onMsg) {
    return new Promise((resolve) => {
      const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
      sock.on("error", (err) => {
        errors.push(`UDP ${port}: ${err.code === "EACCES" ? "permission denied (needs CAP_NET_BIND_SERVICE)" : err.message}`);
        resolve();
      });
      sock.on("message", onMsg);
      sock.bind(port, () => {
        try {
          sock.addMembership(group, localAddr);
        } catch (err) {
          errors.push(`join ${group}: ${err.message}`);
        }
        sockets.push(sock);
        resolve();
      });
    });
  }

  const onPtp = (msg, rinfo) => {
    const info = parsePtp(msg);
    if (!info) return;
    const key = `${rinfo.address}|v${info.version}|${info.domain ?? info.subdomain}`;
    const prev = ptp.get(key) || { ip: rinfo.address, version: info.version, domain: info.domain ?? null, subdomain: info.subdomain ?? null, packets: 0, sourceMac: info.sourceMac || null };
    prev.packets++;
    if (info.version === 1 && info.control === 0) prev.sendsSync = true;
    if (info.version === 2 && info.messageType === 0) prev.sendsSync = true;
    ptp.set(key, prev);
    if (info.announce) announces.set(`${rinfo.address}|${info.domain}`, { ip: rinfo.address, domain: info.domain, ...info.announce });
  };
  await listen(319, "224.0.1.129", onPtp);
  await listen(320, "224.0.1.129", onPtp);
  await listen(9875, "239.255.255.255", (msg, rinfo) => {
    // SAP header: flags(1) authLen(1) msgIdHash(2) origin(4) [payload type] \0 SDP
    const authLen = msg[1] * 4;
    let off = 8 + authLen;
    const rest = msg.subarray(off).toString("utf-8");
    const sdpStart = rest.indexOf("v=0");
    if (sdpStart < 0) return;
    const sdp = parseSdp(rest.slice(sdpStart));
    const deletion = (msg[0] & 0x04) !== 0;
    sap.set(`${rinfo.address}|${sdp.sessionName}`, { source: rinfo.address, deletion, ...sdp });
  });

  await new Promise((r) => setTimeout(r, s * 1000));
  sockets.forEach((sock) => {
    try {
      sock.close();
    } catch {
      /* ignore */
    }
  });

  const leaders = [...ptp.values()].filter((p) => p.sendsSync);
  const findings = [];
  const v1Leaders = leaders.filter((l) => l.version === 1);
  if (v1Leaders.length > 1) findings.push({ severity: "warning", message: `${v1Leaders.length} devices are sending PTPv1 Sync — Dante expects one leader per network/VLAN.` });
  const domains = new Set([...announces.values()].map((a) => a.domain));
  if (domains.size > 1) findings.push({ severity: "info", message: `Multiple PTPv2 domains seen (${[...domains].join(", ")}). AES67 devices must share the same domain.` });
  if (!ptp.size) findings.push({ severity: "info", message: "No PTP traffic seen. Either no Dante/AES67 devices are on this VLAN, or IGMP snooping is filtering 224.0.1.129 from this port." });

  return {
    seconds: s,
    ptp: [...ptp.values()].sort((a, b) => b.packets - a.packets).map((p) => ({ ...p, vendor: p.sourceMac ? macVendor(p.sourceMac) : null })),
    grandmasters: [...announces.values()].map((a) => ({ ...a, vendor: a.grandmasterMac ? macVendor(a.grandmasterMac) : null })),
    streams: [...sap.values()],
    findings,
    errors,
  };
}

/** Multicast groups this host has joined, per interface (from `ip maddr`). */
export async function multicastGroups() {
  const r = await run("ip", ["maddr", "show"], { timeoutMs: 5000 });
  const groups = [];
  let iface = null;
  for (const line of r.stdout.split("\n")) {
    const m = line.match(/^\d+:\s+(\S+)/);
    if (m) iface = m[1];
    const g = line.match(/inet6?\s+(\S+)/);
    if (g && iface) groups.push({ iface, group: g[1] });
  }
  return { groups };
}

// ------------------------------------------------------------------ tool inventory
export const TOOL_BINARIES = [
  { cmd: "ping", pkg: "iputils-ping" },
  { cmd: "traceroute", pkg: "traceroute" },
  { cmd: "mtr", pkg: "mtr-tiny" },
  { cmd: "nmap", pkg: "nmap" },
  { cmd: "arp-scan", pkg: "arp-scan" },
  { cmd: "snmpwalk", pkg: "snmp" },
  { cmd: "tshark", pkg: "tshark" },
  { cmd: "lldpctl", pkg: "lldpd" },
  { cmd: "avahi-browse", pkg: "avahi-utils" },
  { cmd: "iperf3", pkg: "iperf3" },
  { cmd: "dig", pkg: "dnsutils" },
  { cmd: "ethtool", pkg: "ethtool" },
  { cmd: "tcpdump", pkg: "tcpdump" },
];

export async function toolInventory() {
  return Promise.all(TOOL_BINARIES.map(async (t) => ({ ...t, installed: await hasCommand(t.cmd) })));
}
