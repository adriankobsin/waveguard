export const MOCK_SWITCH_PORT_DATA = {};

export function buildMockPollResult(ip, name, portCount = null) {
  return {
    success: false,
    ip,
    name: name || ip,
    sysName: name || ip,
    ports: [],
    polledAt: new Date().toISOString(),
    source: "mock-empty",
    error: "No mock data available — live SNMP only",
  };
}
