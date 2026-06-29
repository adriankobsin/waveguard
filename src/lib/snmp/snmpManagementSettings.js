/** Platform-wide Core Network (SNMP fleet) settings. */

export const DEFAULT_SNMP_GLOBAL = {
  autoPollEnabled: false,
  autoPollIntervalSec: 300,
  defaultPollTimeoutMs: 3000,
  alertOnCableFault: true,
  alertOnPortDownPct: 0,
  trafficHistorySamples: 48,
  defaultPortView: "panel",
  showInactivePorts: true,
  highlightHighTrafficMbps: 100,
};

export function normalizeSnmpGlobalSettings(raw) {
  const base = { ...DEFAULT_SNMP_GLOBAL, ...raw };
  return {
    ...base,
    autoPollIntervalSec: Math.min(3600, Math.max(60, Number(base.autoPollIntervalSec) || 300)),
    defaultPollTimeoutMs: Math.min(10000, Math.max(500, Number(base.defaultPollTimeoutMs) || 3000)),
    trafficHistorySamples: Math.min(96, Math.max(12, Number(base.trafficHistorySamples) || 48)),
    alertOnPortDownPct: Math.min(100, Math.max(0, Number(base.alertOnPortDownPct) || 0)),
    defaultPortView: base.defaultPortView === "table" ? "table" : "panel",
  };
}
