import { SHEET_GROUPS, PHASE1_GROUPS, PHASE2_GROUPS } from "./schemas.js";
import {
  endpointToEquipment,
  chassisToEquipment,
  applianceToEquipment,
  patchToCable,
  switchPortToCable,
  collectSiteLocations,
  vlansToDiscoverySubnets,
  racksToLayout,
} from "./normalize.js";

function equipmentKey(eq) {
  return (eq.name || "").trim().toLowerCase();
}

/**
 * Merge parsed workbook sheets into import payload.
 * @param {{ sheets: object[] }} parsed
 * @param {{ enabledGroups?: string[], floorMap?: object }} options
 */
export function buildImportPayload(parsed, options = {}) {
  const enabled = new Set(options.enabledGroups || [...PHASE1_GROUPS, ...PHASE2_GROUPS]);
  const floorMap = options.floorMap || undefined;
  const equipmentByName = new Map();
  const cables = [];
  const warnings = [];
  const ipByEndDevice = new Map();

  const addEquipment = (eq) => {
    if (!eq?.name) return;
    const key = equipmentKey(eq);
    const existing = equipmentByName.get(key);
    if (existing) {
      equipmentByName.set(key, { ...existing, ...eq, name: existing.name || eq.name });
      warnings.push(`Duplicate equipment name merged: ${eq.name}`);
    } else {
      equipmentByName.set(key, eq);
    }
  };

  for (const sheet of parsed.sheets || []) {
    if (sheet.skipped) continue;
    if (!enabled.has(sheet.sheetType)) continue;

    if (sheet.sheetType === SHEET_GROUPS.deviceList) {
      for (const row of sheet.rows || []) {
        addEquipment(endpointToEquipment(row, floorMap));
      }
    } else if (sheet.sheetType === SHEET_GROUPS.appliance) {
      for (const row of sheet.rows || []) {
        addEquipment(applianceToEquipment(row));
      }
    } else if (sheet.sheetType === SHEET_GROUPS.switchPorts) {
      for (const row of sheet.chassis || []) {
        addEquipment(chassisToEquipment(row, floorMap));
      }
      for (const row of sheet.ports || []) {
        const cable = switchPortToCable(row);
        if (cable) cables.push(cable);
        if (row.endDevice && !equipmentByName.has(equipmentKey({ name: row.endDevice }))) {
          addEquipment({
            name: row.endDevice,
            model: "",
            category: "Other",
            location: row.location || "",
            notes: row.notes || "",
            inventoryOnly: true,
            waveguardClassification: "inventory",
            importSource: { sheet: row.sheet, row: row.row },
          });
        }
      }
    } else if (sheet.sheetType === SHEET_GROUPS.patchPanels) {
      for (const row of sheet.rows || []) {
        const cable = patchToCable(row, floorMap);
        if (cable.label) cables.push(cable);
      }
    }
  }

  const equipment = [...equipmentByName.values()];
  const siteLocations = collectSiteLocations(equipment, floorMap);

  let discoverySubnets = [];
  let rackLayout = null;
  if (enabled.has(SHEET_GROUPS.ipScheme)) {
    for (const sheet of parsed.sheets || []) {
      if (sheet.sheetType === SHEET_GROUPS.ipScheme && sheet.vlans) {
        discoverySubnets = vlansToDiscoverySubnets(sheet.vlans);
      }
    }
  }
  if (enabled.has(SHEET_GROUPS.rack)) {
    rackLayout = racksToLayout(parsed.sheets);
  }

  const cableLabels = new Set();
  const dedupedCables = [];
  for (const c of cables) {
    if (!c.label) continue;
    if (cableLabels.has(c.label)) {
      warnings.push(`Duplicate cable label skipped: ${c.label}`);
      continue;
    }
    cableLabels.add(c.label);
    dedupedCables.push(c);
  }

  return {
    equipment,
    cables: dedupedCables,
    siteLocations,
    discoverySubnets,
    rackLayout,
    warnings,
    stats: {
      equipment: equipment.length,
      cables: dedupedCables.length,
      decks: siteLocations.decks?.length || 0,
      vlans: discoverySubnets.length,
    },
  };
}
