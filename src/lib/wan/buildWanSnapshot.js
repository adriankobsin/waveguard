import { buildWanLinks, parseWanLinkKey } from "@/lib/wan/wanManagementSettings";

function pickDefaultPort(links, widgetSelection, defaultDashboardLink) {
  if (!links.length) return null;

  const preferredKey = widgetSelection?.profileId
    ? widgetSelection.portIndex != null
      ? `${widgetSelection.profileId}:${widgetSelection.portIndex}`
      : links.find((l) => l.profileId === widgetSelection.profileId && l.status === "online")?.key
    : defaultDashboardLink;

  if (preferredKey) {
    const match = links.find((l) => l.key === preferredKey);
    if (match) return match;
  }

  return (
    links.find((l) => l.priority === "primary" && l.status === "online") ||
    links.find((l) => l.status === "online") ||
    links[0]
  );
}

/**
 * Build WAN dashboard data from Core Network polls + WAN management settings.
 */
export function buildWanSnapshot(
  snmpSwitches,
  equipment = [],
  widgetSelection = null,
  wanManagement = null
) {
  const wan = buildWanLinks(snmpSwitches, equipment, wanManagement);
  const selected = pickDefaultPort(wan.links, widgetSelection, wan.defaultDashboardLink);

  if (!selected) {
    return {
      configured: false,
      synthetic: wan.synthetic,
      availableRouters: wan.routers,
      ports: [],
      selected: null,
      status: "offline",
      name: "WAN",
      downloadMbps: 0,
      uploadMbps: 0,
    };
  }

  const ports = wan.links.map((l) => ({
    profileId: l.profileId,
    equipmentId: l.equipmentId,
    index: l.portIndex,
    key: l.key,
    name: l.name,
    type: l.type,
    status: l.status,
    linkSpeedMbps: l.linkSpeedMbps,
    downloadMbps: l.downloadMbps,
    uploadMbps: l.uploadMbps,
    publicIp: l.publicIp,
    gateway: l.gateway,
    dns: l.dns,
    isp: l.isp,
    carrier: l.carrier,
    signalDbm: l.signalDbm,
    vpnUp: l.vpnUp,
    latencyMs: l.latencyMs,
    routerName: l.routerName,
    routerIp: l.routerIp,
    routerModel: l.routerModel,
    lastPollAt: l.lastPollAt,
    pollSource: l.pollSource,
    priority: l.priority,
  }));

  return {
    configured: true,
    synthetic: wan.synthetic || selected.synthetic,
    availableRouters: wan.routers.map((r) => ({
      profileId: r.profileId,
      equipmentId: r.equipmentId,
      name: r.name,
      ip: r.ip,
      model: r.model,
      vendor: r.vendor,
      deviceRole: r.deviceRole,
      lastPollAt: r.lastPollAt,
      wanPortCount: r.linkCount,
    })),
    ports,
    selected: {
      profileId: selected.profileId,
      equipmentId: selected.equipmentId,
      index: selected.portIndex,
      name: selected.name,
      type: selected.type,
      status: selected.status,
      linkSpeedMbps: selected.linkSpeedMbps,
      downloadMbps: selected.downloadMbps,
      uploadMbps: selected.uploadMbps,
      publicIp: selected.publicIp,
      gateway: selected.gateway,
      dns: selected.dns,
      isp: selected.isp,
      carrier: selected.carrier,
      signalDbm: selected.signalDbm,
      vpnUp: selected.vpnUp,
      latencyMs: selected.latencyMs,
      routerName: selected.routerName,
      routerIp: selected.routerIp,
      routerModel: selected.routerModel,
      lastPollAt: selected.lastPollAt,
      pollSource: selected.pollSource,
      priority: selected.priority,
    },
    status: selected.status,
    name: selected.name,
    downloadMbps: selected.downloadMbps,
    uploadMbps: selected.uploadMbps,
    isp: selected.isp,
    publicIp: selected.publicIp,
    routerName: selected.routerName,
    routerIp: selected.routerIp,
    lastPollAt: selected.lastPollAt,
  };
}

export { parseWanLinkKey };
