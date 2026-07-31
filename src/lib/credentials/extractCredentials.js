import { normalizeHeader } from "@/lib/spreadsheet/schemas.js";

const USERNAME_HEADERS = new Set([
  "username",
  "user name",
  "user",
  "login",
  "login name",
  "admin user",
  "admin username",
  "snmp user",
  "ssh user",
]);

const PASSWORD_HEADERS = new Set([
  "password",
  "passwd",
  "pwd",
  "pass",
  "admin password",
  "admin pass",
  "snmp community",
  "community",
  "snmp v2 community",
  "ssh password",
  "enable password",
  "secret",
]);

const HOST_HEADERS = new Set([
  "management ip",
  "mgmt ip",
  "ip address",
  "ipv4",
  "ip",
  "host",
  "host ip",
  "device ip",
]);

const NAME_HEADERS = new Set([
  "hostname",
  "host name",
  "equipment name",
  "device name",
  "asset name",
  "end device",
  "device",
  "equipment",
  "name",
  "label",
]);

const PLATFORM_HEADERS = new Set([
  "platform",
  "system",
  "vendor",
  "device type",
]);

const LOGIN_URL_HEADERS = new Set([
  "login url",
  "web url",
  "management url",
  "url",
  "portal url",
]);

const NOTES_HEADERS = new Set(["notes", "comments", "remarks"]);

function cellStr(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return String(v).trim();
}

function isEmptyRow(row) {
  return !row || row.every((c) => cellStr(c) === "");
}

function findColumn(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (candidates.has(h)) return i;
    for (const c of candidates) {
      if (h.includes(c) || c.includes(h)) return i;
    }
  }
  return -1;
}

function mapCredentialColumns(headers) {
  const username = findColumn(headers, USERNAME_HEADERS);
  const password = findColumn(headers, PASSWORD_HEADERS);
  const host = findColumn(headers, HOST_HEADERS);
  const name = findColumn(headers, NAME_HEADERS);
  const platform = findColumn(headers, PLATFORM_HEADERS);
  const loginUrl = findColumn(headers, LOGIN_URL_HEADERS);
  const notes = findColumn(headers, NOTES_HEADERS);
  const hasCredentialData = username >= 0 || password >= 0;
  return { username, password, host, name, platform, loginUrl, notes, hasCredentialData };
}

function inferPlatform(sheetName, deviceName, explicit) {
  const p = String(explicit || "").trim().toLowerCase();
  if (p.includes("peplink")) return "peplink";
  if (p.includes("cisco")) return "cisco";
  if (p.includes("fortinet") || p.includes("fortigate")) return "fortinet";
  if (p.includes("unifi") || p.includes("ubiquiti")) return "unifi";
  if (p.includes("kerio")) return "kerio";
  if (p.includes("lutron")) return "lutron";
  if (p.includes("snmp")) return "snmp";
  if (p.includes("ssh")) return "ssh";

  const sheet = String(sheetName || "").toLowerCase();
  if (sheet.includes("wan") || sheet.includes("router") || sheet.includes("peplink")) return "peplink";
  if (sheet.includes("firewall") || sheet.includes("forti")) return "fortinet";
  if (sheet.includes("wlan") || sheet.includes("unifi")) return "unifi";
  if (/\bsw\b|switch|core sw/i.test(sheet)) return "cisco";

  const name = String(deviceName || "").toLowerCase();
  if (name.includes("peplink")) return "peplink";
  if (name.includes("cisco") || /^sw\d/i.test(name)) return "cisco";
  if (name.includes("forti")) return "fortinet";
  if (name.includes("unifi")) return "unifi";

  return "web";
}

function buildLoginUrl(host, loginUrl) {
  const url = String(loginUrl || "").trim();
  if (url) return url;
  const h = String(host || "").trim();
  if (!h) return "";
  if (/^https?:\/\//i.test(h)) return h;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return `https://${h}/`;
  return "";
}

function pickCell(row, index) {
  return index >= 0 ? cellStr(row[index]) : "";
}

function rowToCredential(sheetName, row, cols, headerRow, rowNumber) {
  const username = pickCell(row, cols.username);
  const password = pickCell(row, cols.password);
  if (!username && !password) return null;

  const host = pickCell(row, cols.host);
  const deviceName = pickCell(row, cols.name);
  const platform = inferPlatform(sheetName, deviceName, pickCell(row, cols.platform));
  const loginUrl = buildLoginUrl(host, pickCell(row, cols.loginUrl));
  const notes = pickCell(row, cols.notes);
  const labelBase = deviceName || host || sheetName;

  return {
    label: `${labelBase} login`.trim(),
    equipmentName: deviceName,
    platform,
    host,
    loginUrl,
    username,
    password,
    notes: notes || `Imported from ${sheetName} row ${rowNumber}`,
    importSource: { sheet: sheetName, row: rowNumber, headerRow, source: "spreadsheet" },
  };
}

/**
 * Scan raw sheet rows for username/password columns and extract credential records.
 */
export function extractCredentialsFromSheetRows(sheetName, rows) {
  if (!rows?.length) return [];
  const found = [];
  const scanLimit = Math.min(rows.length, 40);

  for (let h = 0; h < scanLimit; h++) {
    const headers = (rows[h] || []).map(cellStr).map(normalizeHeader);
    const cols = mapCredentialColumns(headers);
    if (!cols.hasCredentialData) continue;

    for (let r = h + 1; r < rows.length; r++) {
      if (isEmptyRow(rows[r])) continue;
      const cred = rowToCredential(sheetName, rows[r], cols, h + 1, r + 1);
      if (cred) found.push(cred);
    }
  }

  return found;
}

export function dedupeExtractedCredentials(credentials) {
  const byKey = new Map();
  for (const cred of credentials || []) {
    const host = (cred.host || "").trim().toLowerCase();
    const user = (cred.username || "").trim().toLowerCase();
    const platform = cred.platform || "web";
    const name = (cred.equipmentName || cred.label || "").trim().toLowerCase();
    const key = host ? `${platform}|${host}|${user}` : `${platform}|${name}|${user}`;
    byKey.set(key, { ...byKey.get(key), ...cred });
  }
  return [...byKey.values()];
}
