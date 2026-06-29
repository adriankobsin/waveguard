/**
 * Platform-wide Live vs Demo mode.
 *
 * Live (default): real Equipment, real polls, no synthetic WAN preview.
 * Demo: read-only showcase using bundled demo data + forced mock polls.
 *
 * This is independent from `isMockServer` (dev backend on localhost) and from
 * `discovery.snmpEnabled`. Demo mode never mutates persisted Equipment.
 */

export const PLATFORM_MODE_KEY = "platform-mode";
export const PLATFORM_MODE_STORAGE_KEY = "waveguard_platform_mode";
export const PLATFORM_MODE_CHANGED_EVENT = "waveguard-platform-mode-changed";

export const PLATFORM_MODES = {
  LIVE: "live",
  DEMO: "demo",
};

export const DEFAULT_PLATFORM_MODE = { mode: PLATFORM_MODES.LIVE };

export function normalizePlatformMode(raw) {
  const mode =
    raw && typeof raw === "object" && raw.mode === PLATFORM_MODES.DEMO
      ? PLATFORM_MODES.DEMO
      : PLATFORM_MODES.LIVE;
  return { mode };
}

export function isDemoMode(settings) {
  return normalizePlatformMode(settings).mode === PLATFORM_MODES.DEMO;
}

export function loadPlatformModeLocal() {
  if (typeof window === "undefined") return DEFAULT_PLATFORM_MODE;
  try {
    const raw = localStorage.getItem(PLATFORM_MODE_STORAGE_KEY);
    if (!raw) return DEFAULT_PLATFORM_MODE;
    return normalizePlatformMode(JSON.parse(raw));
  } catch {
    return DEFAULT_PLATFORM_MODE;
  }
}

export function savePlatformModeLocal(data) {
  if (typeof window === "undefined") return DEFAULT_PLATFORM_MODE;
  const normalized = normalizePlatformMode(data);
  try {
    localStorage.setItem(PLATFORM_MODE_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent(PLATFORM_MODE_CHANGED_EVENT, { detail: normalized })
    );
  } catch (err) {
    console.warn("[platformMode] localStorage save failed:", err);
  }
  return normalized;
}

/** Synchronous read of current platform mode. */
export function getCurrentPlatformMode() {
  return loadPlatformModeLocal().mode;
}

/** Synchronous boolean check. */
export function isDemoModeActive() {
  return getCurrentPlatformMode() === PLATFORM_MODES.DEMO;
}
