import os from "os";

const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/(\d{1,2})$/;

function ipToInt(ip) {
  return ip.split(".").reduce((n, o) => (n << 8) + parseInt(o, 10), 0) >>> 0;
}

function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function isValidCidr(cidr) {
  if (!CIDR_RE.test(cidr)) return false;
  const [ip, bits] = cidr.split("/");
  const b = parseInt(bits, 10);
  if (b < 8 || b > 30) return false;
  const octets = ip.split(".").map(Number);
  return octets.every((o) => o >= 0 && o <= 255);
}

/** Normalize to network address CIDR (e.g. 192.168.1.5/24 → 192.168.1.0/24). */
export function normalizeCidr(cidr) {
  if (!isValidCidr(cidr)) return null;
  const [ip, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  const network = intToIp(ipToInt(ip) & mask);
  return `${network}/${bits}`;
}

/** Expand IPv4 CIDR to host addresses (excludes network and broadcast for /24+). */
export function expandCidr(cidr, maxHosts = 512) {
  if (!isValidCidr(cidr)) return [];
  const [base, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  const baseInt = ipToInt(base) & mask;
  const hostCount = Math.min(2 ** (32 - bits) - (bits < 31 ? 2 : 0), maxHosts);
  const ips = [];
  const start = bits < 31 ? 1 : 0;
  const end = bits < 31 ? hostCount + 1 : hostCount;
  for (let i = start; i < end && ips.length < maxHosts; i++) {
    ips.push(intToIp((baseInt + i) >>> 0));
  }
  return ips;
}

function isIPv4(addr) {
  return addr.family === "IPv4" || addr.family === 4;
}

export function detectLocalSubnets() {
  const cidrs = new Set();
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const addr of ifaces[name] || []) {
      if (!isIPv4(addr) || addr.internal) continue;
      const parts = addr.address.split(".").map(Number);
      if (parts[0] === 127) continue;
      const guessed = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      const normalized = addr.cidr ? normalizeCidr(addr.cidr) : null;
      cidrs.add(normalized || guessed);
    }
  }
  return [...cidrs];
}

export function getScanInterfaceLabel() {
  const ifaces = os.networkInterfaces();
  const parts = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    const v4 = (addrs || []).find((a) => isIPv4(a) && !a.internal);
    if (v4) parts.push(`${name} (${v4.address})`);
  }
  return parts[0] || "local";
}
