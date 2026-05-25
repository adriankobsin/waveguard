const CATEGORY_COLORS = {
  Network: "#06b6d4",
  Camera: "#a78bfa",
  AV: "#60a5fa",
  Server: "#34d399",
  Power: "#fbbf24",
  Router: "#fb923c",
  Lighting: "#f472b6",
  Other: "#94a3b8",
};

const DEFAULTS_BY_CATEGORY = {
  Network: { ruHeight: 1, defaultWatts: 35, controlType: "none", avRole: "none" },
  Camera: { ruHeight: 1, defaultWatts: 12, controlType: "none", avRole: "none" },
  AV: { ruHeight: 2, defaultWatts: 85, controlType: "REST", avRole: "encoder" },
  Server: { ruHeight: 2, defaultWatts: 65, controlType: "REST", avRole: "none" },
  Power: { ruHeight: 2, defaultWatts: 25, controlType: "none", avRole: "none" },
  Router: { ruHeight: 1, defaultWatts: 35, controlType: "none", avRole: "none" },
  Lighting: { ruHeight: 1, defaultWatts: 20, controlType: "KNX", avRole: "none" },
  Other: { ruHeight: 1, defaultWatts: 15, controlType: "none", avRole: "none" },
};

function inferControlType(item) {
  const n = (item.name || "").toLowerCase();
  const m = (item.model || "").toLowerCase();
  if (n.includes("cp4") || m.includes("cp4")) return "Crestron-CIP";
  if (m.includes("lutron") || n.includes("lighting")) return "KNX";
  if (m.includes("q-sys") || n.includes("q-sys")) return "REST";
  if (m.includes("nvx") || n.includes("nvx")) return "Crestron-CIP";
  return null;
}

function inferAvRole(item) {
  const n = (item.name || "").toLowerCase();
  const m = (item.model || "").toLowerCase();
  if (m.includes("q-sys") || n.includes("q-sys")) return "dsp";
  if (m.includes("nvx")) {
    if (n.includes("enc") || n.includes("tx")) return "encoder";
    return "decoder";
  }
  if (m.includes("matrix") || n.includes("matrix")) return "matrix";
  if (m.includes("qled") || m.includes("display") || n.startsWith("tv-")) return "display";
  return null;
}

export function normalizeEquipmentRecord(raw) {
  const cat = raw.category || "Other";
  const defaults = DEFAULTS_BY_CATEGORY[cat] || DEFAULTS_BY_CATEGORY.Other;
  const status = raw.status || "unknown";
  const lanStatus =
    status === "online" ? "up" : status === "offline" ? "down" : "degraded";

  const telemetry = {
    powerW: raw.telemetry?.powerW ?? raw.defaultWatts ?? defaults.defaultWatts,
    tempC: raw.telemetry?.tempC ?? (status === "warning" ? 48 : 36),
    lanStatus: raw.telemetry?.lanStatus ?? lanStatus,
    lastSeen: raw.telemetry?.lastSeen ?? new Date().toISOString(),
  };

  return {
    ...raw,
    ruHeight: raw.ruHeight ?? defaults.ruHeight,
    defaultWatts: raw.defaultWatts ?? defaults.defaultWatts,
    controlType: raw.controlType ?? inferControlType(raw) ?? defaults.controlType,
    avRole: raw.avRole ?? inferAvRole(raw) ?? defaults.avRole,
    telemetry,
    color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other,
  };
}

export function normalizeScanDevice(device, equipmentById) {
  const eq = equipmentById?.[device.id];
  const merged = eq ? { ...eq, ...device } : device;
  return normalizeEquipmentRecord(merged);
}

export function buildEquipmentMap(devices) {
  return Object.fromEntries(
    (devices || []).map((d) => [d.id, normalizeEquipmentRecord(d)])
  );
}

export function placementToRackItem(placement, catalog) {
  const eq = catalog[placement.equipmentId];
  if (!eq) return null;
  return {
    id: placement.equipmentId,
    equipmentId: placement.equipmentId,
    name: eq.name,
    model: eq.model,
    category: eq.category,
    ip: eq.ip,
    ruStart: placement.ruStart,
    ruHeight: placement.ruHeight ?? eq.ruHeight ?? 1,
    watts: eq.telemetry?.powerW ?? eq.defaultWatts ?? 0,
    tempC: eq.telemetry?.tempC ?? 36,
    lanStatus: eq.telemetry?.lanStatus ?? "up",
    color: eq.color,
    status: eq.status,
  };
}

export function computeRackSummary(items, catalogWatts = 500) {
  const watts = items.reduce((s, i) => s + (i.watts || 0), 0);
  const temps = items.map((i) => i.tempC).filter(Boolean);
  const tempC = temps.length
    ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
    : 32;
  return { watts: Math.max(watts, catalogWatts), tempC, usedWatts: watts };
}

export { CATEGORY_COLORS };
