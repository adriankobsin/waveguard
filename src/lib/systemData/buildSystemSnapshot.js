import { formatRelativeTime } from "./formatRelativeTime";
import { buildSnmpFleetSnapshot } from "@/lib/snmp/snmpAnalytics";
import { buildWanSnapshot } from "@/lib/wan/buildWanSnapshot";

function countByStatus(devices) {
  const total = devices.length;
  const online = devices.filter((d) => d.status === "online").length;
  const warning = devices.filter((d) => d.status === "warning").length;
  const offline = devices.filter((d) => d.status === "offline").length;
  return { online, warning, offline, total };
}

function filterCategory(devices, category) {
  return devices.filter((d) => d.category === category);
}

function filterControl(devices) {
  return devices.filter(
    (d) =>
      (d.controlType && d.controlType !== "none") ||
      /cp4|processor|controller/i.test(d.name || "") ||
      /crestron|lutron/i.test(d.model || "")
  );
}

function buildTrafficSeries(logs) {
  const now = Date.now();
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now - (23 - i) * 3600000);
    return {
      time: `${String(hour.getHours()).padStart(2, "0")}:00`,
      inMbps: 0,
      outMbps: 0,
    };
  });

  for (const log of logs || []) {
    const t = new Date(log.created_date || log.createdAt).getTime();
    const hoursAgo = Math.floor((now - t) / 3600000);
    if (hoursAgo < 0 || hoursAgo >= 24) continue;
    const idx = 23 - hoursAgo;
    const weight = log.status === "error" ? 2 : 8;
    if (log.action === "scan_completed" || log.action === "snmp_poll") {
      buckets[idx].inMbps += weight * 1.2;
      buckets[idx].outMbps += weight * 0.6;
    } else {
      buckets[idx].inMbps += weight * 0.4;
      buckets[idx].outMbps += weight * 0.3;
    }
  }

  return buckets.map((b) => ({
    ...b,
    inMbps: Math.round(Math.max(4, b.inMbps) * 10) / 10,
    outMbps: Math.round(Math.max(2, b.outMbps) * 10) / 10,
  }));
}

function formatLogEvent(log) {
  const actionLabels = {
    rule_fired: "Automation rule fired",
    cable_created: "Cable record created",
    device_updated: "Device updated",
    scan_completed: "Network scan completed",
    snmp_poll: "SNMP poll completed",
    user_login: "User logged in",
  };
  const text = log.details || actionLabels[log.action] || log.action || "System event";
  return {
    id: log.id,
    text,
    time: formatRelativeTime(log.created_date || log.createdAt),
    status: log.status,
  };
}

function findWanDevice(devices) {
  return (
    devices.find(
      (d) =>
        /starlink|wan|router/i.test(d.name || "") ||
        /starlink|isr/i.test(d.model || "") ||
        d.ip?.startsWith("10.0.0.")
    ) || devices.find((d) => d.category === "Network" && d.ip)
  );
}

function findUpsDevices(devices) {
  return devices.filter((d) => d.category === "Power" || /ups/i.test(d.name || ""));
}

function estimateBattery(eq) {
  if (eq.telemetry?.batteryPct != null) return eq.telemetry.batteryPct;
  if (eq.status === "warning") return 42;
  if (eq.status === "offline") return 0;
  return 95;
}

function buildRecommendations(devices, tasks) {
  const recs = [];

  for (const eq of findUpsDevices(devices)) {
    const battery = estimateBattery(eq);
    if (battery < 50 || eq.status === "warning") {
      recs.push({
        id: `rec-ups-${eq.id}`,
        text: `Check ${eq.name} — battery at ${battery}%`,
        priority: battery < 30 ? "high" : "medium",
      });
    }
  }

  const overdue = (tasks || []).filter((t) => {
    if (t.status === "completed") return false;
    const due = t.next_due_at || t.planned_due_at;
    return due && new Date(due) < new Date();
  });
  for (const task of overdue.slice(0, 2)) {
    recs.push({
      id: `rec-task-${task.id}`,
      text: `Overdue maintenance: ${task.title}`,
      priority: task.priority === "critical" ? "high" : "medium",
    });
  }

  for (const eq of devices.filter((d) => d.status === "offline").slice(0, 2)) {
    recs.push({
      id: `rec-offline-${eq.id}`,
      text: `Investigate offline device ${eq.name} (${eq.ip || "no IP"})`,
      priority: "high",
    });
  }

  return recs.slice(0, 5);
}

function deviceToAlarm(eq, severity) {
  const title =
    severity === "critical"
      ? `${eq.name} offline`
      : `${eq.name} — ${eq.status === "warning" ? "degraded" : "attention needed"}`;
  return {
    id: `alarm-${severity}-${eq.id}`,
    title,
    time: formatRelativeTime(eq.updated_date || eq.telemetry?.lastSeen),
    equipmentId: eq.id,
  };
}

/**
 * Build dashboard widget data from live Equipment, MaintenanceTask, and ActionLog records.
 */
export function buildSystemSnapshot({
  equipment = [],
  tasks = [],
  logs = [],
  rules = [],
  snmpSwitches = { profiles: [], global: {} },
  wanManagement = null,
}) {
  const devices = equipment.map((eq) => {
    const status = eq.status || "online";
    const meta = eq.telemetry || {};
    return {
      ...eq,
      status,
      telemetry: {
        powerW: meta.powerW ?? eq.defaultWatts,
        tempC: meta.tempC,
        lanStatus: meta.lanStatus || (status === "online" ? "up" : status === "offline" ? "down" : "degraded"),
        lastSeen: meta.lastSeen || eq.updated_date,
        batteryPct: meta.batteryPct,
      },
    };
  });

  const network = countByStatus(filterCategory(devices, "Network"));
  const av = countByStatus(filterCategory(devices, "AV"));
  const control = countByStatus(filterControl(devices));
  const lighting = countByStatus(filterCategory(devices, "Lighting"));
  const cctv = countByStatus(filterCategory(devices, "Camera"));

  const offline = devices.filter((d) => d.status === "offline");
  const warning = devices.filter((d) => d.status === "warning");

  const criticalAlarms = offline.map((d) => deviceToAlarm(d, "critical"));
  const warningAlarms = [
    ...warning.map((d) => deviceToAlarm(d, "warning")),
    ...(rules || [])
      .filter((r) => r.enabled && /ups|battery/i.test(r.name || ""))
      .map((r) => ({
        id: `alarm-rule-${r.id}`,
        title: r.name,
        time: formatRelativeTime(r.created_date),
      })),
  ].slice(0, 8);

  const wanDevice = findWanDevice(devices);
  const wanFromNetwork = buildWanSnapshot(snmpSwitches, equipment, null, wanManagement);
  const upsList = findUpsDevices(devices);
  const mainUps = upsList[0];

  const sortedLogs = [...(logs || [])].sort(
    (a, b) =>
      new Date(b.created_date || b.createdAt) - new Date(a.created_date || a.createdAt)
  );

  const snmpFleet = buildSnmpFleetSnapshot(snmpSwitches, equipment);

  return {
    monitoredCount: devices.length,
    categories: {
      network: { label: "Core network", ...network },
      av: { label: "AV systems", ...av },
      control: { label: "Control processors", ...control },
      lighting: { label: "Lighting zones", ...lighting },
      cctv: { label: "Cameras", ...cctv },
    },
    traffic: buildTrafficSeries(logs),
    criticalAlarms,
    warningAlarms,
    offlineDevices: offline.map((d) => ({ name: d.name, ip: d.ip || "—", id: d.id })),
    recentEvents: sortedLogs.slice(0, 8).map(formatLogEvent),
    recommendations: buildRecommendations(devices, tasks),
    wan: wanFromNetwork.configured
      ? {
          ...wanFromNetwork,
          status: wanFromNetwork.selected?.status || "offline",
          name: wanFromNetwork.selected?.name || "WAN",
          downloadMbps: wanFromNetwork.selected?.downloadMbps ?? 0,
          uploadMbps: wanFromNetwork.selected?.uploadMbps ?? 0,
          isp: wanFromNetwork.selected?.isp,
          publicIp: wanFromNetwork.selected?.publicIp,
        }
      : {
          configured: false,
          availableRouters: wanFromNetwork.availableRouters,
          ports: [],
          selected: null,
          status: wanDevice?.status === "online" ? "online" : wanDevice?.status === "offline" ? "offline" : "warning",
          name: wanDevice?.name || "WAN",
          downloadMbps:
            wanDevice?.responseTimeMs != null
              ? Math.round((120 - Math.min(wanDevice.responseTimeMs, 100)) * 0.5 * 10) / 10
              : wanDevice?.status === "online"
                ? 24.3
                : 0,
          uploadMbps:
            wanDevice?.status === "online"
              ? Math.round((wanDevice?.responseTimeMs != null ? 18 : 12) * 10) / 10
              : 0,
        },
    ups: mainUps
      ? {
          name: mainUps.name,
          status: mainUps.status === "online" ? "Online" : mainUps.status === "offline" ? "Offline" : "Warning",
          battery: estimateBattery(mainUps),
          load: mainUps.telemetry?.powerW
            ? Math.min(95, Math.round((mainUps.telemetry.powerW / 3000) * 100))
            : 38,
        }
      : null,
    maintenance: {
      overdue: tasks.filter((t) => {
        if (t.status === "completed") return false;
        const due = t.next_due_at || t.planned_due_at;
        return due && new Date(due) < new Date();
      }).length,
      pending: tasks.filter((t) => t.status === "pending" || t.status === "scheduled").length,
    },
    snmpFleet,
    fetchedAt: new Date().toISOString(),
  };
}
