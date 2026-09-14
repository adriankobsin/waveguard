import os from "os";

/** True for RFC1918 / link-local / loopback hosts used on vessel LANs. */
export function isPrivateOrLocalHostname(hostname) {
  if (!hostname) return false;
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "0.0.0.0" || host === "::" || host === "::1") return true;
  if (host.endsWith(".local")) return true;
  if (host === "127.0.0.1") return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  // IPv6 unique-local / link-local
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  return false;
}

/** Non-internal IPv4 addresses on this host (AV trunk / management NICs). */
export function listLanIPv4Addresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" && entry.family !== 4) continue;
      if (entry.internal) continue;
      addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

export function buildPublicOrigin(req, fallbackPort) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").toString().split(",")[0].trim();
  const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
  if (hostHeader) return `${proto}://${hostHeader}`;
  return `http://127.0.0.1:${fallbackPort}`;
}

export function formatLanAccessBanner({ host, port, uiMounted }) {
  const ips = listLanIPv4Addresses();
  const lines = [
    `[waveguard] Listening on ${host}:${port}`,
    `[waveguard] Local:   http://127.0.0.1:${port}`,
  ];
  if (ips.length === 0) {
    lines.push("[waveguard] LAN:     (no non-loopback IPv4 found — connect the host to the AV trunk and restart)");
  } else {
    for (const ip of ips) {
      lines.push(`[waveguard] LAN:     http://${ip}:${port}`);
    }
  }
  if (uiMounted) {
    lines.push("[waveguard] Web UI is served from this process — open any LAN URL above from phones, tablets, or PCs on the AV network.");
  } else {
    lines.push("[waveguard] API only (no dist/). Run `npm run build` then `npm run ship` to serve the web platform.");
  }
  return lines.join("\n");
}
