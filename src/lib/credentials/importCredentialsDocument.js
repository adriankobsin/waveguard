import * as XLSX from "xlsx";
import {
  extractCredentialsFromSheetRows,
  dedupeExtractedCredentials,
} from "@/lib/credentials/extractCredentials.js";
import { normalizeCredentialsVault } from "@/lib/credentials/credentialsVault.js";

/**
 * Parse a credentials document (.xlsx, .xls, .csv, .json) into vault-ready records.
 */
export function parseCredentialsDocument(buffer, filename = "") {
  const ext = String(filename || "").split(".").pop()?.toLowerCase();

  if (ext === "json") {
    const text = typeof buffer === "string" ? buffer : new TextDecoder().decode(buffer);
    const data = JSON.parse(text);
    return normalizeCredentialsVault(data);
  }

  let wb;
  if (ext === "csv") {
    const text = typeof buffer === "string" ? buffer : new TextDecoder().decode(buffer);
    wb = XLSX.read(text, { type: "string", raw: false });
  } else {
    wb = XLSX.read(buffer, { type: "array", cellDates: false });
  }

  const extracted = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    extracted.push(...extractCredentialsFromSheetRows(sheetName, rows));
  }

  return dedupeExtractedCredentials(extracted).map((c) => ({
    ...c,
    importSource: { ...(c.importSource || {}), source: "document" },
  }));
}
