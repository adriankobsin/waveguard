/**
 * Client-side Catalyst 9800 WLC API.
 * Mirrors ciscoApi.js patterns.
 */

import { base44, isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  NETWORK_CISCO_WLC_KEY,
  NETWORK_CISCO_WLC_CHANGED_EVENT,
  DEFAULT_CISCO_WLC_CONTROLLERS,
  DEFAULT_CISCO_WLC_CONTROLLER,
  normalizeCiscoWlcController,
  normalizeCiscoWlcControllers,
  loadCiscoWlcLocal,
  saveCiscoWlcLocal,
} from "@/lib/network/ciscoWlcSettings";
import { buildClientWlcMockSnapshot } from "@/lib/integrations/cisco/wlcDemoSnapshot";

async function loadFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: NETWORK_CISCO_WLC_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeCiscoWlcControllers(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[ciscoWlcApi] load failed:", err);
  }
  return loadCiscoWlcLocal() || { ...DEFAULT_CISCO_WLC_CONTROLLERS };
}

async function persistToSettings(payload) {
  const normalized = normalizeCiscoWlcControllers(payload);
  saveCiscoWlcLocal(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(NETWORK_CISCO_WLC_CHANGED_EVENT, { detail: normalized })
    );
  }
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: NETWORK_CISCO_WLC_KEY,
    });
    const body = { key: NETWORK_CISCO_WLC_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[ciscoWlcApi] save failed:", err);
  }
  return normalized;
}

function redactForWire(conn) {
  return {
    wlcId: conn.id,
    host: conn.host,
    httpsPort: conn.httpsPort,
    port: conn.httpsPort,
    username: conn.username,
    password: conn.password,
    allowInsecure: conn.allowInsecure,
    label: conn.label,
  };
}

async function callMockWlc(op, body = {}) {
  if (!isMockServer) return null;
  const base = getMockAppApiBase();
  try {
    const res = await fetch(`${base}/functions/ciscoWlcCommand`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
      body: JSON.stringify({ op, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    return {
      success: false,
      mode: "live",
      error: data?.error || `HTTP ${res.status}`,
      _httpError: true,
    };
  } catch (err) {
    return { success: false, mode: "live", error: err?.message || String(err), _network: true };
  }
}

function buildMockSnapshot(connection) {
  return buildClientWlcMockSnapshot({ host: connection?.host || "192.168.10.1" });
}

export async function listCiscoWlcControllers() {
  if (isDemoModeActive()) {
    return loadCiscoWlcLocal() || { ...DEFAULT_CISCO_WLC_CONTROLLERS };
  }
  return loadFromSettings();
}

export async function addCiscoWlcController(draft) {
  const incoming = normalizeCiscoWlcController({ ...DEFAULT_CISCO_WLC_CONTROLLER, ...draft });
  if (!incoming.host) throw new Error("Host is required");
  const current = await listCiscoWlcControllers();
  const existing = current.controllers.find(
    (c) => c.host.toLowerCase() === incoming.host.toLowerCase()
  );
  if (existing) {
    return saveCiscoWlcController({ ...existing, ...incoming, id: existing.id });
  }
  const next = {
    controllers: [
      ...current.controllers,
      { ...incoming, updatedAt: new Date().toISOString() },
    ],
  };
  return persistToSettings(next);
}

export async function saveCiscoWlcController(draft) {
  const incoming = normalizeCiscoWlcController(draft);
  if (!incoming.host) throw new Error("Host is required");
  const current = await listCiscoWlcControllers();
  const idx = current.controllers.findIndex((c) => c.id === incoming.id);
  const next = { controllers: [...current.controllers] };
  const merged = { ...incoming, updatedAt: new Date().toISOString() };
  if (idx >= 0) next.controllers[idx] = merged;
  else next.controllers.push(merged);
  return persistToSettings(next);
}

export async function removeCiscoWlcController(controllerId) {
  const current = await listCiscoWlcControllers();
  const next = {
    controllers: current.controllers.filter((c) => c.id !== controllerId),
  };
  return persistToSettings(next);
}

export async function testCiscoWlcController(draft) {
  const conn = normalizeCiscoWlcController(draft);
  if (!conn.host) return { success: false, message: "Host is required" };
  if (isDemoModeActive()) {
    const snapshot = buildMockSnapshot(conn);
    return {
      success: true,
      host: conn.host,
      mode: "demo",
      apCount: snapshot.summary.apTotal,
      controller: snapshot.controller,
      message: `Demo: RESTCONF connected — ${snapshot.summary.apTotal} access points.`,
    };
  }
  const live = await callMockWlc("testConnection", redactForWire(conn));
  if (live && live.success !== undefined) {
    if (!live.success && live.error && !live.message) {
      return { ...live, message: live.error };
    }
    return live;
  }
  const snapshot = buildMockSnapshot(conn);
  return {
    success: true,
    host: conn.host,
    mode: "mock",
    apCount: snapshot.summary.apTotal,
    controller: snapshot.controller,
    message: `Mock server unavailable — returning simulated WLC data.`,
  };
}

export async function pollCiscoWlcSnapshot(draft) {
  const conn = normalizeCiscoWlcController(draft);
  if (!conn.host) {
    return { success: false, message: "Host is required", snapshot: null };
  }
  if (isDemoModeActive()) {
    return {
      success: true,
      host: conn.host,
      mode: "demo",
      snapshot: buildMockSnapshot(conn),
    };
  }
  const live = await callMockWlc("pollSnapshot", redactForWire(conn));
  if (live && (live.snapshot || live.success === false)) return live;
  if (live?._httpError || live?._network) {
    return {
      success: false,
      host: conn.host,
      mode: "live",
      snapshot: null,
      message: live.error || "Could not reach WaveGuard scanner service",
    };
  }
  return {
    success: false,
    host: conn.host,
    mode: "live",
    snapshot: null,
    message: live?.error || "No snapshot returned from scanner",
  };
}

export async function pollAllCiscoWlcControllers() {
  const { controllers } = await listCiscoWlcControllers();
  const out = [];
  for (const ctrl of controllers) {
    if (!ctrl.enabled) continue;
    try {
      const result = await pollCiscoWlcSnapshot(ctrl);
      if (result.success && result.snapshot) {
        await saveCiscoWlcController({
          ...ctrl,
          lastSnapshot: result.snapshot,
          lastConnectedAt: new Date().toISOString(),
          lastError: null,
          controller: result.snapshot.controller,
        });
      } else if (!result.success) {
        await saveCiscoWlcController({
          ...ctrl,
          lastError: result.message || result.error || "Poll failed",
        });
      }
      out.push({ controller: ctrl, ...result });
    } catch (err) {
      out.push({
        controller: ctrl,
        success: false,
        message: err?.message || String(err),
      });
    }
  }
  return out;
}

export async function getCiscoWlcApDetail(draft, wtpMac) {
  const conn = normalizeCiscoWlcController(draft);
  if (isDemoModeActive()) {
    const snapshot = buildMockSnapshot(conn);
    const ap = snapshot.accessPoints.find(
      (a) => a.wtpMac?.toUpperCase() === String(wtpMac).toUpperCase()
    );
    return { success: true, ap: ap || null };
  }
  return callMockWlc("getApDetail", { ...redactForWire(conn), wtpMac });
}
