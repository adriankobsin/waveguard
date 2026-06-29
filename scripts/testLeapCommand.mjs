// Generic LEAP command tester — sends a setOutput against a real
// processor with an optional kind hint, so you can verify the
// CreateRequest dispatch (GoToDimmedLevel / GoToShadeLevel /
// GoToSwitchedLevel / etc. + fallback chain) without going through
// the full UI.
//
// Usage:
//   node scripts/testLeapCommand.mjs <zoneId> <level> [kindHint]
//     zoneId      Lutron integration ID (e.g. 1184)
//     level       0–100
//     kindHint    "dimmed" | "switched" | "shade" | "tilt" | "shadeAndTilt"
//                 (defaults to "dimmed")
//
// WAVEGUARD_CONFIG_DIR must point at the paired-cert folder, or the
// script must run from the directory that contains `leap-certs/`.
//
// Example:
//   WAVEGUARD_CONFIG_DIR=mock-server/leap-certs node scripts/testLeapCommand.mjs 1184 50 shade

import { getLeapClient, isPaired } from "../scanner/integrations/lutron/leapClient.js";

const HOST = process.env.LUTRON_HOST || "192.168.20.70";
const zoneId = process.argv[2];
const level = Number(process.argv[3]);
const kindHint = process.argv[4] || "dimmed";

if (!zoneId || Number.isNaN(level)) {
  console.error(
    "Usage: node scripts/testLeapCommand.mjs <zoneId> <level 0-100> [kindHint]"
  );
  process.exit(1);
}
if (!isPaired(HOST)) {
  console.error(`Processor at ${HOST} is not paired. Run pairing first.`);
  process.exit(1);
}

const client = getLeapClient({ host: HOST, port: 8081 });
await client.connect();
await new Promise((r) => setTimeout(r, 1500));

console.log(
  `\nSending setOutput(zone=${zoneId}, level=${level}, kindHint=${kindHint}) against ${HOST}…\n`
);

try {
  const result = await client.setOutput(zoneId, level, 0, kindHint);
  console.log("\n✓ setOutput succeeded:", result);
} catch (err) {
  console.log("\n✗ setOutput failed:", err.message);
  if (err.leapStatus) console.log("  leapStatus:", err.leapStatus);
}

await new Promise((r) => setTimeout(r, 500));
process.exit(0);
