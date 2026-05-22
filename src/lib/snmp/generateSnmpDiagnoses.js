import { enrichProfiles, detectCableFaults, detectPortDownAlerts } from "@/lib/snmp/snmpAnalytics";

/**
 * Build diagnosis cards from SNMP switch fleet state for the Diagnoses page.
 */
export function generateSnmpDiagnoses({ profiles = [], equipment = [], global = {} }) {
  const equipmentById = new Map((equipment || []).map((e) => [e.id, e]));
  const enriched = enrichProfiles(profiles, equipmentById);
  const diagnoses = [];
  const now = new Date().toISOString();

  for (const fault of detectCableFaults(enriched)) {
    const sw = enriched.find((s) => s.id === fault.switchId);
    const id = `diag-snmp-cable-${fault.switchId}-p${fault.portIndex}`;
    diagnoses.push({
      id,
      source: "snmp",
      category: "cable_fault",
      equipmentId: sw?.equipmentId || null,
      equipmentName: fault.switchName,
      equipmentIp: fault.switchIp,
      switchProfileId: fault.switchId,
      portIndex: fault.portIndex,
      severity: "critical",
      summary: `Cable fault — ${fault.switchName} port ${fault.portIndex} down with ${fault.connectedDevice || "known device"} still mapped`,
      likelyCause: `Port ${fault.portIndex} (${fault.portName || `Gi0/${fault.portIndex}`}) is operationally down but the MAC/FDB table still shows ${fault.connectedDevice || "a connected endpoint"}. This usually indicates a cable fault, device powered off, or a stale FDB entry.`,
      steps: [
        `Open Core Network and inspect port ${fault.portIndex} on ${fault.switchName}`,
        fault.ifAlias ? `Check interface alias: ${fault.ifAlias}` : "Verify interface alias and VLAN assignment",
        `Confirm ${fault.connectedDevice || "the endpoint"} is powered and link LED status`,
        "Re-seat or replace patch cable; run interface test from Core Network",
        fault.macAddr ? `Expected MAC: ${fault.macAddr}` : "Clear stale MAC if device was moved",
      ],
      suggestedAction: "snmp_port_bounce",
      requiresApproval: true,
      resolvedAt: null,
      relatedDocuments: [],
      createdAt: sw?.lastPollAt || now,
      snmpPolledAt: sw?.lastPollAt,
    });
  }

  for (const alert of detectPortDownAlerts(enriched, global.alertOnPortDownPct)) {
    const sw = enriched.find((s) => s.id === alert.switchId);
    const id = `diag-snmp-portdown-${alert.switchId}`;
    diagnoses.push({
      id,
      source: "snmp",
      category: "port_availability",
      equipmentId: sw?.equipmentId || null,
      equipmentName: alert.switchName,
      equipmentIp: sw?.ip,
      switchProfileId: alert.switchId,
      severity: alert.severity,
      summary: `${alert.switchName} — ${alert.message}`,
      likelyCause:
        "Multiple interfaces on this switch are down. Check upstream power, spanning tree, or a widespread cabling issue in this location.",
      steps: [
        `Review all ports on ${alert.switchName} in Switch Management`,
        "Check for recent power events or maintenance in this deck/room",
        "Verify switch health and CPU logs via SNMP",
        "Poll fleet again after physical inspection",
      ],
      suggestedAction: "check_config",
      requiresApproval: false,
      resolvedAt: null,
      relatedDocuments: [],
      createdAt: sw?.lastPollAt || now,
      snmpPolledAt: sw?.lastPollAt,
    });
  }

  for (const sw of enriched) {
    if (sw.enabled === false) continue;

    if (sw.lastPollError) {
      const id = `diag-snmp-poll-${sw.id}`;
      diagnoses.push({
        id,
        source: "snmp",
        category: "poll_error",
        equipmentId: sw.equipmentId,
        equipmentName: sw.displayName,
        equipmentIp: sw.ip,
        switchProfileId: sw.id,
        severity: "warning",
        summary: `SNMP poll failed — ${sw.displayName}`,
        likelyCause: sw.lastPollError,
        steps: [
          `Verify ${sw.ip || "switch IP"} is reachable from the scanner host`,
          "Confirm SNMP community and version in switch settings match Discovery",
          "Ensure Net-SNMP (snmpwalk) is installed on the WaveGuard scanner",
          "Check UDP 161 is not blocked by firewall",
        ],
        suggestedAction: "check_config",
        requiresApproval: false,
        resolvedAt: null,
        relatedDocuments: [],
        createdAt: now,
        snmpPolledAt: sw.lastPollAt,
      });
    }

    if (!sw.lastPollAt && sw.ip) {
      const id = `diag-snmp-nopoll-${sw.id}`;
      diagnoses.push({
        id,
        source: "snmp",
        category: "not_polled",
        equipmentId: sw.equipmentId,
        equipmentName: sw.displayName,
        equipmentIp: sw.ip,
        switchProfileId: sw.id,
        severity: "info",
        summary: `${sw.displayName} registered but never polled`,
        likelyCause: "Switch is in the managed fleet but has no SNMP snapshot yet.",
        steps: [
          "Open Core Network and run Poll now",
          "Or enable auto-poll in Core Network → Settings",
        ],
        suggestedAction: "none",
        requiresApproval: false,
        resolvedAt: null,
        relatedDocuments: [],
        createdAt: now,
      });
    }

    const activeFaults = (sw.ports || []).filter(
      (p) => p.status === "down" && p.connectedDevice && !p.slotEmpty
    ).length;
    if (
      sw.health?.status === "critical" &&
      activeFaults === 0 &&
      sw.lastPollAt &&
      !sw.lastPollError
    ) {
      const id = `diag-snmp-health-${sw.id}`;
      diagnoses.push({
        id,
        source: "snmp",
        category: "switch_health",
        equipmentId: sw.equipmentId,
        equipmentName: sw.displayName,
        equipmentIp: sw.ip,
        switchProfileId: sw.id,
        severity: "critical",
        summary: `${sw.displayName} — ${sw.health.label}`,
        likelyCause:
          "SNMP reports multiple down interfaces or poor oper status across the chassis.",
        steps: [
          "Review port panel in Core Network",
          "Check power and environmental status in the rack",
          "Compare with last known good poll timestamp",
        ],
        suggestedAction: "check_config",
        requiresApproval: false,
        resolvedAt: null,
        relatedDocuments: [],
        createdAt: sw.lastPollAt || now,
        snmpPolledAt: sw.lastPollAt,
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return diagnoses.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}
