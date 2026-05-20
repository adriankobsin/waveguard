/**
 * Build topology connections from discovered devices (gateway star heuristic).
 */
export function buildTopologyConnections(devices) {
  const connections = [];
  if (!devices?.length) return connections;

  const byIp = Object.fromEntries(devices.map((d) => [d.ip, d]));
  const gateway =
    devices.find((d) => d.ip?.endsWith(".1")) ||
    devices.find((d) => (d.hostname || d.name || "").toLowerCase().includes("router")) ||
    devices.find((d) => d.category === "Network" && d.openPorts?.includes(161));

  const hub = gateway || devices[0];
  if (!hub) return connections;

  const hubId = hub.id;
  for (const dev of devices) {
    if (dev.id === hubId) continue;
    const id = `conn-${hubId}-${dev.id}`;
    connections.push({
      id,
      source: hubId,
      target: dev.id,
      source_id: hubId,
      target_id: dev.id,
      type: "cable",
      label: `${hub.name || hub.ip} ↔ ${dev.name || dev.ip}`,
    });
  }

  // Link network switches to each other if multiple switches found
  const switches = devices.filter(
    (d) =>
      d.id !== hubId &&
      (d.category === "Network" || (d.hostname || d.name || "").toLowerCase().includes("sw"))
  );
  for (let i = 0; i < switches.length - 1; i++) {
    const a = switches[i];
    const b = switches[i + 1];
    connections.push({
      id: `conn-${a.id}-${b.id}`,
      source: a.id,
      target: b.id,
      source_id: a.id,
      target_id: b.id,
      type: "cable",
      label: `${a.name || a.ip} ↔ ${b.name || b.ip}`,
    });
  }

  return connections;
}

export function mapDevicesToTopology(discovered) {
  return discovered.map((d) => ({
    id: d.id,
    name: d.hostname || d.name || d.ip,
    category: d.category || "Unknown",
    model: d.model || d.vendor || "Unknown",
    ip: d.ip,
    mac: d.mac,
    status: d.status === "discovered" ? "online" : d.status || "online",
    location: d.location || "",
    serial: d.serial || "",
    hostname: d.hostname,
    vendor: d.vendor,
    openPorts: d.openPorts,
  }));
}
