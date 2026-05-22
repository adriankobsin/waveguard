/**
 * Smoke test for the Lutron Integration Report parser.
 *
 * Reads `H7 Integration Report12052026.pdf` (or any other report passed as
 * argv[2]) using pdfjs-dist, extracts text the same way the browser uploader
 * does, then runs the parser and prints a count summary.
 *
 *   node scripts/testLutronParser.mjs ["c:/path/to/report.pdf"]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { parseLutronIntegrationReport } from "../src/lib/lighting/parseLutronIntegrationReport.js";

const require = createRequire(import.meta.url);
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  console.log("Reading", target);
  const text = await extractPdfText(target);
  fs.writeFileSync(
    path.join(__dirname, "lutron-report.extracted.txt"),
    text,
    "utf8"
  );

  const parsed = parseLutronIntegrationReport(text, {
    fileName: path.basename(target),
  });
  console.log("\n=== Counts ===");
  console.log(parsed.house.counts);

  console.log("\n=== First 5 areas ===");
  console.table(parsed.areas.slice(0, 5).map((a) => ({
    href: a.href,
    floor: a.floor,
    name: a.name,
  })));

  console.log("\n=== First 5 zones ===");
  console.table(parsed.zones.slice(0, 5).map((z) => ({
    href: z.href,
    kind: z.kind,
    area: z.area,
    name: z.name,
  })));

  console.log("\n=== First 5 scenes ===");
  console.table(parsed.scenes.slice(0, 5).map((s) => ({
    href: s.href,
    area: s.area,
    name: s.name,
  })));

  console.log("\n=== First 3 devices ===");
  console.table(parsed.devices.slice(0, 3).map((d) => ({
    href: d.href,
    model: d.model,
    floor: d.floor,
    area: d.area,
    location: d.location,
    buttons: d.buttons.length,
    leds: d.leds.length,
  })));

  // Sanity: spot-check a known zone from H7
  const known = parsed.zones.find((z) => z.href === "/zone/5384");
  if (known) {
    console.log("\n=== Known zone /zone/5384 ===");
    console.log(known);
  }
}

main().catch((err) => {
  console.error("Parser test failed:", err);
  process.exit(1);
});
