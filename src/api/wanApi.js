import { base44, isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { isDemoModeActive } from "@/lib/platformMode";

async function localMockSpeedTest(portName) {
  await new Promise((r) => setTimeout(r, 2200 + Math.random() * 1500));
  const n = String(portName || "").toLowerCase();
  const base =
    /cell|lte|5g|modem/.test(n)
      ? { download: 118, upload: 26, latency: 42, isp: "5G Cellular" }
      : /wan2|backup|4g/.test(n)
        ? { download: 86, upload: 22, latency: 32, isp: "4G LTE Backup" }
        : /wan3|vsat|sat/.test(n)
          ? { download: 12, upload: 4, latency: 580, isp: "VSAT" }
          : { download: 248, upload: 42, latency: 18, isp: "Starlink Maritime" };
  const jitter = () => (Math.random() - 0.5) * 0.1;
  return {
    success: true,
    downloadMbps: Math.round(base.download * (1 + jitter()) * 10) / 10,
    uploadMbps: Math.round(base.upload * (1 + jitter()) * 10) / 10,
    latencyMs: Math.round(base.latency * (1 + jitter() * 0.2)),
    jitterMs: Math.round(2 + Math.random() * 4),
    server: `${base.isp} — local mock`,
    isp: base.isp,
    source: "mock-local",
    testedAt: new Date().toISOString(),
  };
}

export async function runWanSpeedTest({ profileId, portIndex, portName }) {
  if (isDemoModeActive()) {
    return localMockSpeedTest(portName);
  }
  if (isMockServer) {
    const base = getMockAppApiBase();
    try {
      const res = await fetch(`${base}/functions/wanSpeedTest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
        body: JSON.stringify({ profileId, portIndex, portName }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
    } catch {
      /* fall through to local mock */
    }
    return localMockSpeedTest(portName);
  }

  const res = await base44.functions.invoke("wanSpeedTest", {
    profileId,
    portIndex,
    portName,
  });
  if (res.data?.success === false) {
    throw new Error(res.data.error || "Speed test failed");
  }
  return res.data;
}
