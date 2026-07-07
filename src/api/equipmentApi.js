import { base44, isMockServer, MOCK_SERVER_URL } from "@/api/base44Client";
import { isDemoModeActive } from "@/lib/platformMode";

const MOCK_APP = "mock-app";

function guardDemoWrite() {
  if (isDemoModeActive()) {
    throw new Error(
      "Demo mode is read-only. Switch to Live in Settings → Platform mode to edit equipment."
    );
  }
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("base44_access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function mockEntityApi(path, options = {}) {
  const base = `${MOCK_SERVER_URL}/api/apps/${MOCK_APP}`;
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...options.headers,
      },
    });
  } catch (err) {
    throw new Error(
      err?.message === "Failed to fetch"
        ? "Could not reach the WaveGuard API. Start the dev stack with npm run dev:all."
        : err?.message || "Network request failed"
    );
  }
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return data;
}

function unwrapList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

export async function listEquipment() {
  if (isMockServer) {
    const data = await mockEntityApi("/entities/Equipment");
    return Array.isArray(data) ? data : unwrapList(data);
  }
  const rows = await base44.entities.Equipment.list();
  return Array.isArray(rows) ? rows : unwrapList(rows);
}

export async function findEquipmentByIp(ip) {
  if (!ip) return null;
  if (isMockServer) {
    try {
      const rows = await mockEntityApi(`/entities/Equipment?q=${encodeURIComponent(JSON.stringify({ ip }))}`);
      const list = Array.isArray(rows) ? rows : unwrapList(rows);
      return list[0] || null;
    } catch {
      const all = await listEquipment();
      return all.find((e) => e.ip === ip) || null;
    }
  }
  const rows = await base44.entities.Equipment.filter({ ip });
  const list = Array.isArray(rows) ? rows : unwrapList(rows);
  return list[0] || null;
}

export async function findEquipmentByName(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  const all = await listEquipment();
  return all.find((e) => (e.name || "").trim().toLowerCase() === key) || null;
}

export async function createEquipment(data) {
  guardDemoWrite();
  if (isMockServer) {
    return mockEntityApi("/entities/Equipment", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  return base44.entities.Equipment.create(data);
}

export async function updateEquipment(id, data) {
  guardDemoWrite();
  if (isMockServer) {
    return mockEntityApi(`/entities/Equipment/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  return base44.entities.Equipment.update(id, data);
}

export async function deleteEquipment(id) {
  guardDemoWrite();
  if (isMockServer) {
    return mockEntityApi(`/entities/Equipment/${id}`, { method: "DELETE" });
  }
  return base44.entities.Equipment.delete(id);
}

export async function upsertEquipment(record) {
  let existing = record.name ? await findEquipmentByName(record.name) : null;
  if (!existing && record.ip) existing = await findEquipmentByIp(record.ip);
  if (existing?.id) {
    return updateEquipment(existing.id, {
      ...existing,
      ...record,
      id: existing.id,
      updated_date: new Date().toISOString(),
    });
  }
  const created = await createEquipment({
    ...record,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  });
  return created;
}

export async function bulkUpsertEquipment(records) {
  const results = { created: 0, updated: 0, items: [] };
  for (const record of records) {
    const prev = await findEquipmentByName(record.name);
    const item = await upsertEquipment(record);
    results.items.push(item);
    if (prev?.id) results.updated++;
    else results.created++;
  }
  return results;
}

export async function clearAllEquipment() {
  const all = await listEquipment();
  for (const e of all) {
    if (e.id) await deleteEquipment(e.id);
  }
  return all.length;
}
