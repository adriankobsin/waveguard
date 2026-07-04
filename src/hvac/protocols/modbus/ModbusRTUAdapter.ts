import type { HVACProtocolAdapter } from "../../core/HVACService";
import type { HVACMode, HVACFanSpeed, HVACZoneState, HVACDiagnostics, ZoneConfig, RegisterMap } from "../../core/HVACTypes";
import { HVACMapper } from "../../core/HVACMapper";

export class ModbusRTUAdapter implements HVACProtocolAdapter {
  private connected = false;
  private config: ZoneConfig;
  private registerMap: RegisterMap;

  constructor(config: ZoneConfig) {
    this.config = config;
    if (!config.registerMap) throw new Error(`ModbusRTU adapter for "${config.id}" requires a registerMap`);
    this.registerMap = config.registerMap;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async readRegister(entry: { address: number; type: string }): Promise<number> {
    return 0;
  }

  private async writeRegister(entry: { address: number; type: string }, _value: number): Promise<void> {}

  async readZone(_zoneId: string): Promise<HVACZoneState> {
    const rawTemp = await this.readRegister(this.registerMap.currentTemperature);
    const rawTarget = await this.readRegister(this.registerMap.targetTemperature);
    const rawPower = await this.readRegister(this.registerMap.powerState);
    const rawMode = await this.readRegister(this.registerMap.mode);
    const rawFan = await this.readRegister(this.registerMap.fanSpeed);
    const rawAlarm = await this.readRegister(this.registerMap.alarmCode);

    const currentTemperature = HVACMapper.mapRegisterValue(this.registerMap.currentTemperature, rawTemp) as number;
    const targetTemperature = HVACMapper.mapRegisterValue(this.registerMap.targetTemperature, rawTarget) as number;
    const powerState = rawPower !== 0;
    const mode = HVACMapper.mapRegisterValue(this.registerMap.mode, rawMode) as HVACMode;
    const fanSpeed = HVACMapper.mapRegisterValue(this.registerMap.fanSpeed, rawFan) as HVACFanSpeed;
    const alarmCode = String(HVACMapper.mapRegisterValue(this.registerMap.alarmCode, rawAlarm));

    let humidity: number | null = null;
    if (this.registerMap.humidity) {
      humidity = HVACMapper.mapRegisterValue(this.registerMap.humidity, await this.readRegister(this.registerMap.humidity)) as number;
    }

    return {
      id: this.config.id,
      name: this.config.name,
      deck: this.config.deck,
      room: this.config.room,
      manufacturer: this.config.manufacturer,
      protocol: this.config.protocol,
      online: true,
      currentTemperature,
      targetTemperature,
      humidity,
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
    await this.writeRegister(this.registerMap.powerState, power ? 1 : 0);
  }

  async writeSetpoint(_zoneId: string, temperature: number): Promise<void> {
    const raw = HVACMapper.unmapRegisterValue(this.registerMap.targetTemperature, temperature);
    await this.writeRegister(this.registerMap.targetTemperature, raw);
  }

  async writeMode(_zoneId: string, mode: HVACMode): Promise<void> {
    const raw = HVACMapper.unmapRegisterValue(this.registerMap.mode, mode);
    await this.writeRegister(this.registerMap.mode, raw);
  }

  async writeFanSpeed(_zoneId: string, fanSpeed: HVACFanSpeed): Promise<void> {
    const raw = HVACMapper.unmapRegisterValue(this.registerMap.fanSpeed, fanSpeed);
    await this.writeRegister(this.registerMap.fanSpeed, raw);
  }

  async readDiagnostics(_zoneId: string): Promise<HVACDiagnostics> {
    return {
      zoneId: this.config.id,
      protocol: this.config.protocol,
      manufacturer: this.config.manufacturer,
      lastCommunicationTime: new Date().toISOString(),
      lastSuccessfulRead: new Date().toISOString(),
      lastWriteTime: null,
      lastWriteSuccess: null,
      lastErrorMessage: null,
      rawValues: {},
      retryCount: 0,
      connectionState: this.connected ? "connected" : "disconnected",
    };
  }
}
