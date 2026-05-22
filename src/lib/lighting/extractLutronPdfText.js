/**
 * Extract plain text from a Lutron Integration Report PDF in the browser.
 *
 * Lutron's PDF text layer preserves the device-name → model → href columns,
 * which is exactly what `parseLutronIntegrationReport` expects. We rebuild a
 * line per row by sorting text items by Y position and joining items on the
 * same row with a single space; column boundaries are detected via wide X
 * gaps so the right-hand "path" column ends up after a tab character.
 */
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
    if (gap > COLUMN_GAP_THRESHOLD) {
      out += "\t";
    } else if (gap > 1.5) {
      out += " ";
    }
    out += it.str;
    lastEnd = it.x + it.width;
  }
  return out;
}

async function extractPageText(page) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items
    .filter((it) => typeof it.str === "string")
    .map((it) => {
      const [, , , , x, yRaw] = it.transform || [];
      const y = viewport.height - (yRaw || 0);
      return {
        str: it.str,
        x: x ?? 0,
        y,
        width: it.width ?? 0,
      };
    });
  return groupRows(items).map(rowToLine);
}

/**
 * Read a File / Blob containing a Lutron Integration Report PDF and return
 * the text content as one long newline-joined string.
 */
export async function extractLutronPdfText(file) {
  if (!file) throw new Error("No file provided");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const lines = await extractPageText(page);
    allLines.push(...lines);
  }
  return allLines.join("\n");
}
