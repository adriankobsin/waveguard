import { ciscoRouterAdapter } from "./ciscoRouterAdapter.js";
import { peplinkRouterAdapter } from "./peplinkRouter.js";
import { fortinetRouterAdapter } from "./fortinetRouterAdapter.js";
import { genericRouterAdapter } from "./genericRouterAdapter.js";

export const routerRegistry = {
  peplink: peplinkRouterAdapter,
  cisco: ciscoRouterAdapter,
  fortinet: fortinetRouterAdapter,
  snmp: genericRouterAdapter,
};

export const ROUTER_VENDORS = Object.keys(routerRegistry);

export function getRouterAdapter(vendorId) {
  return routerRegistry[vendorId] || genericRouterAdapter;
}

export function getRouterCapabilities(vendorId) {
  const adapter = getRouterAdapter(vendorId);
  return adapter.getCapabilities();
}

export function getRouterDefaultConfig(vendorId) {
  const adapter = getRouterAdapter(vendorId);
  return adapter.getDefaultConfig();
}

export function getAllRouterAdapters() {
  return Object.values(routerRegistry);
}

export function getAllRouterVendors() {
  return Object.entries(routerRegistry).map(([id, adapter]) => ({
    id,
    label: adapter.label,
    capabilities: adapter.getCapabilities(),
  }));
}

const VENDOR_DETECTION_RULES = [
  { vendor: "peplink", pattern: /peplink|balance\s*2500|balance\s*20|max\s*br|max\s*transit|max\s*mini/i },
  { vendor: "fortinet", pattern: /fortinet|fortigate|fgt/i },
  { vendor: "cisco", pattern: /cisco.*(isr|asr|router|wan|gateway|rv\d|8\d{3})/i },
  { vendor: "cisco", pattern: /catalyst\s*8|csr|ir\s*1/i },
];

export function detectRouterVendor(equipment) {
  if (!equipment) return "snmp";
  const blob = `${equipment.make || ""} ${equipment.vendor || ""} ${equipment.model || ""} ${equipment.name || ""}`;
  for (const rule of VENDOR_DETECTION_RULES) {
    if (rule.pattern.test(blob)) return rule.vendor;
  }
  if (equipment.deviceRole === "wan_router" || equipment.category === "Router") {
    if (/peplink|balance/i.test(blob)) return "peplink";
    if (/cisco|isr|asr/i.test(blob)) return "cisco";
    if (/fortinet|fortigate/i.test(blob)) return "fortinet";
  }
  return "snmp";
}

export function isRouterAdapterAvailable(vendorId) {
  return !!routerRegistry[vendorId];
}

export function checkAllAdapterHealth() {
  return Object.entries(routerRegistry).map(([id, adapter]) => ({
    id,
    label: adapter.label,
    health: adapter.getHealth(),
  }));
}

export { PeplinkRouterAdapter } from "./peplinkRouter.js";
export { CiscoRouterAdapter } from "./ciscoRouterAdapter.js";
export { FortinetRouterAdapter } from "./fortinetRouterAdapter.js";
export { GenericRouterAdapter } from "./genericRouterAdapter.js";
