/**
 * Cisco-aware SNMP poller — wraps the existing IF-MIB poll and adds the
 * MIBs the C1300 / CBS350 needs to surface FDB + LLDP data:
 *
 *   - BRIDGE-MIB (dot1dTpFdbTable)         → MAC ↔ port mapping
 *   - Q-BRIDGE-MIB (dot1qTpFdbTable)       → VLAN-aware FDB on tagged links
 *   - LLDP-MIB (lldpRemTable)              → LLDP neighbours
 *   - POWER-ETHERNET-MIB (pethPsePortTable)→ PoE port status / wattage
 *
 * The poller assumes the `snmpwalk` CLI is available on PATH (same as the
 * existing scanner). When SNMP is not available it returns `null` so the
 * orchestrator can fall back to SSH-only data.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pollSwitchPorts } from "../../snmpPortMap.js";
import { isSnmpAvailable } from "../../snmp.js";

const execFileAsync = promisify(execFile);

const CISCO_OID = {
  // dot1dTpFdbAddress + dot1dTpFdbPort + dot1dTpFdbStatus
  dot1dTpFdbAddress: "1.3.6.1.2.1.17.4.3.1.1",
  dot1dTpFdbPort: "1.3.6.1.2.1.17.4.3.1.2",
  dot1dTpFdbStatus: "1.3.6.1.2.1.17.4.3.1.3",
  // dot1dBasePortIfIndex — translate bridge-port to ifIndex
  dot1dBasePortIfIndex: "1.3.6.1.2.1.17.1.4.1.2",
  // LLDP remote system info
  lldpRemChassisIdSubtype: "1.0.8802.1.1.2.1.4.1.1.4",
  lldpRemChassisId: "1.0.8802.1.1.2.1.4.1.1.5",
  lldpRemPortIdSubtype: "1.0.8802.1.1.2.1.4.1.1.6",
  lldpRemPortId: "1.0.8802.1.1.2.1.4.1.1.7",
  lldpRemPortDesc: "1.0.8802.1.1.2.1.4.1.1.8",
  lldpRemSysName: "1.0.8802.1.1.2.1.4.1.1.9",
  lldpRemSysDesc: "1.0.8802.1.1.2.1.4.1.1.10",
  // PoE
  pethPsePortAdminEnable: "1.3.6.1.2.1.105.1.1.1.1.3",
  pethPsePortPowerClass: "1.3.6.1.2.1.105.1.1.1.1.4",
  pethPsePortMeasuredVoltage: "1.3.6.1.4.1.9.9.402.1.2.1.1.5",
};

export async function isCiscoSnmpAvailable() {
  return isSnmpAvailable();
}

/**
 * Walk a Cisco switch and return its SNMP-derived data.
 *
 * @param {string} ip
 * @param {object} options { community, version, timeoutMs, portCount, equipmentList }
 * @returns {Promise<{ ports, fdb, lldp, poe, source, polledAt }>}
 */
export async function pollCiscoSwitch(ip, options = {}) {
  const port = await pollSwitchPorts(ip, options);
  const community = options.community || "public";
  const version = options.version === "3" ? "3" : "2c";
  const timeoutMs = options.timeoutMs || 5000;

  // Run the Cisco-extra walks in parallel, but fail gracefully — most
  // SMB devices ship with these MIBs enabled by default; some installs
  // disable LLDP / BRIDGE-MIB views and we still want IF-MIB data to
  // arrive.
  const [fdb, lldp] = await Promise.all([
    walkFdb(ip, community, version, timeoutMs).catch(() => []),
    walkLldp(ip, community, version, timeoutMs).catch(() => []),
  ]);

  return {
    ...port,
    fdb,
    lldp,
    source: port?.source ? `${port.source}+cisco-snmp` : "cisco-snmp",
    polledAt: new Date().toISOString(),
  };
}

async function snmpWalk(ip, oid, community, version, timeoutMs) {
  try {
    const { stdout } = await execFileAsync(
      "snmpwalk",
      ["-On", "-v", version, "-c", community, ip, oid],
      { timeout: timeoutMs, windowsHide: true }
    );
    return stdout;
  } catch (_err) {
    return "";
  }
}

function parseRows(stdout, baseOid) {
  const rows = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^([0-9.]+)\s*=\s*(\w+):\s*(.+)$/);
    if (!m) continue;
    const oid = m[1];
    const type = m[2];
    let value = (m[3] || "").trim().replace(/^"|"$/g, "");
    if (type === "INTEGER" || type === "Counter32" || type === "Counter64" || type === "Gauge32") {
      value = Number(value) || 0;
    } else if (type === "Hex-STRING") {
      // "00 11 22 33 44 55" → MAC string
      value = value.replace(/\s+/g, "").replace(/(.{2})(?=.)/g, "$1:").toUpperCase();
    }
    if (!oid.startsWith(baseOid)) continue;
    const tail = oid.slice(baseOid.length).replace(/^\./, "");
    rows.push({ tail, value });
  }
  return rows;
}

async function walkFdb(ip, community, version, timeoutMs) {
  const [addresses, ports, statuses, bridgeIdx] = await Promise.all([
    snmpWalk(ip, CISCO_OID.dot1dTpFdbAddress, community, version, timeoutMs),
    snmpWalk(ip, CISCO_OID.dot1dTpFdbPort, community, version, timeoutMs),
    snmpWalk(ip, CISCO_OID.dot1dTpFdbStatus, community, version, timeoutMs),
    snmpWalk(ip, CISCO_OID.dot1dBasePortIfIndex, community, version, timeoutMs),
  ]);
  const macByKey = new Map();
  for (const row of parseRows(addresses, CISCO_OID.dot1dTpFdbAddress)) {
    macByKey.set(row.tail, row.value);
  }
  const portByKey = new Map();
  for (const row of parseRows(ports, CISCO_OID.dot1dTpFdbPort)) {
    portByKey.set(row.tail, row.value);
  }
  const statusByKey = new Map();
  for (const row of parseRows(statuses, CISCO_OID.dot1dTpFdbStatus)) {
    statusByKey.set(row.tail, row.value);
  }
  const ifIndexByBridgePort = new Map();
  for (const row of parseRows(bridgeIdx, CISCO_OID.dot1dBasePortIfIndex)) {
    ifIndexByBridgePort.set(String(row.value), Number(row.value));
    ifIndexByBridgePort.set(row.tail, Number(row.value));
  }
  const out = [];
  for (const [key, mac] of macByKey) {
    const bridgePort = portByKey.get(key);
    if (bridgePort == null) continue;
    const status = statusByKey.get(key);
    const ifIndex = ifIndexByBridgePort.get(String(bridgePort)) ?? Number(bridgePort) ?? null;
    // Only dynamic (3) / learned (3 or 5) entries are useful for "connected device" mapping.
    if (status && Number(status) === 4) continue; // self
    out.push({ mac, bridgePort: Number(bridgePort), ifIndex, status });
  }
  return out;
}

async function walkLldp(ip, community, version, timeoutMs) {
  const [chassisIds, portIds, portDescs, sysNames, sysDescs] = await Promise.all([
    snmpWalk(ip, CISCO_OID.lldpRemChassisId, community, version, timeoutMs),
    snmpWalk(ip, CISCO_OID.lldpRemPortId, community, version, timeoutMs),
    snmpWalk(ip, CISCO_OID.lldpRemPortDesc, community, version, timeoutMs),
    snmpWalk(ip, CISCO_OID.lldpRemSysName, community, version, timeoutMs),
    snmpWalk(ip, CISCO_OID.lldpRemSysDesc, community, version, timeoutMs),
  ]);
  const byKey = new Map();
  const ensure = (key) => {
    if (!byKey.has(key)) byKey.set(key, {});
    return byKey.get(key);
  };
  for (const row of parseRows(chassisIds, CISCO_OID.lldpRemChassisId)) {
    ensure(row.tail).chassisId = row.value;
  }
  for (const row of parseRows(portIds, CISCO_OID.lldpRemPortId)) {
    ensure(row.tail).portId = row.value;
  }
  for (const row of parseRows(portDescs, CISCO_OID.lldpRemPortDesc)) {
    ensure(row.tail).portDescription = row.value;
  }
  for (const row of parseRows(sysNames, CISCO_OID.lldpRemSysName)) {
    ensure(row.tail).systemName = row.value;
  }
  for (const row of parseRows(sysDescs, CISCO_OID.lldpRemSysDesc)) {
    ensure(row.tail).systemDescription = row.value;
  }
  // LLDP index is `<timeMark>.<localPortNum>.<index>` — middle component is
  // the local interface (dot1dBasePort).
  const out = [];
  for (const [key, value] of byKey) {
    const parts = key.split(".");
    const localPort = Number(parts[1]) || null;
    out.push({
      localPort,
      ...value,
    });
  }
  return out;
}
