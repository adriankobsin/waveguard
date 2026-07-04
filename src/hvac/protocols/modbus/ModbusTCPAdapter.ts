import { ModbusRTUAdapter } from "./ModbusRTUAdapter";
import type { ZoneConfig } from "../../core/HVACTypes";

export class ModbusTCPAdapter extends ModbusRTUAdapter {
  constructor(config: ZoneConfig) {
    super(config);
  }
}
