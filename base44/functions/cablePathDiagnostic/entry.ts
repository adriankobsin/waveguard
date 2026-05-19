import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Simulate realistic traceroute hops between two IPs on the same network
function simulateTraceroute(fromIp, toIp) {
  const hops = [];
  const isLocal = fromIp && toIp &&
    fromIp.split(".").slice(0, 3).join(".") === toIp.split(".").slice(0, 3).join(".");

  if (isLocal) {
    // Same subnet — typically 1-3 hops through local switches
    const gateway = fromIp.split(".").slice(0, 3).join(".") + ".1";
    const coreSwitch = fromIp.split(".").slice(0, 3).join(".") + ".10";
    hops.push({ hop: 1, ip: gateway,    hostname: "router-wan",  latencyMs: Math.round(Math.random() * 2 + 0.5),  status: "ok" });
    hops.push({ hop: 2, ip: coreSwitch, hostname: "sw-bridge",   latencyMs: Math.round(Math.random() * 3 + 1),    status: "ok" });
    hops.push({ hop: 3, ip: toIp,       hostname: null,           latencyMs: Math.round(Math.random() * 4 + 1),    status: "ok" });
  } else {
    // Different subnets or unknown — add more hops
    hops.push({ hop: 1, ip: "192.168.10.1",  hostname: "router-wan",  latencyMs: Math.round(Math.random() * 2 + 0.5), status: "ok" });
    hops.push({ hop: 2, ip: "192.168.10.10", hostname: "sw-bridge",   latencyMs: Math.round(Math.random() * 3 + 1),   status: "ok" });
    hops.push({ hop: 3, ip: "192.168.10.11", hostname: "sw-saloon",   latencyMs: Math.round(Math.random() * 4 + 2),   status: "ok" });
    if (toIp) {
      hops.push({ hop: 4, ip: toIp, hostname: null, latencyMs: Math.round(Math.random() * 5 + 2), status: "ok" });
    }
  }

  return hops;
}

function simulatePing(ip, count = 5) {
  const base = Math.random() * 8 + 1;
  const results = Array.from({ length: count }, (_, i) => {
    const lost = Math.random() < 0.05; // 5% packet loss chance
    return {
      seq: i + 1,
      latencyMs: lost ? null : parseFloat((base + Math.random() * 3).toFixed(2)),
      status: lost ? "timeout" : "ok",
    };
  });
  const received = results.filter(r => r.status === "ok");
  const latencies = received.map(r => r.latencyMs);
  return {
    target: ip,
    transmitted: count,
    received: received.length,
    packetLossPct: parseFloat(((count - received.length) / count * 100).toFixed(1)),
    minMs: latencies.length ? Math.min(...latencies) : null,
    maxMs: latencies.length ? Math.max(...latencies) : null,
    avgMs: latencies.length ? parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)) : null,
    results,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { fromDevice, toDevice, testType = "both" } = await req.json();

    if (!fromDevice || !toDevice) {
      return Response.json({ error: "fromDevice and toDevice are required" }, { status: 400 });
    }

    // Simulate test duration
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

    const fromIp = fromDevice.ip || null;
    const toIp = toDevice.ip || null;

    const result = {
      success: true,
      testedAt: new Date().toISOString(),
      fromDevice: { name: fromDevice.name, ip: fromIp },
      toDevice:   { name: toDevice.name,   ip: toIp   },
    };

    if (testType === "traceroute" || testType === "both") {
      result.traceroute = simulateTraceroute(fromIp, toIp);
      result.totalHops = result.traceroute.length;
      const lastHop = result.traceroute[result.traceroute.length - 1];
      result.endToEndLatencyMs = result.traceroute.reduce((acc, h) => acc + (h.latencyMs || 0), 0);
    }

    if (testType === "ping" || testType === "both") {
      if (toIp) {
        result.ping = simulatePing(toIp);
        result.reachable = result.ping.received > 0;
      } else {
        result.ping = null;
        result.reachable = false;
        result.note = "Target IP unknown — ping skipped";
      }
    }

    // Overall health assessment
    const avgMs = result.ping?.avgMs || result.endToEndLatencyMs;
    if (!result.reachable && testType !== "traceroute") {
      result.health = "unreachable";
    } else if (avgMs > 50) {
      result.health = "degraded";
    } else if (avgMs > 20) {
      result.health = "fair";
    } else {
      result.health = "good";
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});