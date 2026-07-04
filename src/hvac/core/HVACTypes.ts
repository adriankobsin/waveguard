export type HVACMode = "off" | "cool" | "heat" | "auto" | "dry" | "fan_only";

export type HVACFanSpeed = "auto" | "low" | "medium" | "high";

export type HVACPowerState = "on" | "off";

export type HVACProtocol =
  | "modbus_rtu"
  | "modbus_tcp"
  | "bacnet_ip"
  | "bacnet_mstp"
  | "canbus"
  | "crestron_gateway"
  | "mock";

export type HVACManufacturer =
  | "frigomar"
  | "dometic"
  | "condaria"
  | "cruisair"
  | "webasto"
  | "heinen_hopman"
  | "generic"
  | "mock";

export type RegisterType = "holding" | "input" | "coil" | "discrete";

export interface RegisterMapEntry {
  address: number;
  type: RegisterType;
  scale?: number;
  unit?: string;
  readOnly: boolean;
  mapping?: Record<string, string>;
  bitMask?: number;
}

export interface RegisterMap {
  currentTemperature: RegisterMapEntry;
  targetTemperature: RegisterMapEntry;
  powerState: RegisterMapEntry;
  mode: RegisterMapEntry;
  fanSpeed: RegisterMapEntry;
  humidity?: RegisterMapEntry;
  valveStatus?: RegisterMapEntry;
  compressorStatus?: RegisterMapEntry;
  alarmCode: RegisterMapEntry;
  [key: string]: RegisterMapEntry | undefined;
}

export interface BACnetObjectMap {
  currentTemperature: { objectType: string; instance: number; property: string };
  targetTemperature: { objectType: string; instance: number; property: string };
  powerState: { objectType: string; instance: number; property: string };
  mode: { objectType: string; instance: number; property: string; mapping?: Record<number, string> };
  fanSpeed: { objectType: string; instance: number; property: string; mapping?: Record<number, string> };
  alarmCode: { objectType: string; instance: number; property: string };
  humidity?: { objectType: string; instance: number; property: string };
  [key: string]: { objectType: string; instance: number; property: string; mapping?: Record<number, string> } | undefined;
}

export interface CANMessageMap {
  currentTemperature: { id: number; offset: number; length: number; scale: number };
  targetTemperature: { id: number; offset: number; length: number; scale: number };
  powerState: { id: number; offset: number; length: number };
  mode: { id: number; offset: number; length: number; mapping?: Record<number, string> };
  fanSpeed: { id: number; offset: number; length: number; mapping?: Record<number, string> };
  alarmCode: { id: number; offset: number; length: number };
  [key: string]: { id: number; offset: number; length: number; scale?: number; mapping?: Record<number, string> } | undefined;
}

export interface ModbusRTUConnection {
  serialPort: string;
  baudRate: number;
  parity: "none" | "even" | "odd";
  stopBits: 1 | 2;
  slaveId: number;
}

export interface ModbusTCPConnection {
  host: string;
  port: number;
  slaveId: number;
}

export interface BACnetIPConnection {
  host: string;
  port: number;
  deviceInstance: number;
}

export interface BACnetMSTPConnection {
  serialPort: string;
  baudRate: number;
  deviceInstance: number;
  macAddress: number;
}

export interface CANBusConnection {
  interface: string;
  baudRate: number;
}

export interface CrestronGatewayConnection {
  host: string;
  port: number;
  /** Crestron 4-Series/VC-4 REST API credentials */
  username?: string;
  password?: string;
  /** Optional Modbus TCP fallback slave ID if Crestron exposes zones via Modbus */
  fallbackSlaveId?: number;
  /** Crestron program slot (typically 1) */
  programSlot?: number;
}

export type HVACConnection =
  | ({ type: "modbus_rtu" } & ModbusRTUConnection)
  | ({ type: "modbus_tcp" } & ModbusTCPConnection)
  | ({ type: "bacnet_ip" } & BACnetIPConnection)
  | ({ type: "bacnet_mstp" } & BACnetMSTPConnection)
  | ({ type: "canbus" } & CANBusConnection)
  | ({ type: "crestron_gateway" } & CrestronGatewayConnection)
  | ({ type: "mock" });

export interface ZoneConfig {
  id: string;
  name: string;
  deck: string;
  room: string;
  manufacturer: HVACManufacturer;
  protocol: HVACProtocol;
  connection: HVACConnection;
  registerMap?: RegisterMap;
  bacnetMap?: BACnetObjectMap;
  canMap?: CANMessageMap;
  /** Crestron gateway zone index — maps this zone to a Crestron SIMPL+ module instance */
  crestronZoneIndex?: number;
  supportedModes?: HVACMode[];
  minSetpoint?: number;
  maxSetpoint?: number;
}

export interface HVACConfig {
  pollIntervalMs: number;
  defaultMinSetpoint: number;
  defaultMaxSetpoint: number;
  defaultSupportedModes: HVACMode[];
  forceWrite: boolean;
  zones: ZoneConfig[];
}

export interface HVACDiagnostics {
  zoneId: string;
  protocol: HVACProtocol;
  manufacturer: HVACManufacturer;
  lastCommunicationTime: string | null;
  lastSuccessfulRead: string | null;
  lastWriteTime: string | null;
  lastWriteSuccess: boolean | null;
  lastErrorMessage: string | null;
  rawValues: Record<string, unknown>;
  retryCount: number;
  connectionState: "connected" | "disconnected" | "error";
}

export interface HVACZoneState {
  id: string;
  name: string;
  deck: string;
  room: string;
  manufacturer: HVACManufacturer;
  protocol: HVACProtocol;
  online: boolean;
  currentTemperature: number | null;
  targetTemperature: number | null;
  humidity: number | null;
  mode: HVACMode;
  fanSpeed: HVACFanSpeed;
  powerState: HVACPowerState;
  valveStatus: number | null;
  compressorStatus: boolean | null;
  alarmStatus: boolean;
  alarmCode: string;
}

export interface HVACSystemStatus {
  overall: "healthy" | "degraded" | "offline";
  totalZones: number;
  onlineZones: number;
  offlineZones: number;
  alarmZones: number;
  lastPollTime: string | null;
  adapters: Record<string, { connected: boolean; lastError: string | null }>;
}
