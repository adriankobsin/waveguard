/**
 * WAN speed test — Peplink on-device API or mock for dev.
 */

import { buildMockPeplinkPoll } from "../../src/lib/integrations/peplink/peplinkAdapter.js";

const MOCK_ISP_PROFILES = {
  wan1: { download: 248, upload: 42, latency: 18, isp: "Starlink Maritime" },
  wan2: { download: 86, upload: 22, latency: 32, isp: "4G LTE Backup" },
  wan3: { download: 12, upload: 4, latency: 580, isp: "VSAT" },
  cellular: { download: 120, upload: 28, latency: 45, isp: "5G Cellular" },
  default: { download: 95, upload: 18, latency: 24, isp: "Internet" },
};

function mockProfileForPort(portName = "") {
  const n = String(portName).toLowerCase();
  if (/cell|lte|5g|modem/.test(n)) return MOCK_ISP_PROFILES.cellular;
  if (/wan2|backup|2/.test(n)) return MOCK_ISP_PROFILES.wan2;
  if (/wan3|vsat|sat/.test(n)) return MOCK_ISP_PROFILES.wan3;
  if (/wan1|primary|starlink/.test(n)) return MOCK_ISP_PROFILES.wan1;
  return MOCK_ISP_PROFILES.default;
}

async function sessionLogin(ip, username, password) {
  const res = await fetch(`https://${ip}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status})`);
  }
  const body = await res.json();
  if (body.stat === "fail") {
    throw new Error(`Login failed: ${body.message || "invalid credentials"}`);
  }
  const cookies = res.headers.getSetCookie?.() || [];
  const bauth = cookies.find((c) => c.startsWith("bauth="));
  if (!bauth) {
    throw new Error("Peplink login succeeded but no bauth cookie received");
  }
  return bauth.split(";")[0];
}

async function getLocalToken(ip, clientId, clientSecret) {
  const res = await fetch(`https://${ip}/api/auth.token.grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, scope: "api" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token grant failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json();
  if (data.stat === "fail") {
    throw new Error(`Token grant failed: ${data.message || "unknown"}`);
  }
  if (!data.response?.accessToken) {
    throw new Error("No access token in Peplink response");
  }
  return data.response.accessToken;
}

async function pollLocalSpeedTest(ip, profile, wanIndex) {
  const sessionCreds = profile.browserLogin?.username && profile.browserLogin?.password
    ? { username: profile.browserLogin.username, password: profile.browserLogin.password }
    : null;
  const tokenCreds = profile.peplink?.localClientId && profile.peplink?.localClientSecret
    ? { clientId: profile.peplink.localClientId, clientSecret: profile.peplink.localClientSecret }
    : null;

  if (!sessionCreds && !tokenCreds) {
    throw new Error("On-device API credentials required for speed test");
  }

  let authCookie = null;
  let authToken = null;

  if (sessionCreds) {
    try {
      authCookie = await sessionLogin(ip, sessionCreds.username, sessionCreds.password);
    } catch (err) {
      if (!tokenCreds) throw err;
    }
  }

  if (!authCookie && tokenCreds) {
    authToken = await getLocalToken(ip, tokenCreds.clientId, tokenCreds.clientSecret);
  }

  const authSuffix = authCookie ? "" : `?accessToken=${encodeURIComponent(authToken)}`;
  const authHeaders = authCookie ? { Cookie: authCookie } : {};

  const res = await fetch(`https://${ip}/api/cmd.speedtest${authSuffix}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ wan: wanIndex }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Speed test failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json();
  if (data.stat === "fail") {
    throw new Error(`Speed test failed: ${data.message || "unknown error"}`);
  }
  const result = data.response || data;
  return {
    success: true,
    downloadMbps: Number(result.download || result.down || 0),
    uploadMbps: Number(result.upload || result.up || 0),
    latencyMs: Number(result.latency || result.ping || 0) || null,
    jitterMs: Number(result.jitter) || null,
    server: result.server || "Peplink speed test",
    source: "peplink-local",
    testedAt: new Date().toISOString(),
  };
}

function runMockSpeedTest(portName) {
  const base = mockProfileForPort(portName);
  const jitter = () => (Math.random() - 0.5) * 0.12;
  return {
    success: true,
    downloadMbps: Math.round(base.download * (1 + jitter()) * 10) / 10,
    uploadMbps: Math.round(base.upload * (1 + jitter()) * 10) / 10,
    latencyMs: Math.round(base.latency * (1 + jitter() * 0.3)),
    jitterMs: Math.round(2 + Math.random() * 4),
    server: `${base.isp} — WaveGuard mock`,
    isp: base.isp,
    source: "mock",
    testedAt: new Date().toISOString(),
  };
}

/**
 * Run a WAN speed test for a managed router profile + WAN port index.
 */
export async function runWanSpeedTest(profile, opts = {}) {
  const { ip, equipment, wanIndex = 1, portName = "", forceMock } = opts;
  const useMock =
    forceMock ||
    process.env.PEPLINK_USE_MOCK === "1" ||
    process.env.WAN_SPEEDTEST_MOCK === "1";

  if (useMock) {
    await new Promise((r) => setTimeout(r, 2200 + Math.random() * 1800));
    return runMockSpeedTest(portName);
  }

  if (profile.integrationVendor === "peplink" || profile.pollMethod === "peplink_hybrid") {
    if (ip) {
      const hasSessionCreds = !!(profile.browserLogin?.username && profile.browserLogin?.password);
      const hasTokenCreds = !!(profile.peplink?.localClientId && profile.peplink?.localClientSecret);
      if (hasSessionCreds || hasTokenCreds) {
        try {
          return await pollLocalSpeedTest(ip, profile, wanIndex);
        } catch (err) {
          if (profile.peplink?.mode === "local") throw err;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
    const mock = buildMockPeplinkPoll(equipment?.model, ip);
    const port = mock.ports?.find((p) => p.index === wanIndex) || mock.ports?.[0];
    return runMockSpeedTest(port?.name || portName);
  }

  await new Promise((r) => setTimeout(r, 2500));
  return runMockSpeedTest(portName);
}
