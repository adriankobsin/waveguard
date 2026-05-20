/**
 * Shared commit logic for vessel spreadsheet import (browser + mock-server).
 */

export async function commitVesselImport(deps, payload, options = {}) {
  const { replace = false } = options;
  const result = {
    equipmentCreated: 0,
    equipmentUpdated: 0,
    cablesCreated: 0,
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
    if (existingCableLabels.has(cable.label) && !replace) {
      result.cablesSkipped++;
      continue;
    }
    cablesToCreate.push(cable);
  }

  if (deps.bulkCreateCables && cablesToCreate.length) {
    try {
      const created = await deps.bulkCreateCables(cablesToCreate);
      result.cablesCreated += Array.isArray(created) ? created.length : cablesToCreate.length;
    } catch (err) {
      for (const cable of cablesToCreate) {
        try {
          await deps.createCable(cable);
          result.cablesCreated++;
        } catch (e) {
          result.errors.push(`Cable ${cable.label}: ${e.message}`);
        }
      }
    }
  } else {
    for (const cable of cablesToCreate) {
      try {
        await deps.createCable(cable);
        result.cablesCreated++;
      } catch (err) {
        result.errors.push(`Cable ${cable.label}: ${err.message}`);
      }
    }
  }

  return result;
}
