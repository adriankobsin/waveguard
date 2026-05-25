import { base44, isMockServer } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

const APP_ID = appParams.appId || import.meta.env.VITE_BASE44_APP_ID || "mock-app";

export function getScannerBaseUrl(agentUrl) {
  const fromSettings = agentUrl?.trim();
  if (fromSettings) return fromSettings.replace(/\/$/, "");
  const fromEnv = import.meta.env.VITE_SCANNER_URL || import.meta.env.VITE_API_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, "");
  if (isMockServer && import.meta.env.DEV) return "";
  if (isMockServer) return typeof window !== "undefined" ? window.location.origin : "http://localhost:3002";
  return "";
}

function unwrapInvokeResponse(res) {
  if (!res) return {};
  if (res.data && typeof res.data === "object" && ("success" in res.data || "subnets" in res.data || "devices" in res.data)) {
    return res.data;
  }
  if (typeof res.success === "boolean" || res.subnets || res.devices) return res;
  return res.data ?? res;
}

const SCANNER_HELP =
  'Start the WaveGuard scanner: run "npm run mock" (or "npm run dev:all") in the project folder. If port 3002 is in use, stop the old process and restart.';

async function postScannerFunction(functionName, body, agentUrl) {
  const base = getScannerBaseUrl(agentUrl);
  const url = `${base}/api/apps/${APP_ID}/functions/${functionName}`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    throw new Error(`${SCANNER_HELP} (${err.message})`);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(`${SCANNER_HELP} (received HTML instead of JSON — wrong service on the scanner port).`);
    }
    throw new Error(`Invalid scanner response (${res.status}). ${SCANNER_HELP}`);
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Scanner error (${res.status}). ${SCANNER_HELP}`);
  }
  return data;
}

/** Check that the on-prem scanner agent is reachable. */
export async function checkScannerHealth(agentUrl) {
  const base = getScannerBaseUrl(agentUrl);
  try {
    const res = await fetch(`${base}/api/apps/${APP_ID}/scanner/health`);
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text.includes("Cannot GET") ? SCANNER_HELP : `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Detect IPv4 subnets on the machine running the scanner agent. */
export async function discoverSubnets(agentUrl) {
  if (!isMockServer) {
    const res = await base44.functions.invoke("discoverSubnets", {});
    return unwrapInvokeResponse(res);
  }
  return postScannerFunction("discoverSubnets", {}, agentUrl);
}

/** Run a live network discovery scan (ping / arp / full). */
export async function networkScan(payload, agentUrl) {
  if (!isMockServer) {
    const res = await base44.functions.invoke("networkScan", payload);
    return unwrapInvokeResponse(res);
  }
  return postScannerFunction("networkScan", payload, agentUrl);
}
