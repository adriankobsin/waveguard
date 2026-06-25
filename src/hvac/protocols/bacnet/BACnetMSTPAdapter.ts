import { BACnetIPAdapter } from "./BACnetIPAdapter";
import type { ZoneConfig } from "../../core/HVACTypes";

export class BACnetMSTPAdapter extends BACnetIPAdapter {
  constructor(config: ZoneConfig) {
    super(config);
  }
}
