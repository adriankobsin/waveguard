/**
 * Client for the standalone-server APIs (monitoring, alerts, notification
 * channels, network tools, config backups, host health, updates).
 * Auth is the HttpOnly session cookie set at login — same-origin fetch sends it.
 */

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !window.location.pathname.startsWith("/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Session expired — please log in again");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

const get = (p) => request("GET", p);
const post = (p, b = {}) => request("POST", p, b);
const put = (p, b = {}) => request("PUT", p, b);
const del = (p) => request("DELETE", p);

// ---- auth / account
export const authStatus = () => get("/api/auth/status");
export const logout = () => post("/api/auth/logout");
export const changePassword = (currentPassword, newPassword) => post("/api/auth/change-password", { currentPassword, newPassword });
export const listSessions = () => get("/api/auth/sessions");

// ---- monitors
export const listMonitors = () => get("/api/monitors");
export const monitorSummary = () => get("/api/monitors/summary");
export const createMonitor = (m) => post("/api/monitors", m);
export const updateMonitor = (id, m) => put(`/api/monitors/${id}`, m);
export const deleteMonitor = (id) => del(`/api/monitors/${id}`);
export const checkMonitor = (id) => post(`/api/monitors/${id}/check`);
export const monitorHistory = (id, hours = 24) => get(`/api/monitors/${id}/history?hours=${hours}`);
export const importMonitorsFromEquipment = (categories) => post("/api/monitors/import-equipment", { categories });
export const listAlerts = (limit = 200) => get(`/api/alerts?limit=${limit}`);
export const clearAlerts = () => del("/api/alerts");
export const getMaintenanceWindow = () => get("/api/maintenance-window");
export const setMaintenanceWindow = (minutes, reason) => put("/api/maintenance-window", { minutes, reason });

// ---- notification channels
export const listChannels = () => get("/api/notifications/channels");
export const createChannel = (c) => post("/api/notifications/channels", c);
export const updateChannel = (id, c) => put(`/api/notifications/channels/${id}`, c);
export const deleteChannel = (id) => del(`/api/notifications/channels/${id}`);
export const testChannel = (id) => post(`/api/notifications/channels/${id}/test`);

// ---- network tools
export const toolInventory = () => get("/api/tools/inventory");
export const runTool = (name, params) => post(`/api/tools/${name}`, params);
export const getTool = (name) => get(`/api/tools/${name}`);

// ---- config backups
export const listConfigBackups = () => get("/api/config-backups");
export const runConfigBackup = (host) => post("/api/config-backups/run", host ? { host } : {});
export const getConfigBackup = (id) => get(`/api/config-backups/${id}`);
export const diffConfigBackup = (id, against) => get(`/api/config-backups/${id}/diff${against ? `?against=${against}` : ""}`);

// ---- system
export const systemHealth = () => get("/api/system/health");
export const updateStatus = () => get("/api/system/update");
export const requestUpdate = () => post("/api/system/update");
export const importBackup = (payload) => post("/api/system/import", payload);
export const exportBackupUrl = "/api/system/export";

// ---- formatting helpers
export function formatBytes(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function formatDuration(sec) {
  if (sec == null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
