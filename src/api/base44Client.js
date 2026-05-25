import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const isMockServer =
  typeof window !== "undefined" && !window.location.host.includes("base44.app");

export const MOCK_SERVER_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3002";

function resolveLocalServerUrl() {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_SCANNER_URL;
  if (envUrl) return String(envUrl).replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  return MOCK_SERVER_URL;
}

export const base44 = createClient({
  appId: isMockServer ? "mock-app" : appId,
  token: isMockServer ? "mock-dev-token" : token,
  functionsVersion,
  serverUrl: isMockServer ? resolveLocalServerUrl() : "",
  requiresAuth: false,
  appBaseUrl: isMockServer ? (resolveLocalServerUrl() || MOCK_SERVER_URL) : appBaseUrl,
});
