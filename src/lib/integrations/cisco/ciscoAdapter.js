/**
 * Cisco poll adapter — normalises the SSH/SNMP snapshot produced by
 * `scanner/integrations/cisco/ciscoSwitchClient.js` into the same
 * `ports[]` shape the Core Network fleet already consumes.
 *
 * Used in two places:
 *   1. `pollProfileAndSave` in `mock-server/server.js` — when a managed
 *      switch profile has `pollMethod: "cisco_ssh"`, we merge the Cisco
 *      snapshot over the generic SNMP poll so the existing UI just works.
 *   2. The Cisco Switches page — to render the per-switch interface table
 *      directly from the snapshot returned by `pollCiscoSwitch()`.
 */

import { matchCiscoDevice } from "./ciscoDeviceCatalog.js";

/**
 * @typedef {object} CiscoSnapshot
 * @property {object} system
 * @property {Array<object>} interfaces
 * @property {Array<object>} macs
 * @property {{ lldp: Array<object>, cdp: Array<object> }} neighbors
 * @property {string} polledAt
 */

/** Build a connected-device label from MAC table + LLDP/CDP entries. */
function resolveConnectedDevice(port, snapshot) {
  if (!snapshot) return { name: null, mac: null };
  const ifName = port.name?.toLowerCase();
  const ifIndex = port.index;

  // 1. Try LLDP (highest confidence — vendor publishes its hostname).
  const lldp = snapshot.neighbors?.lldp || [];
  const lldpHit = lldp.find((n) => {
    const np = (n.port || "").toLowerCase();
    return np === ifName || np === `gi1/0/${ifIndex}` || np === `te1/0/${ifIndex}`;
  });
  if (lldpHit?.systemName) {
    // Use chassisId as MAC where possible (most LLDP implementations send
    // the device MAC as the chassis identifier).
    return { name: lldpHit.systemName, mac: lldpHit.chassisId || null };
  }

  // 2. Try CDP next.
  const cdp = snapshot.neighbors?.cdp || [];
  const cdpHit = cdp.find((n) => {
    const np = (n.port || "").toLowerCase();
    return np === ifName || np === `gi1/0/${ifIndex}` || np === `te1/0/${ifIndex}`;
  });
  if (cdpHit?.deviceId) {
    return { name: cdpHit.deviceId, mac: null };
  }

  // 3. Fall back to MAC table — if exactly one entry is bound to this port,
  // we don't have a name but we DO have the MAC, which lets the existing
  // `resolveConnectedEquipment` selector cross-reference Equipment.
  const macs = (snapshot.macs || []).filter((m) => {
    const mp = (m.port || "").toLowerCase();
    return mp === ifName;
  });
  if (macs.length === 1) {
    return { name: null, mac: macs[0].mac };
  }
  if (macs.length > 1) {
    return { name: `${macs.length} devices`, mac: null };
  }
  return { name: null, mac: null };
}

/**
 * Normalise the Cisco snapshot into the shape `pollSwitchPorts` returns.
 * Caller can merge the result over a generic SNMP poll via
 * `mergeCiscoIntoPoll`.
 */
export function normalizeCiscoPoll(snapshot, equipment = null) {
  if (!snapshot) return null;
  const sys = snapshot.system || {};
  const interfaces = snapshot.interfaces || [];

  const ports = interfaces.map((p) => {
    const cd = resolveConnectedDevice(p, snapshot);
    return {
      index: p.index,
      ifDescr: p.name,
      ifAlias: p.ifAlias || "",
      name: p.name,
      status: p.status,
      ifOperStatus: p.status,
      speed: p.speedMbps || p.speed,
      speedMbps: p.speedMbps || p.speed,
      mtu: p.mtu ?? 1500,
      vlan: p.vlan ?? null,
      duplex: p.duplex ?? null,
      poeWatts: p.poeWatts ?? null,
      poeStatus: p.poeStatus ?? null,
      inMbps: p.inMbps ?? 0,
      outMbps: p.outMbps ?? 0,
      inOctets: undefined,
      outOctets: undefined,
      macAddr: cd.mac,
      connectedDevice: cd.name,
      portRole: p.portRole || (p.isUplink ? "uplink" : "lan"),
      meta: p.isUplink ? { type: "uplink" } : undefined,
      isUplink: !!p.isUplink,
    };
  });

  return {
    sysUpTime: sys.uptimeSec ?? null,
    sysName: sys.hostname || equipment?.name || null,
    sysDescr: sys.description || null,
    name: equipment?.name || sys.hostname || null,
    ip: sys.host || equipment?.ip || null,
    ports,
    source: "cisco-ssh",
    polledAt: snapshot.polledAt || new Date().toISOString(),
    ciscoMeta: {
      model: sys.model || null,
      serial: sys.serial || null,
      firmware: sys.firmware || null,
      uptime: sys.uptime || null,
      mac: sys.mac || null,
      poeBudgetW: sys.poeBudgetW ?? null,
      poeUsedW: sys.poeUsedW ?? null,
      hostname: sys.hostname || null,
    },
  };
}

/**
 * Merge a Cisco snapshot over a generic SNMP poll. The Cisco snapshot wins
 * for any port present in both — its data is richer (PoE, VLAN, duplex).
 */
export function mergeCiscoIntoPoll(snmpPoll, ciscoSnapshot, equipment = null) {
  const ciscoPoll = normalizeCiscoPoll(ciscoSnapshot, equipment);
  if (!ciscoPoll) return snmpPoll;
  if (!snmpPoll?.ports?.length) return ciscoPoll;

  const byIndex = new Map(snmpPoll.ports.map((p) => [Number(p.index), p]));
  for (const cisco of ciscoPoll.ports) {
    const existing = byIndex.get(Number(cisco.index));
    if (existing) {
      // Preserve SNMP byte counters (they're more granular).
      byIndex.set(Number(cisco.index), {
        ...existing,
        ...cisco,
        inMbps: existing.inMbps || cisco.inMbps || 0,
        outMbps: existing.outMbps || cisco.outMbps || 0,
        inOctets: existing.inOctets,
        outOctets: existing.outOctets,
      });
    } else {
      byIndex.set(Number(cisco.index), cisco);
    }
  }

  return {
    ...snmpPoll,
    sysName: ciscoPoll.sysName || snmpPoll.sysName,
    sysDescr: ciscoPoll.sysDescr || snmpPoll.sysDescr,
    sysUpTime: ciscoPoll.sysUpTime ?? snmpPoll.sysUpTime,
    ports: [...byIndex.values()].sort((a, b) => Number(a.index) - Number(b.index)),
    source: ciscoPoll.source,
    ciscoMeta: ciscoPoll.ciscoMeta,
    polledAt: ciscoPoll.polledAt,
  };
}

/**
 * Try to extract an Equipment-compatible shape from a Cisco snapshot so
 * the orchestrator can auto-create / upsert a row when the operator
 * registers a switch through the Lutron-style modal.
 */
export function deriveEquipmentFromSnapshot(snapshot, fallbackHost) {
  if (!snapshot?.system) {
    if (!fallbackHost) return null;
    return {
      make: "Cisco",
      model: "C1300",
      ip: fallbackHost,
      name: `Cisco switch ${fallbackHost}`,
      category: "Network",
    };
  }
  const sys = snapshot.system;
  const chassis = matchCiscoDevice(sys.model || "");
  return {
    make: "Cisco",
    model: sys.model || chassis?.model || "C1300",
    ip: sys.host || fallbackHost,
    mac: sys.mac || null,
    serial: sys.serial || null,
    name: sys.hostname || `Cisco ${sys.model || "switch"}`,
    category: "Network",
    description: sys.description || null,
  };
}
