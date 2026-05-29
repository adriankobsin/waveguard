export {
  PLATFORM_RESET_CONFIRM,
  FACTORY_GENERAL,
  buildFactoryRackLayout,
  applyFactoryResetToDb,
} from "./platformFactoryResetData.js";

import { DEFAULT_SITE_LOCATIONS, SITE_LOCATIONS_CHANGED_EVENT, saveSiteLocationsLocal } from "@/lib/siteLocations";
import { DEFAULT_DISCOVERY_SETTINGS, DISCOVERY_CHANGED_EVENT, saveDiscoverySettingsLocal } from "@/lib/discoverySettings";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";
import { clearTopologySessionCache } from "@/lib/topology/topologySessionCache";
import { saveGeneralSettingsLocal } from "@/lib/generalSettingsStorage";
import { saveRackLayoutLocal } from "@/lib/rackLayoutStorage";
import {
  DEFAULT_LIGHTING_HOUSE,
  DEFAULT_LIGHTING_CONNECTION,
  DEFAULT_CUSTOM_SCENES,
  DEFAULT_LIGHTING_EVENT_LOG,
  LIGHTING_HOUSE_CHANGED_EVENT,
  LIGHTING_ZONE_STATE_CHANGED_EVENT,
  LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT,
  LIGHTING_CONNECTION_CHANGED_EVENT,
  LIGHTING_CUSTOM_SCENES_CHANGED_EVENT,
  LIGHTING_EVENT_LOG_CHANGED_EVENT,
  clearLightingHouseLocal,
  clearLutronConnectionLocal,
  clearLightingConnectionLocal,
  saveLightingHouseLocal,
  saveZoneStateLocal,
  saveLutronConnectionLocal,
  saveLightingConnectionLocal,
  saveCustomScenesLocal,
  saveLightingEventLogLocal,
} from "@/lib/lighting/lightingSettings";
import {
  DEFAULT_CISCO_SWITCHES,
  DEFAULT_CISCO_EVENT_LOG,
  NETWORK_CISCO_SWITCHES_CHANGED_EVENT,
  NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT,
  clearCiscoSwitchesLocal,
  saveCiscoEventLogLocal,
} from "@/lib/network/ciscoSwitchSettings";
import { DEFAULT_SNMP_SWITCHES, SNMP_SWITCHES_CHANGED_EVENT, saveSnmpSwitchesLocal } from "@/lib/snmp/snmpSwitchProfiles";
import {
  DEFAULT_WAN_MANAGEMENT,
  WAN_MANAGEMENT_CHANGED_EVENT,
  saveWanManagementLocal,
} from "@/lib/wan/wanManagementSettings";
import { CREDENTIALS_CHANGED_EVENT, saveCredentialsLocal } from "@/lib/credentials/credentialsVault";
import {
  FACTORY_GENERAL,
  buildFactoryRackLayout,
} from "./platformFactoryResetData.js";

const LOCAL_STORAGE_KEYS = [
  "waveguard_general_settings",
  "site-locations",
  "discovery",
  "waveguard_appearance_settings",
  "waveguard-rack-layout",
  "snmp-switches",
  "wan-management",
  "device-credentials-vault",
  "waveguard_wan_widget_selection",
  "waveguard_wan_speed_tests",
  "waveguard-acknowledged-diagnoses",
  "wg-discovery-results",
  "waveguard:lighting:house",
  "waveguard:lighting:zone-state",
  "waveguard:lighting:active-scene",
  "waveguard:lighting:lutron-connection",
  "waveguard:lighting:connection",
  "waveguard:lighting:custom-scenes",
  "waveguard:lighting:event-log",
  "waveguard:lighting:ocs-zones",
  "waveguard:network:cisco-switches",
  "waveguard:network:cisco-event-log",
];

/** Clear browser caches and seed defaults (browser only). */
export function clearPlatformBrowserCaches() {
  if (typeof window === "undefined") return;

  LOCAL_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });

  try {
    sessionStorage.removeItem("waveguard-dismissed-diagnoses");
  } catch {
    /* ignore */
  }

  clearTopologySessionCache();

  const siteLocations = { ...DEFAULT_SITE_LOCATIONS };
  const discovery = { ...DEFAULT_DISCOVERY_SETTINGS };
  const rackLayout = buildFactoryRackLayout();

  saveGeneralSettingsLocal({ ...FACTORY_GENERAL });
  saveSiteLocationsLocal(siteLocations);
  saveDiscoverySettingsLocal(discovery);
  saveRackLayoutLocal(rackLayout);

  clearLightingHouseLocal();
  clearLutronConnectionLocal();
  clearLightingConnectionLocal();
  clearCiscoSwitchesLocal();

  const lightingHouse = { ...DEFAULT_LIGHTING_HOUSE };
  const lutronConnection = { ...DEFAULT_LIGHTING_CONNECTION };
  const lightingConnection = { ...DEFAULT_LIGHTING_CONNECTION };
  const customScenes = { ...DEFAULT_CUSTOM_SCENES };
  const lightingEventLog = { ...DEFAULT_LIGHTING_EVENT_LOG };
  const ciscoSwitches = { ...DEFAULT_CISCO_SWITCHES };
  const ciscoEventLog = { ...DEFAULT_CISCO_EVENT_LOG };
  const snmpSwitches = { ...DEFAULT_SNMP_SWITCHES };
  const wanManagement = { ...DEFAULT_WAN_MANAGEMENT };

  saveLightingHouseLocal(lightingHouse);
  saveZoneStateLocal({});
  saveLutronConnectionLocal(lutronConnection);
  saveLightingConnectionLocal(lightingConnection);
  saveCustomScenesLocal(customScenes);
  saveLightingEventLogLocal(lightingEventLog);
  saveCiscoEventLogLocal(ciscoEventLog);
  saveSnmpSwitchesLocal(snmpSwitches);
  saveWanManagementLocal(wanManagement);
  saveCredentialsLocal([]);

  window.dispatchEvent(new CustomEvent("waveguard-general-settings-changed", { detail: FACTORY_GENERAL }));
  window.dispatchEvent(new CustomEvent(SITE_LOCATIONS_CHANGED_EVENT, { detail: siteLocations }));
  window.dispatchEvent(new CustomEvent(DISCOVERY_CHANGED_EVENT, { detail: discovery }));
  window.dispatchEvent(new CustomEvent(EQUIPMENT_CHANGED_EVENT));
  window.dispatchEvent(new CustomEvent(LIGHTING_HOUSE_CHANGED_EVENT, { detail: lightingHouse }));
  window.dispatchEvent(new CustomEvent(LIGHTING_ZONE_STATE_CHANGED_EVENT, { detail: { state: {} } }));
  window.dispatchEvent(new CustomEvent(LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT, { detail: lutronConnection }));
  window.dispatchEvent(new CustomEvent(LIGHTING_CONNECTION_CHANGED_EVENT, { detail: lightingConnection }));
  window.dispatchEvent(new CustomEvent(LIGHTING_CUSTOM_SCENES_CHANGED_EVENT, { detail: customScenes }));
  window.dispatchEvent(new CustomEvent(LIGHTING_EVENT_LOG_CHANGED_EVENT, { detail: lightingEventLog }));
  window.dispatchEvent(new CustomEvent(NETWORK_CISCO_SWITCHES_CHANGED_EVENT, { detail: ciscoSwitches }));
  window.dispatchEvent(new CustomEvent(NETWORK_CISCO_EVENT_LOG_CHANGED_EVENT, { detail: ciscoEventLog }));
  window.dispatchEvent(new CustomEvent(SNMP_SWITCHES_CHANGED_EVENT, { detail: snmpSwitches }));
  window.dispatchEvent(new CustomEvent(WAN_MANAGEMENT_CHANGED_EVENT, { detail: wanManagement }));
  window.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT, { detail: [] }));
}
