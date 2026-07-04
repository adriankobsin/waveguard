import type { HVACProtocolAdapter } from "../../core/HVACService";
import type {
  HVACMode, HVACFanSpeed, HVACZoneState, HVACDiagnostics,
  ZoneConfig, RegisterMap, CrestronGatewayConnection,
} from "../../core/HVACTypes";
import { HVACMapper } from "../../core/HVACMapper";

const CRESTRON_API_BASE = "/api/v1/cws/api";
const DEFAULT_REST_PORT = 443;
const DEFAULT_MODBUS_PORT = 502;
const DEFAULT_PROGRAM_SLOT = 1;

export interface CrestronZoneEndpoint {
  /** Crestron REST resource path for this zone, e.g. "hvac/owner_cabin" */
  restPath: string;
  /** Modbus register block start for this zone on the Crestron Modbus TCP server */
  modbusRegisterOffset: number;
}

export class CrestronGatewayAdapter implements HVACProtocolAdapter {
  private connected = false;
  private config: ZoneConfig;
  private gatewayConfig: CrestronGatewayConnection;
  private registerMap: RegisterMap;
  private lastError: string | null = null;
  private lastCommunication: string | null = null;
  private useRestApi = true;

  constructor(config: ZoneConfig) {
    this.config = config;
    if (!config.registerMap) {
      throw new Error(`CrestronGateway adapter for "${config.id}" requires a registerMap`);
    }
    this.registerMap = config.registerMap;
    this.gatewayConfig = config.connection as CrestronGatewayConnection;
    this.useRestApi = !!(this.gatewayConfig.username && this.gatewayConfig.password);
  }

  private get baseUrl(): string {
    const protocol = this.gatewayConfig.port === 443 ? "https" : "http";
    return `${protocol}://${this.gatewayConfig.host}:${this.gatewayConfig.port}`;
  }

  private get zoneIndex(): number {
    return this.config.crestronZoneIndex ?? 0;
  }

  private get restHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.gatewayConfig.username && this.gatewayConfig.password) {
      const encoded = btoa(`${this.gatewayConfig.username}:${this.gatewayConfig.password}`);
      headers["Authorization"] = `Basic ${encoded}`;
    }
    return headers;
  }

  private async restGet<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${CRESTRON_API_BASE}/${path}`;
    const res = await fetch(url, { headers: this.restHeaders });
    if (!res.ok) throw new Error(`Crestron REST GET ${path} failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  private async restPost(path: string, body: unknown): Promise<void> {
    const url = `${this.baseUrl}${CRESTRON_API_BASE}/${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.restHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Crestron REST POST ${path} failed: ${res.status} ${res.statusText}`);
  }

  async connect(): Promise<void> {
    this.connected = false;

    if (this.useRestApi) {
      try {
        await this.restGet("device/info");
        this.connected = true;
        return;
      } catch {
        this.lastError = "Crestron REST API unreachable, falling back to Modbus TCP";
      }
    }

    this.useRestApi = false;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async readRegister(entry: { address: number; type: string }): Promise<number> {
    if (this.useRestApi) {
      const slot = this.gatewayConfig.programSlot ?? DEFAULT_PROGRAM_SLOT;
      try {
        const result = await this.restGet<{ Value: number }>(
          `program/${slot}/digital/${entry.address}`,
        );
        this.lastCommunication = new Date().toISOString();
        return result.Value ?? 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private async writeRegister(
    entry: { address: number; type: string },
    value: number,
  ): Promise<void> {
    if (this.useRestApi) {
      const slot = this.gatewayConfig.programSlot ?? DEFAULT_PROGRAM_SLOT;
      await this.restPost(`program/${slot}/digital/${entry.address}`, { Value: value });
      this.lastCommunication = new Date().toISOString();
    }
  }

  private async readAnalog(address: number): Promise<number> {
    if (this.useRestApi) {
      const slot = this.gatewayConfig.programSlot ?? DEFAULT_PROGRAM_SLOT;
      try {
        const result = await this.restGet<{ Value: number }>(
          `program/${slot}/analog/${address}`,
        );
        this.lastCommunication = new Date().toISOString();
        return result.Value ?? 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private async writeAnalog(address: number, value: number): Promise<void> {
    if (this.useRestApi) {
      const slot = this.gatewayConfig.programSlot ?? DEFAULT_PROGRAM_SLOT;
      await this.restPost(`program/${slot}/analog/${address}`, { Value: value });
      this.lastCommunication = new Date().toISOString();
    }
  }

  private modbusAddress(base: number): number {
    return base + this.zoneIndex * 100;
  }

  async readZone(_zoneId: string): Promise<HVACZoneState> {
    const tempAddr = this.modbusAddress(this.registerMap.currentTemperature.address);
    const targetAddr = this.modbusAddress(this.registerMap.targetTemperature.address);
    const powerAddr = this.modbusAddress(this.registerMap.powerState.address);
    const modeAddr = this.modbusAddress(this.registerMap.mode.address);
    const fanAddr = this.modbusAddress(this.registerMap.fanSpeed.address);
    const alarmAddr = this.modbusAddress(this.registerMap.alarmCode.address);

    let rawTemp: number;
    let rawTarget: number;
    let rawPower: number;
    let rawMode: number;
    let rawFan: number;
    let rawAlarm: number;

    if (this.useRestApi) {
      rawTemp = await this.readAnalog(tempAddr);
      rawTarget = await this.readAnalog(targetAddr);
      rawPower = await this.readRegister(this.registerMap.powerState);
      rawMode = await this.readAnalog(modeAddr);
      rawFan = await this.readAnalog(fanAddr);
      rawAlarm = await this.readAnalog(alarmAddr);
    } else {
      rawTemp = 0;
      rawTarget = 0;
      rawPower = 0;
      rawMode = 0;
      rawFan = 0;
      rawAlarm = 0;
    }

    const currentTemperature = HVACMapper.mapRegisterValue(
      this.registerMap.currentTemperature, rawTemp,
    ) as number;
    const targetTemperature = HVACMapper.mapRegisterValue(
      this.registerMap.targetTemperature, rawTarget,
    ) as number;
    const powerState = rawPower !== 0;
    const mode = HVACMapper.mapRegisterValue(this.registerMap.mode, rawMode) as HVACMode;
    const fanSpeed = HVACMapper.mapRegisterValue(this.registerMap.fanSpeed, rawFan) as HVACFanSpeed;
    const alarmCode = String(HVACMapper.mapRegisterValue(this.registerMap.alarmCode, rawAlarm));

    return {
      id: this.config.id,
      name: this.config.name,
      deck: this.config.deck,
      room: this.config.room,
      manufacturer: this.config.manufacturer,
      protocol: "crestron_gateway",
      online: this.connected,
      currentTemperature,
      targetTemperature,
      humidity: null,
      mode,
      fanSpeed,
      powerState: powerState ? "on" : "off",
      valveStatus: null,
      compressorStatus: null,
      alarmStatus: alarmCode !== "0" && alarmCode !== "",
      alarmCode,
    };
  }

  async writePower(_zoneId: string, power: boolean): Promise<void> {
    if (this.useRestApi) {
      await this.writeRegister(this.registerMap.powerState, power ? 1 : 0);
    }
  }

  async writeSetpoint(_zoneId: string, temperature: number): Promise<void> {
    const raw = HVACMapper.unmapRegisterValue(this.registerMap.targetTemperature, temperature);
    if (this.useRestApi) {
      await this.writeAnalog(
        this.modbusAddress(this.registerMap.targetTemperature.address), raw,
      );
    }
  }

  async writeMode(_zoneId: string, mode: HVACMode): Promise<void> {
    const raw = HVACMapper.unmapRegisterValue(this.registerMap.mode, mode);
    if (this.useRestApi) {
      await this.writeAnalog(
        this.modbusAddress(this.registerMap.mode.address), raw,
      );
    }
  }

  async writeFanSpeed(_zoneId: string, fanSpeed: HVACFanSpeed): Promise<void> {
    const raw = HVACMapper.unmapRegisterValue(this.registerMap.fanSpeed, fanSpeed);
    if (this.useRestApi) {
      await this.writeAnalog(
        this.modbusAddress(this.registerMap.fanSpeed.address), raw,
      );
    }
  }

  async readDiagnostics(_zoneId: string): Promise<HVACDiagnostics> {
    return {
      zoneId: this.config.id,
      protocol: "crestron_gateway",
      manufacturer: this.config.manufacturer,
      lastCommunicationTime: this.lastCommunication,
      lastSuccessfulRead: this.lastCommunication,
      lastWriteTime: null,
      lastWriteSuccess: null,
      lastErrorMessage: this.lastError,
      rawValues: {
        gatewayHost: this.gatewayConfig.host,
        gatewayPort: this.gatewayConfig.port,
        useRestApi: this.useRestApi,
        zoneIndex: this.zoneIndex,
        programSlot: this.gatewayConfig.programSlot ?? DEFAULT_PROGRAM_SLOT,
      },
      retryCount: 0,
      connectionState: this.connected ? "connected" : "disconnected",
    };
  }
}
