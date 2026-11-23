/** AV Flow API: live NVX + Dante + network picture, NVX routing, settings. */
import { isDemoModeActive } from "@/lib/platformMode";
import { buildAvFlowDemo } from "@/lib/av/avFlowDemo";

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export async function scanAvFlow({ seconds = 4 } = {}) {
  if (isDemoModeActive()) {
    await new Promise((r) => setTimeout(r, 500));
    return buildAvFlowDemo();
  }
  return request("POST", "/api/av-flow/scan", { seconds });
}

export async function routeNvx({ rxIp, txIp }) {
  if (isDemoModeActive()) {
    await new Promise((r) => setTimeout(r, 500));
    return { demo: true, rxIp, txIp };
  }
  return request("POST", "/api/av-flow/nvx/route", { rxIp, txIp });
}

export async function getAvFlowSettings() {
  if (isDemoModeActive()) return { settings: { nvxUsername: "admin", nvxPassword: "********", extraNvxIps: [] } };
  return request("GET", "/api/av-flow/settings");
}

export async function saveAvFlowSettings(settings) {
  if (isDemoModeActive()) return { settings };
  return request("PUT", "/api/av-flow/settings", settings);
}
