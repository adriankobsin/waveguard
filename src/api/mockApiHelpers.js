import { getAccessToken } from "@base44/sdk";
import { isMockServer } from "@/api/base44Client";

/** Base URL for mock-app API calls (proxied via Nginx or Vite). */
export function getMockAppApiBase() {
  if (!isMockServer) return "";
  return "/api/apps/mock-app";
}

/** Auth header for direct mock API fetches (matches SDK token storage). */
export function getMockAuthHeaders() {
  const token = getAccessToken() || "mock-dev-token";
  return token ? { Authorization: `Bearer ${token}` } : {};
}
