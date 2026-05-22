/**
 * End-to-end smoke test for the lighting integration.
 *
 *   1. Parse the H7 Integration Report into a normalized house.
 *   2. Build a mock Lutron engine.
 *   3. Set a few zones, activate a scene, poll and print the resulting state.
 *
 * This mirrors what `src/api/lightingApi.js` does in demo / mock mode and
 * proves the API surface works without a live LEAP processor.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { parseLutronIntegrationReport, groupZonesByArea } from "../src/lib/lighting/parseLutronIntegrationReport.js";
import { buildMockLutronEngine } from "../src/lib/integrations/lutron/lutronAdapter.js";

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
  let cy = null;
  let row = null;
  for (const it of sorted) {
    if (cy === null || Math.abs(it.y - cy) > ROW_TOLERANCE) {
      cy = it.y;
      row = [];
      rows.push(row);
    }
    row.push(it);
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
  const lines = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => typeof it.str === "string")
      .map((it) => {
        const [, , , , x, yRaw] = it.transform || [];
        return { str: it.str, x: x ?? 0, y: vp.height - (yRaw || 0), width: it.width ?? 0 };
      });
    lines.push(...groupRows(items).map(rowToLine));
  }
  return lines.join("\n");
}

async function main() {
  const target =
    process.argv[2] ||
    "C:/Users/adria/Wave-AVI Ltd/Botts Mews - Documents/Programming/Lutron/HOUSE 7/H7 Integration Report12052026.pdf";
  console.log("1) Parsing report:", path.basename(target));
  const text = await extractPdfText(target);
  const house = parseLutronIntegrationReport(text, { fileName: path.basename(target) });
  console.log("   →", house.house.counts);

  console.log("\n2) Building mock Lutron engine");
  const engine = buildMockLutronEngine();

  // Spot a known area: Sub Basement\SB.02 CINEMA
  const cinema = house.areas.find((a) =>
    a.fullPath.endsWith("SB.02 CINEMA")
  );
  if (!cinema) throw new Error("Could not find cinema area in parsed data");
  const byArea = groupZonesByArea(house);
  const cinemaZones = (byArea.get(cinema.id) || []).filter(
    (z) => z.kind === "light"
  );
  console.log("   Cinema area:", cinema.fullPath);
  console.log(
    "   Cinema light loads:",
    cinemaZones.map((z) => `${z.name} (${z.href})`).join(", ")
  );

  console.log("\n3) Setting WALL LIGHTS to 60%");
  const r1 = engine.setZoneLevel("/zone/7131", 60);
  console.log("   →", r1);

  console.log("\n4) Setting DOWNLIGHTS to 30%");
  const r2 = engine.setZoneLevel("/zone/15601", 30);
  console.log("   →", r2);

  console.log("\n5) Activate scene 'Off Scene' (areascene/801) for cinema");
  const offScene = house.scenes.find(
    (s) => s.href === "/areascene/801"
  );
  console.log("   Scene:", offScene);
  const sceneResult = engine.activateScene(offScene.href, cinemaZones.map((z) => ({
    href: z.href,
    level: 0,
  })));
  console.log("   →", { sceneHref: sceneResult.sceneHref, zonesUpdated: sceneResult.zones.length });

  console.log("\n6) Poll cinema zones");
  const polled = engine.pollZones(cinemaZones.map((z) => z.href));
  console.table(
    polled.map((p) => ({
      href: p.href,
      level: p.level,
      on: p.on,
      updatedAt: p.updatedAt,
    }))
  );

  console.log("\n7) Engine snapshot");
  console.log("   activeScene =", engine.snapshot().activeScene);
  console.log("   zones in memory =", Object.keys(engine.snapshot().zones).length);

  // Build the hierarchy summary by floor
  console.log("\n8) Loads by area (top 5 floors)");
  const floors = new Map();
  for (const z of house.zones) {
    if (!floors.has(z.floor)) floors.set(z.floor, new Map());
    const areas = floors.get(z.floor);
    if (!areas.has(z.area)) areas.set(z.area, 0);
    areas.set(z.area, areas.get(z.area) + 1);
  }
  for (const [floor, areas] of [...floors.entries()].slice(0, 5)) {
    console.log(`  ${floor}`);
    for (const [area, count] of [...areas.entries()].slice(0, 4)) {
      console.log(`    · ${area}: ${count} loads`);
    }
    if (areas.size > 4) console.log(`    · …+${areas.size - 4} more areas`);
  }

  console.log("\nLighting integration smoke test PASSED.");
}

main().catch((err) => {
  console.error("Lighting integration smoke test FAILED:", err);
  process.exit(1);
});
