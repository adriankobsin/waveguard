const ONLINE = new Set(["online", "up", "ok", "active", "healthy", "installed", "present", "running"]);
const OFFLINE = new Set(["offline", "down", "failed", "unreachable", "fault", "critical"]);
const WARNING = new Set(["warning", "degraded", "alarm", "degraded-link"]);

/** Map inventory and probe statuses onto the dashboard's three states. */
export function dashboardStatus(eq) {
  const raw = String(eq?.status || "").trim().toLowerCase();
  const lan = String(eq?.telemetry?.lanStatus || "").trim().toLowerCase();
  if (OFFLINE.has(raw) || lan === "down") return "offline";
  if (WARNING.has(raw)) return "warning";
  // Inventory rows are stored as unknown/installed with a placeholder lanStatus
  // of "degraded". That placeholder is not a measured fault.
  if (lan === "degraded" && raw && raw !== "unknown" && raw !== "installed" && !ONLINE.has(raw)) {
    return "warning";
  }
  return "online";
}

/** Fold spreadsheet categories into the dashboard buckets. */
export function dashboardCategory(eq) {
  const c = String(eq?.category || "").trim().toLowerCase();
  if (["network", "router", "server", "switch", "wireless", "firewall", "it"].includes(c)) return "network";
  if (["av", "audio", "video"].includes(c)) return "av";
  if (["camera", "cctv", "security"].includes(c)) return "cctv";
  if (["power", "ups", "pdu"].includes(c)) return "power";
  if (c === "lighting" || c === "shade" || c === "shades") return "lighting";
  if (["control", "automation", "processor"].includes(c)) return "control";
  return "other";
}

function hourStart(ms) {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  d.setSeconds(0, 0);
  d.setMilliseconds(0);
  return d.getTime();
}

function hourBuckets(now = Date.now()) {
  return Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now - (23 - i) * 3600000);
    const start = hourStart(hour.getTime());
    const label = new Date(start);
    return {
      time: `${String(label.getHours()).padStart(2, "0")}:00`,
      start,
      inMbps: 0,
      outMbps: 0,
      samples: 0,
    };
  });
}

function sampleTimestamp(sample, fallbackMs) {
  if (sample?.at) {
    const t = new Date(sample.at).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return fallbackMs;
}

function sumPortRates(profile) {
  let inMbps = 0;
  let outMbps = 0;
  for (const port of profile?.lastPoll?.ports || []) {
    if (port?.slotEmpty) continue;
    inMbps += Number(port.inMbps) || 0;
    outMbps += Number(port.outMbps) || 0;
  }
  return {
    inMbps: Math.round(inMbps * 10) / 10,
    outMbps: Math.round(outMbps * 10) / 10,
  };
}

/**
 * 24-hour inbound/outbound series from switch poll history.
 * Live port rates fill the current hour when history has not been stored yet.
 */
export function buildTrafficSeries(snmpSwitches, now = Date.now()) {
  const buckets = hourBuckets(now);
  const profiles = (snmpSwitches?.profiles || []).filter((p) => p && p.enabled !== false);
  const latestBySwitch = new Map();

  for (const profile of profiles) {
    const hist = profile.lastPoll?.trafficHistory || [];
    const intervalMs = Math.max(5, Number(profile.pollIntervalSec) || 30) * 1000;
    hist.forEach((sample, idx) => {
      const fromEnd = hist.length - 1 - idx;
      const t = sampleTimestamp(sample, now - fromEnd * intervalMs);
      const start = hourStart(t);
      const bucketIndex = buckets.findIndex((b) => b.start === start);
      if (bucketIndex < 0) return;
      const key = `${profile.id || profile.equipmentId || "sw"}:${bucketIndex}`;
      const prev = latestBySwitch.get(key);
      if (!prev || t >= prev.t) {
        latestBySwitch.set(key, {
          t,
          inMbps: Number(sample.inMbps) || 0,
          outMbps: Number(sample.outMbps) || 0,
        });
      }
    });
  }

  const hourTotals = new Map();
  for (const [key, sample] of latestBySwitch) {
    const hour = key.split(":").pop();
    const acc = hourTotals.get(hour) || { inMbps: 0, outMbps: 0 };
    acc.inMbps += sample.inMbps;
    acc.outMbps += sample.outMbps;
    hourTotals.set(hour, acc);
  }
  hourTotals.forEach((acc, hour) => {
    const bucket = buckets[Number(hour)];
    if (!bucket) return;
    bucket.inMbps = Math.round(acc.inMbps * 10) / 10;
    bucket.outMbps = Math.round(acc.outMbps * 10) / 10;
    bucket.samples = 1;
  });

  let liveIn = 0;
  let liveOut = 0;
  for (const profile of profiles) {
    const rates = sumPortRates(profile);
    liveIn += rates.inMbps;
    liveOut += rates.outMbps;
  }
  liveIn = Math.round(liveIn * 10) / 10;
  liveOut = Math.round(liveOut * 10) / 10;

  const hasHistory = hourTotals.size > 0;
  if (!hasHistory && (liveIn || liveOut)) {
    buckets[23].inMbps = liveIn;
    buckets[23].outMbps = liveOut;
    buckets[23].samples = 1;
  }

  const series = buckets.map(({ time, inMbps, outMbps }) => ({ time, inMbps, outMbps }));
  const hasTraffic = series.some((p) => p.inMbps > 0 || p.outMbps > 0) || liveIn > 0 || liveOut > 0;
  return {
    series,
    live: { inMbps: liveIn, outMbps: liveOut },
    hasTraffic,
    source: hasTraffic ? "snmp" : "none",
  };
}

/** Plot only measured latency. Missing hours stay null so the chart does not invent a day of samples. */
export function buildWanLatencySeries(latencyMs, now = Date.now()) {
  const value = Number(latencyMs);
  const known = Number.isFinite(value) && value > 0;
  return Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now - (23 - i) * 3600000);
    return {
      hour: `${String(hour.getHours()).padStart(2, "0")}:00`,
      latency: known && i === 23 ? Math.round(value) : null,
    };
  });
}
