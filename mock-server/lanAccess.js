import os from "os";

/** RFC1918, loopback, link-local, and .local names used on vessel VLANs. */
export function isVesselHostname(hostname) {
  if (!hostname) return false;
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "0.0.0.0" || host === "::" || host === "::1") return true;
  if (host.endsWith(".local")) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return false;
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  return false;
}

/** Every non-loopback IPv4 on this host (one entry per VLAN interface). */
export function listLanIPv4Addresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" && entry.family !== 4) continue;
      if (entry.internal) continue;
      addresses.push({
        address: entry.address,
        cidr: entry.cidr || "",
        netmask: entry.netmask || "",
      });
    }
  }
  const seen = new Set();
  return addresses.filter((row) => {
    if (seen.has(row.address)) return false;
    seen.add(row.address);
    return true;
  });
}

export function buildPublicOrigin(req, fallbackPort) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
  if (hostHeader) return `${proto}://${hostHeader}`;
  return `http://127.0.0.1:${fallbackPort}`;
}

export function formatLanAccessBanner({ host, port }) {
  const ips = listLanIPv4Addresses();
  const lines = [
    `[waveguard] Listening on ${host}:${port} (every IPv4 interface / VLAN on this host)`,
    `[waveguard] Local:   http://127.0.0.1:${port}`,
  ];
  if (ips.length === 0) {
    lines.push("[waveguard] VLAN:    no non-loopback IPv4 yet");
  } else {
    for (const row of ips) {
      lines.push(`[waveguard] VLAN:    http://${row.address}:${port}  ${row.cidr || ""}`.trimEnd());
    }
  }
  lines.push("[waveguard] Other VLANs reach this host by routing to one of the addresses above. The app does not filter clients by source VLAN.");
  return lines.join("\n");
}
