/**
 * Server-side Peplink polling — InControl 2 + on-device REST.
 */

import {
  buildMockPeplinkPoll,
  normalizeLocalPeplinkStatus,
  normalizeIncontrolDeviceStatus,
  shouldUsePeplinkMock,
} from "../../src/lib/integrations/peplink/peplinkAdapter.js";

const INCONTROL_BASE = process.env.PEPLINK_INCONTROL_URL || "https://api.ic.peplink.com";

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Accept: "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Peplink API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getIncontrolToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const data = await fetchJson(`${INCONTROL_BASE}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return data.access_token;
}

async function pollIncontrolDevice(profile, globalCreds) {
  const pep = profile.peplink || {};
  const orgId = pep.incontrolOrgId || globalCreds?.incontrolOrgId;
  const deviceId = pep.deviceId;
  if (!orgId || !deviceId) {
    throw new Error("InControl org ID and device ID required");
  }
  const clientId = globalCreds?.incontrolClientId;
  const clientSecret = globalCreds?.incontrolClientSecret;
  if (!clientId || !clientSecret) {
    throw new Error("InControl API credentials not configured");
  }
  const token = await getIncontrolToken(clientId, clientSecret);
  const data = await fetchJson(`${INCONTROL_BASE}/rest/o/${orgId}/d/${deviceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const normalized = normalizeIncontrolDeviceStatus(data);
  return {
    ...normalized,
    polledAt: new Date().toISOString(),
    source: "peplink-incontrol",
  };
}

async function pollLocalDevice(ip, profile) {
  const pep = profile.peplink || {};
  const clientId = pep.localClientId;
  const clientSecret = pep.localClientSecret;
  if (!clientId || !clientSecret) {
    throw new Error("On-device API client ID and secret required");
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const data = await fetchJson(`https://${ip}/api/status`, {
    headers: { Authorization: `Basic ${auth}` },
    // @ts-ignore — Node fetch may need agent for self-signed certs in production
  });
  const normalized = normalizeLocalPeplinkStatus(data);
  return {
    ...normalized,
    polledAt: new Date().toISOString(),
    source: "peplink-local",
  };
}

/**
 * Fetch Peplink status for a managed profile.
 * @param {object} profile - normalized switch profile
 * @param {object} opts - { ip, equipment, forceMock, globalPeplinkCreds }
 */
export async function fetchPeplinkStatus(profile, opts = {}) {
  const { ip, equipment, forceMock, globalPeplinkCreds } = opts;
  const model = equipment?.model || "";
  const pep = profile.peplink || {};
  const mode = pep.mode || "auto";

  if (shouldUsePeplinkMock(forceMock) || process.env.PEPLINK_USE_MOCK === "1") {
    return buildMockPeplinkPoll(model, ip);
  }

  const tryLocal = mode === "local" || mode === "auto";
  const tryIncontrol = mode === "incontrol" || mode === "auto";

  if (tryLocal && ip && pep.localClientId && pep.localClientSecret) {
    try {
      return await pollLocalDevice(ip, profile);
    } catch (err) {
      if (mode === "local") throw err;
    }
  }

  if (tryIncontrol && pep.deviceId) {
    return await pollIncontrolDevice(profile, globalPeplinkCreds);
  }

  return buildMockPeplinkPoll(model, ip);
}

export async function testPeplinkConnection(profile, opts = {}) {
  try {
    const result = await fetchPeplinkStatus(profile, opts);
    return {
      success: true,
      source: result.source,
      portCount: result.ports?.length || 0,
      online: result.peplinkMeta?.online !== false,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
