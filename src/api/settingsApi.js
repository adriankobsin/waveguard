import { isMockServer } from "@/api/base44Client";
import { getMockAppApiBase } from "@/api/mockApiHelpers";

const mockBase = isMockServer ? getMockAppApiBase() : "";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("base44_access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function testIntegration(integrationKey, config) {
  const res = await fetch(`${mockBase}/integrations/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ integrationKey, config }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Connection test failed");
  return data;
}

export async function testOpenAiKey(apiKey) {
  const res = await fetch(`${mockBase}/ai/test-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "API key test failed");
  return data;
}

export async function listBackups() {
  const res = await fetch(`${mockBase}/backups`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to load backups");
  return data.backups || [];
}

export async function createBackup(createdBy) {
  const res = await fetch(`${mockBase}/backups`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ createdBy }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Backup failed");
  return data.backup;
}

export async function restoreBackup(backupId) {
  const res = await fetch(`${mockBase}/backups/${backupId}/restore`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Restore failed");
  return data;
}

export async function downloadBackup(backupId) {
  const res = await fetch(`${mockBase}/backups/${backupId}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Download failed");
  return data;
}

export async function createUserAccount({ username, password, role }) {
  const res = await fetch(`${mockBase}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ username, password, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create user");
  return data.user;
}

export async function updateUserAccount(id, patch) {
  const res = await fetch(`${mockBase}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update user");
  return data.user;
}

export async function deleteUserAccount(id) {
  const res = await fetch(`${mockBase}/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to delete user");
  }
}

export async function reindexDocumentation(paths) {
  const res = await fetch(`${mockBase}/documentation/reindex`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(paths),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Re-index failed");
  return data;
}
