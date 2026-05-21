function normMac(mac) {
  if (!mac) return "";
  return String(mac)
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .replace(/(.{2})(?=.)/g, "$1:")
    .slice(0, 17);
}

/** Match polled port neighbour to an Equipment record when possible. */
export function resolveConnectedEquipment(equipmentList, port) {
  if (!port) return null;
  const list = equipmentList || [];

  if (port.connectedEquipmentId) {
    const byId = list.find((e) => e.id === port.connectedEquipmentId);
    if (byId) return byId;
  }

  const portMac = normMac(port.macAddr);
  if (portMac) {
    const byMac = list.find((e) => normMac(e.mac) === portMac);
    if (byMac) return byMac;
  }

  const label = (port.connectedDevice || "").trim().toLowerCase();
  if (!label) return null;

  const exact = list.find((e) => (e.name || "").trim().toLowerCase() === label);
  if (exact) return exact;

  const partial = list.find((e) => {
    const name = (e.name || "").trim().toLowerCase();
    return name && (name.includes(label) || label.includes(name));
  });
  return partial || null;
}
