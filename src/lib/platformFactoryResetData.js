import { DEFAULT_SITE_LOCATIONS } from "./siteLocations.js";
import { DEFAULT_DISCOVERY_SETTINGS } from "./discoverySettings.js";
import { SNMP_SWITCHES_SETTINGS_KEY } from "./snmp/snmpSwitchProfiles.js";
import { DEFAULT_SNMP_GLOBAL } from "./snmp/snmpManagementSettings.js";
import { DEFAULT_DASHBOARD_LAYOUT } from "./dashboardLayout.js";
import { DEFAULT_RACK_LAYOUT } from "./defaultRackLayout.js";

export const PLATFORM_RESET_CONFIRM = "RESET";

export const FACTORY_GENERAL = {
  name: "M/Y Horizon",
  displayName: "Horizon",
  homePort: "Palma de Mallorca",
  timezone: "Europe/London",
  notes: "",
  appTitle: "Wave Guard",
  appSubtitle: "",
  logoUrl: null,
};

function factoryIntegrations() {
  const keys = ["snmp", "crestron", "qsys", "dahua", "mqtt", "lutron", "dali", "dmx", "knx", "cisco"];
  const cfg = {};
  keys.forEach((key) => {
    cfg[key] = {
      enabled: key === "snmp",
      host: "",
      port: key === "qsys" ? "1710" : key === "knx" ? "3671" : "",
    };
  });
  return cfg;
}

export function buildFactoryRackLayout() {
  return {
    ...DEFAULT_RACK_LAYOUT,
    placements: [],
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  };
}

export function buildFactorySystemSettings() {
  const now = Date.now();
  return [
    { id: "setting-snmp", key: "snmp_community", value: "public", category: "snmp" },
    { id: "setting-scan", key: "scan_interval_minutes", value: "60", category: "discovery" },
    {
      id: "setting-discovery",
      key: "discovery",
      category: "discovery",
      value: { ...DEFAULT_DISCOVERY_SETTINGS },
    },
    {
      id: "setting-snmp-switches",
      key: SNMP_SWITCHES_SETTINGS_KEY,
      category: "snmp",
      value: { global: { ...DEFAULT_SNMP_GLOBAL }, profiles: [] },
    },
    {
      id: "setting-site-locations",
      key: "site-locations",
      category: "site",
      value: { ...DEFAULT_SITE_LOCATIONS },
    },
    { id: "setting-general", key: "general", category: "general", value: { ...FACTORY_GENERAL } },
    {
      id: "setting-dashboard",
      key: "dashboard-layout",
      category: "dashboard",
      value: { layout: [...DEFAULT_DASHBOARD_LAYOUT] },
    },
    { id: `setting-integrations-${now}`, key: "integrations", category: "integrations", value: factoryIntegrations() },
    {
      id: `setting-ai-${now}`,
      key: "ai",
      category: "ai",
      value: { connected: false, key: "", keyHint: "", model: "gpt-4o-mini" },
    },
    {
      id: `setting-docs-${now}`,
      key: "documentation",
      category: "documentation",
      value: {
        storageType: "local",
        uploadPath: "/var/waveguard/documents/upload",
        aiIndexPath: "/var/waveguard/documents/index",
        nasMountPath: "",
        cloudEndpoint: "",
        cloudBucket: "",
        cloudAccessKey: "",
        cloudSecretKey: "",
      },
    },
    {
      id: `setting-notifications-${now}`,
      key: "notifications",
      category: "notifications",
      value: {
        bellRetentionDays: 30,
        emailAlerts: false,
        whatsappAlerts: false,
      },
    },
    {
      id: `setting-email-${now}`,
      key: "email",
      category: "email",
      value: {
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPassword: "",
        fromAddress: "",
        recipients: [],
        alertOnOffline: true,
        alertOnWarning: true,
      },
    },
    {
      id: `setting-retention-${now}`,
      key: "retention",
      category: "retention",
      value: {
        deviceHistory: 90,
        events: 90,
        notifications: 30,
        wanSpeed: 90,
        metrics: 90,
      },
    },
  ];
}

export function buildFactoryUsers() {
  return [
    {
      id: "user-admin",
      username: "WaveAdmin",
      email: "waveadmin@local",
      name: "Wave Admin",
      full_name: "Wave Admin",
      role: "admin",
      password: "Wave-avi23!",
      created_date: new Date().toISOString(),
    },
    {
      id: "user-2",
      username: "tech",
      email: "tech@waveguard.test",
      name: "Tech User",
      full_name: "Tech User",
      role: "user",
      password: "password123",
      created_date: new Date().toISOString(),
    },
  ];
}

export function buildFactoryOperationalState() {
  return {
    equipment: [],
    cables: [],
    maintenanceTasks: [],
    automationRules: [],
    actionLogs: [],
    deviceGroups: [],
    signalLinks: [],
    rackLayouts: [buildFactoryRackLayout()],
    layoutTopology: [],
    backups: [],
  };
}

export function applyFactoryResetToDb(db) {
  const sessions = { ...db.sessions };
  Object.assign(db, buildFactoryOperationalState());
  db.users = buildFactoryUsers();
  db.systemSettings = buildFactorySystemSettings();
  db.sessions = sessions;
}
