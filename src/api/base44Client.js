import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const isMockServer =
  typeof window !== "undefined" && !window.location.host.includes("base44.app");

export const MOCK_SERVER_URL = "http://localhost:3002";

export const base44 = createClient({
  appId: isMockServer ? "mock-app" : appId,
  token: isMockServer ? "mock-dev-token" : token,
  functionsVersion,
  serverUrl: isMockServer ? MOCK_SERVER_URL : "",
  requiresAuth: false,
  appBaseUrl: isMockServer ? MOCK_SERVER_URL : appBaseUrl,
});
