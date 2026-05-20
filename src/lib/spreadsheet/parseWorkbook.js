import * as XLSX from "xlsx";
import { detectSheetType, headerRowForType } from "./detectSheetType.js";
import { SHEET_GROUPS, normalizeHeader, isCredentialHeader } from "./schemas.js";

function cellStr(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return String(v).trim();
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    if (!h || isCredentialHeader(h)) return;
    const key = normalizeHeader(h);
    if (!key || key.startsWith("column_")) return;
    obj[key] = cellStr(row[i]);
  });
  return obj;
}

function findHeaderRow(rows, sheetType) {
  const preferred = headerRowForType(sheetType) - 1;
  const scanTo = Math.min(rows.length, 20);
  for (let r = 0; r < scanTo; r++) {
    const line = (rows[r] || []).map(cellStr).map(normalizeHeader);
    const joined = line.join("|");
    if (sheetType === SHEET_GROUPS.deviceList && joined.includes("end device") && joined.includes("floor")) return r;
    if (sheetType === SHEET_GROUPS.patchPanels && joined.includes("patch panel") && joined.includes("cable no")) return r;
    if (sheetType === SHEET_GROUPS.switchPorts && joined.includes("hostname") && joined.includes("management ip")) return r;
    if (sheetType === SHEET_GROUPS.appliance && joined.includes("hostname") && (joined.includes("management ip") || joined.includes("model no"))) return r;
    if (sheetType === SHEET_GROUPS.rack && (joined.includes("552-r") || line.some((c) => /^\d+$/.test(c) && parseInt(c, 10) > 10))) return r;
    if (sheetType === SHEET_GROUPS.ipScheme && joined.includes("ip range")) return r;
  }
  return preferred;
}

function isEmptyRow(row) {
  return !row || row.every((c) => cellStr(c) === "");
}

function isLegendRow(obj, sheetType) {
  const hostname = obj.hostname || "";
  if (sheetType === SHEET_GROUPS.switchPorts || sheetType === SHEET_GROUPS.appliance) {
    const lower = hostname.toLowerCase();
    if (lower === "port number" || lower === "vlan" || lower === "end device") return true;
    if (obj.firmware?.toLowerCase() === "vlan") return true;
  }
  return false;
}

function isInterfaceName(hostname) {
  return /^(Gi|Te|Fa|Eth|Port)\d/i.test(hostname) || /^[A-Za-z]+\d+\/\d+/.test(hostname);
}

function looksLikeMac(val) {
  return /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(String(val || "").trim());
}

function parseSwitchSheet(sheetName, rows, headerIdx) {
  const headers = (rows[headerIdx] || []).map(cellStr);
  const chassis = [];
  const ports = [];
  let currentChassis = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;
    const obj = rowToObject(headers, row);
    if (isLegendRow(obj, SHEET_GROUPS.switchPorts)) continue;

    const hostname = obj.hostname || "";
    if (!hostname || hostname === "#VALUE!") continue;

    if (!isInterfaceName(hostname)) {
      currentChassis = {
        sheet: sheetName,
        row: i + 1,
        hostname,
        mac: looksLikeMac(obj["mac address"]) ? obj["mac address"] : "",
        firmware: obj.firmware || "",
        location: obj.location || "",
        model: obj["model no"] || obj["model no."] || "",
        managementIp: obj["management ip"] || "",
        serial: obj["serial number"] || "",
        poeTotal: obj["poe total (w)"] || "",
        notes: obj.notes || "",
        kind: "chassis",
      };
      chassis.push(currentChassis);
      continue;
    }

    const vlan = obj["mac address"] && !looksLikeMac(obj["mac address"]) ? obj["mac address"] : "";
    ports.push({
      sheet: sheetName,
      row: i + 1,
      switchHostname: currentChassis?.hostname || sheetName,
      interface: hostname,
      vlan,
      patchPanel: obj.firmware || "",
      location: obj.location || "",
      endDevice: obj["model no"] || obj["model no."] || "",
      poeW: obj["poe total (w)"] || "",
      notes: obj["serial number"]?.includes("#VALUE!") ? "" : (obj["serial number"] || obj.notes || ""),
      managementIp: obj["management ip"] || "",
      kind: "port",
    });
  }

  return { chassis, ports };
}

function parseRackSheet(sheetName, rows, headerIdx) {
  const headers = (rows[headerIdx] || []).map(cellStr);
  const placements = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;
    const uPos = cellStr(row[0]);
    const equipment = cellStr(row[1]) || cellStr(row[2]);
    if (!equipment && !uPos) continue;
    placements.push({
      sheet: sheetName,
      row: i + 1,
      uPosition: uPos,
      equipment,
      rackColumn: headers[1] || sheetName,
    });
  }
  return { placements };
}

function parseIpScheme(rows) {
  const vlans = [];
  let vlanRowIdx = -1;
  let rangeRowIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const line = (rows[r] || []).map(cellStr).join("|").toLowerCase();
    if (line.includes("vlan") && vlanRowIdx < 0) vlanRowIdx = r;
    if (line.includes("ip range") && rangeRowIdx < 0) rangeRowIdx = r;
  }
  if (vlanRowIdx < 0 || rangeRowIdx < 0) return { vlans };

  const vlanRow = rows[vlanRowIdx] || [];
  const rangeRow = rows[rangeRowIdx] || [];
  for (let c = 0; c < Math.max(vlanRow.length, rangeRow.length); c++) {
    const vlanCell = cellStr(vlanRow[c]);
    const rangeCell = cellStr(rangeRow[c]);
    if (rangeCell && /^\d+\.\d+/.test(rangeCell)) {
      const vlanName = vlanCell || cellStr(vlanRow[c - 1]) || cellStr(vlanRow[c - 2]) || "";
      vlans.push({ vlan: vlanName, ipRange: rangeCell, column: c });
    } else if (vlanCell.toLowerCase().includes("vlan")) {
      const nextRange = cellStr(rangeRow[c + 1]) || cellStr(rangeRow[c + 2]);
      if (nextRange && /^\d+\.\d+/.test(nextRange)) {
        vlans.push({ vlan: vlanCell, ipRange: nextRange, column: c });
      }
    }
  }
  return { vlans };
}

function parseGenericRows(sheetName, sheetType, rows, headerIdx) {
  const headers = (rows[headerIdx] || []).map(cellStr);
  const parsed = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;
    const obj = rowToObject(headers, row);
    if (isLegendRow(obj, sheetType)) continue;

    if (sheetType === SHEET_GROUPS.deviceList) {
      if (!obj["end device"]) continue;
      parsed.push({
        sheet: sheetName,
        row: i + 1,
        floor: obj.floor || "",
        room: obj.room || "",
        location: obj.location || "",
        system: obj.system || "",
        type: obj.type || "",
        endDevice: obj["end device"] || "",
        endDevicePort: obj["end device port"] || "",
        poeW: obj["poe (w)"] || "",
        mac: obj.mac || "",
        serial: obj["serial #"] || obj.serial || "",
        notes: obj.notes || "",
        kind: "endpoint",
      });
    } else if (sheetType === SHEET_GROUPS.patchPanels) {
      if (!obj["patch panel"]) continue;
      parsed.push({
        sheet: sheetName,
        row: i + 1,
        patchPanel: obj["patch panel"] || "",
        port: obj.port || "",
        cableNo: obj["cable no."] || obj["cable no"] || "",
        type: obj.type || "",
        system: obj.system || "",
        floor: obj.floor || "",
        room: obj.room || "",
        location: obj.location || "",
        endDevice: obj["end device"] || "",
        endDevicePort: obj["end device port/int"] || obj["end device port"] || "",
        testedLength: obj["tested/length"] || obj["tested\\length"] || "",
        notes: obj.notes || "",
        kind: "patch",
      });
    } else if (sheetType === SHEET_GROUPS.appliance) {
      const name = obj.hostname || obj["base mac address"] || "";
      if (!name || isInterfaceName(name)) continue;
      parsed.push({
        sheet: sheetName,
        row: i + 1,
        hostname: name,
        mac: looksLikeMac(obj["mac address"]) ? obj["mac address"] : looksLikeMac(obj["base mac address"]) ? obj["base mac address"] : "",
        location: obj.location || "",
        firmware: obj.firmware || obj["firmware version"] || "",
        model: obj["model no"] || obj["model no (controller)"] || "",
        managementIp: obj["management ip"] || "",
        serial: obj["serial number"] || "",
        notes: obj.notes || "",
        kind: "appliance",
      });
    }
  }
  return parsed;
}

/**
 * Parse an xlsx ArrayBuffer into structured sheet data.
 * @param {ArrayBuffer} buffer
 * @returns {{ sheets: object[], summary: object }}
 */
export function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheets = [];
  const summary = { byGroup: {}, totalRows: 0, warnings: [] };

  for (const sheetName of wb.SheetNames) {
    const sheetType = detectSheetType(sheetName);
    if (sheetType === SHEET_GROUPS.skip) {
      sheets.push({ sheetName, sheetType, skipped: true, rows: [] });
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
    const headerIdx = findHeaderRow(rows, sheetType);

    let payload;
    if (sheetType === SHEET_GROUPS.switchPorts) {
      payload = parseSwitchSheet(sheetName, rows, headerIdx);
    } else if (sheetType === SHEET_GROUPS.rack) {
      payload = parseRackSheet(sheetName, rows, headerIdx);
    } else if (sheetType === SHEET_GROUPS.ipScheme) {
      payload = parseIpScheme(rows);
    } else {
      payload = { rows: parseGenericRows(sheetName, sheetType, rows, headerIdx) };
    }

    const rowCount =
      sheetType === SHEET_GROUPS.switchPorts
        ? (payload.chassis?.length || 0) + (payload.ports?.length || 0)
        : sheetType === SHEET_GROUPS.rack
          ? payload.placements?.length || 0
          : sheetType === SHEET_GROUPS.ipScheme
            ? payload.vlans?.length || 0
            : payload.rows?.length || 0;

    summary.byGroup[sheetType] = (summary.byGroup[sheetType] || 0) + rowCount;
    summary.totalRows += rowCount;

    sheets.push({ sheetName, sheetType, headerRow: headerIdx + 1, rowCount, ...payload });
  }

  return { sheets, summary };
}
