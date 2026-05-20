#!/usr/bin/env node
/**
 * API smoke tests against the local mock server (live scanner mode).
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
const BASE = (process.argv[2] || "http://localhost:3002").replace(/\/$/, "");
const APP = "mock-app";
const API = `${BASE}/api/apps/${APP}`;

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}: ${detail}`);
}

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\nWaveGuard smoke tests → ${BASE}\n`);

  // Scanner health
  const health = await fetch(`${API}/scanner/health`).then((r) => r.json());
  if (health.ok && health.localSubnets?.length) {
    ok(`scanner health (${health.scanInterface}, subnets: ${health.localSubnets.join(", ")})`);
  } else {
    fail("scanner health", JSON.stringify(health));
  }

  // Auth — WaveAdmin
  const login = await request("POST", "/auth/login", {
    username: "WaveAdmin",
    password: "Wave-avi23!",
  });
  if (login.status === 200 && login.json.access_token) {
    ok("auth login (WaveAdmin)");
  } else {
    fail("auth login", `${login.status} ${JSON.stringify(login.json)}`);
  }
  const token = login.json?.access_token;

  // Auth — bad password
  const badLogin = await request("POST", "/auth/login", {
    username: "WaveAdmin",
    password: "wrong",
  });
  if (badLogin.status === 401) ok("auth rejects bad password");
  else fail("auth rejects bad password", String(badLogin.status));

  // User me
  const me = await request("GET", "/entities/User/me", null, token);
  if (me.status === 200 && me.json?.username) ok(`User/me (${me.json.username})`);
  else fail("User/me", `${me.status}`);

  // Equipment list
  const equipRes = await fetch(`${API}/entities/Equipment`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const equip = { status: equipRes.status, json: await equipRes.json() };
  const items = Array.isArray(equip.json) ? equip.json : equip.json?.data;
  if (equip.status === 200 && Array.isArray(items) && items.length > 0) {
    ok(`Equipment list (${items.length} items)`);
  } else {
    fail("Equipment list", `${equip.status}`);
  }

  // Cables
  const cables = await fetch(`${API}/entities/Cable`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const cableList = Array.isArray(cables) ? cables : cables?.data;
  if (Array.isArray(cableList) && cableList.length > 0) ok(`Cables (${cableList.length})`);
  else fail("Cables", "empty or error");

  // Discover subnets (live)
  const subnets = await request("POST", "/functions/discoverSubnets", {});
  if (subnets.status === 200 && subnets.json?.subnets?.length) {
    ok(`discoverSubnets (${subnets.json.subnets.join(", ")})`);
  } else {
    fail("discoverSubnets", JSON.stringify(subnets.json));
  }

  // Network scan — ping on localhost only (fast)
  const scan = await request("POST", "/functions/networkScan", {
    subnets: ["127.0.0.0/24"],
    scanType: "ping",
    target: "127.0.0.1",
    snmpEnabled: false,
  });
  if (scan.status === 200 && scan.json?.success !== false) {
    const count = scan.json?.devices?.length ?? scan.json?.results?.length ?? "?";
    ok(`networkScan ping localhost (${count} device(s))`);
  } else {
    fail("networkScan", `${scan.status} ${JSON.stringify(scan.json)?.slice(0, 200)}`);
  }

  // Topology layout load
  const layout = await request("POST", "/functions/loadTopologyLayout", {});
  if (layout.status === 200) ok("loadTopologyLayout");
  else fail("loadTopologyLayout", String(layout.status));

  // SNMP port map (mock response)
  const snmp = await request("POST", "/functions/snmpPortMap", { deviceId: "dev-1" });
  if (snmp.status === 200) ok("snmpPortMap");
  else fail("snmpPortMap", String(snmp.status));

  // Vite proxy (optional)
  try {
    const proxy = await fetch("http://localhost:5173/api/apps/mock-app/scanner/health");
    if (proxy.ok) ok("Vite /api proxy to mock server");
    else fail("Vite proxy", String(proxy.status));
  } catch (e) {
    fail("Vite proxy", e.message);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
