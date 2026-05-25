import { DEFAULT_SNMP_GLOBAL, normalizeSnmpGlobalSettings } from "./snmpManagementSettings.js";
import {
  resolveSwitchChassis,
  deployPortsOnChassis,
  portCountFromModel,
} from "./switchModelCatalog.js";
import {
  parseNetworkDeviceModel,
  deployNetworkPortsOnChassis,
  resolveEquipmentModelString,
} from "./networkDeviceCatalog.js";
import {
  matchPeplinkDevice,
  getPeplinkDefaultLogin,
} from "../integrations/peplink/peplinkDeviceCatalog.js";
import { normalizeBrowserLogin } from "../credentials/credentialsVault.js";
import { getVendorInfo } from "../integrations/vendorRegistry.js";

export { parseSwitchModel, resolveSwitchChassis, portCountFromModel } from "./switchModelCatalog.js";
export { parseNetworkDeviceModel } from "./networkDeviceCatalog.js";

export const SNMP_SWITCHES_SETTINGS_KEY = "snmp-switches";
export const SNMP_SWITCHES_CHANGED_EVENT = "waveguard-snmp-switches-changed";
export const PEPLINK_CREDENTIALS_KEY = "peplink-credentials";

export const DEVICE_ROLES = ["switch", "router", "firewall", "wan_router"];
export const INTEGRATION_VENDORS = ["snmp", "cisco", "peplink", "fortinet", "kerio", "unifi"];
export const POLL_METHODS = ["snmp", "peplink_hybrid", "cisco_ssh"];

export const DEFAULT_CISCO_CONFIG = {
  ciscoSwitchId: "",
  sshPort: 22,
  sshUsername: "cisco",
  enablePassword: "",
};

export const DEFAULT_PEPLINK_CONFIG = {
  mode: "auto",
  incontrolOrgId: "",
  deviceId: "",
  localClientId: "",
  localClientSecret: "",
  localClientSecretConfigured: false,
};

export const DEFAULT_SNMP_SWITCHES = {
  global: { ...DEFAULT_SNMP_GLOBAL },
  profiles: [],
};

function normMac(mac) {
  if (!mac) return "";
  return String(mac)
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .replace(/(.{2})(?=.)/g, "$1:")
    .slice(0, 17);
}

export function profileIdForEquipment(equipmentId) {
  return `snmp-sw-${equipmentId}`;
}

export function normalizeSnmpPort(port) {
  if (!port) return null;
  const status =
    port.status === "up" || port.status === "down" || port.status === "disabled"
      ? port.status
      : port.ifOperStatus === "up"
        ? "up"
        : port.ifOperStatus === "down"
          ? "down"
          : "unknown";
  return {
    index: Number(port.index ?? port.port) || 0,
    name: port.name || port.ifDescr || `Port ${port.index ?? port.port}`,
    ifAlias: port.ifAlias || "",
    status,
    speed: Number(port.speed ?? port.speedMbps ?? port.ifSpeed) || 0,
    speedMbps: Number(port.speedMbps ?? port.speed ?? port.ifSpeed) || 0,
    mtu: port.mtu ?? 1500,
    inMbps: Number(port.inMbps) || 0,
    outMbps: Number(port.outMbps) || 0,
    poeWatts: port.poeWatts != null ? Number(port.poeWatts) : null,
    poeStatus: port.poeStatus || null,
    vlan: port.vlan ?? null,
    macAddr: port.macAddr || null,
    connectedDevice: port.connectedDevice || null,
    connectedEquipmentId: port.connectedEquipmentId || null,
    inOctets: port.inOctets,
    outOctets: port.outOctets,
    portRole: port.portRole || port.meta?.type || null,
    meta: port.meta && typeof port.meta === "object" ? { ...port.meta } : undefined,
    isUplink: port.isUplink ?? ["wan", "cellular", "uplink"].includes(port.portRole || port.meta?.type),
  };
}

export function normalizeLastPoll(raw) {
  if (!raw) return null;
  const ports = (raw.ports || []).map(normalizeSnmpPort).filter(Boolean);
  return {
    sysUptime: raw.sysUptime ?? null,
    sysName: raw.sysName || "",
    polledAt: raw.polledAt || null,
    source: raw.source || null,
    ports,
    trafficHistory: Array.isArray(raw.trafficHistory) ? raw.trafficHistory : [],
    peplinkMeta: raw.peplinkMeta || null,
  };
}

export function normalizePeplinkConfig(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PEPLINK_CONFIG };
  const mode = ["incontrol", "local", "auto"].includes(raw.mode) ? raw.mode : "auto";
  return {
    mode,
    incontrolOrgId: raw.incontrolOrgId || "",
    deviceId: raw.deviceId || "",
    localClientId: raw.localClientId || "",
    localClientSecret: raw.localClientSecret || "",
    localClientSecretConfigured: !!(
      raw.localClientSecretConfigured || raw.localClientSecret
    ),
  };
}

export function normalizeCapabilities(raw, vendor) {
  const defaults = getVendorInfo(vendor)?.capabilities || {
    snmp: true,
    rest: false,
    cellular: false,
    vpn: false,
  };
  if (!raw || typeof raw !== "object") return { ...defaults };
  return {
    snmp: raw.snmp !== false,
    rest: !!raw.rest,
    cellular: !!raw.cellular,
    vpn: !!raw.vpn,
  };
}

export function detectIntegrationVendor(eq) {
  if (!eq) return "snmp";
  const blob = `${eq.make || ""} ${eq.vendor || ""} ${eq.model || ""} ${eq.name || ""}`.toLowerCase();
  if (/peplink|balance\s*2500|max\s*br/i.test(blob)) return "peplink";
  if (/fortinet|fortigate/i.test(blob)) return "fortinet";
  if (/kerio/i.test(blob)) return "kerio";
  if (/unifi|ubiquiti|udm|dream\s*machine/i.test(blob)) return "unifi";
  if (/cisco|meraki|catalyst|cbs\d|sg\d/i.test(blob)) return "cisco";
  return "snmp";
}

export function detectDeviceRole(eq) {
  if (!eq) return "switch";
  if (eq.category === "Router") return "wan_router";
  const blob = `${eq.name || ""} ${eq.model || ""} ${eq.make || ""}`.toLowerCase();
  if (/peplink|balance\s*2500|max\s*br/i.test(blob)) return "wan_router";
  if (/fortigate|firewall|asa|ftd|kerio/i.test(blob)) return "firewall";
  if (/router|gateway|udm|dream\s*machine|mx[-_\s]/i.test(blob)) return "router";
  if (
    /switch|managed\s+switch|\bsw[-_\s./]|cbs|sg[-_]?\d|catalyst/i.test(blob) ||
    (/\bcisco\b/i.test(blob) && /\b(sw|switch|sg|cbs|catalyst)\b/i.test(blob))
  ) {
    return "switch";
  }
  if (eq.category === "Network") {
    if (/access point|\bap[-_\s]|modem|starlink/i.test(blob)) return "switch";
    if (/router|firewall|peplink|balance|fortigate/i.test(blob)) {
      return /firewall|fortigate|kerio/i.test(blob) ? "firewall" : "router";
    }
  }
  return "switch";
}

export function defaultPollMethod(vendor) {
  if (vendor === "peplink") return "peplink_hybrid";
  if (vendor === "cisco") return "cisco_ssh";
  return "snmp";
}

export function normalizeCiscoConfig(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CISCO_CONFIG };
  const sshPort = Number(raw.sshPort);
  return {
    ciscoSwitchId: raw.ciscoSwitchId || "",
    sshPort: Number.isFinite(sshPort) && sshPort > 0 ? Math.floor(sshPort) : 22,
    sshUsername:
      typeof raw.sshUsername === "string" && raw.sshUsername.trim()
        ? raw.sshUsername.trim()
        : DEFAULT_CISCO_CONFIG.sshUsername,
    enablePassword:
      typeof raw.enablePassword === "string" ? raw.enablePassword : "",
  };
}

export function buildDefaultProfileFields(eq, options = {}) {
  const integrationVendor = detectIntegrationVendor(eq);
  const deviceRole = options.forceWanRouter ? "wan_router" : detectDeviceRole(eq);
  const pollMethod = defaultPollMethod(integrationVendor);
  const vendorInfo = getVendorInfo(integrationVendor);
  const pep = matchPeplinkDevice(eq);
  const pepLogin = pep ? getPeplinkDefaultLogin(pep) : null;
  const ip = getEquipmentIp(eq);
  return {
    deviceRole,
    integrationVendor,
    pollMethod,
    peplink: { ...DEFAULT_PEPLINK_CONFIG },
    cisco: { ...DEFAULT_CISCO_CONFIG },
    browserLogin: pepLogin
      ? {
          loginUrl: ip ? `https://${ip}/` : "",
          username: pepLogin.username,
          password: pepLogin.password,
          credentialId: "",
        }
      : { loginUrl: ip ? `https://${ip}/` : "", username: "", password: "", credentialId: "" },
    capabilities: { ...vendorInfo.capabilities },
  };
}

export function normalizeSnmpSwitchProfile(raw) {
  if (!raw?.equipmentId) return null;
  const portCount = raw.portCount == null || raw.portCount === "" ? null : Number(raw.portCount);
  const integrationVendor = INTEGRATION_VENDORS.includes(raw.integrationVendor)
    ? raw.integrationVendor
    : "snmp";
  const deviceRole = DEVICE_ROLES.includes(raw.deviceRole) ? raw.deviceRole : "switch";
  const pollMethod = POLL_METHODS.includes(raw.pollMethod)
    ? raw.pollMethod
    : defaultPollMethod(integrationVendor);

  return {
    id: raw.id || profileIdForEquipment(raw.equipmentId),
    equipmentId: raw.equipmentId,
    enabled: raw.enabled !== false,
    portCount: portCount > 0 ? portCount : null,
    deckId: raw.deckId || "",
    roomId: raw.roomId || "",
    location: raw.location || "",
    snmpCommunity: raw.snmpCommunity || "",
    snmpVersion: raw.snmpVersion === "3" ? "3" : "2c",
    notes: raw.notes || "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    pollIntervalSec: raw.pollIntervalSec > 0 ? Number(raw.pollIntervalSec) : null,
    deviceRole,
    integrationVendor,
    pollMethod,
    peplink: normalizePeplinkConfig(raw.peplink),
    cisco: normalizeCiscoConfig(raw.cisco),
    browserLogin: normalizeBrowserLogin(raw.browserLogin),
    capabilities: normalizeCapabilities(raw.capabilities, integrationVendor),
    lastPollAt: raw.lastPollAt || null,
    lastPollError: raw.lastPollError || null,
    lastPoll: normalizeLastPoll(raw.lastPoll),
    counterSnapshot: raw.counterSnapshot || null,
  };
}

export function normalizeSnmpSwitchesState(raw) {
  const legacyList = Array.isArray(raw) ? raw : null;
  const profiles = (raw?.profiles || legacyList || [])
    .filter(Boolean)
    .map((p) => (p.equipmentId ? normalizeSnmpSwitchProfile(p) : null))
    .filter(Boolean);
  return {
    global: normalizeSnmpGlobalSettings(raw?.global),
    profiles,
  };
}

export function loadSnmpSwitchesLocal() {
  try {
    const raw = localStorage.getItem(SNMP_SWITCHES_SETTINGS_KEY);
    if (!raw) return null;
    return normalizeSnmpSwitchesState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSnmpSwitchesLocal(data) {
  const normalized = normalizeSnmpSwitchesState(data);
  localStorage.setItem(SNMP_SWITCHES_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(SNMP_SWITCHES_CHANGED_EVENT, { detail: normalized }));
  return normalized;
}

/** Resolve IP from Equipment row (supports legacy import field names). */
export function getEquipmentIp(eq) {
  const ip = eq?.ip ?? eq?.ip_address ?? eq?.ipAddress ?? "";
  return String(ip).trim();
}

/** Equipment that looks like a manageable switch (legacy). */
export function isLikelySwitch(eq) {
  return isLikelyManagedNetworkDevice(eq) && detectDeviceRole(eq) === "switch";
}

/** Switches, WAN routers, firewalls, and core network appliances. */
export function isLikelyManagedNetworkDevice(eq) {
  if (!eq) return false;
  const blob = `${eq.name || ""} ${eq.model || ""} ${eq.make || ""} ${eq.vendor || ""}`.toLowerCase();

  if (
    /peplink|balance\s*2500|max\s*br|fortigate|fortinet|kerio|udm|dream\s*machine/i.test(blob)
  ) {
    return true;
  }

  if (
    /switch|managed\s+switch|\bsw[-_\s./]|cbs|sg[-_]?\d|catalyst|meraki\s*ms|nexus|\b2960|\b3850/i.test(blob) ||
    (/\bcisco\b/i.test(blob) && /\b(sw|switch|sg|cbs|catalyst)\b/i.test(blob))
  ) {
    return true;
  }

  if (/router|firewall|gateway|wan\s*router/i.test(blob)) {
    return true;
  }

  if (eq.category === "Network") {
    if (/access point|\bap[-_\s]|starlink|modem|u6\s*pro|unifi\s*ap/i.test(blob)) {
      return false;
    }
    return true;
  }

  return false;
}

/** Resolve chassis from switch catalog or network device catalog. */
export function resolveDeviceChassis(equipment, profile = null) {
  const network = equipment
    ? parseNetworkDeviceModel(equipment)
    : parseNetworkDeviceModel(profile?.model || "");
  if (network) {
    const override = profile?.portCount > 0 ? profile.portCount : null;
    if (override && override !== network.portCount) {
      return { ...network, portCount: override, label: `${network.label} (override ${override} ports)` };
    }
    return network;
  }
  return resolveSwitchChassis(equipment, profile);
}

export function deployPortsOnDevice(polledPorts, chassis) {
  if (chassis?.portSlots?.length) {
    return deployNetworkPortsOnChassis(polledPorts, chassis);
  }
  return deployPortsOnChassis(polledPorts, chassis);
}

export function mapPollToUiPorts(pollPorts, portCountOverride) {
  const ports = (pollPorts || []).map((p) => {
    const n = normalizeSnmpPort(p);
    return {
      ...n,
      speed: n.speedMbps || n.speed,
    };
  });
  if (portCountOverride && ports.length > portCountOverride) {
    return ports.slice(0, portCountOverride);
  }
  return ports;
}

export function buildConnectionMap(switches) {
  const connectionMap = [];
  for (const sw of switches || []) {
    for (const port of sw.ports || []) {
      if (port.connectedDevice || port.macAddr) {
        connectionMap.push({
          switchName: sw.name,
          switchIp: sw.ip,
          port: port.index,
          portAlias: port.ifAlias,
          connectedDevice: port.connectedDevice,
          macAddr: port.macAddr,
          status: port.status === "up" ? "up" : "down",
          speed: port.speedMbps || port.speed,
          vlan: port.vlan,
          poeWatts: port.poeWatts,
        });
      }
    }
  }
  return connectionMap;
}

/** Append aggregate traffic sample for charts (max 24 points). */
export function appendTrafficHistory(lastPoll, inMbps, outMbps, maxSamples = 24) {
  const hist = [...(lastPoll?.trafficHistory || [])];
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  hist.push({
    time,
    inMbps: Math.round(inMbps * 10) / 10,
    outMbps: Math.round(outMbps * 10) / 10,
  });
  while (hist.length > maxSamples) hist.shift();
  return hist;
}

export function mergePollIntoProfile(profile, pollResult, options = {}) {
  const equipment = options.equipment;
  const chassis = resolveDeviceChassis(equipment, profile);
  const effectiveCount =
    portCountFromModel(equipment?.model, profile.portCount) ||
    chassis?.portCount ||
    profile.portCount;
  const rawPorts = mapPollToUiPorts(pollResult.ports, effectiveCount);
  const ports = chassis ? deployPortsOnDevice(rawPorts, chassis) : rawPorts;
  const totalIn = ports.filter((p) => !p.slotEmpty).reduce((s, p) => s + (p.inMbps || 0), 0);
  const totalOut = ports.filter((p) => !p.slotEmpty).reduce((s, p) => s + (p.outMbps || 0), 0);
  const maxSamples = options.trafficHistorySamples ?? 24;
  const lastPoll = {
    sysUptime: pollResult.sysUptime ?? profile.lastPoll?.sysUptime,
    sysName: pollResult.sysName || pollResult.name,
    polledAt: pollResult.polledAt,
    source: pollResult.source,
    ports,
    trafficHistory: appendTrafficHistory(profile.lastPoll, totalIn, totalOut, maxSamples),
    peplinkMeta: pollResult.peplinkMeta || profile.lastPoll?.peplinkMeta || null,
  };
  return {
    ...profile,
    lastPollAt: pollResult.polledAt,
    lastPollError: pollResult.error || null,
    lastPoll,
    counterSnapshot: pollResult.counterSnapshot || profile.counterSnapshot,
  };
}

/**
 * Build a new Core Network fleet profile from an Equipment row, ready to be persisted.
 * Used when assigning a WAN router from the WAN Management panel.
 */
export function buildFleetProfileForEquipment(eq, { forceWanRouter = false } = {}) {
  const defaults = buildDefaultProfileFields(eq, { forceWanRouter });
  return {
    id: profileIdForEquipment(eq.id),
    equipmentId: eq.id,
    enabled: true,
    portCount: portCountFromModel(eq.model) || null,
    pollIntervalSec: null,
    deckId: eq.deckId || "",
    roomId: eq.roomId || "",
    location: eq.location || "",
    snmpCommunity: "",
    snmpVersion: "2c",
    notes: "",
    tags: forceWanRouter ? ["wan"] : [],
    lastPollAt: null,
    lastPollError: null,
    lastPoll: null,
    ...defaults,
  };
}

export { normMac };
