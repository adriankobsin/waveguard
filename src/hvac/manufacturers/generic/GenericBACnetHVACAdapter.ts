import { BACnetIPAdapter } from "../../protocols/bacnet/BACnetIPAdapter";
import { BACnetMSTPAdapter } from "../../protocols/bacnet/BACnetMSTPAdapter";
import type { ZoneConfig } from "../../core/HVACTypes";

export function createGenericBACnetAdapter(config: ZoneConfig): BACnetIPAdapter | BACnetMSTPAdapter {
  if (config.protocol === "bacnet_mstp") {
    return new BACnetMSTPAdapter(config);
  }
  return new BACnetIPAdapter(config);
}
