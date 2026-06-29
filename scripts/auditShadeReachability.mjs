/**
 * Cross-reference the shade/blind/blackout zones listed in a Lutron
 * Integration Report against the live LEAP processor, so we can tell
 * which of those zones are actually reachable and what ControlType the
 * processor reports for each.
 *
 * Outputs three tables:
 *   - shades the processor confirms (with ControlType)
 *   - shades the processor returns a Dimmed ControlType for (probably a
 *     misclassification in the report)
 *   - shades the processor doesn't recognise at all (likely live on a
 *     separate Sivoia QS+ / second QSX processor)
 *
 * Usage:
 *   WAVEGUARD_CONFIG_DIR=mock-server/leap-certs \
 *   node scripts/auditShadeReachability.mjs ["c:/path/to/report.pdf"]
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { getLeapClient, isPaired } from "../scanner/integrations/lutron/leapClient.js";
import { parseLutronIntegrationReport } from "../src/lib/lighting/parseLutronIntegrationReport.js";

const require = createRequire(import.meta.url);
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HOST = process.env.LUTRON_HOST || "192.168.20.70";
const ROW_TOLERANCE = 2.5;
const COLUMN_GAP_THRESHOLD = 18;

function groupRows(items) {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > ROW_TOLERANCE) return a.y - b.y;
    return a.x - b.x;
  });
  const rows = [];
  let currentY = null;
  let currentRow = null;
  for (const it of sorted) {
    if (currentY === null || Math.abs(it.y - currentY) > ROW_TOLERANCE) {
      currentY = it.y;
      currentRow = [];
      rows.push(currentRow);
    }
    currentRow.push(it);
  }
  return rows;
}

function rowToLine(row) {
  if (!row.length) return "";
  row.sort((a, b) => a.x - b.x);
  let out = row[0].str;
  let lastEnd = row[0].x + row[0].width;
  for (let i = 1; i < row.length; i += 1) {
    const it = row[i];
    const gap = it.x - lastEnd;
    if (gap > COLUMN_GAP_THRESHOLD) out += "\t";
    else if (gap > 1.5) out += " ";
    out += it.str;
    lastEnd = it.x + it.width;
  }
  return out;
}

async function extractPdfText(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const allLines = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => typeof it.str === "string")
      .map((it) => {
        const [, , , , x, yRaw] = it.transform || [];
        return {
          str: it.str,
          x: x ?? 0,
          y: viewport.height - (yRaw || 0),
          width: it.width ?? 0,
        };
      });
    allLines.push(...groupRows(items).map(rowToLine));
  }
  return allLines.join("\n");
}

async function main() {
  const target =
    process.argv[2] ||
    "C:/Users/adria/Wave-AVI Ltd/Botts Mews - Documents/Programming/Lutron/HOUSE 7/H7 Integration Report12052026.pdf";
  if (!fs.existsSync(target)) {
    console.error("PDF not found:", target);
    process.exit(1);
  }
  if (!isPaired(HOST)) {
    console.error(`Processor at ${HOST} is not paired.`);
    process.exit(1);
  }

  console.log("Parsing", target);
  const text = await extractPdfText(target);
  const parsed = parseLutronIntegrationReport(text, {
    fileName: path.basename(target),
  });
  const allZones = parsed.zones || [];
  const shadeKinds = new Set(["shade", "blind", "blackout"]);
  const shadeZones = allZones.filter((z) => shadeKinds.has(z.kind));
  console.log(
    `\nReport contains ${allZones.length} zones total, of which ${shadeZones.length} are classified as shade/blind/blackout.\n`
  );

  console.log("Sample of report-classified shade zones:");
  for (const z of shadeZones.slice(0, 15)) {
    console.log(`  ${z.href.padEnd(14)} kind=${z.kind.padEnd(8)} ${z.floor} · ${z.area} · ${z.name}`);
  }
  if (shadeZones.length > 15) console.log(`  … and ${shadeZones.length - 15} more`);

  console.log(`\nProbing each href against ${HOST}…\n`);
  const client = getLeapClient({ host: HOST, port: 8081 });
  await client.connect();
  await new Promise((r) => setTimeout(r, 1500));

  const results = [];
  const BATCH = 8;
  for (let i = 0; i < shadeZones.length; i += BATCH) {
    const slice = shadeZones.slice(i, i + BATCH);
    const out = await Promise.all(
      slice.map(async (z) => {
        const id = z.href.split("/").pop();
        try {
          const resp = await client.client.request("ReadRequest", z.href);
          const status = resp?.Header?.StatusCode || "?";
          const body = resp?.Body || {};
          const zone = body.Zone || body;
          return {
            id,
            href: z.href,
            kind: z.kind,
            name: z.name,
            area: z.area,
            status,
            controlType: zone?.ControlType || (status.startsWith("2") ? "?" : null),
            errorMessage: body.Message || body.Exception?.Message || null,
          };
        } catch (err) {
          return {
            id,
            href: z.href,
            kind: z.kind,
            name: z.name,
            area: z.area,
            status: "ERROR",
            controlType: null,
            errorMessage: err.message,
          };
        }
      })
    );
    results.push(...out);
  }

  const confirmed = results.filter((r) => r.controlType && r.controlType !== "Dimmed");
  const misclassified = results.filter((r) => r.controlType === "Dimmed");
  const missing = results.filter((r) => !r.controlType);

  console.log(`── Confirmed on processor as a real shade/tilt/lift × ${confirmed.length} ──`);
  for (const r of confirmed.slice(0, 30)) {
    console.log(`  ${r.href.padEnd(14)} ControlType=${(r.controlType || "?").padEnd(14)} ${r.area} · ${r.name}`);
  }
  if (confirmed.length > 30) console.log(`  … and ${confirmed.length - 30} more`);

  console.log(`\n── On processor but reported as Dimmed × ${misclassified.length} ──`);
  for (const r of misclassified.slice(0, 30)) {
    console.log(`  ${r.href.padEnd(14)} ${r.area} · ${r.name}`);
  }
  if (misclassified.length > 30) console.log(`  … and ${misclassified.length - 30} more`);

  console.log(`\n── NOT FOUND on this processor × ${missing.length} ──`);
  for (const r of missing.slice(0, 30)) {
    console.log(`  ${r.href.padEnd(14)} status=${(r.status || "?").padEnd(20)} ${r.area} · ${r.name}`);
    if (r.errorMessage) console.log(`    └─ ${r.errorMessage}`);
  }
  if (missing.length > 30) console.log(`  … and ${missing.length - 30} more`);

  console.log(`\nSummary against ${HOST}:`);
  console.log(`  confirmed shades:    ${confirmed.length}`);
  console.log(`  Dimmed on processor: ${misclassified.length} (parser said shade — processor disagrees)`);
  console.log(`  not on processor:    ${missing.length} (likely lives on a different processor)`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
