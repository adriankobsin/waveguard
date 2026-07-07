/**
 * Shared commit logic for vessel spreadsheet import (browser + mock-server).
 */

function patchPortKey(cable) {
  const panel = (cable.patch_panel || "").trim().toLowerCase();
  const port = cable.port != null ? String(cable.port).trim() : "";
  if (!panel || !port) return "";
  return `${panel}|${port}`;
}

export async function commitVesselImport(deps, payload, options = {}) {
  const { replace = false } = options;
  const result = {
    equipmentCreated: 0,
    equipmentUpdated: 0,
    cablesCreated: 0,
    cablesUpdated: 0,
    cablesSkipped: 0,
    errors: [],
  };

  if (replace) {
    if (deps.clearEquipment) await deps.clearEquipment();
    if (deps.clearCables) await deps.clearCables();
  }

  if (deps.saveSiteLocations && payload.siteLocations?.decks?.length) {
    await deps.saveSiteLocations(payload.siteLocations);
  }

  if (deps.saveDiscoverySubnets && payload.discoverySubnets?.length) {
    await deps.saveDiscoverySubnets(payload.discoverySubnets);
  }

  if (deps.saveRackLayout && payload.rackLayout) {
    await deps.saveRackLayout(payload.rackLayout);
  }

  const existingByName = deps.getExistingByName ? await deps.getExistingByName() : new Map();
  const existingByIp = deps.getExistingByIp ? await deps.getExistingByIp() : new Map();
  const existingCableLabels = deps.getExistingCableLabels ? await deps.getExistingCableLabels() : new Set();
  const existingByPatchPort = deps.getExistingByPatchPort ? await deps.getExistingByPatchPort() : new Map();

  for (const record of payload.equipment || []) {
    try {
      const nameKey = (record.name || "").trim().toLowerCase();
      const ipKey = (record.ip || "").trim();
      let existing = existingByName.get(nameKey);
      if (!existing && ipKey) existing = existingByIp.get(ipKey);

      if (existing?.id) {
        await deps.updateEquipment(existing.id, { ...existing, ...record });
        result.equipmentUpdated++;
        existingByName.set(nameKey, { ...existing, ...record });
      } else {
        const created = await deps.createEquipment(record);
        result.equipmentCreated++;
        if (created?.name) existingByName.set(nameKey, created);
        if (created?.ip) existingByIp.set(created.ip, created);
      }
    } catch (err) {
      result.errors.push(`Equipment ${record.name}: ${err.message}`);
    }
  }

  const cablesToCreate = [];
  for (const cable of payload.cables || []) {
    if (!cable.label) continue;

    const portKey = patchPortKey(cable);
    const existingPort = portKey ? existingByPatchPort.get(portKey) : null;
    if (existingPort?.id && deps.updateCable && !replace) {
      try {
        const updated = await deps.updateCable(existingPort.id, { ...existingPort, ...cable });
        result.cablesUpdated++;
        if (updated?.label) {
          existingCableLabels.add(updated.label);
        }
        existingByPatchPort.set(portKey, { ...existingPort, ...cable, id: existingPort.id });
        continue;
      } catch (err) {
        result.errors.push(`Cable ${cable.patch_panel} P${cable.port}: ${err.message}`);
        continue;
      }
    }

    if (existingCableLabels.has(cable.label) && !replace) {
      result.cablesSkipped++;
      continue;
    }
    cablesToCreate.push(cable);
  }

  if (deps.bulkCreateCables && cablesToCreate.length) {
    try {
      const created = await deps.bulkCreateCables(cablesToCreate);
      const rows = Array.isArray(created) ? created : cablesToCreate;
      result.cablesCreated += rows.length;
      for (const row of rows) {
        if (row?.label) existingCableLabels.add(row.label);
        const key = patchPortKey(row);
        if (key) existingByPatchPort.set(key, row);
      }
    } catch (err) {
      for (const cable of cablesToCreate) {
        try {
          const created = await deps.createCable(cable);
          result.cablesCreated++;
          if (created?.label) existingCableLabels.add(created.label);
          const key = patchPortKey(created || cable);
          if (key) existingByPatchPort.set(key, created || cable);
        } catch (e) {
          result.errors.push(`Cable ${cable.label}: ${e.message}`);
        }
      }
    }
  } else {
    for (const cable of cablesToCreate) {
      try {
        const created = await deps.createCable(cable);
        result.cablesCreated++;
        if (created?.label) existingCableLabels.add(created.label);
        const key = patchPortKey(created || cable);
        if (key) existingByPatchPort.set(key, created || cable);
      } catch (err) {
        result.errors.push(`Cable ${cable.label}: ${err.message}`);
      }
    }
  }

  return result;
}
