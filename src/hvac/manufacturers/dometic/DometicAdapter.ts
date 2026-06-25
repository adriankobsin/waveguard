import { ModbusRTUAdapter } from "../../protocols/modbus/ModbusRTUAdapter";
import { DOMETIC_DEFAULT_REGISTER_MAP } from "./DometicRegisterMap";
import type { ZoneConfig } from "../../core/HVACTypes";

export class DometicAdapter extends ModbusRTUAdapter {
  constructor(config: ZoneConfig) {
    const enriched: ZoneConfig = {
      ...config,
      registerMap: config.registerMap ?? DOMETIC_DEFAULT_REGISTER_MAP,
      supportedModes: config.supportedModes ?? ["off", "cool", "heat", "auto", "dry", "fan_only"],
      minSetpoint: config.minSetpoint ?? 16,
      maxSetpoint: config.maxSetpoint ?? 30,
    };
    super(enriched);
  }
}
