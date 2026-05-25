import { isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";

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

export async function loadWanSpeedTestsWithServer() {
  const local = loadWanSpeedTests();
  if (!isMockServer) return local;
  try {
    const base = getMockAppApiBase();
    const res = await fetch(`${base}/speedTests`, {
      headers: { ...getMockAuthHeaders() },
    });
    if (res.ok) {
      const server = await res.json();
      if (!Array.isArray(server) || !server.length) return local;
      const merged = mergeTestResults(local, server);
      try {
        localStorage.setItem(SPEED_TESTS_KEY, JSON.stringify(merged));
      } catch { /* ok */ }
      return merged;
    }
  } catch {
    /* fall through */
  }
  return local;
}

function mergeTestResults(local, server) {
  const seen = new Map();
  for (const t of local) {
    const k = `${t.profileId}:${t.portIndex}`;
    const existing = seen.get(k);
    if (!existing || new Date(t.testedAt) > new Date(existing.testedAt)) {
      seen.set(k, t);
    }
  }
  for (const t of server) {
    const k = `${t.profileId}:${t.portIndex}`;
    const existing = seen.get(k);
    if (!existing || new Date(t.testedAt) > new Date(existing.testedAt)) {
      seen.set(k, t);
    }
  }
  return [...seen.values()].sort((a, b) => new Date(b.testedAt) - new Date(a.testedAt)).slice(0, 24);
}

export async function saveWanSpeedTestResult(result) {
  if (typeof window === "undefined") return result;
  const key = `${result.profileId}:${result.portIndex}`;
  const prev = loadWanSpeedTests().filter((r) => `${r.profileId}:${r.portIndex}` !== key);
  const next = [{ ...result, key }, ...prev].slice(0, 24);
  try {
    localStorage.setItem(SPEED_TESTS_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[wanWidgetStorage] save speed test failed:", err);
  }
  if (isMockServer) {
    try {
      const base = getMockAppApiBase();
      await fetch(`${base}/speedTests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
        body: JSON.stringify(result),
      });
    } catch { /* server sync is best-effort */ }
  }
  return result;
}

export function getWanSpeedTestForPort(profileId, portIndex) {
  const key = `${profileId}:${portIndex}`;
  return loadWanSpeedTests().find((r) => r.key === key || (`${r.profileId}:${r.portIndex}` === key));
}
