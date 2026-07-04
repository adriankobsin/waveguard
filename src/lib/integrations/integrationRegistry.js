import { VENDOR_REGISTRY, getVendorInfo } from "@/lib/integrations/vendorRegistry";

const DB_CATEGORY_MAP = {
  router: "networking",
  lighting: "lighting",
  hvac: "hvac",
  protocol: "protocol",
  iot: "iot",
  automation: "automation",
};

const DB_CATEGORY_LABELS = {
  router: "Networking",
  lighting: "Lighting",
  hvac: "HVAC",
  protocol: "Protocols",
  iot: "IoT",
  automation: "Automation",
};

const DB_ICON_MAP = {
  router: "Network",
  lighting: "Lightbulb",
  hvac: "Thermometer",
  protocol: "Cable",
  iot: "Cpu",
  automation: "Zap",
};

export function getCategoryLabel(category) {
  return DB_CATEGORY_LABELS[category] || category;
}

export function getCategoryIcon(category) {
  return DB_ICON_MAP[category] || "Box";
}

export function dbTypeToIntegrationDef(dbType) {
  return {
    key: dbType.id,
    label: dbType.label,
    description: dbType.description,
    category: dbType.category,
    categoryLabel: getCategoryLabel(dbType.category),
    icon: getCategoryIcon(dbType.category),
    phase: dbType.phase,
    defaultPort: dbType.default_port,
    protocols: safeJsonParse(dbType.protocols, []),
    docsUrl: dbType.docs_url,
  };
}

export function integrateVendorDbData(vendorId, dbTypes) {
  const vendorInfo = getVendorInfo(vendorId);
  const dbMatch = dbTypes?.find((t) => t.id === vendorId);
  if (!dbMatch) {
    return {
      ...vendorInfo,
      category: "networking",
      categoryLabel: "Networking",
      icon: "Network",
      dbConfig: null,
    };
  }
  return {
    ...vendorInfo,
    ...dbTypeToIntegrationDef(dbMatch),
    dbConfig: dbMatch,
  };
}

function safeJsonParse(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export const CATEGORY_ORDER = [
  "router",
  "lighting",
  "hvac",
  "iot",
  "protocol",
  "automation",
];

export const PROTOCOL_LABELS = {
  snmp: "SNMP",
  rest: "REST API",
  ssh: "SSH",
  "modbus-tcp": "ModBUS TCP",
  "modbus-rtu": "ModBUS RTU",
  "knx-ip": "KNX IP",
  "knx-tunnelling": "KNX Tunnelling",
  mqtt: "MQTT",
  mqtts: "MQTTS",
  webhook: "Webhook",
  serial: "RS-485 Serial",
  "bacnet-ip": "BACnet/IP",
  http: "HTTP",
  websocket: "WebSocket",
};

export function getProtocolLabel(protocol) {
  return PROTOCOL_LABELS[protocol] || protocol;
}
