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
  equipmentToDiscoverySubnets,
  mergeDiscoverySubnetLists,
  normalizeDiscoveryKnownHosts,
  racksToLayout,
  normalizePatchPanelId,
  isCanonicalPatchPanelName,
  knownHostToEquipment,
} from "./normalize.js";
import { stripVesselEquipmentName } from "./equipmentName.js";

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

/** Cable/media / generic type strings that should not replace a real device model. */
const WEAK_MODEL =
  /^(cat\s*\d+|os\d*|patch|fiber|copper|utm|it|av|sec|cctv|tel|ant|lut|hvac|switch|access\s*point|display|router|camera|server|firewall|wlc|nas|pbx)$/i;

function looksLikePartNumber(value) {
  const s = String(value || "").trim();
  return /\d/.test(s) && s.length >= 3;
}

function appendMergedNote(existing, addition) {
  if (!addition) return existing || "";
  if (!existing) return addition;
  if (String(existing).includes(String(addition))) return existing;
  return `${existing} | ${addition}`;
}

/**
 * Merge equipment rows from multiple sheets without letting blank / weaker
 * fields from Patch Panels wipe Device List / switch / appliance data (IP,
 * room, serial, model, etc.).
 */
export function mergeEquipmentRecords(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const out = { ...existing, name: existing.name || incoming.name };
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "name") continue;
    if (value == null || value === "") continue;

    const current = out[key];
    if (current == null || current === "") {
      out[key] = value;
      continue;
    }

    if (key === "port_count") {
      out[key] = Math.max(Number(current) || 0, Number(value) || 0);
      continue;
    }
    if (key === "notes") {
      out[key] = appendMergedNote(current, value);
      continue;
    }
    if (key === "model") {
      if (WEAK_MODEL.test(String(current)) && !WEAK_MODEL.test(String(value))) {
        out[key] = value;
      } else if (
        !WEAK_MODEL.test(String(value)) &&
        !looksLikePartNumber(current) &&
        looksLikePartNumber(value)
      ) {
        out[key] = value;
      }
      continue;
    }
    if (key === "location" && /room\s*\d+/i.test(String(current)) && !/room\s*\d+/i.test(String(value))) {
      // Keep structured deck/room location from Device List over patch destination text.
      continue;
    }
    if (key === "importSource") {
      // Keep the first (usually Device List / chassis) provenance.
      continue;
    }
    // First non-empty value wins for identity / location fields.
  }

  if (incoming.equipment_subtype && !out.equipment_subtype) {
    out.equipment_subtype = incoming.equipment_subtype;
  }
  return out;
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
      equipmentByName.set(key, mergeEquipmentRecords(existing, eq));
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
        if (!endName || /^(none|0|end device|n\/a|-)$/i.test(endName)) continue;
        const endIp =
          row.managementIp && /^(\d{1,3}\.){3}\d{1,3}$/.test(String(row.managementIp).trim())
            ? String(row.managementIp).trim()
            : "";
        // Always merge so Device List rows pick up IPs discovered on switch ports.
        addEquipment({
          name: endName,
          model: "",
          category: "Other",
          ip: endIp,
          location: row.location || "",
          notes: row.notes || "",
          inventoryOnly: true,
          waveguardClassification: "inventory",
          importSource: { sheet: row.sheet, row: row.row },
        });
      }
    } else if (sheet.sheetType === SHEET_GROUPS.patchPanels) {
      for (const row of sheet.rows || []) {
        const cable = patchToCable(row, floorMap);
        if (!cable.patch_panel || !cable.port) {
          warnings.push(
            `Patch row skipped (sheet ${row.sheet || "?"}, row ${row.row || "?"}): missing patch panel or port`
          );
          continue;
        }
        if (!cable.label) {
          cable.label = `${cable.patch_panel}-P${cable.port}`;
        }
        cables.push(cable);
        const endpoint = patchEndpointToEquipment(row, floorMap);
        if (endpoint) addEquipment(endpoint);
        const panelEq = patchPanelToEquipment(row, floorMap);
        if (panelEq) {
          const key = equipmentKey(panelEq);
          if (equipmentByName.has(key)) {
            equipmentByName.set(
              key,
              mergeEquipmentRecords(equipmentByName.get(key), panelEq)
            );
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

  let vlanSubnets = [];
  const schemeHosts = [];
  if (enabled.has(SHEET_GROUPS.ipScheme)) {
    for (const sheet of parsed.sheets || []) {
      if (sheet.sheetType !== SHEET_GROUPS.ipScheme) continue;
      if (sheet.vlans?.length) {
        vlanSubnets = vlansToDiscoverySubnets(sheet.vlans);
      }
      if (sheet.hosts?.length) {
        schemeHosts.push(...sheet.hosts);
      }
    }
  }

  const layoutData = enabled.has(SHEET_GROUPS.rack) ? racksToLayout(parsed.sheets) : null;
  let equipment = applyRackLayoutToEquipment([...equipmentByName.values()], layoutData);

  // Finalise patch-panel chassis records: port_count from observed ports, drop
  // accidental port-row names (MEC552-R2-PP5-1) if a canonical parent exists.
  const maxPortByPanel = new Map();
  for (const c of cables) {
    if (!c.patch_panel || c.port == null || c.port === "") continue;
    const key = String(c.patch_panel).trim().toLowerCase();
    const n = parseInt(String(c.port).trim(), 10);
    if (!Number.isFinite(n)) continue;
    maxPortByPanel.set(key, Math.max(maxPortByPanel.get(key) || 0, n));
  }

  equipment = equipment.filter((eq) => {
    if (eq.equipment_subtype !== "patch_panel") return true;
    const name = String(eq.name || "").trim();
    if (isCanonicalPatchPanelName(name)) return true;
    // Port-suffixed leftovers should not survive when normalization worked.
    const parent = normalizePatchPanelId(name, name.match(/-(\d+)$/)?.[1] || "");
    if (parent && parent !== name && equipmentByName.has(parent.toLowerCase())) {
      warnings.push(`Dropped non-canonical patch panel row "${name}" (merged into ${parent})`);
      return false;
    }
    // If we can canonicalize the name in place, rename it.
    if (parent && parent !== name && isCanonicalPatchPanelName(parent)) {
      eq.name = parent;
      return true;
    }
    return isCanonicalPatchPanelName(name) || Boolean(maxPortByPanel.get(name.toLowerCase()));
  });

  // Deduplicate after possible renames.
  const dedupedEquipment = [];
  const seenEq = new Map();
  for (const eq of equipment) {
    const key = equipmentKey(eq);
    if (seenEq.has(key)) {
      seenEq.set(key, mergeEquipmentRecords(seenEq.get(key), eq));
    } else {
      seenEq.set(key, eq);
    }
  }
  for (const eq of seenEq.values()) {
    if (eq.equipment_subtype === "patch_panel") {
      const key = equipmentKey(eq);
      const maxPort = maxPortByPanel.get(key) || 0;
      eq.port_count = Math.max(Number(eq.port_count) || 0, maxPort, maxPort > 0 ? maxPort : 24);
      eq.model = eq.model && !/^access\s*point$/i.test(eq.model) ? eq.model : "Patch Panel";
    }
    dedupedEquipment.push(eq);
  }
  equipment = dedupedEquipment;

  const siteLocations = collectSiteLocations(equipment, floorMap);

  // Discovery targets = IP Scheme VLANs + /24s inferred from IT/management IPs.
  const discoverySubnets = mergeDiscoverySubnetLists(
    vlanSubnets,
    equipmentToDiscoverySubnets(equipment)
  );
  const knownHosts = normalizeDiscoveryKnownHosts([
    ...schemeHosts,
    ...equipment
      .filter((e) => e.ip)
      .map((e) => ({
        ip: e.ip,
        name: e.name || e.ip,
        vlan: e.systemCategory || e.category || "",
        source: "equipment",
      })),
    ...discoverySubnets
      .filter((s) => s.gateway)
      .map((s) => ({
        ip: s.gateway,
        name: `${s.label || s.cidr} gateway`,
        vlan: s.label || "",
        source: "ipScheme",
      })),
  ]);

  // Backfill equipment IPs from IP Scheme host table when Device List omitted them.
  const hostIpByName = new Map(
    knownHosts
      .filter((h) => h.name && h.ip)
      .map((h) => [String(h.name).trim().toLowerCase(), h.ip])
  );
  function resolveHostIp(name) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return "";
    if (hostIpByName.has(key)) return hostIpByName.get(key);
    // Soft match: "AP - 101 Massage" ↔ "AP - 101 Massage (101)" etc.
    for (const [n, ip] of hostIpByName) {
      if (n === key) return ip;
      if (n.startsWith(key + " ") || key.startsWith(n + " ")) return ip;
      if (n.includes(key) && key.length >= 8) return ip;
      if (key.includes(n) && n.length >= 8) return ip;
    }
    // Room / AP number match: "AP Ext. - 344 Aft" ↔ host containing "344"
    const roomNum = key.match(/\b(\d{2,4})\b/);
    if (roomNum) {
      const token = roomNum[1];
      const candidates = [];
      for (const [n, ip] of hostIpByName) {
        if (new RegExp(`(^|[^0-9])${token}([^0-9]|$)`).test(n)) {
          candidates.push([n, ip]);
        }
      }
      if (candidates.length === 1) return candidates[0][1];
    }
    return "";
  }
  equipment = equipment.map((eq) => {
    if (eq.ip) return eq;
    const fromScheme = resolveHostIp(eq.name);
    return fromScheme ? { ...eq, ip: fromScheme } : eq;
  });

  // Keep the name map in sync with IP backfills so later merges see the IPs.
  equipmentByName.clear();
  for (const eq of equipment) {
    equipmentByName.set(equipmentKey(eq), eq);
  }

  // Materialize every remaining IP Scheme host as inventory equipment so Topology
  // shows all spreadsheet IP devices — not only rows that already had an IP.
  const equipmentIps = new Set(
    equipment.map((e) => String(e.ip || "").trim()).filter(Boolean)
  );
  let materializedHosts = 0;
  for (const host of knownHosts) {
    const ip = String(host.ip || "").trim();
    if (!ip || equipmentIps.has(ip)) continue;
    const eq = knownHostToEquipment(host);
    if (!eq) continue;
    addEquipment(eq);
    const stored = equipmentByName.get(equipmentKey(eq));
    if (stored) equipment.push(stored);
    equipmentIps.add(ip);
    materializedHosts += 1;
  }
  if (materializedHosts > 0) {
    warnings.push(
      `Materialized ${materializedHosts} IP Scheme host${materializedHosts === 1 ? "" : "s"} as inventory equipment for topology`
    );
  }

  // Final dedupe by name after materialization merges.
  {
    const byName = new Map();
    for (const eq of equipment) {
      const key = equipmentKey(eq);
      byName.set(key, byName.has(key) ? mergeEquipmentRecords(byName.get(key), eq) : eq);
    }
    equipment = [...byName.values()];
  }

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
      // Same NET/tag can appear on multiple panels — keep both rows with a unique label.
      if (cableLabels.has(c.label)) {
        const unique = `${c.label} (${c.patch_panel} P${c.port})`;
        warnings.push(
          `Duplicate cable label "${c.label}" on ${c.patch_panel} P${c.port} kept as "${unique}"`
        );
        c.label = unique;
      }
      cableLabels.add(c.label);
      dedupedCables.push(c);
      continue;
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
    discoveryKnownHosts: knownHosts,
    rackLayout: layoutData,
    credentials: parsed.credentials || [],
    warnings,
    stats: {
      equipment: equipment.length,
      cables: dedupedCables.length,
      decks: siteLocations.decks?.length || 0,
      vlans: discoverySubnets.length,
      knownHosts: knownHosts.length,
      credentials: (parsed.credentials || []).length,
    },
  };
}
