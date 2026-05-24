/** Default dashboard grid layout (12-col react-grid-layout). */
export const DEFAULT_DASHBOARD_LAYOUT = [
  { id: "w1", type: "stats_grid",    x: 0, y: 0, w: 12, h: 2 },
  { id: "w2", type: "traffic_chart", x: 0, y: 2, w: 7,  h: 3 },
  { id: "w3", type: "wan_latency",   x: 7, y: 2, w: 5,  h: 3 },
  { id: "w4", type: "alarms",        x: 0, y: 5, w: 4,  h: 3 },
  { id: "w5", type: "categories",    x: 4, y: 5, w: 4,  h: 3 },
  { id: "w6", type: "wan_status",    x: 8, y: 5, w: 4,  h: 3 },
];