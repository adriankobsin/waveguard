import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";

/**
 * Look up approximate system location from a public IP (or host egress IP when omitted).
 * Proxied through the mock server to avoid browser CORS limits.
 */
export async function lookupLocation(ip) {
  const base = getMockAppApiBase();
  if (!base) {
    return {
      success: false,
      error: "Geolocation requires the local WaveGuard server",
      lookedUpAt: new Date().toISOString(),
    };
  }

  const res = await fetch(`${base}/functions/geoLocation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getMockAuthHeaders(),
      Accept: "application/json",
    },
    body: JSON.stringify({
      ip: ip && String(ip).trim() ? String(ip).trim() : undefined,
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error || detail;
    } catch {
      /* ignore */
    }
    return {
      success: false,
      ip: ip || null,
      error: detail,
      lookedUpAt: new Date().toISOString(),
    };
  }

  return res.json();
}
