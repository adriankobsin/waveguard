import { base44, isMockServer, MOCK_SERVER_URL } from "@/api/base44Client";
import {
  getBuiltinDefaultRackLayout,
  loadRackLayoutLocal,
  saveRackLayoutLocal,
} from "@/lib/rackLayoutStorage";

const MOCK_APP = "mock-app";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("base44_access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function mockApi(path, options = {}) {
  const base = `${MOCK_SERVER_URL}/api/apps/${MOCK_APP}`;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
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
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

function pickDefaultLayout(layouts) {
  const rows = unwrapList(layouts);
  return rows.find((l) => l.is_default) || rows[0] || null;
}

export async function listEquipment() {
  if (isMockServer) {
    const data = await mockApi("/entities/Equipment");
    return Array.isArray(data) ? data : unwrapList(data);
  }
  const rows = await base44.entities.Equipment.list();
  return Array.isArray(rows) ? rows : unwrapList(rows);
}

export async function listSignalLinks(query) {
  if (isMockServer) {
    const q = query ? `?q=${encodeURIComponent(JSON.stringify(query))}` : "";
    const data = await mockApi(`/entities/SignalLink${q}`);
    const rows = Array.isArray(data) ? data : unwrapList(data);
    if (query?.kind) return rows.filter((s) => s.kind === query.kind);
    return rows;
  }
  if (query) {
    const rows = await base44.entities.SignalLink.filter(query);
    return Array.isArray(rows) ? rows : unwrapList(rows);
  }
  const rows = await base44.entities.SignalLink.list();
  return Array.isArray(rows) ? rows : unwrapList(rows);
}

/**
 * Load the default rack layout. Tries mock API, entity list, local cache, then built-in seed.
 * @returns {{ layout: object, source: 'api'|'entity'|'local'|'builtin', warning?: string }}
 */
export async function loadDefaultRackLayout() {
  if (isMockServer) {
    const apiErrors = [];

    try {
      const { layout } = await mockApi("/rack-layout");
      if (layout) {
        saveRackLayoutLocal(layout);
        return { layout, source: "api" };
      }
    } catch (err) {
      apiErrors.push(err.message);
    }

    try {
      const data = await mockApi("/entities/RackLayout");
      const layout = pickDefaultLayout(data);
      if (layout) {
        saveRackLayoutLocal(layout);
        return { layout, source: "entity" };
      }
    } catch (err) {
      apiErrors.push(err.message);
    }

    const cached = loadRackLayoutLocal();
    if (cached) {
      return {
        layout: cached,
        source: "local",
        warning:
          "Using saved rack layout from this browser. Restart the mock server (npm run mock) to sync with the server.",
      };
    }

    return {
      layout: getBuiltinDefaultRackLayout(),
      source: "builtin",
      warning:
        apiErrors.length > 0
          ? "Could not reach the mock server — showing the default layout. Run npm run mock from the project root, then click Retry."
          : undefined,
    };
  }

  try {
    const layouts = unwrapList(await base44.entities.RackLayout.list());
    const layout = pickDefaultLayout(layouts);
    if (layout) return { layout, source: "api" };
  } catch (err) {
    console.warn("[topologyApi] RackLayout entity list failed:", err);
  }

  const cached = loadRackLayoutLocal();
  if (cached) {
    return { layout: cached, source: "local", warning: "Using locally saved rack layout." };
  }

  return { layout: getBuiltinDefaultRackLayout(), source: "builtin" };
}

export async function saveRackLayout(layout) {
  if (isMockServer) {
    try {
      const { layout: saved } = await mockApi("/rack-layout", {
        method: "PUT",
        body: JSON.stringify(layout),
      });
      const result = saved || layout;
      saveRackLayoutLocal(result);
      return { layout: result, persisted: "api" };
    } catch (err) {
      const result = {
        ...layout,
        id: layout.id || `rack-layout-local-${Date.now()}`,
      };
      saveRackLayoutLocal(result);
      return {
        layout: result,
        persisted: "local",
        warning: `Saved in this browser only (${err.message}). Run npm run mock and save again to sync.`,
      };
    }
  }

  let saved;
  if (layout.id) {
    saved = await base44.entities.RackLayout.update(layout.id, layout);
  } else {
    saved = await base44.entities.RackLayout.create(layout);
  }
  saveRackLayoutLocal(saved || layout);
  return { layout: saved || layout, persisted: "api" };
}

export async function deleteRackLayout(id) {
  if (isMockServer) {
    try {
      await mockApi(`/rack-layout/${id}`, { method: "DELETE" });
      return { success: true };
    } catch {
      return { success: true };
    }
  }
  return base44.entities.RackLayout.delete(id);
}
