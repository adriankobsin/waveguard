import { buildConnectionMap } from "@/lib/snmp/snmpSwitchProfiles";

/** Map enriched switch row to Connections tab display shape. */
export function switchToConnectionView(sw) {
  const ports = (sw.ports || []).map((p) => ({
    port: p.index,
    ifAlias: p.ifAlias || "",
    ifOperStatus: p.slotEmpty ? "unknown" : p.status,
    ifSpeed: p.speedMbps || p.speed,
    connectedDevice: p.connectedDevice,
    macAddr: p.macAddr,
    vlan: p.vlan,
    poeWatts: p.poeWatts,
    slotEmpty: p.slotEmpty,
    isUplink: p.isUplink,
  }));

  const polled = ports.filter((p) => !p.slotEmpty);
  return {
    id: sw.id,
    name: sw.displayName,
    ip: sw.ip,
    model: sw.model,
    location: sw.location || sw.eq?.location,
    enabled: sw.enabled !== false,
    lastPollAt: sw.lastPollAt,
    lastPollError: sw.lastPollError,
    pollSource: sw.lastPoll?.source || sw.pollSource,
    health: sw.health,
    portsUp: polled.filter((p) => p.ifOperStatus === "up").length,
    portsDown: polled.filter((p) => p.ifOperStatus === "down").length,
    totalPorts: ports.length,
    ports,
  };
}

export function buildConnectionsFleetView(enrichedSwitches) {
  const switches = (enrichedSwitches || []).map(switchToConnectionView);
  const connectionMap = buildConnectionMap(
    switches.map((sw) => ({
      name: sw.name,
      ip: sw.ip,
      ports: sw.ports
        .filter((p) => !p.slotEmpty && (p.connectedDevice || p.macAddr))
        .map((p) => ({
          index: p.port,
          ifAlias: p.ifAlias,
          status: p.ifOperStatus,
          connectedDevice: p.connectedDevice,
          macAddr: p.macAddr,
          speedMbps: p.ifSpeed,
          vlan: p.vlan,
          poeWatts: p.poeWatts,
        })),
    }))
  );

  const activeConnections = connectionMap.filter((c) => c.status === "up").length;
  const faults = connectionMap.filter((c) => c.status === "down");

  return {
    switches,
    connectionMap,
    totalConnections: connectionMap.length,
    activeConnections,
    disconnectedPorts: faults.length,
    cableFaults: faults.length,
  };
}
