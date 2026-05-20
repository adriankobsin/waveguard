import {
  findEquipmentByIp,
  listEquipment,
  upsertEquipment,
} from "@/api/equipmentApi";
import { notifyEquipmentChanged, stableEquipmentId } from "@/lib/discoveryRegistration";
import { equipmentToTopologyNode, stripUndefined } from "@/lib/topology/syncTopologyFromEquipment";

export async function findEquipmentById(id) {
  if (!id) return null;
  const all = await listEquipment();
  return all.find((e) => e.id === id) || null;
}

function editFormToEquipmentRecord(deviceId, formData, existingNode, existingEq) {
  const ip = formData.ip || existingNode?.ip || existingEq?.ip;
  return stripUndefined({
    id: existingEq?.id || deviceId || (ip ? stableEquipmentId(ip) : undefined),
    name: formData.name,
    ip,
    mac: formData.mac,
    make: formData.make,
    model: formData.model,
    firmware: formData.firmware,
    location: formData.location,
    serial: formData.serial,
    category: formData.category,
    status: formData.status,
    notes: formData.notes,
    controlType: formData.controlType,
    waveguardClassification:
      existingEq?.waveguardClassification ||
      (existingNode?.inventoryOnly ? "inventory" : "monitored"),
    inventoryOnly: existingEq?.inventoryOnly ?? existingNode?.inventoryOnly,
    monitoringEnabled: existingEq?.monitoringEnabled ?? true,
    updated_date: new Date().toISOString(),
  });
}

/**
 * Persist topology device edits to Equipment storage (survives full SNMP rescan).
 */
export async function persistTopologyDeviceEdit(deviceId, formData, existingNode) {
  let existingEq = await findEquipmentById(deviceId);
  if (!existingEq && (formData.ip || existingNode?.ip)) {
    existingEq = await findEquipmentByIp(formData.ip || existingNode.ip);
  }

  const record = editFormToEquipmentRecord(deviceId, formData, existingNode, existingEq);
  if (!record.id) throw new Error("Device id is required");
  if (!record.name?.trim()) throw new Error("Device name is required");

  const saved = await upsertEquipment(record);
  notifyEquipmentChanged();
  return equipmentToTopologyNode(saved);
}

/**
 * Merge scan results into Equipment without wiping user metadata.
 */
export async function persistTopologyDeviceScan(deviceId, scanned, existingNode) {
  if (!scanned?.ip && !existingNode?.ip) throw new Error("No IP to save scan results");

  let existingEq = await findEquipmentById(deviceId);
  if (!existingEq) {
    existingEq = await findEquipmentByIp(scanned.ip || existingNode.ip);
  }

  const ip = scanned.ip || existingNode?.ip || existingEq?.ip;
  const name =
    scanned.hostname ||
    scanned.name ||
    existingNode?.name ||
    existingEq?.name ||
    ip;

  const record = stripUndefined({
    id: existingEq?.id || deviceId || stableEquipmentId(ip),
    name,
    ip,
    mac: scanned.mac || existingEq?.mac || existingNode?.mac || "",
    model: scanned.model || scanned.vendor || existingEq?.model || existingNode?.model,
    category: scanned.category || existingEq?.category || existingNode?.category || "Unknown",
    vendor: scanned.vendor || existingEq?.vendor || "",
    status: scanned.status === "discovered" ? "online" : (scanned.status || existingEq?.status || "online"),
    location: existingEq?.location || existingNode?.location || "",
    serial: existingEq?.serial || existingNode?.serial || "",
    firmware: existingEq?.firmware || existingNode?.firmware || "",
    notes: existingEq?.notes || existingNode?.notes || "",
    openPorts: scanned.openPorts || existingEq?.openPorts || existingNode?.openPorts || [],
    waveguardClassification: existingEq?.waveguardClassification || "monitored",
    monitoringEnabled: existingEq?.monitoringEnabled ?? true,
    updated_date: new Date().toISOString(),
  });

  const saved = await upsertEquipment(record);
  notifyEquipmentChanged();
  return equipmentToTopologyNode(saved);
}
