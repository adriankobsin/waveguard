import net from "net";
import dns from "dns/promises";

export const COMMON_PORTS = [22, 80, 443, 161, 554, 502, 1702, 3671, 5000, 37777, 41794];

export function probeTcpPort(ip, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, ip);
  });
}

export async function probePorts(ip, ports = COMMON_PORTS, timeoutMs = 800) {
  const list = Array.isArray(ports) && ports.length ? ports : COMMON_PORTS;
  const open = [];
  await Promise.all(
    list.map(async (port) => {
      if (await probeTcpPort(ip, port, timeoutMs)) open.push(port);
    })
  );
  return open.sort((a, b) => a - b);
}

export async function reverseHostname(ip) {
  try {
    const names = await dns.reverse(ip);
    return names[0] || "";
  } catch {
    return "";
  }
}
