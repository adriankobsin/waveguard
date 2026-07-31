import { SHEET_GROUPS, PHASE1_GROUPS, PHASE2_GROUPS } from "./schemas.js";
import {
  endpointToEquipment,
  chassisToEquipment,
  applianceToEquipment,
  genericRowToEquipment,
  patchToCable,
  patchEndpointToEquipment,
  patchPanelToEquipment,
  switchPortToCable,
  collectSiteLocations,
  vlansToDiscoverySubnets,
  racksToLayout,
} from "./normalize.js";
import { stripVesselEquipmentName } from "./equipmentName.js";
import { isSyntheticPatchLabel } from "./cableTag.js";

function patchPortKey(cable) {
  const panel = (cable.patch_panel || "").trim().toLowerCase();
  const port = cable.port != null ? String(cable.port).trim() : "";
  if (!panel || !port) return "";
  return `${panel}|${port}`;
}

function equipmentKey(eq) {
  return (eq.name || "").trim().toLowerCase();
}

function fuzzyMatch(a, b) {
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function applyRackLayoutToEquipment(equipmentList, layoutData) {
  if (!layoutData?.placements || !layoutData?.racks?.length) return equipmentList;
  const rackById = new Map(layoutData.racks.map((r) => [r.id, r]));
  for (const eq of equipmentList) {
    if (eq.equipment_subtype !== "patch_panel") continue;
    for (const placement of Object.values(layoutData.placements)) {
      if (!fuzzyMatch(placement.label, eq.name)) continue;
      const rack = rackById.get(placement.rackId);
      if (rack) {
        eq.rack_name = rack.name;
        eq.rack_u = placement.u;
      }
      break;
    }
  }
  return equipmentList;
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
        const endName = stripVesselEquipmentName(row.endDevice || "");
        if (endName && !equipmentByName.has(equipmentKey({ name: endName }))) {
          addEquipment({
            name: endName,
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
        if (!cable.label) {
          if (cable.patch_panel && cable.port) {
            warnings.push(
              `Patch panel ${cable.patch_panel} port ${cable.port}: missing cable tag (NET ####) — row skipped`
            );
          }
          continue;
        }
        if (isSyntheticPatchLabel(cable.label, cable.patch_panel, cable.port)) {
          warnings.push(
            `Patch panel ${cable.patch_panel} port ${cable.port}: invalid cable label "${cable.label}" — row skipped`
          );
          continue;
        }
        cables.push(cable);
        const endpoint = patchEndpointToEquipment(row, floorMap);
        if (endpoint) addEquipment(endpoint);
        const panelEq = patchPanelToEquipment(row, floorMap);
        if (panelEq) {
          const key = equipmentKey(panelEq);
          if (equipmentByName.has(key)) {
            const existing = equipmentByName.get(key);
            equipmentByName.set(key, {
              ...existing,
              ...panelEq,
              port_count: Math.max(existing.port_count || 24, panelEq.port_count || 24),
            });
          } else {
            addEquipment(panelEq);
          }
        }
      }
    } else if (sheet.sheetType === SHEET_GROUPS.generic) {
      for (const row of sheet.rows || []) {
        const eq = genericRowToEquipment(row, floorMap);
        if (eq) addEquipment(eq);
      }
    }
  }

  let discoverySubnets = [];
  if (enabled.has(SHEET_GROUPS.ipScheme)) {
    for (const sheet of parsed.sheets || []) {
      if (sheet.sheetType === SHEET_GROUPS.ipScheme && sheet.vlans) {
        discoverySubnets = vlansToDiscoverySubnets(sheet.vlans);
      }
    }
  }

  const layoutData = enabled.has(SHEET_GROUPS.rack) ? racksToLayout(parsed.sheets) : null;
  const equipment = applyRackLayoutToEquipment([...equipmentByName.values()], layoutData);
  const siteLocations = collectSiteLocations(equipment, floorMap);

  const cableLabels = new Set();
  const cablePorts = new Set();
  const dedupedCables = [];
  for (const c of cables) {
    if (!c.label) continue;
    const portKey = patchPortKey(c);
    if (portKey) {
      if (cablePorts.has(portKey)) {
        warnings.push(`Duplicate patch port skipped: ${c.patch_panel} P${c.port}`);
        continue;
      }
      cablePorts.add(portKey);
    }
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
    rackLayout: layoutData,
    credentials: parsed.credentials || [],
    warnings,
    stats: {
      equipment: equipment.length,
      cables: dedupedCables.length,
      decks: siteLocations.decks?.length || 0,
      vlans: discoverySubnets.length,
      credentials: (parsed.credentials || []).length,
    },
  };
}
