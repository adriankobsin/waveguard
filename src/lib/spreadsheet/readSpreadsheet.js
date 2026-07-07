import * as XLSX from "xlsx";

/**
 * Read .xlsx, .xls, or .csv File into an ArrayBuffer for parseWorkbook.
 */
export async function readSpreadsheetToBuffer(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const wb = XLSX.read(text, { type: "string", raw: false });
    return XLSX.write(wb, { type: "array", bookType: "xlsx" });
  }
  return file.arrayBuffer();
}
