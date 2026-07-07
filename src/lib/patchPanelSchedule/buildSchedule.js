import { inferRackNameFromPanel } from "@/lib/spreadsheet/normalize.js";

export const TEST_RESULTS = ["pass", "fail", "pending", "not_tested"];

const FROM_EQUIPMENT_RE = /^(.+?)\s+P(\d+)$/i;

export function backfillPatchPanelFields(cable) {
  const c = { ...cable };
  if (!c.patch_panel && c.from_equipment) {
    const m = c.from_equipment.match(FROM_EQUIPMENT_RE);
    if (m) {
      c.patch_panel = m[1].trim();
      c.port = m[2];
    }
  }
  if (!c.schedule_source && c.importSource?.sheet === "Patch Panels") {
    c.schedule_source = "vessel_import";
  }
  if (!c.test_result) c.test_result = "not_tested";
  return c;
}

export function isPatchPanelCable(cable) {
  const c = backfillPatchPanelFields(cable);
  return Boolean(c.patch_panel && c.port);
}

function panelKey(name) {
  return String(name || "").trim().toLowerCase();
}

function portNum(value) {
  const n = parseInt(String(value || ""), 10);
  return Number.isNaN(n) ? null : n;
}

function cablePortKey(panel, port) {
  return `${panelKey(panel)}::${portNum(port)}`;
}

export function buildSchedule({ cables = [], panels = [], rackLayout = null } = {}) {
  const normalizedCables = cables.map(backfillPatchPanelFields).filter(isPatchPanelCable);
  const cablesByPort = new Map();
  for (const c of normalizedCables) {
    cablesByPort.set(cablePortKey(c.patch_panel, c.port), c);
  }

  const panelMap = new Map();
  for (const p of panels) {
    if (p.equipment_subtype !== "patch_panel" && !/patch/i.test(p.model || "") && !/pp\d/i.test(p.name || "")) {
      continue;
    }
    const name = p.name || "";
    if (!name) continue;
    panelMap.set(panelKey(name), {
      id: p.id,
      name,
      rack_name: p.rack_name || inferRackNameFromPanel(name),
      rack_u: p.rack_u ?? null,
      port_count: p.port_count || 24,
      deck: p.floor ? p.floor : "",
      location: p.location || "",
      model: p.model || "",
      system_category: p.systemCategory || p.system_category || "",
      notes: p.notes || "",
    });
  }

  for (const c of normalizedCables) {
    const key = panelKey(c.patch_panel);
    if (!panelMap.has(key)) {
      panelMap.set(key, {
        id: null,
        name: c.patch_panel,
        rack_name: inferRackNameFromPanel(c.patch_panel),
        rack_u: null,
        port_count: 24,
        deck: c.deck || "",
        location: c.location || "",
        model: c.type || "",
        system_category: c.system_category || "",
        notes: "",
      });
    }
    const panel = panelMap.get(key);
    const p = portNum(c.port);
    if (p != null && p > panel.port_count) panel.port_count = p;
  }

  if (rackLayout?.placements && rackLayout?.racks?.length) {
    const rackById = new Map(rackLayout.racks.map((r) => [r.id, r]));
    for (const panel of panelMap.values()) {
      for (const placement of Object.values(rackLayout.placements)) {
        const label = placement.label || "";
        const pn = panel.name.toLowerCase();
        const pl = label.toLowerCase();
        if (!pl || !(pn.includes(pl) || pl.includes(pn))) continue;
        const rack = rackById.get(placement.rackId);
        if (rack) {
          panel.rack_name = rack.name;
          panel.rack_u = placement.u;
        }
        break;
      }
    }
  }

  const rackMap = new Map();
  for (const panel of panelMap.values()) {
    const rackName = panel.rack_name || "Unassigned";
    if (!rackMap.has(rackName)) {
      rackMap.set(rackName, { name: rackName, panels: [] });
    }
    const ports = [];
    for (let i = 1; i <= panel.port_count; i++) {
      const cable = cablesByPort.get(cablePortKey(panel.name, i));
      if (cable) {
        ports.push({
          port: i,
          cableId: cable.id,
          label: cable.label || "",
          type: cable.type || "",
          system_category: cable.system_category || "",
          to_equipment: cable.to_equipment || "",
          end_device_port: cable.end_device_port || "",
          length: cable.length || "",
          test_result: cable.test_result || "not_tested",
          last_tested_at: cable.last_tested_at || "",
          notes: cable.notes || "",
          status: cable.status || "installed",
          deck: cable.deck || panel.deck || "",
          room: cable.room || "",
          location: cable.location || panel.location || "",
          schedule_source: cable.schedule_source || "vessel_import",
          isSpare: false,
          patch_panel: panel.name,
        });
      } else {
        ports.push({
          port: i,
          cableId: null,
          label: "",
          type: "",
          system_category: panel.system_category || "",
          to_equipment: "",
          end_device_port: "",
          length: "",
          test_result: "not_tested",
          last_tested_at: "",
          notes: "",
          status: "spare",
          deck: panel.deck || "",
          room: "",
          location: panel.location || "",
          schedule_source: "manual",
          isSpare: true,
          patch_panel: panel.name,
        });
      }
    }
    rackMap.get(rackName).panels.push({ ...panel, ports });
  }

  const racks = [...rackMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((rack) => ({
      ...rack,
      panels: rack.panels.sort((a, b) => {
        const ua = a.rack_u ?? 999;
        const ub = b.rack_u ?? 999;
        if (ua !== ub) return ua - ub;
        return a.name.localeCompare(b.name);
      }),
    }));

  return { racks, totalPanels: panelMap.size, totalPorts: [...panelMap.values()].reduce((n, p) => n + p.port_count, 0) };
}

export function filterSchedule(schedule, filters = {}) {
  const {
    search = "",
    rack = "All",
    panel = "All",
    deck = "All",
    system = "All",
    testResult = "All",
    status = "All",
  } = filters;
  const q = search.trim().toLowerCase();

  const racks = schedule.racks
    .filter((r) => rack === "All" || r.name === rack)
    .map((r) => ({
      ...r,
      panels: r.panels
        .filter((p) => panel === "All" || p.name === panel)
        .map((p) => ({
          ...p,
          ports: p.ports.filter((port) => {
            if (deck !== "All" && port.deck !== deck) return false;
            if (system !== "All" && port.system_category !== system) return false;
            if (testResult !== "All" && port.test_result !== testResult) return false;
            if (status !== "All" && port.status !== status) return false;
            if (!q) return true;
            const hay = [
              port.label,
              port.to_equipment,
              port.end_device_port,
              port.notes,
              port.type,
              port.patch_panel,
              port.deck,
              port.room,
              port.location,
              port.system_category,
              String(port.port),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          }),
        }))
        .filter((p) => p.ports.length > 0 || (!q && deck === "All" && system === "All" && testResult === "All" && status === "All")),
    }))
    .filter((r) => r.panels.length > 0);

  return { ...schedule, racks };
}

export function collectFilterOptions(schedule) {
  const racks = new Set();
  const panels = new Set();
  const decks = new Set();
  const systems = new Set();
  for (const r of schedule.racks || []) {
    racks.add(r.name);
    for (const p of r.panels || []) {
      panels.add(p.name);
      if (p.deck) decks.add(p.deck);
      if (p.system_category) systems.add(p.system_category);
      for (const port of p.ports || []) {
        if (port.deck) decks.add(port.deck);
        if (port.system_category) systems.add(port.system_category);
      }
    }
  }
  return {
    racks: ["All", ...[...racks].sort()],
    panels: ["All", ...[...panels].sort()],
    decks: ["All", ...[...decks].sort()],
    systems: ["All", ...[...systems].sort()],
    testResults: ["All", ...TEST_RESULTS],
    statuses: ["All", "installed", "spare", "planned", "removed"],
  };
}
