import * as XLSX from "xlsx";
import { detectSheetType, headerRowForType } from "./detectSheetType.js";
import { SHEET_GROUPS, normalizeHeader, isCredentialHeader } from "./schemas.js";
import {
  parseCompactPatchRows,
  isPatchPanelHeaderRow,
  looksLikePatchDataRow,
} from "./parseCompactPatchPanel.js";
import { detectGenericHeaderRow, rowToGenericEquipment } from "./headerMapping.js";
import { extractCableTagFromText } from "./cableTag.js";
import {
  extractCredentialsFromSheetRows,
  dedupeExtractedCredentials,
} from "../credentials/extractCredentials.js";

/** Sheet names we should never auto-import even via the generic fallback. */
const EXPLICIT_SKIP_NAMES = new Set([
  "search",
  "data",
  "instructions",
  "readme",
  "legend",
  "key",
  "notes",
  "tabs",
]);

function cellStr(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return String(v).trim();
}

/** Excel sheets sometimes expand to tens of thousands of empty columns — clip them. */
function trimSheetRows(rows, maxCols = 40) {
  let lastCol = 0;
  for (const row of rows || []) {
    for (let i = Math.min((row?.length || 0) - 1, maxCols - 1); i >= 0; i--) {
      if (cellStr(row[i]) !== "") {
        if (i + 1 > lastCol) lastCol = i + 1;
        break;
      }
    }
  }
  const width = Math.min(Math.max(lastCol, 1), maxCols);
  return (rows || []).map((row) => {
    const out = Array.isArray(row) ? row.slice(0, width) : [];
    while (out.length < width) out.push("");
    return out;
  });
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
    if (sheetType === SHEET_GROUPS.patchPanels && joined.includes("patch panel") && (joined.includes("cable no") || joined.includes("deck") || joined.includes("port"))) return r;
    if (sheetType === SHEET_GROUPS.switchPorts && joined.includes("hostname") && joined.includes("management ip")) return r;
    if (
      sheetType === SHEET_GROUPS.appliance &&
      (joined.includes("management ip") || joined.includes("model no")) &&
      (joined.includes("hostname") || joined.includes("mac address") || joined.includes("serial number"))
    ) {
      return r;
    }
    if (sheetType === SHEET_GROUPS.rack && (joined.includes("552-r") || line.some((c) => /^\d+$/.test(c) && parseInt(c, 10) > 10))) return r;
    if (sheetType === SHEET_GROUPS.rack && (line[0] === "u" || line[0]?.includes("position"))) return r;
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
    if (
      lower === "port number" ||
      lower === "vlan" ||
      lower === "end device" ||
      lower === "device hostname" ||
      lower === "extension" ||
      lower === "phones" ||
      lower === "hostname" ||
      lower === "mac address" ||
      lower === "base mac address" ||
      lower === "model no" ||
      lower === "model no (controller)"
    ) {
      return true;
    }
    if (obj.firmware?.toLowerCase() === "vlan") return true;
    if (obj["management ip"]?.toLowerCase() === "end device ip") return true;
    if (obj["management ip"]?.toLowerCase() === "ip address") return true;
  }
  return false;
}

function isInterfaceName(hostname) {
  const h = String(hostname || "").trim();
  if (!h) return false;
  // Physical + port-channel interfaces — never treat as chassis equipment.
  if (/^(Gi|Te|Fa|Eth|Port|Po)\d/i.test(h)) return true;
  if (/^[A-Za-z]+\d+\/\d+/.test(h)) return true;
  return false;
}

function isJunkChassisHostname(hostname) {
  const lower = String(hostname || "").trim().toLowerCase();
  if (!lower || lower === "none" || lower === "#value!") return true;
  if (
    /^(stackwise(\s+\d+)?|switch links|port channel|phones|extension|device hostname)$/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

function isValidIpv4(value) {
  const s = String(value || "").trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return false;
  return s.split(".").every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255;
  });
}

function looksLikeMac(val) {
  return /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(String(val || "").trim());
}

function isRealSwitchChassis(entry) {
  if (!entry?.hostname || isJunkChassisHostname(entry.hostname)) return false;
  if (isValidIpv4(entry.managementIp)) return true;
  if (looksLikeMac(entry.mac) && entry.model) return true;
  return false;
}

function parsePatchPanelPayload(sheetName, rows, headerIdx) {
  const compactRows = parseCompactPatchRows(sheetName, rows);
  const headerIsPatch = isPatchPanelHeaderRow(rows[headerIdx]);
  const standardRows = headerIsPatch
    ? parseGenericRows(sheetName, SHEET_GROUPS.patchPanels, rows, headerIdx)
    : [];

  const compactLooksPrimary =
    compactRows.length > 0 &&
    (looksLikePatchDataRow(rows[0]) || !headerIsPatch);

  if (compactLooksPrimary && compactRows.length >= standardRows.length) {
    return { rows: compactRows, compact: true };
  }
  if (standardRows.length) return { rows: standardRows };
  if (compactRows.length) return { rows: compactRows, compact: true };
  return { rows: parseGenericRows(sheetName, SHEET_GROUPS.patchPanels, rows, headerIdx) };
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
      // Footer rows (Stackwise / Port Channel / PoN / None) are not switches.
      if (isJunkChassisHostname(hostname)) continue;
      const mac = looksLikeMac(obj["mac address"]) ? obj["mac address"] : "";
      const model = obj["model no"] || obj["model no."] || "";
      const managementIp = isValidIpv4(obj["management ip"]) ? obj["management ip"] : "";
      // Only promote rows that look like a real switch chassis.
      if (!managementIp && !(mac && model)) continue;
      currentChassis = {
        sheet: sheetName,
        row: i + 1,
        hostname,
        mac,
        firmware: obj.firmware || "",
        location: obj.location || "",
        model,
        managementIp,
        serial: obj["serial number"] || "",
        poeTotal: obj["poe total (w)"] || "",
        notes: obj.notes || "",
        rawObj: obj,
        consumedKeys: [
          "hostname",
          "mac address",
          "firmware",
          "location",
          "model no",
          "model no.",
          "management ip",
          "serial number",
          "poe total (w)",
          "notes",
        ],
        kind: "chassis",
      };
      chassis.push(currentChassis);
      continue;
    }

    const vlan = obj["mac address"] && !looksLikeMac(obj["mac address"]) ? obj["mac address"] : "";
    const endDeviceIp = isValidIpv4(obj["management ip"]) ? obj["management ip"] : "";
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
      managementIp: endDeviceIp,
      kind: "port",
    });
  }

  return { chassis: chassis.filter(isRealSwitchChassis), ports };
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

function isIpv4Cell(value) {
  const s = cellStr(value);
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return false;
  return s.split(".").every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255;
  });
}

function parseIpScheme(rows) {
  const vlans = [];
  const hosts = [];
  let vlanRowIdx = -1;
  let rangeRowIdx = -1;
  let maskRowIdx = -1;
  let gatewayRowIdx = -1;
  let addressHeaderIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const line = (rows[r] || []).map(cellStr).join("|").toLowerCase();
    if (line.includes("vlan") && vlanRowIdx < 0) vlanRowIdx = r;
    if (line.includes("ip range") && rangeRowIdx < 0) rangeRowIdx = r;
    if (line.includes("subnet mask") && maskRowIdx < 0) maskRowIdx = r;
    if (line.includes("default gateway") && gatewayRowIdx < 0) gatewayRowIdx = r;
    if (line.includes("address used") && line.includes("device name") && addressHeaderIdx < 0) {
      addressHeaderIdx = r;
    }
  }
  if (vlanRowIdx < 0 || rangeRowIdx < 0) return { vlans, hosts };

  const vlanRow = rows[vlanRowIdx] || [];
  const rangeRow = rows[rangeRowIdx] || [];
  const maskRow = maskRowIdx >= 0 ? rows[maskRowIdx] || [] : [];
  const gatewayRow = gatewayRowIdx >= 0 ? rows[gatewayRowIdx] || [] : [];
  const seenRanges = new Set();

  for (let c = 0; c < Math.max(vlanRow.length, rangeRow.length); c++) {
    const vlanCell = cellStr(vlanRow[c]);
    const rangeAt = cellStr(rangeRow[c]);
    // Prefer the range in THIS column. Do not steal the next column's range
    // when the current cell is an "IP Range" label — that mis-labels VLANs.
    const rangeCell = rangeAt && /^\d+\.\d+/.test(rangeAt) ? rangeAt : "";
    if (!rangeCell) continue;

    const vlanName =
      (vlanCell && !/^ip range$/i.test(vlanCell) && !/^vlan$/i.test(vlanCell)
        ? vlanCell
        : "") ||
      cellStr(vlanRow[c - 1]) ||
      cellStr(vlanRow[c - 2]) ||
      "";
    if (!vlanName || /^ip range$/i.test(vlanName) || /^vlan$/i.test(vlanName)) continue;

    const rangeKey = `${vlanName}|${rangeCell}`;
    if (seenRanges.has(rangeKey)) continue;
    seenRanges.add(rangeKey);

    const rangeCol = c;
    // Albatros IP Scheme: VLAN title + Device Name sit on the range column;
    // "Address Used" (IPs) is typically one column to the left.
    const addressCol = c > 0 ? c - 1 : c;
    vlans.push({
      vlan: vlanName,
      ipRange: rangeCell,
      gateway: isIpv4Cell(gatewayRow[rangeCol]) ? cellStr(gatewayRow[rangeCol]) : "",
      mask: cellStr(maskRow[rangeCol]) || "",
      column: addressCol,
      rangeColumn: rangeCol,
    });
  }

  // Address Used / Device Name tables sit under each VLAN block:
  // [VLAN title / Address Used] | [range col / Device Name]
  if (addressHeaderIdx >= 0) {
    for (const vlan of vlans) {
      const ipCol = vlan.column;
      const nameCol = vlan.rangeColumn;
      let blankStreak = 0;
      for (let r = addressHeaderIdx + 1; r < rows.length; r++) {
        const ip = cellStr(rows[r]?.[ipCol]);
        const name = cellStr(rows[r]?.[nameCol]);
        if (!isIpv4Cell(ip)) {
          blankStreak += 1;
          if (blankStreak >= 8) break;
          continue;
        }
        blankStreak = 0;
        // Sheet lists every address in the range — keep real assignments only.
        // "DHCP" marks pool placeholders, not devices to probe.
        if (!name || /^dhcp$/i.test(name) || /^\d+$/.test(name)) continue;
        hosts.push({
          ip,
          name,
          vlan: vlan.vlan,
          source: "ipScheme",
        });
      }
    }
  }

  return { vlans, hosts };
}

function parseGenericEquipmentSheet(sheetName, rows) {
  const detected = detectGenericHeaderRow(rows);
  if (!detected) return null;
  const items = [];
  for (let i = detected.index + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;
    const eq = rowToGenericEquipment(row, detected, sheetName, i + 1);
    if (eq) items.push(eq);
  }
  return {
    headerRow: detected.index + 1,
    detectedColumns: detected.fieldByCol,
    headers: detected.headers,
    rows: items,
  };
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
        ip: obj.ip || obj["ip address"] || obj["management ip"] || "",
        notes: obj.notes || "",
        rawObj: obj,
        consumedKeys: [
          "floor",
          "room",
          "location",
          "system",
          "type",
          "end device",
          "end device port",
          "poe (w)",
          "mac",
          "serial #",
          "serial",
          "ip",
          "ip address",
          "management ip",
          "notes",
        ],
        kind: "endpoint",
      });
    } else if (sheetType === SHEET_GROUPS.patchPanels) {
      if (!obj["patch panel"]) continue;
      const port = obj.port || "";
      const rawPanel = obj["patch panel"] || "";
      // Albatros lists panel IDs as MEC552-R1-PP1-P1 with a separate Port column.
      const panel =
        port && new RegExp(`-P${String(port).trim()}$`, "i").test(rawPanel)
          ? rawPanel.replace(new RegExp(`-P${String(port).trim()}$`, "i"), "")
          : rawPanel;
      parsed.push({
        sheet: sheetName,
        row: i + 1,
        patchPanel: panel,
        port,
        cableNo:
          extractCableTagFromText(obj["cable no."] || obj["cable no"] || obj.net || obj["cable number"] || obj["cable #"] || "") ||
          String(obj["cable no."] || obj["cable no"] || obj.net || obj["cable number"] || obj["cable #"] || "").trim(),
        type: obj.type || "",
        system: obj.system || obj.code || "",
        deck: obj.deck || obj.code || "",
        floor: obj.floor || obj.deck || obj.code || "",
        room: obj.room || "",
        location: obj.location || obj.destination || "",
        endDevice:
          obj["end device sw"] ||
          obj["end device"] ||
          obj.device ||
          obj.destination ||
          "",
        endDevicePort:
          obj["end device port/i"] ||
          obj["end device port/int"] ||
          obj["end device port"] ||
          (obj.device && obj.device !== "0" && !obj["end device sw"] ? obj.device : "") ||
          "",
        testedLength: obj["tested/length"] || obj["tested\\length"] || "",
        notes: obj.notes || "",
        rawObj: obj,
        consumedKeys: [
          "patch panel",
          "port",
          "cable no.",
          "cable no",
          "net",
          "cable number",
          "cable #",
          "type",
          "system",
          "code",
          "deck",
          "floor",
          "room",
          "location",
          "destination",
          "end device",
          "end device sw",
          "device",
          "end device port/i",
          "end device port/int",
          "end device port",
          "tested/length",
          "tested\\length",
          "notes",
        ],
        kind: "patch",
      });
    } else if (sheetType === SHEET_GROUPS.appliance) {
      const mac =
        looksLikeMac(obj["mac address"])
          ? obj["mac address"]
          : looksLikeMac(obj["base mac address"])
            ? obj["base mac address"]
            : "";
      const model = obj["model no"] || obj["model no (controller)"] || "";
      const managementIpRaw = obj["management ip"] || obj["ip address"] || "";
      const managementIp = isValidIpv4(managementIpRaw) ? managementIpRaw : "";
      // Prefer human names / models over raw MAC addresses as the equipment name.
      const name =
        obj.hostname ||
        obj["device hostname"] ||
        (model && !looksLikeMac(model) ? model : "") ||
        (managementIp ? "" : "") ||
        mac ||
        managementIp ||
        "";
      if (!name || isInterfaceName(name)) continue;
      if (isLegendRow({ hostname: name, "management ip": managementIpRaw, firmware: obj.firmware }, sheetType)) {
        continue;
      }
      if (/^(mac address|hostname|model|end device|port number|device hostname|extension|phones|<spare>|ssids|vlan id)$/i.test(name)) {
        continue;
      }
      // Bare port numbers / SFP port labels from WAN/Firewall port tables.
      if (/^\d+$/.test(name) && !managementIp) continue;
      if (/^(x\d+\s*sfp\+?|mgmt|ha)$/i.test(String(name).trim()) && !managementIp) continue;
      // Keep real chassis, WLAN APs, WAN circuits, and PBX phones; drop empty port stubs.
      const hasStrongIdentity = !!(
        obj.hostname ||
        obj["device hostname"] ||
        managementIp ||
        mac ||
        (model && model.length >= 4 && !/^(x\d+\s*sfp\+?|mgmt|ha|faulty|provisioned)/i.test(model))
      );
      if (!hasStrongIdentity) continue;
      // PBX sheets use extension numbers as hostname — prefer the device model label.
      const displayName =
        /^\d+$/.test(name) && model && /cisco|crestron|zenitel|tsw|8821|8851|intercom|phone/i.test(model)
          ? model
          : name;
      parsed.push({
        sheet: sheetName,
        row: i + 1,
        hostname: displayName,
        mac,
        location: obj.location || "",
        firmware: obj.firmware || obj["firmware version"] || "",
        model: model || displayName,
        managementIp,
        serial: obj["serial number"] || "",
        notes: obj.notes || (/^\d+$/.test(name) ? `Extension ${name}` : ""),
        rawObj: obj,
        consumedKeys: [
          "hostname",
          "device hostname",
          "mac address",
          "base mac address",
          "location",
          "firmware",
          "firmware version",
          "model no",
          "model no (controller)",
          "management ip",
          "ip address",
          "serial number",
          "notes",
        ],
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
  const extractedCredentials = [];

  for (const sheetName of wb.SheetNames) {
    let sheetType = detectSheetType(sheetName);
    const lower = String(sheetName || "").trim().toLowerCase();

    if (sheetType === SHEET_GROUPS.skip && EXPLICIT_SKIP_NAMES.has(lower)) {
      sheets.push({ sheetName, sheetType, skipped: true, rows: [] });
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = trimSheetRows(
      XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false })
    );
    extractedCredentials.push(...extractCredentialsFromSheetRows(sheetName, rows));

    // Unknown sheet → try compact patch rows first, then header-based patch, then generic equipment.
    if (sheetType === SHEET_GROUPS.skip) {
      const compactRows = parseCompactPatchRows(sheetName, rows);
      if (compactRows.length) {
        summary.byGroup[SHEET_GROUPS.patchPanels] =
          (summary.byGroup[SHEET_GROUPS.patchPanels] || 0) + compactRows.length;
        summary.totalRows += compactRows.length;
        sheets.push({
          sheetName,
          sheetType: SHEET_GROUPS.patchPanels,
          headerRow: 0,
          rowCount: compactRows.length,
          compact: true,
          rows: compactRows,
        });
        continue;
      }

      const patchHeaderIdx = findHeaderRow(rows, SHEET_GROUPS.patchPanels);
      const patchProbe = (rows[patchHeaderIdx] || []).map(cellStr).map(normalizeHeader).join("|");
      if (patchProbe.includes("patch panel") && (patchProbe.includes("cable no") || patchProbe.includes("port"))) {
        const patchRows = parseGenericRows(sheetName, SHEET_GROUPS.patchPanels, rows, patchHeaderIdx);
        if (patchRows.length) {
          summary.byGroup[SHEET_GROUPS.patchPanels] =
            (summary.byGroup[SHEET_GROUPS.patchPanels] || 0) + patchRows.length;
          summary.totalRows += patchRows.length;
          sheets.push({
            sheetName,
            sheetType: SHEET_GROUPS.patchPanels,
            headerRow: patchHeaderIdx + 1,
            rowCount: patchRows.length,
            headers: (rows[patchHeaderIdx] || []).map(cellStr),
            rows: patchRows,
          });
          continue;
        }
      }

      const generic = parseGenericEquipmentSheet(sheetName, rows);
      if (generic && generic.rows.length) {
        summary.byGroup[SHEET_GROUPS.generic] =
          (summary.byGroup[SHEET_GROUPS.generic] || 0) + generic.rows.length;
        summary.totalRows += generic.rows.length;
        sheets.push({
          sheetName,
          sheetType: SHEET_GROUPS.generic,
          headerRow: generic.headerRow,
          rowCount: generic.rows.length,
          detectedColumns: generic.detectedColumns,
          headers: generic.headers,
          rows: generic.rows,
        });
      } else {
        sheets.push({ sheetName, sheetType, skipped: true, rows: [] });
      }
      continue;
    }

    const headerIdx = findHeaderRow(rows, sheetType);

    let payload;
    if (sheetType === SHEET_GROUPS.switchPorts) {
      payload = parseSwitchSheet(sheetName, rows, headerIdx);
    } else if (sheetType === SHEET_GROUPS.rack) {
      payload = parseRackSheet(sheetName, rows, headerIdx);
    } else if (sheetType === SHEET_GROUPS.ipScheme) {
      payload = parseIpScheme(rows);
    } else if (sheetType === SHEET_GROUPS.patchPanels) {
      payload = parsePatchPanelPayload(sheetName, rows, headerIdx);
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

    sheets.push({
      sheetName,
      sheetType,
      headerRow: payload.compact ? 0 : headerIdx + 1,
      rowCount,
      headers: payload.compact
        ? undefined
        : sheetType === SHEET_GROUPS.patchPanels
          ? (rows[headerIdx] || []).map(cellStr)
          : undefined,
      ...payload,
    });
  }

  return {
    sheets,
    summary,
    credentials: dedupeExtractedCredentials(extractedCredentials),
  };
}
