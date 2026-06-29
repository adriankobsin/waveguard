import { getEquipmentIp, resolveDeviceChassis, deployPortsOnDevice } from "@/lib/snmp/snmpSwitchProfiles";
import { resolveEquipmentModelString } from "@/lib/snmp/networkDeviceCatalog";
import { DEVICE_ROLE_LABELS } from "@/lib/integrations/vendorRegistry";
import { buildConnectionsFleetView } from "@/lib/snmp/connectionMapView";
import { formatRelativeTime } from "@/lib/systemData/formatRelativeTime";

export function formatUptime(seconds) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatSpeedMbps(mbps) {
  const n = Number(mbps) || 0;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} Gbps`;
  return `${n.toFixed(n < 10 ? 1 : 0)} Mbps`;
}

export function getSwitchHealth(profile, ports = []) {
  if (!profile?.enabled) return { status: "disabled", label: "Disabled", score: 0 };
  if (!profile.lastPollAt) return { status: "unknown", label: "Not polled", score: 0 };
  if (profile.lastPollError) return { status: "critical", label: "Poll error", score: 25 };
  const total = ports.length;
  if (!total) return { status: "warning", label: "No interfaces", score: 50 };
  const up = ports.filter((p) => p.status === "up").length;
  const faults = ports.filter((p) => p.status === "down" && p.connectedDevice).length;
  const down = ports.filter((p) => p.status === "down").length;
  if (faults > 0) return { status: "critical", label: `${faults} cable fault${faults > 1 ? "s" : ""}`, score: 30 };
  const upPct = (up / total) * 100;
  if (upPct >= 95) return { status: "healthy", label: "Healthy", score: 100 };
  if (upPct >= 75) return { status: "warning", label: `${down} port${down > 1 ? "s" : ""} down`, score: 70 };
  return { status: "critical", label: `${down} ports down`, score: 40 };
}

export function detectCableFaults(enrichedSwitches) {
  const faults = [];
  for (const sw of enrichedSwitches || []) {
    for (const port of sw.ports || []) {
      if (port.status === "down" && (port.connectedDevice || port.macAddr)) {
        faults.push({
          severity: "critical",
          switchId: sw.id,
          switchName: sw.displayName,
          switchIp: sw.ip,
          portIndex: port.index,
          portName: port.name,
          ifAlias: port.ifAlias,
          connectedDevice: port.connectedDevice,
          macAddr: port.macAddr,
          location: sw.location,
        });
      }
    }
  }
  return faults;
}

export function detectPortDownAlerts(enrichedSwitches, thresholdPct = 0) {
  if (!thresholdPct) return [];
  const alerts = [];
  for (const sw of enrichedSwitches || []) {
    const total = sw.ports?.length || 0;
    if (!total) continue;
    const down = sw.ports.filter((p) => p.status === "down").length;
    const pct = (down / total) * 100;
    if (pct >= thresholdPct) {
      alerts.push({
        severity: pct >= 50 ? "critical" : "warning",
        switchId: sw.id,
        switchName: sw.displayName,
        message: `${down}/${total} ports down (${Math.round(pct)}%)`,
      });
    }
  }
  return alerts;
}

export function computeFleetSummary(enrichedSwitches, globalSettings = {}) {
  let portsTotal = 0;
  let portsUp = 0;
  let portsDown = 0;
  let poeWatts = 0;
  let trafficIn = 0;
  let trafficOut = 0;
  let enabled = 0;
  let healthy = 0;
  let degraded = 0;
  let critical = 0;

  for (const sw of enrichedSwitches || []) {
    if (sw.enabled === false) continue;
    enabled++;
    const health = getSwitchHealth(sw, sw.ports);
    if (health.status === "healthy") healthy++;
    else if (health.status === "critical") critical++;
    else if (health.status === "warning" || health.status === "unknown") degraded++;

    for (const p of sw.ports || []) {
      portsTotal++;
      if (p.status === "up") portsUp++;
      if (p.status === "down") portsDown++;
      if (p.poeWatts > 0) poeWatts += p.poeWatts;
      trafficIn += p.inMbps || 0;
      trafficOut += p.outMbps || 0;
    }
  }

  const faults = detectCableFaults(enrichedSwitches);
  const downAlerts = detectPortDownAlerts(enrichedSwitches, globalSettings.alertOnPortDownPct);

  return {
    switchCount: enrichedSwitches?.length || 0,
    enabledCount: enabled,
    healthyCount: healthy,
    degradedCount: degraded,
    criticalCount: critical,
    portsTotal,
    portsUp,
    portsDown,
    poeWatts: Math.round(poeWatts * 10) / 10,
    trafficIn: Math.round(trafficIn * 10) / 10,
    trafficOut: Math.round(trafficOut * 10) / 10,
    cableFaults: faults.length,
    faults,
    downAlerts,
  };
}

export function enrichProfiles(profiles, equipmentById) {
  return (profiles || []).map((p) => {
    const eq = equipmentById.get(p.equipmentId);
    const polled = p.lastPoll?.ports || [];
    const chassis = resolveDeviceChassis(eq, p);
    const ports = chassis
      ? deployPortsOnDevice(polled, chassis)
      : polled.length
        ? polled
        : chassis
          ? deployPortsOnDevice([], chassis)
          : [];
    const health = getSwitchHealth(p, ports.filter((pt) => !pt.slotEmpty));
    return {
      ...p,
      eq,
      chassis,
      displayName: eq?.name || p.lastPoll?.sysName || p.id,
      ip: getEquipmentIp(eq),
      model: resolveEquipmentModelString(eq) || eq?.model || "",
      make: eq?.make || "",
      vendor: eq?.vendor || "",
      serial: eq?.serial || "",
      ports,
      sysUptime: p.lastPoll?.sysUptime,
      sysName: p.lastPoll?.sysName,
      pollSource: p.lastPoll?.source || p.lastPollError ? "error" : null,
      health,
      roleLabel: DEVICE_ROLE_LABELS[p.deviceRole] || "Device",
    };
  });
}

export function exportPortsCsv(enrichedSwitches) {
  const headers = [
    "Switch",
    "IP",
    "Location",
    "Port",
    "Name",
    "Alias",
    "Status",
    "Speed Mbps",
    "VLAN",
    "Connected Device",
    "MAC",
    "PoE W",
    "In Mbps",
    "Out Mbps",
  ];
  const rows = [headers.join(",")];
  for (const sw of enrichedSwitches || []) {
    for (const p of sw.ports || []) {
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      rows.push(
        [
          sw.displayName,
          sw.ip,
          sw.location,
          p.index,
          p.name,
          p.ifAlias,
          p.status,
          p.speedMbps || p.speed,
          p.vlan,
          p.connectedDevice,
          p.macAddr,
          p.poeWatts,
          p.inMbps,
          p.outMbps,
        ]
          .map(esc)
          .join(",")
      );
    }
  }
  return rows.join("\n");
}

/** Compact SNMP fleet summary for dashboard widgets. */
export function buildSnmpFleetSnapshot(snmpSwitches, equipment = []) {
  const profiles = snmpSwitches?.profiles || [];
  const global = snmpSwitches?.global || {};
  const byId = new Map((equipment || []).map((e) => [e.id, e]));
  const enriched = enrichProfiles(profiles, byId);
  const summary = computeFleetSummary(enriched, global);
  const connections = buildConnectionsFleetView(enriched);

  const lastPollAt = profiles.reduce((best, p) => {
    if (!p.lastPollAt) return best;
    return !best || p.lastPollAt > best ? p.lastPollAt : best;
  }, null);

  const polledPorts = (ports) => (ports || []).filter((p) => !p.slotEmpty);

  const switches = enriched.map((sw) => {
    const polled = polledPorts(sw.ports);
    const up = polled.filter((p) => p.status === "up").length;
    const faults = polled.filter((p) => p.status === "down" && p.connectedDevice).length;
    return {
      id: sw.id,
      name: sw.displayName,
      ip: sw.ip || "",
      enabled: sw.enabled !== false,
      healthStatus: sw.health?.status || "unknown",
      healthLabel: sw.health?.label || "Unknown",
      portsUp: up,
      portsTotal: polled.length,
      cableFaults: faults,
      lastPollAt: sw.lastPollAt,
      lastPollRelative: sw.lastPollAt ? formatRelativeTime(sw.lastPollAt) : null,
    };
  });

  return {
    registered: profiles.length,
    enabledCount: summary.enabledCount,
    healthyCount: summary.healthyCount,
    degradedCount: summary.degradedCount,
    criticalCount: summary.criticalCount,
    polledCount: profiles.filter((p) => p.lastPollAt).length,
    portsUp: summary.portsUp,
    portsDown: summary.portsDown,
    portsTotal: summary.portsTotal,
    activeConnections: connections.activeConnections,
    totalConnections: connections.totalConnections,
    cableFaults: connections.cableFaults,
    trafficInMbps: summary.trafficIn,
    trafficOutMbps: summary.trafficOut,
    poeWatts: summary.poeWatts,
    lastPollAt,
    lastPollRelative: lastPollAt ? formatRelativeTime(lastPollAt) : null,
    switches,
    topFaults: summary.faults.slice(0, 3).map((f) => ({
      switchName: f.switchName,
      portIndex: f.portIndex,
      connectedDevice: f.connectedDevice,
    })),
  };
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
