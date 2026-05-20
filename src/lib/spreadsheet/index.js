export { parseWorkbook } from "./parseWorkbook.js";
export { buildImportPayload } from "./linkRows.js";
export {
  SHEET_GROUPS,
  PHASE1_GROUPS,
  PHASE2_GROUPS,
  DEFAULT_FLOOR_MAP,
} from "./schemas.js";
export { detectSheetType } from "./detectSheetType.js";

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
