import { formatRelativeTime } from "./formatRelativeTime";

const DISMISSED_KEY = "waveguard-dismissed-diagnoses";

export function getDismissedDiagnosisIds() {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function dismissDiagnosisId(id) {
  const ids = new Set(getDismissedDiagnosisIds());
  ids.add(id);
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function diagnosisForOffline(eq) {
  const isCamera = eq.category === "Camera";
  return {
    id: `diag-offline-${eq.id}`,
    equipmentId: eq.id,
    equipmentName: eq.name,
    equipmentIp: eq.ip,
    severity: "critical",
    summary: isCamera
      ? `${eq.name} unreachable — possible PoE or network fault`
      : `${eq.name} offline — not responding on the network`,
    likelyCause: isCamera
      ? "The device may have lost PoE power, the switch port may be disabled, or the cable path is broken. Check the upstream switch port and PoE budget."
      : `No response from ${eq.ip || "the device IP"}. Verify power, cabling, and VLAN routing to ${eq.location || "its location"}.`,
    steps: [
      `Ping ${eq.ip || "the device"} from the WaveGuard scanner host`,
      `Check switch port status for ${eq.name}`,
      eq.category === "Camera" ? "Verify PoE budget on the supplying switch" : "Review recent configuration changes",
      "Power-cycle the device if safe to do so",
    ],
    suggestedAction: isCamera ? "snmp_port_bounce" : "ping_restart",
    requiresApproval: true,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: eq.updated_date || new Date().toISOString(),
  };
}

function diagnosisForWarning(eq) {
  const temp = eq.telemetry?.tempC;
  const isUps = eq.category === "Power" || /ups/i.test(eq.name || "");
  const isNetwork = eq.category === "Network";

  if (isUps) {
    const battery = eq.telemetry?.batteryPct ?? 42;
    return {
      id: `diag-ups-${eq.id}`,
      equipmentId: eq.id,
      equipmentName: eq.name,
      equipmentIp: eq.ip,
      severity: "warning",
      summary: `${eq.name} battery at ${battery}% — verify AC input`,
      likelyCause:
        "The UPS reports a low charge or degraded battery. AC input may be interrupted, or the battery pack may need replacement.",
      steps: [
        "Verify AC mains input to the UPS",
        "Check bypass panel and shore power connection",
        "Review UPS event log via management interface",
        "Schedule battery replacement if AC is healthy",
      ],
      suggestedAction: "check_cable",
      requiresApproval: false,
      resolvedAt: null,
      relatedDocuments: [],
      createdAt: eq.updated_date || new Date().toISOString(),
    };
  }

  if (isNetwork && temp > 45) {
    return {
      id: `diag-cpu-${eq.id}`,
      equipmentId: eq.id,
      equipmentName: eq.name,
      equipmentIp: eq.ip,
      severity: "warning",
      summary: `High temperature on ${eq.name} (${temp}°C)`,
      likelyCause:
        "Elevated switch or router temperature may indicate blocked ventilation, high ambient temperature in the rack, or a broadcast storm increasing CPU load.",
      steps: [
        "Check rack fan operation and intake clearance",
        "Review port utilization and error counters via SNMP",
        "Identify unusual traffic sources on connected VLANs",
        "Verify STP is enabled on all trunks",
      ],
      suggestedAction: "check_config",
      requiresApproval: false,
      resolvedAt: null,
      relatedDocuments: [],
      createdAt: eq.updated_date || new Date().toISOString(),
    };
  }

  return {
    id: `diag-warn-${eq.id}`,
    equipmentId: eq.id,
    equipmentName: eq.name,
    equipmentIp: eq.ip,
    severity: "warning",
    summary: `${eq.name} reported degraded health`,
    likelyCause:
      "The device is reachable but reporting warning status. Review telemetry, logs, and recent changes.",
    steps: [
      `Inspect ${eq.name} in Equipment for notes and location`,
      "Run a single-device scan from Topology",
      "Check related automation rules and action logs",
    ],
    suggestedAction: "check_config",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: eq.updated_date || new Date().toISOString(),
  };
}

function diagnosisForMaintenance(task) {
  return {
    id: `diag-task-${task.id}`,
    equipmentId: null,
    equipmentName: task.equipment_name || "Maintenance",
    equipmentIp: null,
    severity: task.priority === "critical" ? "warning" : "info",
    summary: `Overdue: ${task.title}`,
    likelyCause: "Scheduled maintenance is past its due date and has not been completed.",
    steps: [
      "Review task details in Maintenance",
      "Assign a technician and update status",
      "Mark complete when work is finished",
    ],
    suggestedAction: "none",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: task.next_due_at || task.planned_due_at || new Date().toISOString(),
  };
}

/**
 * Generate diagnosis cards from live equipment and maintenance data.
 */
export function generateDiagnosesFromSystem({ equipment = [], tasks = [] }, { excludeIds = [] } = {}) {
  const excluded = new Set(excludeIds);
  const diagnoses = [];

  for (const eq of equipment) {
    if (eq.status === "offline") {
      diagnoses.push(diagnosisForOffline(eq));
    } else if (eq.status === "warning") {
      diagnoses.push(diagnosisForWarning(eq));
    }
  }

  for (const task of tasks) {
    if (task.status === "completed") continue;
    const due = task.next_due_at || task.planned_due_at;
    if (due && new Date(due) < new Date()) {
      diagnoses.push(diagnosisForMaintenance(task));
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return diagnoses
    .filter((d) => !excluded.has(d.id))
    .sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

export function getDiagnosisCounts(diagnoses) {
  const active = diagnoses.filter((d) => !d.resolvedAt && !d.acknowledgedAt);
  const acknowledged = diagnoses.filter((d) => d.acknowledgedAt && !d.resolvedAt);
  return {
    active: active.length,
    critical: active.filter((d) => d.severity === "critical").length,
    acknowledged: acknowledged.length,
    snmp: diagnoses.filter((d) => d.source === "snmp" && !d.acknowledgedAt && !d.resolvedAt).length,
  };
}
