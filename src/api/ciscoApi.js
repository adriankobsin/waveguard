/**
 * Client-side Cisco API.
 *
 * Public surface:
 *   - listCiscoSwitches() / addCiscoSwitch() / removeCiscoSwitch() /
 *     saveCiscoSwitch() — CRUD over the SystemSettings ring buffer.
 *   - testCiscoSwitch(draft) — probe the host + try SSH login + system snapshot.
 *   - pollCiscoSwitch(switchId) / pollAllCiscoSwitches() — full snapshot.
 *   - subscribeCiscoEvents() — SSE for live port-change updates.
 *   - recordCiscoEvent(payload) — append to the event log.
 *
 * The shape mirrors `src/api/lightingApi.js` so the rest of the platform
 * can use the same patterns (per-key SystemSettings, localStorage mirror,
 * window CustomEvents for live UI updates, demo-mode bypass).
 */

import { base44, isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  NETWORK_CISCO_SWITCHES_KEY,
  NETWORK_CISCO_SWITCHES_CHANGED_EVENT,
  DEFAULT_CISCO_SWITCHES,
  DEFAULT_CISCO_SWITCH,
  normalizeCiscoSwitch,
  normalizeCiscoSwitches,
  loadCiscoSwitchesLocal,
  saveCiscoSwitchesLocal,
} from "@/lib/network/ciscoSwitchSettings";
import { recordCiscoEvent } from "@/lib/integrations/cisco/ciscoEventLog";
import { buildClientCiscoMockSnapshot } from "@/lib/integrations/cisco/ciscoDemoSnapshot";

export { recordCiscoEvent };

// ── Best-effort event logger ────────────────────────────────────────────

function logEvent(payload) {
  try {
    recordCiscoEvent(payload);
  } catch (err) {
    console.warn("[ciscoApi] event log failed (ignored):", err);
  }
}

// ── Persistence ────────────────────────────────────────────────────────

async function loadFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: NETWORK_CISCO_SWITCHES_KEY,
    });
    if (records.length > 0 && records[0].value != null) {
      return normalizeCiscoSwitches(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[ciscoApi] load failed:", err);
  }
  return loadCiscoSwitchesLocal() || { ...DEFAULT_CISCO_SWITCHES };
}

async function persistToSettings(payload) {
  const normalized = normalizeCiscoSwitches(payload);
  saveCiscoSwitchesLocal(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(NETWORK_CISCO_SWITCHES_CHANGED_EVENT, { detail: normalized })
    );
  }
  if (isDemoModeActive()) return normalized;
  try {
    const records = await base44.entities.SystemSettings.filter({
      key: NETWORK_CISCO_SWITCHES_KEY,
    });
    const body = { key: NETWORK_CISCO_SWITCHES_KEY, value: normalized };
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, body);
    } else {
      await base44.entities.SystemSettings.create(body);
    }
  } catch (err) {
    console.warn("[ciscoApi] save failed:", err);
  }
  return normalized;
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function listCiscoSwitches() {
  if (isDemoModeActive()) {
    return loadCiscoSwitchesLocal() || { ...DEFAULT_CISCO_SWITCHES };
  }
  return loadFromSettings();
}

export async function addCiscoSwitch(draft) {
  const incoming = normalizeCiscoSwitch({ ...DEFAULT_CISCO_SWITCH, ...draft });
  if (!incoming.host) {
    throw new Error("Host is required");
  }
  const current = await listCiscoSwitches();
  const existing = current.switches.find(
    (s) => s.host.toLowerCase() === incoming.host.toLowerCase()
  );
  if (existing) {
    // Merge — preserves the previous id and any auto-registration links.
    return saveCiscoSwitch({ ...existing, ...incoming, id: existing.id });
  }
  const next = {
    switches: [...current.switches, { ...incoming, updatedAt: new Date().toISOString() }],
  };
  const saved = await persistToSettings(next);
  logEvent({
    host: incoming.host,
    switchId: incoming.id,
    kind: "switch-added",
    severity: "info",
    action: "addSwitch",
    result: "success",
    message: `Added Cisco switch ${incoming.host}`,
  });
  return saved;
}

export async function saveCiscoSwitch(draft) {
  const incoming = normalizeCiscoSwitch(draft);
  if (!incoming.host) {
    throw new Error("Host is required");
  }
  const current = await listCiscoSwitches();
  const idx = current.switches.findIndex((s) => s.id === incoming.id);
  const next = { switches: [...current.switches] };
  const merged = { ...incoming, updatedAt: new Date().toISOString() };
  if (idx >= 0) next.switches[idx] = merged;
  else next.switches.push(merged);
  return persistToSettings(next);
}

export async function removeCiscoSwitch(switchId) {
  const current = await listCiscoSwitches();
  const removed = current.switches.find((s) => s.id === switchId);
  const next = { switches: current.switches.filter((s) => s.id !== switchId) };
  const saved = await persistToSettings(next);
  if (removed) {
    logEvent({
      host: removed.host,
      switchId: removed.id,
      kind: "switch-removed",
      severity: "info",
      action: "removeSwitch",
      result: "success",
      message: `Removed Cisco switch ${removed.host}`,
    });
  }
  return saved;
}

// ── Mock-server bridge ──────────────────────────────────────────────────

async function callMockCisco(op, body = {}) {
  if (!isMockServer) return null;
  const base = getMockAppApiBase();
  try {
    const res = await fetch(`${base}/functions/ciscoCommand`, {
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

/** Mock fallback used when the mock server is offline or in demo mode. */
function buildMockSnapshot(connection) {
  return buildClientCiscoMockSnapshot({ host: connection?.host || "192.168.10.250" });
}

export async function testCiscoSwitch(draft) {
  const conn = normalizeCiscoSwitch(draft);
  if (!conn.host) {
    return { success: false, message: "Host is required" };
  }
  if (isDemoModeActive()) {
    const mock = buildMockSnapshot(conn);
    return {
      success: true,
      host: conn.host,
      mode: "demo",
      system: mock.system,
      message: `Demo: connected to ${mock.system.hostname || mock.system.model}.`,
    };
  }
  const live = await callMockCisco("testSwitch", redactForWire(conn));
  if (live && live.success !== undefined) {
    logEvent({
      host: conn.host,
      switchId: conn.id,
      kind: "test-connection",
      severity: live.success ? "info" : "warning",
      action: "testSwitch",
      result: live.success ? "success" : "failed",
      message: live.message || live.error || (live.success ? "Connection OK" : "Connection failed"),
    });
    return live;
  }
  const mock = buildMockSnapshot(conn);
  return {
    success: true,
    host: conn.host,
    mode: "mock",
    system: mock.system,
    message: `Mock server unavailable — returning simulated data for ${mock.system.model}.`,
  };
}

export async function pollCiscoSwitchSnapshot(draft) {
  const conn = normalizeCiscoSwitch(draft);
  if (!conn.host) {
    return { success: false, message: "Host is required", snapshot: null };
  }
  if (isDemoModeActive()) {
    return { success: true, host: conn.host, mode: "demo", snapshot: buildMockSnapshot(conn) };
  }
  const live = await callMockCisco("pollAll", redactForWire(conn));
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

/**
 * Iterate every saved Cisco switch and poll a fresh snapshot. Used by the
 * dashboard / fleet wiring so the Core Network page sees Cisco data even
 * when the operator hasn't opened the dedicated page yet.
 */
export async function pollAllCiscoSwitches() {
  const { switches } = await listCiscoSwitches();
  const out = [];
  for (const sw of switches) {
    if (!sw.enabled) continue;
    try {
      const result = await pollCiscoSwitchSnapshot(sw);
      out.push({ switch: sw, ...result });
    } catch (err) {
      out.push({
        switch: sw,
        success: false,
        message: err?.message || String(err),
      });
    }
  }
  return out;
}

export async function getCiscoSystem(draft) {
  const conn = normalizeCiscoSwitch(draft);
  if (isDemoModeActive()) {
    return { success: true, system: buildMockSnapshot(conn).system };
  }
  const live = await callMockCisco("getSystem", redactForWire(conn));
  if (live) return live;
  return { success: true, mode: "mock", system: buildMockSnapshot(conn).system };
}

export async function getCiscoInterfaces(draft) {
  const conn = normalizeCiscoSwitch(draft);
  if (isDemoModeActive()) {
    return { success: true, interfaces: buildMockSnapshot(conn).interfaces };
  }
  const live = await callMockCisco("getInterfaces", redactForWire(conn));
  if (live) return live;
  return { success: true, mode: "mock", interfaces: buildMockSnapshot(conn).interfaces };
}

export async function getCiscoMacTable(draft) {
  const conn = normalizeCiscoSwitch(draft);
  if (isDemoModeActive()) {
    return { success: true, macs: buildMockSnapshot(conn).macs };
  }
  const live = await callMockCisco("getMacTable", redactForWire(conn));
  if (live) return live;
  return { success: true, mode: "mock", macs: buildMockSnapshot(conn).macs };
}

export async function getCiscoNeighbors(draft) {
  const conn = normalizeCiscoSwitch(draft);
  if (isDemoModeActive()) {
    return { success: true, neighbors: buildMockSnapshot(conn).neighbors };
  }
  const live = await callMockCisco("getNeighbors", redactForWire(conn));
  if (live) return live;
  return { success: true, mode: "mock", neighbors: buildMockSnapshot(conn).neighbors };
}

// ── Live event stream (SSE) ─────────────────────────────────────────────

export function subscribeCiscoEvents({ host, onSnapshot, onPortChange, onError, onPing } = {}) {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }
  if (!isMockServer) {
    // No live SSE outside the mock environment; the in-memory event log
    // already broadcasts via window CustomEvents.
    return () => {};
  }
  const base = getMockAppApiBase();
  const url = `${base}/functions/ciscoEvents${host ? `?host=${encodeURIComponent(host)}` : ""}`;
  let es;
  try {
    es = new EventSource(url, { withCredentials: false });
  } catch (err) {
    onError?.({ message: err?.message || "EventSource failed" });
    return () => {};
  }
  es.addEventListener("snapshot", (ev) => {
    try {
      onSnapshot?.(JSON.parse(ev.data));
    } catch { /* */ }
  });
  es.addEventListener("portChange", (ev) => {
    try {
      const data = JSON.parse(ev.data);
      onPortChange?.(data);
      logEvent({
        host: data?.host || host,
        kind: "port-change",
        severity: "info",
        action: "portChange",
        result: "success",
        message: `Port ${data?.portName || data?.ifIndex} → ${data?.status}`,
        ifIndex: data?.ifIndex,
        portName: data?.portName,
      });
    } catch { /* */ }
  });
  es.addEventListener("ping", (ev) => {
    try { onPing?.(JSON.parse(ev.data)); } catch { /* */ }
  });
  es.addEventListener("error", (ev) => {
    onError?.({ message: ev?.data || "SSE error" });
  });
  return () => {
    try { es.close(); } catch { /* */ }
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function redactForWire(conn) {
  // Send the full credentials to the mock server (it's localhost), but
  // strip nothing — both SSH and SNMP need them in cleartext.
  return {
    host: conn.host,
    sshPort: conn.sshPort,
    sshUsername: conn.sshUsername,
    sshPassword: conn.sshPassword,
    enablePassword: conn.enablePassword,
    platform: conn.platform,
    snmpEnabled: conn.snmpEnabled,
    snmpPort: conn.snmpPort,
    snmpVersion: conn.snmpVersion,
    snmpCommunity: conn.snmpCommunity,
    snmpv3User: conn.snmpv3User,
    snmpv3AuthProto: conn.snmpv3AuthProto,
    snmpv3AuthPass: conn.snmpv3AuthPass,
    snmpv3PrivProto: conn.snmpv3PrivProto,
    snmpv3PrivPass: conn.snmpv3PrivPass,
  };
}
