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

async function pollLocalSpeedTest(ip, profile, wanIndex) {
  const pep = profile.peplink || {};
  const clientId = pep.localClientId;
  const clientSecret = pep.localClientSecret;
  if (!clientId || !clientSecret) {
    throw new Error("On-device API credentials required for speed test");
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`https://${ip}/api/cmd.speedtest`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wan: wanIndex }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Speed test failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json();
  return {
    success: true,
    downloadMbps: Number(data.download || data.down || 0),
    uploadMbps: Number(data.upload || data.up || 0),
    latencyMs: Number(data.latency || data.ping || 0) || null,
    jitterMs: Number(data.jitter) || null,
    server: data.server || "Peplink speed test",
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
    if (ip && profile.peplink?.localClientId && profile.peplink?.localClientSecret) {
      try {
        return await pollLocalSpeedTest(ip, profile, wanIndex);
      } catch (err) {
        if (profile.peplink?.mode === "local") throw err;
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
