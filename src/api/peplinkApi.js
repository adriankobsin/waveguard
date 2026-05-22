import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";

export async function getPeplinkCredentials() {
  const base = getMockAppApiBase();
  if (!base) {
    return { incontrolOrgId: "", incontrolClientId: "", hasClientSecret: false };
  }
  const res = await fetch(`${base}/peplink/credentials`, {
    headers: getMockAuthHeaders(),
  });
  if (!res.ok) return { incontrolOrgId: "", incontrolClientId: "", hasClientSecret: false };
  return res.json();
}

export async function savePeplinkCredentials(creds) {
  const base = getMockAppApiBase();
  if (!base) return { success: false };
  const res = await fetch(`${base}/peplink/credentials`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save Peplink credentials");
  }
  return res.json();
}
