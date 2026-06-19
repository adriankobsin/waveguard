/** Default dashboard grid layout (12-col react-grid-layout). */

export const DEFAULT_DASHBOARD_LAYOUT = [

  { id: "w1", type: "stats_grid",    x: 0, y: 0, w: 12, h: 2 },

  { id: "w2", type: "traffic_chart", x: 0, y: 2, w: 7,  h: 3 },

  { id: "w3", type: "wan_latency",   x: 7, y: 2, w: 5,  h: 3 },

  { id: "w4", type: "alarms",        x: 0, y: 5, w: 4,  h: 3 },

  { id: "w5", type: "categories",    x: 4, y: 5, w: 4,  h: 3 },

  { id: "w6", type: "wan_status",    x: 8, y: 5, w: 4,  h: 3 },

  { id: "w7", type: "lutron_lights", x: 0, y: 8, w: 4,  h: 3 },

  { id: "w8", type: "cisco_switches", x: 4, y: 8, w: 4, h: 3 },

  { id: "w9", type: "system_location", x: 8, y: 8, w: 4, h: 4 },

  { id: "w10", type: "live_weather", x: 0, y: 11, w: 4, h: 3 },

];



const AUTO_WIDGET_TYPES = ["system_location", "live_weather"];



function appendWidget(layout, type, placement) {

  if (layout.some((w) => w.type === type)) return layout;

  const maxY = layout.reduce((max, w) => Math.max(max, (w.y || 0) + (w.h || 1)), 0);

  return [

    ...layout,

    {

      id: `w-${type}-${Date.now()}`,

      type,

      x: placement?.x ?? 0,

      y: placement?.y ?? maxY,

      w: placement?.w ?? 4,

      h: placement?.h ?? 3,

    },

  ];

}



/** Ensure saved layouts include standard geo / weather widgets. */

export function ensureLocationWidget(layout) {

  if (!Array.isArray(layout)) return DEFAULT_DASHBOARD_LAYOUT;

  let next = layout;

  for (const type of AUTO_WIDGET_TYPES) {

    const def = DEFAULT_DASHBOARD_LAYOUT.find((w) => w.type === type);

    next = appendWidget(next, type, def ? { x: def.x, y: def.y, w: def.w, h: def.h } : undefined);

  }

  return next;

}

