const STORAGE_KEY = "waveguard_general_settings";

export function loadGeneralSettingsLocal() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function saveGeneralSettingsLocal(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("waveguard-general-settings-changed", { detail: data }));
  } catch (err) {
    console.warn("[generalSettingsStorage] localStorage save failed:", err);
    throw new Error("Could not save settings in browser storage. Try a smaller image or clear site data.");
  }
}
