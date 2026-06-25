import { isDemoModeActive } from "@/lib/platformMode";

const API_BASE = "/api/hvac";

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let msg;
    try {
      const body = await res.json();
      msg = body.error || body.message || res.statusText;
    } catch {
      msg = res.statusText;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchAllZones() {
  if (isDemoModeActive()) {
    const { getDemoHVACZones } = await import("@/lib/demo/demoHVACData");
    return getDemoHVACZones();
  }
  return apiFetch("/zones");
}

export async function fetchZone(zoneId) {
  if (isDemoModeActive()) {
    const { getDemoHVACZones } = await import("@/lib/demo/demoHVACData");
    const zones = getDemoHVACZones();
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    return zone;
  }
  return apiFetch(`/zones/${encodeURIComponent(zoneId)}`);
}

export async function setZonePower(zoneId, power) {
  return apiFetch(`/zones/${encodeURIComponent(zoneId)}/power`, {
    method: "POST",
    body: JSON.stringify({ power }),
  });
}

export async function setZoneSetpoint(zoneId, temperature) {
  if (temperature < 16 || temperature > 30) {
    throw new Error("Setpoint must be between 16°C and 30°C");
  }
  return apiFetch(`/zones/${encodeURIComponent(zoneId)}/setpoint`, {
    method: "POST",
    body: JSON.stringify({ temperature }),
  });
}

export async function setZoneMode(zoneId, mode) {
  const valid = ["off", "cool", "heat", "auto", "dry", "fan_only"];
  if (!valid.includes(mode)) {
    throw new Error(`Invalid mode "${mode}". Must be one of: ${valid.join(", ")}`);
  }
  return apiFetch(`/zones/${encodeURIComponent(zoneId)}/mode`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export async function setZoneFanSpeed(zoneId, fanSpeed) {
  const valid = ["auto", "low", "medium", "high"];
  if (!valid.includes(fanSpeed)) {
    throw new Error(`Invalid fan speed "${fanSpeed}". Must be one of: ${valid.join(", ")}`);
  }
  return apiFetch(`/zones/${encodeURIComponent(zoneId)}/fan`, {
    method: "POST",
    body: JSON.stringify({ fanSpeed }),
  });
}

export async function fetchZoneDiagnostics(zoneId) {
  return apiFetch(`/zones/${encodeURIComponent(zoneId)}/diagnostics`);
}

export async function fetchSystemStatus() {
  return apiFetch("/system/status");
}
