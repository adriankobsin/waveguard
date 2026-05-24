import { parseNetworkDeviceModel } from "./networkDeviceCatalog.js";

/**
 * Resolve switch chassis layout from Equipment model numbers
 * (e.g. C9300L-24P-4X-E, CBS350-24P, SG350-28).
 */

/** @typedef {'dual-row' | 'single-row' | 'access-uplink' | 'rack-48'} SwitchLayoutId */

/**
 * @typedef {object} SwitchChassisSpec
 * @property {string} model
 * @property {string} series
 * @property {string} vendor
 * @property {number} copperPorts
 * @property {number} uplinkPorts
 * @property {number} portCount
 * @property {boolean} poe
 * @property {SwitchLayoutId} layout
 * @property {string} label
 */

const LAYOUT_LABELS = {
  "dual-row": "Dual-row RJ45",
  "single-row": "Single row",
  "access-uplink": "Access + uplinks",
  "rack-48": "48-port rack",
};

/** Known exact models (highest priority). */
const EXACT_MODELS = {
  "C9300L-24P-4X-E": {
    series: "Catalyst 9300L",
    vendor: "Cisco",
    copperPorts: 24,
    uplinkPorts: 4,
    poe: true,
    layout: "access-uplink",
  },
  "C9300-48P": {
    series: "Catalyst 9300",
    vendor: "Cisco",
    copperPorts: 48,
    uplinkPorts: 0,
    poe: true,
    layout: "rack-48",
  },
  "CBS350-24P": { series: "CBS350", vendor: "Cisco", copperPorts: 24, uplinkPorts: 0, poe: true, layout: "dual-row" },
  "CBS350-24T": { series: "CBS350", vendor: "Cisco", copperPorts: 24, uplinkPorts: 0, poe: false, layout: "dual-row" },
  "CBS350-16T": { series: "CBS350", vendor: "Cisco", copperPorts: 16, uplinkPorts: 0, poe: false, layout: "dual-row" },
  "CBS350-8P": { series: "CBS350", vendor: "Cisco", copperPorts: 8, uplinkPorts: 0, poe: true, layout: "single-row" },
  // Catalyst 1300 family (SMB) — same firmware lineage as CBS350 but adds 10G uplinks.
  "C1300-8P-2G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 8, uplinkPorts: 2, poe: true, layout: "access-uplink" },
  "C1300-8FP-2G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 8, uplinkPorts: 2, poe: true, layout: "access-uplink" },
  "C1300-8T-E-2G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 8, uplinkPorts: 2, poe: false, layout: "access-uplink" },
  "C1300-16P-2G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 16, uplinkPorts: 2, poe: true, layout: "access-uplink" },
  "C1300-16FP-2G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 16, uplinkPorts: 2, poe: true, layout: "access-uplink" },
  "C1300-16T-2G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 16, uplinkPorts: 2, poe: false, layout: "access-uplink" },
  "C1300-24P-4G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 24, uplinkPorts: 4, poe: true, layout: "access-uplink" },
  "C1300-24FP-4G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 24, uplinkPorts: 4, poe: true, layout: "access-uplink" },
  "C1300-24T-4G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 24, uplinkPorts: 4, poe: false, layout: "access-uplink" },
  "C1300-24P-4X": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 24, uplinkPorts: 4, poe: true, layout: "access-uplink" },
  "C1300-24FP-4X": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 24, uplinkPorts: 4, poe: true, layout: "access-uplink" },
  "C1300-24T-4X": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 24, uplinkPorts: 4, poe: false, layout: "access-uplink" },
  "C1300-48P-4G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 48, uplinkPorts: 4, poe: true, layout: "rack-48" },
  "C1300-48FP-4G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 48, uplinkPorts: 4, poe: true, layout: "rack-48" },
  "C1300-48T-4G": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 48, uplinkPorts: 4, poe: false, layout: "rack-48" },
  "C1300-48P-4X": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 48, uplinkPorts: 4, poe: true, layout: "rack-48" },
  "C1300-48FP-4X": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 48, uplinkPorts: 4, poe: true, layout: "rack-48" },
  "C1300-48T-4X": { series: "Catalyst 1300", vendor: "Cisco", copperPorts: 48, uplinkPorts: 4, poe: false, layout: "rack-48" },
  "SG350-28": { series: "SG350", vendor: "Cisco", copperPorts: 28, uplinkPorts: 0, poe: false, layout: "dual-row" },
  "SG350-10": { series: "SG350", vendor: "Cisco", copperPorts: 10, uplinkPorts: 0, poe: false, layout: "single-row" },
  "SG250-18": { series: "SG250", vendor: "Cisco", copperPorts: 18, uplinkPorts: 0, poe: false, layout: "dual-row" },
};

function buildSpec(model, partial) {
  const copper = partial.copperPorts ?? 0;
  const uplink = partial.uplinkPorts ?? 0;
  const portCount = copper + uplink;
  let layout = partial.layout || "dual-row";
  if (portCount <= 12 && layout === "dual-row") layout = "single-row";
  if (copper >= 40) layout = "rack-48";

  return {
    model: model.trim(),
    series: partial.series || "Managed switch",
    vendor: partial.vendor || "Unknown",
    copperPorts: copper,
    uplinkPorts: uplink,
    portCount,
    poe: !!partial.poe,
    layout,
    label: `${partial.series || model} · ${portCount} ports${partial.poe ? " PoE" : ""} (${LAYOUT_LABELS[layout]})`,
  };
}

/**
 * Parse Cisco-style model string into chassis metadata.
 */
export function parseSwitchModel(model) {
  if (!model || !String(model).trim()) return null;

  const network = parseNetworkDeviceModel(model);
  if (network) return network;

  const raw = String(model).trim();
  const key = raw.toUpperCase().replace(/\s+/g, "");
  if (EXACT_MODELS[key]) {
    return buildSpec(raw, EXACT_MODELS[key]);
  }

  const m = key;

  // Catalyst 9300/9200: C9300L-24P-4X-E, C9200L-48P-4X
  let cat = m.match(/^C(9[23]\d{2}[A-Z]?)-(\d+)([PT])?(?:-(\d+)([XGU]))?/);
  if (cat) {
    const copper = Number(cat[2]) || 0;
    const uplink = Number(cat[4]) || 0;
    return buildSpec(raw, {
      series: `Catalyst ${cat[1].replace(/^C/, "")}`,
      vendor: "Cisco",
      copperPorts: copper,
      uplinkPorts: uplink,
      poe: cat[3] === "P",
      layout: uplink > 0 ? "access-uplink" : copper >= 40 ? "rack-48" : "dual-row",
    });
  }

  // CBS350-24P, CBS250-8T
  let cbs = m.match(/^CBS(\d+)-(\d+)([PT])?/);
  if (cbs) {
    const ports = Number(cbs[2]) || 0;
    return buildSpec(raw, {
      series: `CBS${cbs[1]}`,
      vendor: "Cisco",
      copperPorts: ports,
      uplinkPorts: 0,
      poe: cbs[3] === "P",
      layout: ports <= 12 ? "single-row" : "dual-row",
    });
  }

  // Catalyst 1300: C1300-48FP-4G, C1300-24P-4X, C1300-8T-E-2G
  let c1300 = m.match(/^C1300-(\d+)(FP|P|T|FX|X)?(?:-E)?(?:-(\d+)([GX]))?/);
  if (c1300) {
    const copper = Number(c1300[1]) || 0;
    const suffix = (c1300[2] || "").toUpperCase();
    const uplink = Number(c1300[3]) || 0;
    return buildSpec(raw, {
      series: "Catalyst 1300",
      vendor: "Cisco",
      copperPorts: copper,
      uplinkPorts: uplink,
      poe: /P|FP/.test(suffix),
      layout: uplink > 0 ? "access-uplink" : copper >= 40 ? "rack-48" : "dual-row",
    });
  }

  // SG350-28, SG250-18
  let sg = m.match(/^SG(\d+)-(\d+)/);
  if (sg) {
    const ports = Number(sg[2]) || 0;
    return buildSpec(raw, {
      series: `SG${sg[1]}`,
      vendor: "Cisco",
      copperPorts: ports,
      uplinkPorts: 0,
      poe: false,
      layout: ports <= 12 ? "single-row" : "dual-row",
    });
  }

  // Meraki MS225-24P
  let meraki = m.match(/^MS(\d+)-(\d+)([P])?/);
  if (meraki) {
    const ports = Number(meraki[2]) || 0;
    return buildSpec(raw, {
      series: `Meraki MS${meraki[1]}`,
      vendor: "Cisco Meraki",
      copperPorts: ports,
      uplinkPorts: 0,
      poe: meraki[3] === "P",
      layout: ports <= 12 ? "single-row" : "dual-row",
    });
  }

  // Generic trailing port count: something-24P, something-48T
  let generic = m.match(/-(\d{1,3})([PT])(?:-|$)/);
  if (generic) {
    const ports = Number(generic[1]) || 0;
    return buildSpec(raw, {
      series: "Managed switch",
      vendor: "Unknown",
      copperPorts: ports,
      uplinkPorts: 0,
      poe: generic[2] === "P",
      layout: ports <= 12 ? "single-row" : ports >= 40 ? "rack-48" : "dual-row",
    });
  }

  generic = m.match(/-(\d{1,3})(?:-|$)/);
  if (generic) {
    const ports = Number(generic[1]) || 0;
    if (ports >= 4 && ports <= 96) {
      return buildSpec(raw, {
        series: "Managed switch",
        vendor: "Unknown",
        copperPorts: ports,
        uplinkPorts: 0,
        poe: /P/i.test(m),
        layout: ports <= 12 ? "single-row" : ports >= 40 ? "rack-48" : "dual-row",
      });
    }
  }

  return null;
}

/** Resolve chassis from equipment + optional profile override. */
export function resolveSwitchChassis(equipment, profile = null) {
  const model = equipment?.model || profile?.model || "";
  const parsed = parseSwitchModel(model);
  if (parsed) {
    const override = profile?.portCount > 0 ? profile.portCount : null;
    if (override && override !== parsed.portCount) {
      return {
        ...parsed,
        portCount: override,
        copperPorts: Math.min(parsed.copperPorts, override),
        label: `${parsed.label} (override ${override} ports)`,
      };
    }
    return parsed;
  }
  const manual = profile?.portCount > 0 ? profile.portCount : null;
  if (manual) {
    return buildSpec(model || "Custom", {
      series: "Custom",
      vendor: equipment?.make || equipment?.vendor || "Unknown",
      copperPorts: manual,
      uplinkPorts: 0,
      poe: /P/i.test(model),
      layout: manual <= 12 ? "single-row" : manual >= 40 ? "rack-48" : "dual-row",
    });
  }
  return null;
}

/** Placeholder port for empty chassis slot. */
function emptySlot(index, chassis, isUplink) {
  return {
    index,
    name: isUplink ? `Te1/0/${index}` : `Gi1/0/${index}`,
    ifAlias: "",
    status: "unknown",
    speedMbps: isUplink ? 10000 : 1000,
    speed: isUplink ? 10000 : 1000,
    mtu: 1500,
    inMbps: 0,
    outMbps: 0,
    poeWatts: chassis.poe && !isUplink ? 0 : null,
    poeStatus: null,
    vlan: null,
    macAddr: null,
    connectedDevice: null,
    slotEmpty: true,
  };
}

/**
 * Merge polled ports onto fixed chassis slots (by ifIndex 1..portCount).
 */
export function deployPortsOnChassis(polledPorts, chassis) {
  if (!chassis?.portCount) return polledPorts || [];

  const byIndex = new Map((polledPorts || []).map((p) => [Number(p.index), p]));
  const slots = [];

  for (let i = 1; i <= chassis.portCount; i++) {
    const isUplink = chassis.uplinkPorts > 0 && i > chassis.copperPorts;
    const existing = byIndex.get(i);
    if (existing) {
      slots.push({ ...existing, slotEmpty: false, isUplink });
    } else {
      slots.push(emptySlot(i, chassis, isUplink));
    }
  }

  // Append any extra SNMP indices beyond chassis (stack modules, etc.)
  for (const p of polledPorts || []) {
    if (p.index > chassis.portCount && !slots.find((s) => s.index === p.index)) {
      slots.push({ ...p, slotEmpty: false });
    }
  }

  return slots.sort((a, b) => a.index - b.index);
}

/** Port count for polling/mock from equipment model. */
export function portCountFromModel(model, profilePortCount = null) {
  if (profilePortCount > 0) return profilePortCount;
  const spec = parseSwitchModel(model);
  return spec?.portCount || null;
}
