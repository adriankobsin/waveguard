/**
 * Frontend router integration library — consolidated router vendor info and utilities.
 *
 * Provides:
 *   - getRouterVendors()         → list of { id, label, capabilities }
 *   - getRouterAdapter(vendorId) → adapter with getCapabilities(), getDefaultConfig()
 *   - detectRouterVendor(eq)     → heuristic vendor detection
 *   - matchRouterDevice(eq)      → catalog lookup
 *   - routerCatalogToChassisSpec → port layout resolver
 */

import { getVendorInfo } from "../vendorRegistry.js";
import {
  matchRouterDevice,
  routerCatalogToChassisSpec,
  getRouterDefaultLogin,
  ROUTER_VENDOR_LABELS,
} from "./routerDeviceCatalog.js";

export {
  matchRouterDevice,
  routerCatalogToChassisSpec,
  getRouterDefaultLogin,
  ROUTER_VENDOR_LABELS,
  ROUTER_DEVICES,
} from "./routerDeviceCatalog.js";

const ROUTER_VENDOR_DETECTION_RULES = [
  { vendor: "peplink", pattern: /peplink|balance\s*2500|max\s*br/i },
  { vendor: "fortinet", pattern: /fortinet|fortigate/i },
  { vendor: "cisco", pattern: /cisco.*(isr|asr|csr|router|wan)/i },
  { vendor: "cisco", pattern: /catalyst\s*8|ir\s*1/i },
  { vendor: "unifi", pattern: /unifi.*(udm|dream|gateway|ck)/i },
];

export function detectRouterVendor(equipment) {
  if (!equipment) return "snmp";
  const blob = `${equipment.make || ""} ${equipment.vendor || ""} ${equipment.model || ""} ${equipment.name || ""}`;
  for (const rule of ROUTER_VENDOR_DETECTION_RULES) {
    if (rule.pattern.test(blob)) return rule.vendor;
  }
  return "snmp";
}

export function getRouterVendors() {
  const supported = ["peplink", "cisco", "fortinet", "snmp"];
  return supported.map((id) => ({
    id,
    label: ROUTER_VENDOR_LABELS[id] || getVendorInfo(id)?.label || id,
    capabilities: getVendorInfo(id)?.capabilities || {},
    details: getVendorInfo(id),
  }));
}

export function getRouterAdapter(vendorId) {
  const info = getVendorInfo(vendorId);
  return {
    vendorId,
    label: ROUTER_VENDOR_LABELS[vendorId] || info?.label || vendorId,
    capabilities: info?.capabilities || { snmp: true, rest: false, cellular: false, vpn: false },
    pollMethods: info?.pollMethods || ["snmp"],
    defaultConfig: getDefaultRouterConfig(vendorId),
  };
}

export function getDefaultRouterConfig(vendorId) {
  switch (vendorId) {
    case "peplink":
      return {
        mode: "auto",
        incontrolOrgId: "",
        deviceId: "",
        localClientId: "",
        localClientSecret: "",
      };
    case "cisco":
      return { sshPort: 22, sshUsername: "cisco", enablePassword: "" };
    case "fortinet":
      return { sshPort: 22, sshUsername: "admin", apiToken: "", apiPort: 443 };
    default:
      return {};
  }
}

export function isRouter(equipment) {
  if (!equipment) return false;
  if (equipment.deviceRole === "wan_router" || equipment.deviceRole === "router") return true;
  const blob = `${equipment.name || ""} ${equipment.model || ""} ${equipment.make || ""} ${equipment.vendor || ""}`.toLowerCase();
  if (/router|firewall|gateway|wan\s*router|peplink|balance|fortigate|udm|dream\s*machine/i.test(blob)) {
    return true;
  }
  return false;
}

export function getRouterPollMethods(vendorId) {
  const info = getVendorInfo(vendorId);
  return info?.pollMethods || ["snmp"];
}
