const STORAGE_KEY = "waveguard_appearance_settings";

export function loadAppearanceLocal() {
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

export function saveAppearanceLocal(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[appearanceSettingsStorage] localStorage save failed:", err);
  }
}

export function applyThemeToDocument(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme === "light" ? "light" : "dark");
}

/** Read an HSL CSS variable as a usable color string, e.g. hsl(224 28% 5%). */
export function getCssVarHsl(name, alpha) {
  if (typeof document === "undefined") {
    const fallback = "224 28% 5%";
    return alpha != null ? `hsla(${fallback} / ${alpha})` : `hsl(${fallback})`;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (!raw) return null;
  return alpha != null ? `hsla(${raw} / ${alpha})` : `hsl(${raw})`;
}

export function readThemeColors() {
  return {
    background: getCssVarHsl("background"),
    foreground: getCssVarHsl("foreground"),
    card: getCssVarHsl("card"),
    muted: getCssVarHsl("muted"),
    mutedForeground: getCssVarHsl("muted-foreground"),
    border: getCssVarHsl("border"),
  };
}
