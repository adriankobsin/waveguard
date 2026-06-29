const SELECTION_KEY = "waveguard_wan_widget_selection";
const SPEED_TESTS_KEY = "waveguard_wan_speed_tests";

export function loadWanWidgetSelection() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.profileId) return null;
    return {
      profileId: String(parsed.profileId),
      portIndex: parsed.portIndex != null ? Number(parsed.portIndex) : null,
    };
  } catch {
    return null;
  }
}

export function saveWanWidgetSelection({ profileId, portIndex }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SELECTION_KEY,
      JSON.stringify({ profileId, portIndex: portIndex ?? null })
    );
  } catch (err) {
    console.warn("[wanWidgetStorage] save selection failed:", err);
  }
}

export function loadWanSpeedTests() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SPEED_TESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWanSpeedTestResult(result) {
  if (typeof window === "undefined") return result;
  const key = `${result.profileId}:${result.portIndex}`;
  const prev = loadWanSpeedTests().filter((r) => `${r.profileId}:${r.portIndex}` !== key);
  const next = [{ ...result, key }, ...prev].slice(0, 24);
  try {
    localStorage.setItem(SPEED_TESTS_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[wanWidgetStorage] save speed test failed:", err);
  }
  return result;
}

export function getWanSpeedTestForPort(profileId, portIndex) {
  const key = `${profileId}:${portIndex}`;
  return loadWanSpeedTests().find((r) => r.key === key || (`${r.profileId}:${r.portIndex}` === key));
}
