import { base44, isMockServer } from "@/api/base44Client";
import { mockEntityApi } from "@/api/equipmentApi";
import { isDemoModeActive } from "@/lib/platformMode";
import { backfillPatchPanelFields } from "@/lib/patchPanelSchedule/buildSchedule.js";

function guardDemoWrite() {
  if (isDemoModeActive()) {
    throw new Error(
      "Demo mode is read-only. Switch to Live in Settings → Platform mode to edit cables."
    );
  }
}

function unwrapList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

export async function listCables(limit = 2000) {
  if (isMockServer) {
    const data = await mockEntityApi("/entities/Cable");
    return Array.isArray(data) ? data : unwrapList(data);
  }
  const rows = await base44.entities.Cable.list("label", limit);
  return Array.isArray(rows) ? rows : unwrapList(rows);
}

export async function createCable(data) {
  guardDemoWrite();
  if (isMockServer) {
    return mockEntityApi("/entities/Cable", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  return base44.entities.Cable.create(data);
}

export async function updateCable(id, data) {
  guardDemoWrite();
  if (isMockServer) {
    return mockEntityApi(`/entities/Cable/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  return base44.entities.Cable.update(id, data);
}

export async function deleteCable(id) {
  guardDemoWrite();
  if (isMockServer) {
    return mockEntityApi(`/entities/Cable/${id}`, { method: "DELETE" });
  }
  return base44.entities.Cable.delete(id);
}

export async function findPatchPortCable(cables, panelName, port) {
  const panelKey = String(panelName || "").trim().toLowerCase();
  const portStr = String(port);
  return cables.find((raw) => {
    const c = backfillPatchPanelFields(raw);
    return (
      c.patch_panel?.trim().toLowerCase() === panelKey &&
      String(c.port) === portStr
    );
  });
}

export async function upsertPatchPortCable(panelName, port, data) {
  guardDemoWrite();
  const all = await listCables();
  const existing = await findPatchPortCable(all, panelName, port);
  const portStr = String(port);
  const panel = String(panelName || "").trim();
  const payload = {
    label: data.label || `${panel}-P${portStr}`,
    type: data.type || "",
    system_category: data.system_category || "",
    from_equipment: `${panel} P${portStr}`,
    to_equipment: data.to_equipment || "",
    length: data.length || "",
    deck: data.deck || "",
    room: data.room || "",
    location: data.location || "",
    status: data.status || "installed",
    notes: data.notes || "",
    patch_panel: panel,
    port: portStr,
    end_device_port: data.end_device_port || "",
    test_result: data.test_result || "not_tested",
    last_tested_at: data.last_tested_at || null,
    schedule_source: data.schedule_source || "manual",
  };

  if (existing?.id) {
    return updateCable(existing.id, { ...existing, ...payload });
  }
  return createCable(payload);
}

export async function backfillCablesBatch(cables) {
  guardDemoWrite();
  const updates = [];
  for (const raw of cables) {
    const filled = backfillPatchPanelFields(raw);
    if (
      raw.id &&
      (filled.patch_panel !== raw.patch_panel ||
        filled.port !== raw.port ||
        filled.schedule_source !== raw.schedule_source)
    ) {
      updates.push(updateCable(raw.id, { ...raw, ...filled }));
    }
  }
  if (updates.length) await Promise.all(updates);
  return updates.length;
}
