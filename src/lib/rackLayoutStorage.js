import { DEFAULT_RACK_LAYOUT } from "@/lib/defaultRackLayout";

export const RACK_LAYOUT_STORAGE_KEY = "waveguard-rack-layout";

export function loadRackLayoutLocal() {
  try {
    const raw = localStorage.getItem(RACK_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.racks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRackLayoutLocal(layout) {
  localStorage.setItem(RACK_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export function getBuiltinDefaultRackLayout() {
  return JSON.parse(JSON.stringify(DEFAULT_RACK_LAYOUT));
}
