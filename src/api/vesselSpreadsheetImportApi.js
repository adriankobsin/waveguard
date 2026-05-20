import { base44, isMockServer, MOCK_SERVER_URL } from "@/api/base44Client";
import {
  listEquipment,
  createEquipment,
  updateEquipment,
  clearAllEquipment,
} from "@/api/equipmentApi";
import { commitVesselImport } from "@/lib/spreadsheet/commitImport";
import {
  saveSiteLocationsLocal,
  loadSiteLocationsLocal,
  normalizeSiteLocations,
  DEFAULT_SITE_LOCATIONS,
  SITE_LOCATIONS_SETTINGS_KEY,
} from "@/lib/siteLocations";
import {
  saveDiscoverySettingsLocal,
  loadDiscoverySettingsLocal,
  normalizeDiscoverySettings,
  DEFAULT_DISCOVERY_SETTINGS,
  DISCOVERY_SETTINGS_KEY,
} from "@/lib/discoverySettings";
import { saveRackLayoutLocal } from "@/lib/rackLayoutStorage";

async function listCables() {
  const data = await base44.entities.Cable.list("label", 2000);
  return Array.isArray(data) ? data : [];
}

async function clearAllCables() {
  const cables = await listCables();
  for (const c of cables) {
    if (c.id) await base44.entities.Cable.delete(c.id);
  }
  return cables.length;
}

function buildDeps() {
  return {
    getExistingByName: async () => {
      const all = await listEquipment();
      const map = new Map();
      for (const e of all) {
        const k = (e.name || "").trim().toLowerCase();
        if (k) map.set(k, e);
      }
      return map;
    },
    getExistingByIp: async () => {
      const all = await listEquipment();
      const map = new Map();
      for (const e of all) {
        if (e.ip) map.set(e.ip, e);
      }
      return map;
    },
    getExistingCableLabels: async () => {
      const cables = await listCables();
      return new Set(cables.map((c) => c.label).filter(Boolean));
    },
    createEquipment,
    updateEquipment,
    createCable: (data) => base44.entities.Cable.create(data),
    bulkCreateCables: async (rows) => {
      if (isMockServer) {
        const res = await fetch(
          `${MOCK_SERVER_URL}/api/apps/mock-app/entities/Cable/bulk`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rows),
          }
        );
        if (!res.ok) throw new Error("Bulk cable create failed");
        return res.json();
      }
      const created = [];
      for (const row of rows) {
        created.push(await base44.entities.Cable.create(row));
      }
      return created;
    },
    clearEquipment: clearAllEquipment,
    clearCables: clearAllCables,
    saveSiteLocations: async (siteLocations) => {
      const current = loadSiteLocationsLocal() || DEFAULT_SITE_LOCATIONS;
      const merged = normalizeSiteLocations({
        decks: mergeDecks(current.decks, siteLocations.decks),
      });
      saveSiteLocationsLocal(merged);
      try {
        const records = await base44.entities.SystemSettings.filter({ key: SITE_LOCATIONS_SETTINGS_KEY });
        const payload = { key: SITE_LOCATIONS_SETTINGS_KEY, value: JSON.stringify(merged) };
        if (records[0]?.id) await base44.entities.SystemSettings.update(records[0].id, payload);
        else await base44.entities.SystemSettings.create(payload);
      } catch {
        /* local-only ok */
      }
    },
    saveDiscoverySubnets: async (subnets) => {
      const current = loadDiscoverySettingsLocal() || DEFAULT_DISCOVERY_SETTINGS;
      const merged = normalizeDiscoverySettings({
        ...current,
        subnets: [...(current.subnets || []), ...subnets],
      });
      saveDiscoverySettingsLocal(merged);
      try {
        const records = await base44.entities.SystemSettings.filter({ key: DISCOVERY_SETTINGS_KEY });
        const payload = { key: DISCOVERY_SETTINGS_KEY, value: JSON.stringify(merged) };
        if (records[0]?.id) await base44.entities.SystemSettings.update(records[0].id, payload);
        else await base44.entities.SystemSettings.create(payload);
      } catch {
        /* local-only ok */
      }
    },
    saveRackLayout: async (layout) => {
      try {
        await base44.entities.RackLayout.create(layout);
      } catch {
        /* ignore */
      }
      saveRackLayoutLocal({ ...layout, id: layout.id || `rack-import-${Date.now()}` });
    },
  };
}

function mergeDecks(existing, imported) {
  const byName = new Map((existing || []).map((d) => [d.name.toLowerCase(), { ...d, rooms: [...(d.rooms || [])] }]));
  for (const deck of imported || []) {
    const key = deck.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, deck);
      continue;
    }
    const ex = byName.get(key);
    const roomNames = new Set((ex.rooms || []).map((r) => r.name.toLowerCase()));
    for (const room of deck.rooms || []) {
      if (!roomNames.has(room.name.toLowerCase())) {
        ex.rooms.push(room);
        roomNames.add(room.name.toLowerCase());
      }
    }
  }
  return [...byName.values()];
}

export async function commitVesselSpreadsheetImport(payload, options = {}) {
  return commitVesselImport(buildDeps(), payload, options);
}

export async function invokeVesselSpreadsheetImport(payload, options = {}) {
  const res = await base44.functions.invoke("importVesselSpreadsheet", {
    payload,
    options,
  });
  return res?.data ?? res;
}
