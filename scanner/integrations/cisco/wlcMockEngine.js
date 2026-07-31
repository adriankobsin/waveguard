import { buildMockWlcSnapshot } from "./wlcSnapshot.js";

export function getWlcMockSnapshot(conn = {}) {
  return buildMockWlcSnapshot(conn);
}
