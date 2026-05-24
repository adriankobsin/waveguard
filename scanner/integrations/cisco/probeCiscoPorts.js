/**
 * TCP port probes for a Cisco SMB switch (C1300 / CBS350 / SG350).
 *
 * Probes the canonical management ports and produces a recommendation
 * string so the connection modal can tell the operator exactly what to
 * enable on the switch when something is missing.
 */

import net from "node:net";

const PROBE_TIMEOUT_MS = 1500;

const PORTS = [
  { port: 22, role: "ssh", label: "SSH" },
  { port: 161, role: "snmp", label: "SNMP" },
  { port: 443, role: "https", label: "Web GUI (HTTPS)" },
  { port: 80, role: "http", label: "Web GUI (HTTP)" },
];

function probeTcp(host, port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (open, error) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { /* */ }
      resolve({ host, port, open, error: error?.message || null });
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

export async function probeCiscoPorts(host) {
  const results = await Promise.all(PORTS.map((p) => probeTcp(host, p.port)));
  return PORTS.map((p, idx) => ({
    ...p,
    open: results[idx].open,
    error: results[idx].error,
  }));
}

export function recommendationFromPorts(ports) {
  const byRole = Object.fromEntries(ports.map((p) => [p.role, p]));
  if (byRole.ssh?.open && byRole.snmp?.open) {
    return null; // best case
  }
  if (byRole.ssh?.open && !byRole.snmp?.open) {
    return "SSH is reachable but SNMP (port 161) is closed. WaveGuard works without it but live port-counter polling will be limited. Enable SNMP v2c read-only access under Administration → SNMP → Communities on the switch.";
  }
  if (!byRole.ssh?.open && byRole.snmp?.open) {
    return "SNMP is reachable but SSH (port 22) is closed. Enable SSH under Security → TCP/UDP Services and add an SSH user under Administration → User Accounts.";
  }
  if (!byRole.ssh?.open && !byRole.snmp?.open && byRole.https?.open) {
    return "Only the web GUI is reachable. Enable SSH (port 22) and SNMP (port 161) under Security → TCP/UDP Services so WaveGuard can fetch live switch data.";
  }
  return "Cannot reach the switch on any management port. Verify the IP address is correct and the switch is powered on. Check that no firewall is blocking traffic between WaveGuard and the switch.";
}
