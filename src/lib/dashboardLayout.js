/** Default dashboard grid layout (12-col react-grid-layout). */
export const DEFAULT_DASHBOARD_LAYOUT = [
  { id: "w1", type: "network_traffic", x: 0, y: 0, w: 8, h: 4 },
  { id: "w2", type: "critical_alarms", x: 8, y: 0, w: 4, h: 3 },
  { id: "w3", type: "wan_internet", x: 8, y: 3, w: 4, h: 3 },
  { id: "w4", type: "network", x: 0, y: 4, w: 4, h: 4 },
  { id: "w5", type: "av", x: 4, y: 4, w: 4, h: 3 },
  { id: "w6", type: "offline_devices", x: 0, y: 7, w: 4, h: 3 },
];
