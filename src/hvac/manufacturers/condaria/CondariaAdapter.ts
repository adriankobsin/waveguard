import { ModbusRTUAdapter } from "../../protocols/modbus/ModbusRTUAdapter";
import { CONDARIA_DEFAULT_REGISTER_MAP } from "./CondariaRegisterMap";
import type { ZoneConfig } from "../../core/HVACTypes";

export class CondariaAdapter extends ModbusRTUAdapter {
  constructor(config: ZoneConfig) {
    const enriched: ZoneConfig = {
      ...config,
      registerMap: config.registerMap ?? CONDARIA_DEFAULT_REGISTER_MAP,
      supportedModes: config.supportedModes ?? ["off", "cool", "heat", "auto"],
      minSetpoint: config.minSetpoint ?? 16,
      maxSetpoint: config.maxSetpoint ?? 30,
    };
    super(enriched);
  }
}
