// Diagnostic: ReadRequest /zone/<id>/status for one specific zone and dump
// the raw response. Useful for figuring out what fields the processor
// reports for openCloseStop / shade / tilt zones so the subscription
// parser knows how to interpret them.
//
//   WAVEGUARD_CONFIG_DIR=mock-server/leap-certs \
//   node scripts/probeZoneStatus.mjs <zoneId>

import { getLeapClient, isPaired } from "../scanner/integrations/lutron/leapClient.js";

const HOST = process.env.LUTRON_HOST || "192.168.20.70";
const zoneId = process.argv[2] || "5722"; // G.01 STAIR HALL · SHADE BLIND

if (!isPaired(HOST)) {
  console.error(`Processor at ${HOST} is not paired.`);
  process.exit(1);
}

const client = getLeapClient({ host: HOST, port: 8081 });
await client.connect();
await new Promise((r) => setTimeout(r, 1000));

console.log(`\n── ReadRequest /zone/${zoneId} ─────────────────`);
const defResp = await client.client.request("ReadRequest", `/zone/${zoneId}`);
console.log(JSON.stringify(defResp?.Body ?? {}, null, 2));

console.log(`\n── ReadRequest /zone/${zoneId}/status ──────────`);
const statusResp = await client.client.request("ReadRequest", `/zone/${zoneId}/status`);
console.log(JSON.stringify(statusResp?.Body ?? {}, null, 2));

process.exit(0);
