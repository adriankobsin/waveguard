import { HVACService } from "../core/HVACService";
import { registerProtocolAdapter, registerManufacturerAdapter } from "../core/HVACRegistry";
import { ModbusRTUAdapter } from "../protocols/modbus/ModbusRTUAdapter";
import { ModbusTCPAdapter } from "../protocols/modbus/ModbusTCPAdapter";
import { BACnetIPAdapter } from "../protocols/bacnet/BACnetIPAdapter";
import { BACnetMSTPAdapter } from "../protocols/bacnet/BACnetMSTPAdapter";
import { CANBusAdapter } from "../protocols/canbus/CANBusAdapter";
import { MockHVACAdapter } from "../protocols/MockHVACAdapter";
import { CrestronGatewayAdapter } from "../protocols/crestron/CrestronGatewayAdapter";
import { FrigomarAdapter } from "../manufacturers/frigomar/FrigomarAdapter";
import { DometicAdapter } from "../manufacturers/dometic/DometicAdapter";
import { CondariaAdapter } from "../manufacturers/condaria/CondariaAdapter";
import type { HVACConfig } from "../core/HVACTypes";

export function registerAllAdapters(): void {
  registerProtocolAdapter("modbus_rtu", (cfg) => new ModbusRTUAdapter(cfg));
  registerProtocolAdapter("modbus_tcp", (cfg) => new ModbusTCPAdapter(cfg));
  registerProtocolAdapter("bacnet_ip", (cfg) => new BACnetIPAdapter(cfg));
  registerProtocolAdapter("bacnet_mstp", (cfg) => new BACnetMSTPAdapter(cfg));
  registerProtocolAdapter("canbus", (cfg) => new CANBusAdapter(cfg));
  registerProtocolAdapter("crestron_gateway", (cfg) => new CrestronGatewayAdapter(cfg));
  registerProtocolAdapter("mock", () => new MockHVACAdapter());

  registerManufacturerAdapter("frigomar", (cfg) => new FrigomarAdapter(cfg));
  registerManufacturerAdapter("dometic", (cfg) => new DometicAdapter(cfg));
  registerManufacturerAdapter("condaria", (cfg) => new CondariaAdapter(cfg));
}

export function createHVACService(config: HVACConfig, logFn?: (msg: string) => void): HVACService {
  registerAllAdapters();
  return new HVACService(config, logFn);
}
