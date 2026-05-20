import { getAccessToken } from "@base44/sdk";
import { isMockServer, MOCK_SERVER_URL } from "@/api/base44Client";

/** Base URL for mock-app API calls (proxied in Vite dev). */
export function getMockAppApiBase() {
  if (!isMockServer) return "";
  if (import.meta.env.DEV) {
    return "/api/apps/mock-app";
  }
  return `${MOCK_SERVER_URL}/api/apps/mock-app`;
}

/** Auth header for direct mock API fetches (matches SDK token storage). */
export function getMockAuthHeaders() {
  const token = getAccessToken() || "mock-dev-token";
  return token ? { Authorization: `Bearer ${token}` } : {};
}
