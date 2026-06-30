/**
 * Wireshark/tshark integration for live capture and pcap analysis.
 * @see https://www.wireshark.org/docs/man-pages/tshark.html
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import {
  mockWiresharkAnalyze,
  mockWiresharkCapture,
  mockWiresharkStats,
  mockWiresharkStatus,
} from "./wiresharkMockEngine.js";

const DEFAULT_WIN_TSHARK = "C:\\Program Files\\Wireshark\\tshark.exe";
const MAX_DURATION_SEC = 60;
const MAX_PACKETS = 500;
const DEFAULT_TIMEOUT_MS = 120000;

let cachedAvailability = null;

export function getTsharkPath() {
  if (process.env.WIRESHARK_TSHARK_PATH) {
    return process.env.WIRESHARK_TSHARK_PATH;
  }
  if (process.platform === "win32") {
    return DEFAULT_WIN_TSHARK;
  }
  return "tshark";
}

function clampDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(Math.round(n), MAX_DURATION_SEC);
}

function clampMaxPackets(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return 100;
  return Math.min(Math.round(v), MAX_PACKETS);
}

function runTshark(args, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const bin = getTsharkPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("tshark timed out"));
    }, timeoutMs);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(new Error("tshark not found — install Wireshark or set WIRESHARK_TSHARK_PATH"));
      } else {
        reject(err);
      }
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function parseInterfaceList(text) {
  const interfaces = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\d+)\.\s+(.+)$/);
    if (m) {
      interfaces.push({
        index: Number(m[1]),
        name: m[2].trim(),
        label: line.trim(),
      });
    }
  }
  return interfaces;
}

function layerValue(layers, key) {
  const node = layers?.[key];
  if (!node) return null;
  if (Array.isArray(node)) return node[0] ?? null;
  return node;
}

function normalizePacket(entry, index) {
  const layers = entry?._source?.layers ?? entry?.layers ?? {};
  const frame = layerValue(layers, "frame") ?? {};
  const ip = layerValue(layers, "ip") ?? layerValue(layers, "ipv6") ?? {};
  const eth = layerValue(layers, "eth") ?? {};
  const tcp = layerValue(layers, "tcp");
  const udp = layerValue(layers, "udp");
  const icmp = layerValue(layers, "icmp") ?? layerValue(layers, "icmpv6");

  let protocol = "OTHER";
  if (tcp) protocol = "TCP";
  else if (udp) protocol = "UDP";
  else if (icmp) protocol = "ICMP";
  else if (layerValue(layers, "dns")) protocol = "DNS";
  else if (layerValue(layers, "arp")) protocol = "ARP";

  const num = Number(frame["frame.number"]?.[0] ?? frame["frame.number"] ?? index + 1);
  const timeRaw = frame["frame.time"]?.[0] ?? frame["frame.time"] ?? frame["frame.time_epoch"]?.[0];
  const len = Number(frame["frame.len"]?.[0] ?? frame["frame.len"] ?? 0);
  const src =
    ip["ip.src"]?.[0] ??
    ip["ip.src"] ??
    eth["eth.src"]?.[0] ??
    eth["eth.src"] ??
    "—";
  const dst =
    ip["ip.dst"]?.[0] ??
    ip["ip.dst"] ??
    eth["eth.dst"]?.[0] ??
    eth["eth.dst"] ??
    "—";

  let info = frame["frame.info"]?.[0] ?? frame["frame.info"] ?? "";
  if (!info && tcp) {
    const sport = tcp["tcp.srcport"]?.[0] ?? tcp["tcp.srcport"];
    const dport = tcp["tcp.dstport"]?.[0] ?? tcp["tcp.dstport"];
    info = `${sport} → ${dport}`;
  }

  return {
    num,
    time: timeRaw || null,
    src,
    dst,
    protocol,
    length: len,
    info: String(info || protocol),
    raw: layers,
  };
}

function parseTsharkJson(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    const data = JSON.parse(trimmed);
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((entry, i) => normalizePacket(entry, i));
  } catch {
    return [];
  }
}

function parseStatsTable(text, skipHeaderLines = 1) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  for (let i = skipHeaderLines; i < lines.length; i++) {
    const parts = lines[i].split(/\s{2,}|\t/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) rows.push(parts);
  }
  return rows;
}

function parseProtocolHierarchy(text) {
  return parseStatsTable(text, 4).map((row) => ({
    protocol: row[0],
    frames: Number(row[1]) || 0,
    bytes: Number(row[2]) || 0,
  }));
}

function parseConversations(text) {
  return parseStatsTable(text, 5).map((row) => ({
    addrA: row[0],
    addrB: row[1],
    frames: Number(row[2]) || 0,
    bytes: Number(row[3]) || 0,
    protocol: row[4] || "TCP",
  }));
}

function parseEndpoints(text) {
  return parseStatsTable(text, 3).map((row) => ({
    address: row[0],
    frames: Number(row[1]) || 0,
    bytes: Number(row[2]) || 0,
  }));
}

export async function isAvailable() {
  if (cachedAvailability) return cachedAvailability;
  try {
    const { code, stdout, stderr } = await runTshark(["-v"], { timeoutMs: 8000 });
    if (code !== 0 && !stdout && !stderr) {
      cachedAvailability = { available: false, version: null, npcapHint: null };
      return cachedAvailability;
    }
    const versionMatch = (stdout + stderr).match(/TShark \(Wireshark\) ([^\s]+)/i);
    cachedAvailability = {
      available: true,
      version: versionMatch?.[1] || "unknown",
      npcapHint:
        process.platform === "win32"
          ? "Live capture requires Npcap and may need elevated permissions."
          : "Live capture may require root/cap_net_raw on Linux.",
    };
    return cachedAvailability;
  } catch (err) {
    cachedAvailability = {
      available: false,
      version: null,
      npcapHint: err.message,
    };
    return cachedAvailability;
  }
}

export async function listInterfaces() {
  const avail = await isAvailable();
  if (!avail.available) return [];
  const { stdout } = await runTshark(["-D"], { timeoutMs: 15000 });
  return parseInterfaceList(stdout);
}

export async function getWiresharkStatus() {
  const avail = await isAvailable();
  if (!avail.available) {
    return mockWiresharkStatus();
  }
  const interfaces = await listInterfaces();
  return {
    success: true,
    available: true,
    mock: false,
    version: avail.version,
    npcapHint: avail.npcapHint,
    interfaces,
    source: "live",
  };
}

export async function capturePackets({
  interface: iface,
  durationSec = 10,
  bpfFilter = "",
  hostIp = "",
  maxPackets = 100,
  capturePath = null,
} = {}) {
  const duration = clampDuration(durationSec);
  const limit = clampMaxPackets(maxPackets);
  let filter = String(bpfFilter || "").trim();
  if (hostIp && !filter) filter = `host ${hostIp}`;

  const avail = await isAvailable();
  if (!avail.available) {
    return mockWiresharkCapture({ hostIp, durationSec: duration, interface: iface });
  }

  if (!iface) {
    return { success: false, error: "Network interface is required for live capture" };
  }

  const args = ["-i", String(iface), "-a", `duration:${duration}`, "-q"];
  if (filter) args.push("-f", filter);
  if (capturePath) {
    args.push("-w", capturePath);
  } else {
    args.push("-T", "json", "-c", String(limit));
  }

  const { code, stdout, stderr } = await runTshark(args, {
    timeoutMs: (duration + 15) * 1000,
  });

  if (code !== 0 && !stdout && !capturePath) {
    return {
      success: false,
      error: stderr.trim() || "Capture failed",
      hint: avail.npcapHint,
    };
  }

  let packets = [];
  let stats = null;

  if (capturePath && fs.existsSync(capturePath)) {
    const analyzed = await analyzeCapture({ filePath: capturePath, maxPackets: limit });
    packets = analyzed.packets || [];
    stats = analyzed.stats || null;
  } else {
    packets = parseTsharkJson(stdout);
  }

  if (!stats && capturePath) {
    stats = await captureStats({ filePath: capturePath });
  }

  return {
    success: true,
    interface: iface,
    durationSec: duration,
    hostIp: hostIp || null,
    bpfFilter: filter || null,
    packetCount: packets.length,
    packets,
    stats,
    source: "live",
    capturedAt: new Date().toISOString(),
  };
}

export async function analyzeCapture({
  filePath,
  displayFilter = "",
  maxPackets = 100,
} = {}) {
  const limit = clampMaxPackets(maxPackets);
  const avail = await isAvailable();

  if (!filePath || !fs.existsSync(filePath)) {
    if (!avail.available) {
      return mockWiresharkAnalyze({ displayFilter });
    }
    return { success: false, error: "Capture file not found" };
  }

  if (!avail.available) {
    return mockWiresharkAnalyze({ displayFilter });
  }

  const args = ["-r", filePath, "-T", "json", "-c", String(limit)];
  const filter = String(displayFilter || "").trim();
  if (filter) args.push("-Y", filter);

  const { code, stdout, stderr } = await runTshark(args, { timeoutMs: 60000 });
  if (code !== 0 && !stdout) {
    return { success: false, error: stderr.trim() || "Analysis failed" };
  }

  const packets = parseTsharkJson(stdout);
  const stats = await captureStats({ filePath });

  return {
    success: true,
    displayFilter: filter || null,
    packetCount: packets.length,
    packets,
    stats,
    source: "live",
    analyzedAt: new Date().toISOString(),
  };
}

export async function captureStats({ filePath } = {}) {
  const avail = await isAvailable();
  if (!filePath || !fs.existsSync(filePath)) {
    if (!avail.available) return mockWiresharkStats();
    return { success: false, error: "Capture file not found" };
  }
  if (!avail.available) return mockWiresharkStats();

  const [phs, conv, endpoints] = await Promise.all([
    runTshark(["-r", filePath, "-qz", "io,phs,0"], { timeoutMs: 45000 }),
    runTshark(["-r", filePath, "-qz", "conv,tcp,0"], { timeoutMs: 45000 }),
    runTshark(["-r", filePath, "-qz", "endpoints,ip"], { timeoutMs: 45000 }),
  ]);

  return {
    success: true,
    protocolHierarchy: parseProtocolHierarchy(phs.stdout),
    conversations: parseConversations(conv.stdout),
    endpoints: parseEndpoints(endpoints.stdout),
    source: "live",
  };
}

export async function checkDisplayFilter(filter, filePath) {
  const f = String(filter || "").trim();
  if (!f) return { valid: true };
  const avail = await isAvailable();
  if (!avail.available) return { valid: true, mock: true };

  const args = ["-r", filePath, "-Y", f, "-c", "0", "-T", "json"];
  const { stderr, code } = await runTshark(args, { timeoutMs: 15000 });
  if (/syntax error|invalid/i.test(stderr)) {
    return { valid: false, error: stderr.trim() };
  }
  return { valid: code === 0 || !stderr.includes("error") };
}

export function writeTempUpload(base64, captureStore) {
  const captureId = captureStore.newCaptureId();
  const filePath = captureStore.writeFromBase64(captureId, base64);
  return { captureId, filePath };
}
