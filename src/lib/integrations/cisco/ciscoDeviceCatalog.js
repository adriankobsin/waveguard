/**
 * Cisco Catalyst 1300 family device catalog.
 *
 * The C1300 line uses the same SMB-OS firmware as the legacy CBS350 line
 * but adds 10G uplinks and a wider PoE budget. Every SKU we ship a chassis
 * spec for here is also recognised by `parseSwitchModel` in
 * `src/lib/snmp/switchModelCatalog.js`, but having a dedicated catalog
 * lets the Cisco Switches page render rich front-panel art without
 * round-tripping through the generic resolver.
 *
 * Default login: `cisco` / `cisco` on first boot. Most C1300 deployments
 * change the password during initial setup wizard — the modal pre-fills
 * `cisco` as the username to match factory defaults.
 */

/** @typedef {{ index: number, name: string, role: 'lan' | 'uplink', isUplink: boolean }} CiscoPortSlot */

/**
 * @typedef {object} CiscoChassisSpec
 * @property {string} model
 * @property {string} series
 * @property {string} vendor
 * @property {number} copperPorts
 * @property {number} uplinkPorts
 * @property {number} portCount
 * @property {boolean} poe
 * @property {number|null} poeBudgetW
 * @property {'access-uplink' | 'rack-48' | 'dual-row' | 'single-row'} layout
 * @property {CiscoPortSlot[]} portSlots
 * @property {string} label
 */

function makePortSlots(copperCount, uplinkCount) {
  const out = [];
  for (let i = 1; i <= copperCount; i++) {
    out.push({ index: i, name: `gi1/0/${i}`, role: "lan", isUplink: false });
  }
  for (let i = 1; i <= uplinkCount; i++) {
    const isTen = uplinkCount === 4;
    out.push({
      index: copperCount + i,
      name: `${isTen ? "te" : "gi"}1/0/${i}`,
      role: "uplink",
      isUplink: true,
    });
  }
  return out;
}

function buildC1300Spec({ model, copperPorts, uplinkPorts, poe, poeBudgetW, label }) {
  const portCount = copperPorts + uplinkPorts;
  return {
    model,
    series: "Catalyst 1300",
    vendor: "Cisco",
    copperPorts,
    uplinkPorts,
    portCount,
    poe: !!poe,
    poeBudgetW: poe ? poeBudgetW : null,
    layout: copperPorts >= 40 ? "rack-48" : copperPorts >= 24 ? "access-uplink" : copperPorts >= 16 ? "dual-row" : "single-row",
    portSlots: makePortSlots(copperPorts, uplinkPorts),
    label:
      label ||
      `Catalyst 1300 · ${portCount} ports${poe ? ` PoE (${poeBudgetW}W)` : ""}`,
  };
}

/** Complete C9200L / IOS-XE SKU table (SSH-only friendly). */
export const C9200L_CATALOG = [
  buildC1300Spec({
    model: "C9200L-48P-4X",
    copperPorts: 48,
    uplinkPorts: 4,
    poe: true,
    poeBudgetW: 740,
    label: "Catalyst 9200L · 48 ports PoE+ + 4×10G uplinks",
  }),
  buildC1300Spec({
    model: "C9200L-24P-4X",
    copperPorts: 24,
    uplinkPorts: 4,
    poe: true,
    poeBudgetW: 370,
  }),
];

/** Complete C1300 SKU table. */
export const C1300_CATALOG = [
  buildC1300Spec({ model: "C1300-8P-2G", copperPorts: 8, uplinkPorts: 2, poe: true, poeBudgetW: 67 }),
  buildC1300Spec({ model: "C1300-8FP-2G", copperPorts: 8, uplinkPorts: 2, poe: true, poeBudgetW: 120 }),
  buildC1300Spec({ model: "C1300-8T-E-2G", copperPorts: 8, uplinkPorts: 2, poe: false, poeBudgetW: 0 }),
  buildC1300Spec({ model: "C1300-16P-2G", copperPorts: 16, uplinkPorts: 2, poe: true, poeBudgetW: 120 }),
  buildC1300Spec({ model: "C1300-16FP-2G", copperPorts: 16, uplinkPorts: 2, poe: true, poeBudgetW: 240 }),
  buildC1300Spec({ model: "C1300-16T-2G", copperPorts: 16, uplinkPorts: 2, poe: false, poeBudgetW: 0 }),
  buildC1300Spec({ model: "C1300-24P-4G", copperPorts: 24, uplinkPorts: 4, poe: true, poeBudgetW: 195 }),
  buildC1300Spec({ model: "C1300-24FP-4G", copperPorts: 24, uplinkPorts: 4, poe: true, poeBudgetW: 370 }),
  buildC1300Spec({ model: "C1300-24T-4G", copperPorts: 24, uplinkPorts: 4, poe: false, poeBudgetW: 0 }),
  buildC1300Spec({ model: "C1300-24P-4X", copperPorts: 24, uplinkPorts: 4, poe: true, poeBudgetW: 195 }),
  buildC1300Spec({ model: "C1300-24FP-4X", copperPorts: 24, uplinkPorts: 4, poe: true, poeBudgetW: 370 }),
  buildC1300Spec({ model: "C1300-24T-4X", copperPorts: 24, uplinkPorts: 4, poe: false, poeBudgetW: 0 }),
  buildC1300Spec({ model: "C1300-48P-4G", copperPorts: 48, uplinkPorts: 4, poe: true, poeBudgetW: 370 }),
  // ★ Reference device for the integration
  buildC1300Spec({
    model: "C1300-48FP-4G",
    copperPorts: 48,
    uplinkPorts: 4,
    poe: true,
    poeBudgetW: 740,
    label: "Catalyst 1300 · 48 ports PoE+ (740W) + 4×10G SFP+",
  }),
  buildC1300Spec({ model: "C1300-48T-4G", copperPorts: 48, uplinkPorts: 4, poe: false, poeBudgetW: 0 }),
  buildC1300Spec({ model: "C1300-48P-4X", copperPorts: 48, uplinkPorts: 4, poe: true, poeBudgetW: 370 }),
  buildC1300Spec({ model: "C1300-48FP-4X", copperPorts: 48, uplinkPorts: 4, poe: true, poeBudgetW: 740 }),
  buildC1300Spec({ model: "C1300-48T-4X", copperPorts: 48, uplinkPorts: 4, poe: false, poeBudgetW: 0 }),
];

/** Index by exact model number (uppercased). */
const BY_MODEL = new Map([
  ...C1300_CATALOG.map((s) => [s.model.toUpperCase(), s]),
  ...C9200L_CATALOG.map((s) => [s.model.toUpperCase(), { ...s, series: "Catalyst 9200L" }]),
]);

/** Resolve a chassis spec from a model string. Returns null if unknown. */
export function matchCiscoDevice(modelOrEquipment) {
  const raw =
    typeof modelOrEquipment === "string"
      ? modelOrEquipment
      : modelOrEquipment?.model || modelOrEquipment?.name || "";
  const key = String(raw).toUpperCase().replace(/\s+/g, "");
  if (!key) return null;
  if (BY_MODEL.has(key)) return BY_MODEL.get(key);
  // Catalyst 9200L / 9300 IOS-XE
  const c9200 = key.match(/^C9200L?-(\d+)([PT])?(?:-(\d+)([XGU]))?/);
  if (c9200) {
    const copper = Number(c9200[1]) || 0;
    const uplink = Number(c9200[3]) || 4;
    return {
      ...buildC1300Spec({
        model: raw,
        copperPorts: copper,
        uplinkPorts: uplink,
        poe: c9200[2] === "P",
        poeBudgetW: c9200[2] === "P" ? copper * 15 : 0,
      }),
      series: "Catalyst 9200L",
    };
  }
  // Family regex fallback — covers SKUs we haven't catalogued individually.
  const m = key.match(/^C1300-(\d+)(FP|P|T|FX|X)?(?:-(\d+)([GX]))?/);
  if (!m) return null;
  const copper = Number(m[1]) || 0;
  const suffix = (m[2] || "").toUpperCase();
  const uplinkN = Number(m[3]) || 0;
  const poe = /P|FP/.test(suffix);
  const poeBudget = poe ? (/^FP$/.test(suffix) ? copper * 15 : copper * 8) : 0;
  return buildC1300Spec({
    model: raw,
    copperPorts: copper,
    uplinkPorts: uplinkN || 4,
    poe,
    poeBudgetW: poeBudget,
  });
}

/** Get the factory default web/SSH login for a C1300 chassis. */
export function getCiscoDefaultLogin(_chassis) {
  return { username: "cisco", password: "cisco" };
}
