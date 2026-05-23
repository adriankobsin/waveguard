// Diagnostic: ask a paired Lutron processor for every zone it knows
// about, then ReadRequest each one and print its ControlType. Useful
// for verifying that the new probe-based kind detection in leapClient
// will classify shades, blinds and switched zones correctly.
//
// Usage:
//   WAVEGUARD_CONFIG_DIR=mock-server/leap-certs node scripts/probeZoneKinds.mjs

import { getLeapClient, isPaired } from "../scanner/integrations/lutron/leapClient.js";

const HOST = process.env.LUTRON_HOST || "192.168.20.70";

if (!isPaired(HOST)) {
  console.error(`Processor at ${HOST} is not paired. Run pairing first.`);
  process.exit(1);
}

const client = getLeapClient({ host: HOST, port: 8081 });
await client.connect();
// Wait for the subscription to seed the zone list.
await new Promise((r) => setTimeout(r, 2000));

const ids = [...client.lastLevels.keys()];
console.log(`Subscription seeded ${ids.length} zone(s); probing each for ControlType…\n`);

// Probe each in parallel, in batches of 10 so we don't flood the processor.
const zones = [];
const BATCH = 10;
for (let i = 0; i < ids.length; i += BATCH) {
  const slice = ids.slice(i, i + BATCH);
  const results = await Promise.all(
    slice.map(async (id) => {
      try {
        const resp = await client.client.request("ReadRequest", `/zone/${id}`);
        const z = resp?.Body?.Zone || resp?.Body || {};
        return {
          id,
          name: z.Name || "(unnamed)",
          controlType: z.ControlType || "?",
          area: z.AssociatedArea?.href || "",
        };
      } catch (err) {
        return { id, name: "(error)", controlType: err.message };
      }
    })
  );
  zones.push(...results);
}

const byKind = new Map();
for (const z of zones) {
  const list = byKind.get(z.controlType) || [];
  list.push(z);
  byKind.set(z.controlType, list);
}

console.log(`Probed ${zones.length} zone(s):\n`);
for (const [kind, list] of [...byKind.entries()].sort()) {
  console.log(`── ${kind} × ${list.length} ${"─".repeat(Math.max(0, 36 - kind.length))}`);
  for (const z of list.slice(0, 10)) {
    console.log(`  /zone/${z.id.padEnd(6)} ${z.name}`);
  }
  if (list.length > 10) console.log(`  … and ${list.length - 10} more`);
  console.log();
}

process.exit(0);
