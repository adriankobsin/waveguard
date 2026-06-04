/**
 * Shared mock router data for development and testing.
 * Each adapter can fall back to these when no live connection is available.
 */

export const MOCK_ISP_PROFILES = {
  starlink: { download: 248, upload: 42, latency: 18, isp: "Starlink Maritime" },
  lte: { download: 86, upload: 22, latency: 32, isp: "4G LTE Backup" },
  vsat: { download: 12, upload: 4, latency: 580, isp: "VSAT" },
  cellular5g: { download: 120, upload: 28, latency: 45, isp: "5G Cellular" },
  fiber: { download: 500, upload: 250, latency: 5, isp: "Fiber Primary" },
  dsl: { download: 50, upload: 10, latency: 20, isp: "DSL Backup" },
  default: { download: 95, upload: 18, latency: 24, isp: "Internet" },
};

export function mockProfileForPort(portName = "") {
  const n = String(portName).toLowerCase();
  if (/cell|lte|5g|modem/.test(n)) return MOCK_ISP_PROFILES.cellular5g;
  if (/wan2|backup|2/.test(n)) return MOCK_ISP_PROFILES.lte;
  if (/wan3|vsat|sat/.test(n)) return MOCK_ISP_PROFILES.vsat;
  if (/wan1|primary|starlink|fiber/.test(n)) return MOCK_ISP_PROFILES.starlink;
  if (/dsl/.test(n)) return MOCK_ISP_PROFILES.dsl;
  return MOCK_ISP_PROFILES.default;
}

export function runMockSpeedTest(portName) {
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

export function mockWanTraffic(down, up, meta = {}) {
  return {
    inMbps: down,
    outMbps: up,
    meta: { type: "wan", ...meta },
  };
}

export function simulateSpeedTestLatency() {
  return new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
}
