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
  FACTORY_GENERAL,
  buildFactoryRackLayout,
} from "./platformFactoryResetData.js";

const LOCAL_STORAGE_KEYS = [
  "waveguard_general_settings",
  "site-locations",
  "discovery",
  "waveguard_appearance_settings",
  "waveguard-rack-layout",
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

  window.dispatchEvent(new CustomEvent("waveguard-general-settings-changed", { detail: FACTORY_GENERAL }));
  window.dispatchEvent(new CustomEvent(SITE_LOCATIONS_CHANGED_EVENT, { detail: siteLocations }));
  window.dispatchEvent(new CustomEvent(DISCOVERY_CHANGED_EVENT, { detail: discovery }));
  window.dispatchEvent(new CustomEvent(EQUIPMENT_CHANGED_EVENT));
}
