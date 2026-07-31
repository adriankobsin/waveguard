/**
 * Catalyst 9800 WLC diagnoses for the Diagnoses page and Core Network alerts.
 */

export function generateWlcDiagnoses({ controllers = [], probes = {} } = {}) {
  const out = [];

  for (const ctrl of controllers) {
    if (!ctrl.enabled) continue;
    const probe = probes[ctrl.host] || null;
    const snapshot = ctrl.lastSnapshot;

    if (probe && probe.success === false) {
      out.push({
        id: `wlc-offline-${ctrl.host}`,
        source: "cisco_wlc",
        equipmentId: ctrl.equipmentId || null,
        equipmentName: ctrl.label || `WLC ${ctrl.host}`,
        equipmentIp: ctrl.host,
        severity: probe.authFailed ? "critical" : "critical",
        summary: probe.authFailed
          ? `WLC ${ctrl.host} rejected RESTCONF credentials`
          : `WLC unreachable at ${ctrl.host}`,
        likelyCause: probe.message || ctrl.lastError || "RESTCONF connection failed.",
        steps: [
          `Ping ${ctrl.host} from the WaveGuard host`,
          "Verify this is a Catalyst 9800 (wireless YANG models), not a LAN switch",
          "Enable: ip http secure server, restconf — then show restconf state",
          "Re-test from Core Network → Wireless → Credentials",
        ],
        suggestedAction: "test_cisco_wlc",
        requiresApproval: false,
        resolvedAt: null,
        relatedDocuments: [],
        createdAt: probe.checkedAt || new Date().toISOString(),
      });
      continue;
    }

    if (ctrl.lastError && !snapshot) {
      out.push({
        id: `wlc-poll-failed-${ctrl.host}`,
        source: "cisco_wlc",
        equipmentId: ctrl.equipmentId || null,
        equipmentName: ctrl.label || `WLC ${ctrl.host}`,
        equipmentIp: ctrl.host,
        severity: "warning",
        summary: `WLC poll failed for ${ctrl.host}`,
        likelyCause: ctrl.lastError,
        steps: [
          "Open Core Network → Wireless and click Refresh",
          "Check WLC management VLAN reachability",
        ],
        suggestedAction: "poll_cisco_wlc",
        requiresApproval: false,
        resolvedAt: null,
        relatedDocuments: [],
        createdAt: new Date().toISOString(),
      });
    }

    for (const ap of snapshot?.accessPoints || []) {
      if (ap.status !== "offline") continue;
      out.push({
        id: `wlc-ap-offline-${ctrl.host}-${ap.wtpMac || ap.id}`,
        source: "cisco_wlc",
        equipmentId: ctrl.equipmentId || null,
        equipmentName: ap.name || ap.wtpMac,
        equipmentIp: ap.ip || ctrl.host,
        severity: "critical",
        summary: `Access point ${ap.name} is offline`,
        likelyCause: ap.joinError || "AP is not joined to the wireless controller.",
        steps: [
          "Check AP power and uplink cable",
          "Verify CAPWAP UDP 5246/5247 reaches the WLC",
          `Inspect join errors on WLC for ${ap.name}`,
        ],
        suggestedAction: "view_wireless_ap",
        requiresApproval: false,
        resolvedAt: null,
        relatedDocuments: [],
        createdAt: snapshot?.controller?.polledAt || new Date().toISOString(),
      });
    }

    for (const wlan of snapshot?.wlans || []) {
      if (!wlan.enabled || wlan.subnetCidr) continue;
      out.push({
        id: `wlc-ssid-no-subnet-${ctrl.host}-${wlan.profileName}`,
        source: "cisco_wlc",
        equipmentId: null,
        equipmentName: wlan.ssid,
        equipmentIp: ctrl.host,
        severity: "warning",
        summary: `SSID ${wlan.ssid} has no mapped subnet`,
        likelyCause: `Policy profile ${wlan.policyProfile || "unknown"} VLAN ${wlan.vlanId ?? wlan.vlanName ?? "—"} has no interface IP in RESTCONF data.`,
        steps: [
          "Verify the VLAN interface exists on the WLC",
          "Check policy profile VLAN assignment in wireless tag configuration",
        ],
        suggestedAction: "view_wireless_ssid",
        requiresApproval: false,
        resolvedAt: null,
        relatedDocuments: [],
        createdAt: snapshot?.controller?.polledAt || new Date().toISOString(),
      });
    }

    for (const ap of snapshot?.accessPoints || []) {
      for (const radio of ap.radios || []) {
        const util = Number(radio.channelUtil);
        if (!Number.isFinite(util) || util < 80) continue;
        out.push({
          id: `wlc-high-util-${ctrl.host}-${ap.wtpMac}-slot${radio.slot}`,
          source: "cisco_wlc",
          equipmentId: null,
          equipmentName: ap.name,
          equipmentIp: ap.ip || ctrl.host,
          severity: "warning",
          summary: `High channel utilization on ${ap.name} (${util}%)`,
          likelyCause: "RF congestion or excessive clients on this radio.",
          steps: [
            "Review client count and SSID load on this AP",
            "Consider RF profile or channel adjustment",
          ],
          suggestedAction: "view_wireless_ap",
          requiresApproval: false,
          resolvedAt: null,
          relatedDocuments: [],
          createdAt: snapshot?.controller?.polledAt || new Date().toISOString(),
        });
      }
    }
  }

  return out;
}
