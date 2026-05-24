/**
 * Cisco-specific diagnoses for the Diagnoses page.
 *
 * Three diagnosis kinds:
 *
 *   1. `cisco-switch-offline-<host>`
 *      Severity: critical. Fires when a saved Cisco switch has
 *      `enabled === true` but its most recent probe came back as
 *      unreachable. Resolves automatically when the next probe succeeds.
 *
 *   2. `cisco-switch-auth-failed-<host>`
 *      Severity: critical. Fires when SSH port 22 is open but the
 *      authentication failed. Separate from "offline" so the operator
 *      knows to check credentials rather than network reachability.
 *
 *   3. `cisco-port-flapping-<host>-<ifIndex>`
 *      Severity: warning. Fires after 3+ port-up/port-down transitions
 *      within the last 5 minutes on the same interface. Helpful for
 *      diagnosing flaky cables or duplex mismatches.
 *
 * Each diagnosis matches the shape consumed by `DiagnosesPage.jsx` and
 * the sidebar badge counter in `AppLayout.jsx`.
 */

const PORT_FLAP_WINDOW_MS = 5 * 60 * 1000;
const PORT_FLAP_THRESHOLD = 3;

function offlineDiagnosis(sw, probe) {
  return {
    id: `cisco-switch-offline-${sw.host}`,
    source: "cisco",
    equipmentId: sw.equipmentId || null,
    equipmentName: sw.label || sw.system?.hostname || `Cisco switch ${sw.host}`,
    equipmentIp: sw.host,
    severity: "critical",
    summary: `Cisco switch unreachable at ${sw.host}`,
    likelyCause:
      probe?.message ||
      probe?.error ||
      `The switch stopped responding on SSH (port ${sw.sshPort || 22}).`,
    steps: [
      `Ping ${sw.host} from the WaveGuard host`,
      "Confirm the switch has not lost power",
      "Verify the LAN uplink is connected and the VLAN reaches the management interface",
      "Re-test from the Cisco Switches → Test connection button",
    ],
    suggestedAction: "test_cisco_switch",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: probe?.checkedAt || new Date().toISOString(),
  };
}

function authFailedDiagnosis(sw, probe) {
  return {
    id: `cisco-switch-auth-failed-${sw.host}`,
    source: "cisco",
    equipmentId: sw.equipmentId || null,
    equipmentName: sw.label || sw.system?.hostname || `Cisco switch ${sw.host}`,
    equipmentIp: sw.host,
    severity: "critical",
    summary: `Cisco switch ${sw.host} rejected SSH credentials`,
    likelyCause:
      probe?.message ||
      "SSH port is open but the username/password the platform stored is wrong. The switch admin password may have been changed.",
    steps: [
      "Open Cisco Switches → key icon and re-enter the SSH credentials",
      "Verify the SSH user is still in the privilege-15 group on the switch",
      "If the password is forgotten, recover it via the switch's console port",
    ],
    suggestedAction: "edit_cisco_credentials",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: probe?.checkedAt || new Date().toISOString(),
  };
}

function portFlappingDiagnosis(host, ifIndex, sample, transitions) {
  return {
    id: `cisco-port-flapping-${host}-${ifIndex}`,
    source: "cisco",
    equipmentId: null,
    equipmentName: sample?.portName || `Port ${ifIndex}`,
    equipmentIp: host,
    severity: "warning",
    summary: `Port ${sample?.portName || ifIndex} on ${host} is flapping`,
    likelyCause: `${transitions} link transitions within the last ${Math.round(
      PORT_FLAP_WINDOW_MS / 60000
    )} minutes. Cable, transceiver, or duplex mismatch.`,
    steps: [
      "Reseat the cable on both ends",
      "Replace the SFP/RJ45 cable if the issue persists",
      "Check the downstream device's link auto-negotiation setting",
    ],
    suggestedAction: "inspect_port",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: sample?.ts || new Date().toISOString(),
  };
}

/**
 * Build diagnosis objects from the current Cisco state. Caller is
 * responsible for merging the result into the existing diagnoses array.
 *
 * Inputs:
 *   - `switches` : array of normalised Cisco switch records (with optional
 *                  `lastProbe` attached for offline/auth detection).
 *   - `events`   : array of events from `loadCiscoEvents()` — used for
 *                  port-flapping detection.
 */
export function generateCiscoDiagnoses({ switches = [], events = [] } = {}) {
  const out = [];

  for (const sw of switches) {
    if (!sw?.host || !sw.enabled) continue;
    const probe = sw.lastProbe || null;
    if (!probe) continue;
    if (probe.success === false) {
      const isAuth =
        /auth|password|credential|access\s+denied|publickey|permission\s+denied/i.test(
          probe.message || probe.error || ""
        ) ||
        probe.ports?.find((p) => p.role === "ssh" && p.open);
      if (isAuth) {
        out.push(authFailedDiagnosis(sw, probe));
      } else {
        out.push(offlineDiagnosis(sw, probe));
      }
    }
  }

  // Group port-flap events by host + ifIndex.
  const cutoff = Date.now() - PORT_FLAP_WINDOW_MS;
  const byKey = new Map();
  for (const evt of events) {
    if (evt?.kind !== "port-change") continue;
    if (!evt.host || evt.ifIndex == null) continue;
    const ts = Date.parse(evt.ts);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const key = `${evt.host}::${evt.ifIndex}`;
    const bucket = byKey.get(key) || { count: 0, sample: null };
    bucket.count += 1;
    bucket.sample = evt;
    byKey.set(key, bucket);
  }
  for (const [key, { count, sample }] of byKey) {
    if (count < PORT_FLAP_THRESHOLD) continue;
    const [host, ifIndex] = key.split("::");
    out.push(portFlappingDiagnosis(host, ifIndex, sample, count));
  }

  return out;
}
