import assert from "node:assert/strict";
import { buildTrafficSeries, dashboardStatus, dashboardCategory } from "../src/lib/systemData/dashboardMetrics.js";

assert.equal(dashboardStatus({ status: "installed" }), "online");
assert.equal(dashboardStatus({ status: "unknown" }), "online");
assert.equal(dashboardStatus({ status: "unknown", telemetry: { lanStatus: "degraded" } }), "online");
assert.equal(dashboardStatus({ status: "offline" }), "offline");
assert.equal(dashboardStatus({ status: "unknown", telemetry: { lanStatus: "down" } }), "offline");
assert.equal(dashboardStatus({ status: "warning", telemetry: { lanStatus: "degraded" } }), "warning");
assert.equal(dashboardCategory({ category: "Server" }), "network");
assert.equal(dashboardCategory({ category: "Router" }), "network");
assert.equal(dashboardCategory({ category: "Camera" }), "cctv");

const now = Date.parse("2026-11-16T12:00:00Z");
const result = buildTrafficSeries({
  profiles: [
    {
      id: "sw1",
      enabled: true,
      pollIntervalSec: 30,
      lastPoll: {
        ports: [
          { inMbps: 10, outMbps: 4 },
          { inMbps: 2, outMbps: 1 },
        ],
        trafficHistory: [
          { at: "2026-11-16T11:10:00Z", inMbps: 20, outMbps: 5 },
          { at: "2026-11-16T12:00:00Z", inMbps: 12, outMbps: 5 },
        ],
      },
    },
  ],
}, now);

assert.equal(result.source, "snmp");
assert.equal(result.live.inMbps, 12);
assert.equal(result.live.outMbps, 5);
const current = result.series[result.series.length - 1];
assert.equal(current.inMbps, 12);
assert.equal(current.outMbps, 5);
const previous = result.series.find((p) => p.time === "11:00");
assert.equal(previous.inMbps, 20);

const liveOnly = buildTrafficSeries({
  profiles: [{ id: "sw2", lastPoll: { ports: [{ inMbps: 8, outMbps: 3 }] } }],
}, now);
assert.equal(liveOnly.series.at(-1).inMbps, 8);
assert.equal(liveOnly.series.at(-1).outMbps, 3);
assert.equal(liveOnly.series[0].inMbps, 0);

const empty = buildTrafficSeries({ profiles: [] }, now);
assert.equal(empty.source, "none");
assert.equal(empty.hasTraffic, false);

console.log("dashboard metrics OK");
console.log(JSON.stringify({ current, live: result.live }, null, 2));
