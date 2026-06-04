import { isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";

const mockBase = isMockServer ? getMockAppApiBase() : "";

function authHeaders() {
  return isMockServer ? getMockAuthHeaders() : {};
}

async function api(path, options = {}) {
  const res = await fetch(`${mockBase}/integrations${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "API request failed");
  return data;
}

export async function getIntegrationDashboard() {
  return api("/dashboard");
}

export async function getIntegrationTypes(category) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return api(`/types${qs}`);
}

export async function getIntegrationCategories() {
  return api("/categories");
}

export async function getIntegrationConfigs(typeId) {
  const qs = typeId ? `?type_id=${encodeURIComponent(typeId)}` : "";
  return api(`/configs${qs}`);
}

export async function getIntegrationConfig(id) {
  return api(`/configs/${id}`);
}

export async function createIntegrationConfig(body) {
  return api("/configs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateIntegrationConfig(id, body) {
  return api(`/configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteIntegrationConfig(id) {
  return api(`/configs/${id}`, { method: "DELETE" });
}

export async function testIntegrationConfig(id) {
  return api(`/configs/${id}/test`, { method: "POST" });
}

export async function getIntegrationLogs(id, limit = 50) {
  return api(`/configs/${id}/logs?limit=${limit}`);
}
