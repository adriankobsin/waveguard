import { base44, isMockServer } from "@/api/base44Client";
import {
  listEquipment,
  createEquipment,
  updateEquipment,
  clearAllEquipment,
  mockEntityApi,
} from "@/api/equipmentApi";
import { commitVesselImport } from "@/lib/spreadsheet/commitImport";
import { isDemoModeActive } from "@/lib/platformMode";
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
  mergeDiscoveryImport,
  DEFAULT_DISCOVERY_SETTINGS,
  DISCOVERY_SETTINGS_KEY,
} from "@/lib/discoverySettings";
import { saveRackLayoutLocal } from "@/lib/rackLayoutStorage";
import { importCredentialsBatch } from "@/api/credentialsApi";

async function listCables() {
  if (isMockServer) {
    const data = await mockEntityApi("/entities/Cable");
    return Array.isArray(data) ? data : [];
  }
  const data = await base44.entities.Cable.list("label", 2000);
  return Array.isArray(data) ? data : [];
}

async function clearAllCables() {
  const cables = await listCables();
  for (const c of cables) {
    if (c.id) {
      if (isMockServer) {
        await mockEntityApi(`/entities/Cable/${c.id}`, { method: "DELETE" });
      } else {
        await base44.entities.Cable.delete(c.id);
      }
    }
  }
  return cables.length;
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

function syncImportSideEffects(payload) {
  if (payload.siteLocations?.decks?.length) {
    const current = loadSiteLocationsLocal() || DEFAULT_SITE_LOCATIONS;
    const merged = normalizeSiteLocations({
      decks: mergeDecks(current.decks, payload.siteLocations.decks),
    });
    saveSiteLocationsLocal(merged);
  }

  if (payload.discoverySubnets?.length || payload.discoveryKnownHosts?.length) {
    const current = loadDiscoverySettingsLocal() || DEFAULT_DISCOVERY_SETTINGS;
    const merged = mergeDiscoveryImport(
      current,
      payload.discoverySubnets || [],
      payload.discoveryKnownHosts || []
    );
    saveDiscoverySettingsLocal(merged);
  }

  if (payload.rackLayout) {
    saveRackLayoutLocal({
      ...payload.rackLayout,
      id: payload.rackLayout.id || `rack-import-${Date.now()}`,
    });
  }
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
    getExistingByPatchPort: async () => {
      const cables = await listCables();
      const map = new Map();
      for (const c of cables) {
        const panel = (c.patch_panel || "").trim().toLowerCase();
        const port = c.port != null ? String(c.port).trim() : "";
        if (panel && port) map.set(`${panel}|${port}`, c);
      }
      return map;
    },
    createEquipment,
    updateEquipment,
    createCable: async (data) => {
      if (isMockServer) {
        return mockEntityApi("/entities/Cable", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
      return base44.entities.Cable.create(data);
    },
    updateCable: async (id, data) => {
      if (isMockServer) {
        return mockEntityApi(`/entities/Cable/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      }
      return base44.entities.Cable.update(id, data);
    },
    bulkCreateCables: async (rows) => {
      if (isMockServer) {
        return mockEntityApi("/entities/Cable/bulk", {
          method: "POST",
          body: JSON.stringify(rows),
        });
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
    saveDiscoverySubnets: async (subnets, knownHosts = []) => {
      const current = loadDiscoverySettingsLocal() || DEFAULT_DISCOVERY_SETTINGS;
      const merged = mergeDiscoveryImport(current, subnets || [], knownHosts || []);
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

export async function invokeVesselSpreadsheetImport(payload, options = {}) {
  const res = await base44.functions.invoke("importVesselSpreadsheet", {
    payload,
    options,
  });
  return res?.data ?? res;
}

async function persistSpreadsheetCredentials(payload) {
  if (!payload?.credentials?.length) return { credentialsImported: 0 };
  const equipment = await listEquipment();
  return importCredentialsBatch(payload.credentials, equipment);
}

export async function commitVesselSpreadsheetImport(payload, options = {}) {
  if (isDemoModeActive()) {
    throw new Error(
      "Demo mode is read-only. Switch to Live in Settings → Platform mode to import equipment."
    );
  }

  // Local dev: one server-side commit avoids hundreds of per-row fetches (Failed to fetch).
  if (isMockServer) {
    const result = await invokeVesselSpreadsheetImport(payload, options);
    if (result?.success === false) {
      throw new Error(result.error || "Import failed");
    }
    syncImportSideEffects(payload);
    const credResult = await persistSpreadsheetCredentials(payload);
    return { ...result, ...credResult };
  }

  const result = await commitVesselImport(buildDeps(), payload, options);
  syncImportSideEffects(payload);
  const credResult = await persistSpreadsheetCredentials(payload);
  return { ...result, ...credResult };
}
