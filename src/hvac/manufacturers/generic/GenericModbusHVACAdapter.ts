import { ModbusRTUAdapter } from "../../protocols/modbus/ModbusRTUAdapter";
import { ModbusTCPAdapter } from "../../protocols/modbus/ModbusTCPAdapter";
import type { ZoneConfig } from "../../core/HVACTypes";

export function createGenericModbusAdapter(config: ZoneConfig): ModbusRTUAdapter | ModbusTCPAdapter {
  if (config.protocol === "modbus_tcp") {
    return new ModbusTCPAdapter(config);
  }
  return new ModbusRTUAdapter(config);
}
