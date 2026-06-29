/**
 * Lighting-specific diagnoses for the Diagnoses page.
 *
 * Three diagnosis kinds:
 *
 *   1. `lighting-processor-offline`
 *      Severity: critical. Fires only when the operator has saved a
 *      live Lutron connection (`connection.enabled && connection.host`)
 *      AND the most recent `testLutronProcessor()` call came back with
 *      `success === false`. Resolves automatically when the next probe
 *      succeeds.
 *
 *   2. `lighting-zone-rejected-<href>`
 *      Severity: warning. Fires after the first failure on a zone in
 *      the last 5 minutes. One per zone, deduped.
 *
 *   3. `lighting-zone-unreachable-<href>`
 *      Severity: critical. Fires after 3+ consecutive failures on the
 *      same zone within the last 5 minutes. Replaces the warning above
 *      so the operator doesn't see both at once for the same zone.
 *
 * Each diagnosis matches the shape consumed by `DiagnosesPage.jsx` and
 * the sidebar badge counter in `AppLayout.jsx` (see existing diagnoses
 * in `generateDiagnoses.js` for reference).
 */

const ZONE_FAILURE_WINDOW_MS = 5 * 60 * 1000;
const ZONE_UNREACHABLE_THRESHOLD = 3;

function summariseHref(href) {
  if (!href) return "zone";
  // The href is typically /zone/<id>; show the trailing id as a short
  // label and use the full path elsewhere.
  return String(href).replace(/^\/+/, "").replace(/\/+/g, " · ");
}

function processorOfflineDiagnosis(connection, probe) {
  const host = connection?.host || "unknown host";
  const port = connection?.port || (connection?.protocol === "leap" ? 8081 : 23);
  const message =
    probe?.message ||
    probe?.error ||
    "The Lutron processor stopped responding to integration commands.";
  return {
    id: "lighting-processor-offline",
    source: "lighting",
    equipmentId: null,
    equipmentName: `Lutron ${(connection?.protocol || "leap").toUpperCase()} processor`,
    equipmentIp: host,
    severity: "critical",
    summary: `Lutron processor unreachable at ${host}:${port}`,
    likelyCause: message,
    steps: [
      "Ping the processor from the WaveGuard host",
      "Verify the integration credentials in Settings → Lighting",
      "Confirm 3rd-party integration is enabled in Lutron Designer",
      "Power-cycle the processor if it remains unreachable for > 10 min",
    ],
    suggestedAction: "test_lighting_processor",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: probe?.checkedAt || new Date().toISOString(),
  };
}

function zoneRejectedDiagnosis(zoneHref, sample) {
  return {
    id: `lighting-zone-rejected-${zoneHref}`,
    source: "lighting",
    equipmentId: null,
    equipmentName: sample?.zoneName || summariseHref(zoneHref),
    equipmentIp: null,
    severity: "warning",
    summary: `Lutron rejected a command for ${sample?.zoneName || summariseHref(zoneHref)}`,
    likelyCause:
      sample?.message ||
      "The processor rejected the most recent zone command. The zone may be misconfigured, on a different control type than expected, or temporarily offline.",
    steps: [
      `Open Lights and Shades and try the zone again`,
      "If the failure persists, inspect the integration report entry for this zone",
      "Confirm the zone's ControlType matches its physical fixture (dimmer vs shade vs switched)",
    ],
    suggestedAction: "inspect_zone",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: sample?.ts || new Date().toISOString(),
  };
}

function zoneUnreachableDiagnosis(zoneHref, sample, failures) {
  return {
    id: `lighting-zone-unreachable-${zoneHref}`,
    source: "lighting",
    equipmentId: null,
    equipmentName: sample?.zoneName || summariseHref(zoneHref),
    equipmentIp: null,
    severity: "critical",
    summary: `${sample?.zoneName || summariseHref(zoneHref)} is not responding`,
    likelyCause:
      `${failures} consecutive failures within ${Math.round(
        ZONE_FAILURE_WINDOW_MS / 60000
      )} min. The fixture may be unplugged, the keypad lost power, or the LEAP processor's zone table is out of sync.`,
    steps: [
      "Power-cycle the fixture",
      "Check the keypad / dimmer module on the processor's dashboard",
      "Re-pair the processor if the issue persists across multiple zones",
      "Re-import the Integration Report to refresh zone metadata",
    ],
    suggestedAction: "inspect_zone",
    requiresApproval: false,
    resolvedAt: null,
    relatedDocuments: [],
    createdAt: sample?.ts || new Date().toISOString(),
  };
}

/**
 * Build diagnosis objects from the current lighting state. Caller is
 * responsible for merging the result into the existing diagnoses array.
 *
 * Inputs:
 *   - `events`     : array of events from `loadLightingEvents()`.
 *   - `connection` : output of `loadLutronConnection()` (or null).
 *   - `probe`      : output of `testLutronProcessor()` (or null). When
 *                    null, no processor diagnosis is emitted (we assume
 *                    nothing has tested the connection yet).
 */
export function generateLightingDiagnoses({
  events = [],
  connection = null,
  probe = null,
} = {}) {
  const out = [];

  const liveEnabled = !!(connection?.enabled && connection?.host);
  if (liveEnabled && probe && probe.success === false) {
    out.push(processorOfflineDiagnosis(connection, probe));
  }

  // Group events per-zone within the failure window, ignoring the
  // success entries that follow them (a successful command resets the
  // count, mirroring how the operator would expect this to behave).
  const cutoff = Date.now() - ZONE_FAILURE_WINDOW_MS;
  const byZone = new Map();
  for (const evt of events) {
    if (!evt?.zoneHref) continue;
    const ts = Date.parse(evt.ts);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const bucket =
      byZone.get(evt.zoneHref) ||
      { failures: 0, sample: null, lastWasSuccess: false };
    if (evt.result === "success") {
      // Reset the consecutive-failure counter — a single working
      // command is enough to clear the warning.
      bucket.failures = 0;
      bucket.lastWasSuccess = true;
    } else if (
      evt.result === "failed" ||
      evt.severity === "warning" ||
      evt.severity === "critical"
    ) {
      bucket.failures += 1;
      bucket.sample = evt;
      bucket.lastWasSuccess = false;
    }
    byZone.set(evt.zoneHref, bucket);
  }

  for (const [zoneHref, { failures, sample, lastWasSuccess }] of byZone) {
    if (!sample || lastWasSuccess) continue;
    if (failures >= ZONE_UNREACHABLE_THRESHOLD) {
      out.push(zoneUnreachableDiagnosis(zoneHref, sample, failures));
    } else if (failures >= 1) {
      out.push(zoneRejectedDiagnosis(zoneHref, sample));
    }
  }

  return out;
}
