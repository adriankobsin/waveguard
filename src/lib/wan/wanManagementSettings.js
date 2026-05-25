import { enrichProfiles } from "@/lib/snmp/snmpAnalytics";
import {
  getEquipmentIp,
  profileIdForEquipment,
  normalizeSnmpPort,
} from "@/lib/snmp/snmpSwitchProfiles";
import { buildMockPeplinkPoll } from "@/lib/integrations/peplink/peplinkAdapter";

export const WAN_MANAGEMENT_SETTINGS_KEY = "wan-management";
export const WAN_MANAGEMENT_CHANGED_EVENT = "waveguard-wan-management-changed";

export const WAN_PRIORITIES = [
  { id: "primary", label: "Primary", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  { id: "backup", label: "Backup", color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
  { id: "cellular", label: "Cellular", color: "text-purple-400 bg-purple-500/10 border-purple-500/25" },
  { id: "spare", label: "Spare", color: "text-muted-foreground bg-secondary border-border" },
];

export const WAN_LINK_TYPES = [
  { id: "wan", label: "Fixed WAN" },
  { id: "cellular", label: "Cellular / LTE / 5G" },
  { id: "satellite", label: "Satellite / VSAT" },
  { id: "starlink", label: "Starlink" },
];

export const DEFAULT_WAN_LINK_OVERRIDE = {
  label: "",
  isp: "",
  providerAccount: "",
  providerContact: "",
  providerPhone: "",
  providerEmail: "",
  priority: "backup",
  enabled: true,
  notes: "",
  publicIpOverride: "",
  gatewayOverride: "",
  dnsOverride: "",
  contractDownMbps: null,
  contractUpMbps: null,
};

export const DEFAULT_WAN_MANAGEMENT = {
  defaultDashboardLink: null,
  assignedRouterEquipmentIds: [],
  linkOverrides: {},
  manualLinks: [],
};

export function wanLinkKey(profileId, portIndex) {
  return `${profileId}:${portIndex}`;
}

export function parseWanLinkKey(key) {
  if (!key || key.startsWith("manual:")) return { profileId: null, portIndex: null, manualId: key?.replace(/^manual:/, "") };
  const idx = key.lastIndexOf(":");
  if (idx <= 0) return { profileId: key, portIndex: null };
  return {
    profileId: key.slice(0, idx),
    portIndex: Number(key.slice(idx + 1)),
  };
}

export function normalizeWanLinkOverride(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WAN_LINK_OVERRIDE };
  const priority = WAN_PRIORITIES.some((p) => p.id === raw.priority) ? raw.priority : "backup";
  return {
    ...DEFAULT_WAN_LINK_OVERRIDE,
    ...raw,
    priority,
    enabled: raw.enabled !== false,
    contractDownMbps:
      raw.contractDownMbps != null && raw.contractDownMbps !== ""
        ? Number(raw.contractDownMbps)
        : null,
    contractUpMbps:
      raw.contractUpMbps != null && raw.contractUpMbps !== ""
        ? Number(raw.contractUpMbps)
        : null,
  };
}

export function normalizeManualWanLink(raw) {
  if (!raw?.id) return null;
  const type = WAN_LINK_TYPES.some((t) => t.id === raw.type) ? raw.type : "wan";
  const priority = WAN_PRIORITIES.some((p) => p.id === raw.priority) ? raw.priority : "backup";
  return {
    id: String(raw.id),
    routerName: raw.routerName || "Manual router",
    routerEquipmentId: raw.routerEquipmentId || "",
    profileId: raw.profileId || "",
    name: raw.name || "WAN",
    type,
    isp: raw.isp || "",
    providerAccount: raw.providerAccount || "",
    providerContact: raw.providerContact || "",
    providerPhone: raw.providerPhone || "",
    providerEmail: raw.providerEmail || "",
    priority,
    enabled: raw.enabled !== false,
    notes: raw.notes || "",
    publicIp: raw.publicIp || "",
    gateway: raw.gateway || "",
    dns: raw.dns || "",
    contractDownMbps:
      raw.contractDownMbps != null && raw.contractDownMbps !== ""
        ? Number(raw.contractDownMbps)
        : null,
    contractUpMbps:
      raw.contractUpMbps != null && raw.contractUpMbps !== ""
        ? Number(raw.contractUpMbps)
        : null,
    status: raw.status === "offline" ? "offline" : raw.status === "warning" ? "warning" : "online",
    downloadMbps: Number(raw.downloadMbps) || 0,
    uploadMbps: Number(raw.uploadMbps) || 0,
    linkSpeedMbps: Number(raw.linkSpeedMbps) || 0,
    carrier: raw.carrier || "",
    signalDbm: raw.signalDbm ?? null,
  };
}

export function normalizeWanManagement(raw) {
  const base = { ...DEFAULT_WAN_MANAGEMENT, ...(raw && typeof raw === "object" ? raw : {}) };
  const linkOverrides = {};
  for (const [key, val] of Object.entries(base.linkOverrides || {})) {
    linkOverrides[key] = normalizeWanLinkOverride(val);
  }
  const manualLinks = (base.manualLinks || [])
    .map(normalizeManualWanLink)
    .filter(Boolean);
  const assignedRouterEquipmentIds = Array.isArray(base.assignedRouterEquipmentIds)
    ? [...new Set(base.assignedRouterEquipmentIds.filter(Boolean).map(String))]
    : [];
  return {
    defaultDashboardLink: base.defaultDashboardLink || null,
    assignedRouterEquipmentIds,
    linkOverrides,
    manualLinks,
  };
}

function isWanManagementProfile(profile, eq, assignedIds) {
  if (assignedIds?.size) {
    return assignedIds.has(profile.equipmentId);
  }
  if (["wan_router", "router", "firewall"].includes(profile.deviceRole)) return true;
  if (profile.integrationVendor === "peplink") return true;
  if (eq?.category === "Router") return true;
  const blob = `${eq?.name || ""} ${eq?.model || ""} ${eq?.make || ""} ${eq?.vendor || ""}`.toLowerCase();
  return /peplink|balance|fortigate|firewall|router|gateway|starlink|udm|dream\s*machine/.test(blob);
}

function isWanUplinkPort(port) {
  const type = port.meta?.type || port.portRole || "";
  if (type === "wan" || type === "cellular") return true;
  const name = `${port.name || ""} ${port.ifAlias || ""}`.toLowerCase();
  return /wan|cell|lte|5g|modem|starlink|vsat|sat/.test(name);
}

function isWanEquipment(eq) {
  if (!eq) return false;
  if (eq.category === "Router") return true;
  const blob = `${eq.name || ""} ${eq.model || ""} ${eq.make || ""} ${eq.vendor || ""}`.toLowerCase();
  return /router-wan|starlink|peplink|balance\s*2500|max\s*br|fortigate|firewall|wan router|gateway|udm/.test(blob);
}

function inferIspLabel(port, eq, override) {
  if (override?.isp) return override.isp;
  if (port.meta?.isp) return port.meta.isp;
  if (port.meta?.carrier) return port.meta.carrier;
  const name = `${port.name || ""} ${port.ifAlias || ""} ${eq?.notes || ""}`.toLowerCase();
  if (/starlink/.test(name)) return "Starlink";
  if (/cell|lte|5g|modem/.test(name)) return port.meta?.carrier || "Cellular";
  if (/vsat|sat/.test(name)) return "VSAT";
  if (/peplink|balance/.test(`${eq?.model || ""}`.toLowerCase())) return "Peplink WAN";
  return eq?.make || "Internet";
}

function inferPriority(port, override) {
  if (override?.priority) return override.priority;
  const type = port.meta?.type || port.portRole || "";
  const name = `${port.name || ""}`.toLowerCase();
  if (type === "cellular" || /cell|lte|5g|modem/.test(name)) return "cellular";
  if (/wan1|primary|starlink/.test(name)) return "primary";
  if (/wan2|backup/.test(name)) return "backup";
  return "backup";
}

function buildGenericMockWanPoll(eq) {
  const ip = getEquipmentIp(eq);
  const isCellular = /cell|lte|5g|modem/i.test(`${eq?.name || ""} ${eq?.model || ""}`);
  const polledAt = new Date().toISOString();
  const ports = [
    {
      index: 1,
      name: "WAN1",
      status: "up",
      speedMbps: 0,
      inMbps: 0,
      outMbps: 0,
      meta: {
        type: "wan",
        publicIp: null,
        gateway: null,
        dns: null,
        isp: eq?.make || "Internet",
      },
    },
  ];
  if (isCellular) {
    ports.push({
      index: 2,
      name: "Cellular",
      status: "up",
      speedMbps: 0,
      inMbps: 0,
      outMbps: 0,
      meta: { type: "cellular", carrier: "LTE", signalDbm: null, isp: "Cellular" },
    });
  }
  ports.push({ index: ports.length + 1, name: "LAN", status: "up", speedMbps: 0, meta: { type: "lan" } });
  return { sysName: eq?.name || "WAN router", polledAt, source: "synthetic", ports };
}

function buildMockWanPollForEquipment(eq) {
  const isPeplink = /peplink|balance\s*2500|max\s*br/i.test(`${eq?.model || ""} ${eq?.make || ""}`);
  if (isPeplink) return buildMockPeplinkPoll(eq?.model, getEquipmentIp(eq));
  return buildGenericMockWanPoll(eq);
}

function buildSyntheticWanProfiles(equipment, assignedIds) {
  const useAssigned = assignedIds && assignedIds.size > 0;
  const candidates = (equipment || [])
    .filter((eq) => (useAssigned ? assignedIds.has(eq.id) : isWanEquipment(eq)))
    .sort((a, b) => {
      if (/router-wan/i.test(a.name || "")) return -1;
      if (/router-wan/i.test(b.name || "")) return 1;
      return 0;
    });

  return candidates.map((eq) => {
    const mock = buildMockWanPollForEquipment(eq);
    const ports = (mock.ports || []).map((p) => normalizeSnmpPort(p)).filter(Boolean);
    const polledAt = mock.polledAt || new Date().toISOString();
    const isPeplink = /peplink|balance|max\s*br/i.test(`${eq.model} ${eq.make}`);
    return {
      id: profileIdForEquipment(eq.id),
      equipmentId: eq.id,
      enabled: true,
      deviceRole: /starlink/i.test(eq.name || "") ? "router" : "wan_router",
      integrationVendor: isPeplink ? "peplink" : "snmp",
      pollMethod: isPeplink ? "peplink_hybrid" : "snmp",
      location: eq.location || "",
      lastPollAt: polledAt,
      lastPoll: {
        sysName: eq.name,
        polledAt,
        source: mock.source || "synthetic",
        ports,
        peplinkMeta: mock.peplinkMeta,
      },
    };
  });
}

function mapPolledWanLink(profile, eq, port, wanManagement) {
  const key = wanLinkKey(profile.id, port.index);
  const override = wanManagement.linkOverrides[key] || {};
  if (override.enabled === false) return null;

  const type = port.meta?.type || port.portRole || "wan";
  const downloadMbps = Math.round((port.inMbps || 0) * 10) / 10;
  const uploadMbps = Math.round((port.outMbps || 0) * 10) / 10;

  return {
    key,
    source: "polled",
    profileId: profile.id,
    equipmentId: profile.equipmentId,
    portIndex: port.index,
    name: override.label || port.name || port.ifAlias || `WAN ${port.index}`,
    portName: port.name || port.ifAlias || `Port ${port.index}`,
    type,
    status: port.status === "up" ? "online" : port.status === "down" ? "offline" : "warning",
    linkSpeedMbps: port.speedMbps || port.speed || 0,
    downloadMbps,
    uploadMbps,
    publicIp: override.publicIpOverride || port.meta?.publicIp || null,
    gateway: override.gatewayOverride || port.meta?.gateway || null,
    dns: override.dnsOverride || port.meta?.dns || null,
    isp: inferIspLabel(port, eq, override),
    carrier: port.meta?.carrier || null,
    signalDbm: port.meta?.signalDbm ?? null,
    vpnUp: port.meta?.vpnUp ?? null,
    latencyMs: port.meta?.latencyMs ?? null,
    priority: inferPriority(port, override),
    providerAccount: override.providerAccount || "",
    providerContact: override.providerContact || "",
    providerPhone: override.providerPhone || "",
    providerEmail: override.providerEmail || "",
    notes: override.notes || "",
    contractDownMbps: override.contractDownMbps,
    contractUpMbps: override.contractUpMbps,
    enabled: override.enabled !== false,
    routerName: eq?.name || profile.lastPoll?.sysName || "WAN router",
    routerIp: getEquipmentIp(eq) || "",
    routerModel: eq?.model || "",
    routerVendor: profile.integrationVendor || eq?.make || "",
    lastPollAt: profile.lastPollAt || profile.lastPoll?.polledAt || null,
    pollSource: profile.lastPoll?.source || null,
    synthetic: profile.lastPoll?.source === "synthetic" || profile.lastPoll?.source === "peplink-mock",
  };
}

function mapManualWanLink(link) {
  if (!link.enabled) return null;
  return {
    key: `manual:${link.id}`,
    source: "manual",
    manualId: link.id,
    profileId: link.profileId || "",
    equipmentId: link.routerEquipmentId || "",
    portIndex: null,
    name: link.name,
    portName: link.name,
    type: link.type,
    status: link.status,
    linkSpeedMbps: link.linkSpeedMbps,
    downloadMbps: link.downloadMbps,
    uploadMbps: link.uploadMbps,
    publicIp: link.publicIp,
    gateway: link.gateway,
    dns: link.dns,
    isp: link.isp,
    carrier: link.carrier,
    signalDbm: link.signalDbm,
    priority: link.priority,
    providerAccount: link.providerAccount,
    providerContact: link.providerContact,
    providerPhone: link.providerPhone,
    providerEmail: link.providerEmail,
    notes: link.notes,
    contractDownMbps: link.contractDownMbps,
    contractUpMbps: link.contractUpMbps,
    enabled: true,
    routerName: link.routerName,
    routerIp: "",
    routerModel: "",
    routerVendor: "",
    lastPollAt: null,
    pollSource: "manual",
    synthetic: false,
  };
}

/**
 * Build unified WAN link list from polls, equipment, and management settings.
 *
 * When `assignedRouterEquipmentIds` is set, only those routers appear as WAN.
 * Assigned routers without poll data get a synthetic preview so the UI is
 * usable immediately. Real poll data replaces previews once available.
 */
export function buildWanLinks(snmpSwitches, equipment = [], wanManagement = DEFAULT_WAN_MANAGEMENT) {
  const mgmt = normalizeWanManagement(wanManagement);
  const profiles = snmpSwitches?.profiles || [];
  const byId = new Map((equipment || []).map((e) => [e.id, e]));
  const assignedSet = new Set(mgmt.assignedRouterEquipmentIds);
  const useAssignment = assignedSet.size > 0;
  const allowSynthetic = true;
  let synthetic = false;

  let enriched = enrichProfiles(profiles, byId);
  let routers = enriched.filter((sw) => isWanManagementProfile(sw, sw.eq, assignedSet));
  const links = [];

  for (const sw of routers) {
    for (const port of sw.ports || []) {
      if (port.slotEmpty || !isWanUplinkPort(port)) continue;
      const mapped = mapPolledWanLink(sw, sw.eq, port, mgmt);
      if (mapped) links.push(mapped);
    }
  }

  if (!links.length && allowSynthetic) {
    const syntheticProfiles = buildSyntheticWanProfiles(
      equipment,
      useAssignment ? assignedSet : null
    );
    if (syntheticProfiles.length) {
      synthetic = true;
      enriched = enrichProfiles([...profiles, ...syntheticProfiles], byId);
      routers = enriched.filter((sw) => isWanManagementProfile(sw, sw.eq, assignedSet));
      for (const sw of routers) {
        for (const port of sw.ports || []) {
          if (port.slotEmpty || !isWanUplinkPort(port)) continue;
          const mapped = mapPolledWanLink(sw, sw.eq, port, mgmt);
          if (mapped) links.push({ ...mapped, synthetic: true });
        }
      }
    }
  }

  for (const manual of mgmt.manualLinks) {
    const mapped = mapManualWanLink(manual);
    if (mapped) links.push(mapped);
  }

  links.sort((a, b) => {
    const prio = { primary: 0, backup: 1, cellular: 2, spare: 3 };
    const pd = (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9);
    if (pd !== 0) return pd;
    return a.routerName.localeCompare(b.routerName);
  });

  const online = links.filter((l) => l.status === "online");
  const primary = links.find((l) => l.priority === "primary" && l.status === "online") || online[0];

  const routersSummary = routers
    .filter((sw) => links.some((l) => l.profileId === sw.id))
    .map((sw) => ({
      profileId: sw.id,
      equipmentId: sw.equipmentId,
      name: sw.displayName,
      ip: sw.ip || "",
      model: sw.model || "",
      vendor: sw.integrationVendor || sw.vendor || "",
      deviceRole: sw.deviceRole,
      lastPollAt: sw.lastPollAt,
      linkCount: links.filter((l) => l.profileId === sw.id).length,
    }));

  return {
    links,
    routers: routersSummary,
    synthetic,
    summary: {
      total: links.length,
      online: online.length,
      offline: links.filter((l) => l.status === "offline").length,
      primaryIsp: primary?.isp || "—",
      aggregateDownMbps: Math.round(online.reduce((s, l) => s + (l.downloadMbps || 0), 0) * 10) / 10,
      aggregateUpMbps: Math.round(online.reduce((s, l) => s + (l.uploadMbps || 0), 0) * 10) / 10,
    },
    defaultDashboardLink: mgmt.defaultDashboardLink,
  };
}

export function loadWanManagementLocal() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WAN_MANAGEMENT_SETTINGS_KEY);
    if (!raw) return null;
    return normalizeWanManagement(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveWanManagementLocal(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WAN_MANAGEMENT_SETTINGS_KEY, JSON.stringify(normalizeWanManagement(data)));
    window.dispatchEvent(new CustomEvent(WAN_MANAGEMENT_CHANGED_EVENT));
  } catch (err) {
    console.warn("[wanManagementSettings] localStorage save failed:", err);
  }
}
