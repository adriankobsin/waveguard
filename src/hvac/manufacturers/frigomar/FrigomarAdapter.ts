import { ModbusRTUAdapter } from "../../protocols/modbus/ModbusRTUAdapter";
import { FRIGOMAR_DEFAULT_REGISTER_MAP } from "./FrigomarRegisterMap";
import type { ZoneConfig } from "../../core/HVACTypes";

export class FrigomarAdapter extends ModbusRTUAdapter {
  constructor(config: ZoneConfig) {
    const enriched: ZoneConfig = {
      ...config,
      registerMap: config.registerMap ?? FRIGOMAR_DEFAULT_REGISTER_MAP,
      supportedModes: config.supportedModes ?? ["off", "cool", "heat", "auto", "fan_only"],
      minSetpoint: config.minSetpoint ?? 16,
      maxSetpoint: config.maxSetpoint ?? 30,
    };
    super(enriched);
  }
}
