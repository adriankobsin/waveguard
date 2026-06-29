/** Client-side merge of Equipment records into topology scan payload. */

export function stripUndefined(obj) {
  if (!obj || typeof obj !== "object") return {};
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function computeStats(devices, connections) {
  return {
    online: devices.filter((d) => d.status === "online").length,
    warning: devices.filter((d) => d.status === "warning").length,
    offline: devices.filter((d) => d.status === "offline").length,
    active_connections: (connections || []).length,
  };
}

export function equipmentToTopologyNode(eq) {
  return {
    id: eq.id,
    name: eq.name,
    category: eq.category || "Unknown",
    model: eq.model || eq.vendor || "Unknown",
    ip: eq.ip || "",
    mac: eq.mac || "",
    make: eq.make || "",
    status: eq.status || "online",
    location: eq.location || "",
    serial: eq.serial || "",
    hostname: eq.name,
    vendor: eq.vendor || "",
    firmware: eq.firmware || "",
    notes: eq.notes || "",
    controlType: eq.controlType,
    avRole: eq.avRole,
    openPorts: eq.openPorts || [],
    waveguardClassification: eq.waveguardClassification,
    inventoryOnly: eq.inventoryOnly,
  };
}

/**
 * Merge inventory/monitored equipment into topology without a full SNMP rescan.
 * @param {object|null} topologyData - existing topology payload
 * @param {object[]} equipmentList - from listEquipment()
 */
export function mergeEquipmentIntoTopology(topologyData, equipmentList) {
  const registered = (equipmentList || []).filter(
    (e) =>
      e.ip &&
      (e.waveguardClassification === "monitored" ||
        e.waveguardClassification === "inventory" ||
        e.inventoryOnly === true)
  );

  const byIp = new Map();
  const byId = new Map();

  for (const d of topologyData?.devices || []) {
    if (d.ip) byIp.set(d.ip, d);
    if (d.id) byId.set(d.id, d);
  }

  for (const eq of registered) {
    const node = equipmentToTopologyNode(eq);
    const existing = byId.get(eq.id) || (eq.ip ? byIp.get(eq.ip) : null);
    if (existing) {
      const merged = { ...existing, ...node, id: eq.id };
      byIp.set(eq.ip, merged);
      byId.set(eq.id, merged);
    } else {
      byIp.set(eq.ip, node);
      byId.set(eq.id, node);
    }
  }

  const devices = [...new Map([...byId.entries()].map(([, v]) => [v.id, v])).values()];
  const connections = topologyData?.connections || [];

  return {
    success: true,
    devices,
    connections,
    stats: computeStats(devices, connections),
    scanned_at: topologyData?.scanned_at || new Date().toISOString(),
  };
}

export function patchDeviceInTopology(topologyData, deviceId, patch) {
  if (!topologyData?.devices) return topologyData;

  const clean = stripUndefined(patch);
  const devices = topologyData.devices.map((d) =>
    d.id === deviceId ? { ...d, ...clean } : d
  );

  return {
    ...topologyData,
    devices,
    stats: computeStats(devices, topologyData.connections),
  };
}

export function networkScanDeviceToPatch(scanned, existing = {}) {
  if (!scanned) return {};
  const patch = {};
  const name = scanned.hostname || scanned.name;
  if (name) patch.name = name;
  if (scanned.ip) patch.ip = scanned.ip;
  if (scanned.mac) patch.mac = scanned.mac;
  if (scanned.category) patch.category = scanned.category;
  if (scanned.model || scanned.vendor) patch.model = scanned.model || scanned.vendor;
  if (scanned.vendor) patch.vendor = scanned.vendor;
  patch.status = scanned.status === "discovered" ? "online" : (scanned.status || existing.status || "online");
  if (scanned.openPorts?.length) patch.openPorts = scanned.openPorts;
  if (scanned.subnet) patch.subnet = scanned.subnet;
  // Preserve user-edited fields not returned by scan
  for (const key of ["location", "serial", "firmware", "notes"]) {
    if (existing[key] && patch[key] === undefined) patch[key] = existing[key];
  }
  return stripUndefined(patch);
}
