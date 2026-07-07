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

import { parseWorkbook } from "./parseWorkbook.js";
import { buildImportPayload } from "./linkRows.js";

/**
 * Full parse + normalize pipeline from xlsx buffer.
 */
export function parseAndBuildImport(buffer, options = {}) {
  const parsed = parseWorkbook(buffer);
  const payload = buildImportPayload(parsed, options);
  return { parsed, payload };
}
