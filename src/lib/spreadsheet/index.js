export { parseWorkbook } from "./parseWorkbook.js";
export { buildImportPayload } from "./linkRows.js";
export { readSpreadsheetToBuffer } from "./readSpreadsheet.js";
export {
  SHEET_GROUPS,
  PHASE1_GROUPS,
  PHASE2_GROUPS,
  PATCH_PANEL_IMPORT_GROUPS,
  DEFAULT_FLOOR_MAP,
} from "./schemas.js";
export { detectSheetType } from "./detectSheetType.js";
export { stripVesselEquipmentName } from "./equipmentName.js";
export {
  FIELD_SYNONYMS,
  mapHeaderToField,
  detectGenericHeaderRow,
} from "./headerMapping.js";
export { detectEnabledGroupsFromWorkbook } from "../patchPanelSchedule/patchImportPreview.js";

import { parseWorkbook } from "./parseWorkbook.js";
import { buildImportPayload } from "./linkRows.js";
import { detectEnabledGroupsFromWorkbook } from "../patchPanelSchedule/patchImportPreview.js";
import { DEFAULT_FLOOR_MAP, PHASE1_GROUPS, PHASE2_GROUPS } from "./schemas.js";

/**
 * Full parse + normalize pipeline from spreadsheet buffer.
 * When enabledGroups is omitted, every sheet type found in the workbook is imported
 * (Device List, Patch Panels, switches, appliances, racks, IP Scheme, generic).
 */
export function parseAndBuildImport(buffer, options = {}) {
  const parsed = parseWorkbook(buffer);
  const enabledGroups =
    options.enabledGroups ??
    detectEnabledGroupsFromWorkbook(parsed) ??
    [...PHASE1_GROUPS, ...PHASE2_GROUPS];
  const payload = buildImportPayload(parsed, {
    floorMap: options.floorMap || DEFAULT_FLOOR_MAP,
    ...options,
    enabledGroups,
  });
  return { parsed, payload, enabledGroups };
}
