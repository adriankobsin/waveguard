import type { HVACProtocolAdapter } from "../../core/HVACService";
import type { HVACMode, HVACFanSpeed, HVACZoneState, HVACDiagnostics, ZoneConfig, BACnetObjectMap } from "../../core/HVACTypes";
import { HVACMapper } from "../../core/HVACMapper";

export class BACnetIPAdapter implements HVACProtocolAdapter {
  private connected = false;
  private config: ZoneConfig;
  private bacnetMap: BACnetObjectMap;

  constructor(config: ZoneConfig) {
    this.config = config;
    if (!config.bacnetMap) throw new Error(`BACnet/IP adapter for "${config.id}" requires a bacnetMap`);
    this.bacnetMap = config.bacnetMap;
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

  private async readBACnetProperty(
    _objectType: string,
    _instance: number,
    _property: string,
  ): Promise<number> {
    return 0;
  }

  private async writeBACnetProperty(
    _objectType: string,
    _instance: number,
    _property: string,
    _value: number,
  ): Promise<void> {}

  async readZone(_zoneId: string): Promise<HVACZoneState> {
    const rawTemp = await this.readBACnetProperty(
      this.bacnetMap.currentTemperature.objectType,
      this.bacnetMap.currentTemperature.instance,
      this.bacnetMap.currentTemperature.property,
    );
    const rawTarget = await this.readBACnetProperty(
      this.bacnetMap.targetTemperature.objectType,
      this.bacnetMap.targetTemperature.instance,
      this.bacnetMap.targetTemperature.property,
    );
    const rawPower = await this.readBACnetProperty(
      this.bacnetMap.powerState.objectType,
      this.bacnetMap.powerState.instance,
      this.bacnetMap.powerState.property,
    );
    const rawMode = await this.readBACnetProperty(
      this.bacnetMap.mode.objectType,
      this.bacnetMap.mode.instance,
      this.bacnetMap.mode.property,
    );
    const rawFan = await this.readBACnetProperty(
      this.bacnetMap.fanSpeed.objectType,
      this.bacnetMap.fanSpeed.instance,
      this.bacnetMap.fanSpeed.property,
    );
    const rawAlarm = await this.readBACnetProperty(
      this.bacnetMap.alarmCode.objectType,
      this.bacnetMap.alarmCode.instance,
      this.bacnetMap.alarmCode.property,
    );

    const mode = HVACMapper.mapBACnetValue(this.bacnetMap.mode.mapping, rawMode) as HVACMode;
    const fanSpeed = HVACMapper.mapBACnetValue(this.bacnetMap.fanSpeed.mapping, rawFan) as HVACFanSpeed;
    const alarmCode = String(rawAlarm);

    let humidity: number | null = null;
    if (this.bacnetMap.humidity) {
      humidity = await this.readBACnetProperty(
        this.bacnetMap.humidity.objectType,
        this.bacnetMap.humidity.instance,
        this.bacnetMap.humidity.property,
      );
    }

    return {
      id: this.config.id,
      name: this.config.name,
      deck: this.config.deck,
      room: this.config.room,
      manufacturer: this.config.manufacturer,
      protocol: this.config.protocol,
      online: true,
      currentTemperature: rawTemp,
      targetTemperature: rawTarget,
      humidity,
      mode,
      fanSpeed,
      powerState: rawPower !== 0 ? "on" : "off",
      valveStatus: null,
      compressorStatus: null,
      alarmStatus: alarmCode !== "0" && alarmCode !== "",
      alarmCode,
    };
  }

  async writePower(_zoneId: string, power: boolean): Promise<void> {
    await this.writeBACnetProperty(
      this.bacnetMap.powerState.objectType,
      this.bacnetMap.powerState.instance,
      this.bacnetMap.powerState.property,
      power ? 1 : 0,
    );
  }

  async writeSetpoint(_zoneId: string, temperature: number): Promise<void> {
    await this.writeBACnetProperty(
      this.bacnetMap.targetTemperature.objectType,
      this.bacnetMap.targetTemperature.instance,
      this.bacnetMap.targetTemperature.property,
      Math.round(temperature * 100),
    );
  }

  async writeMode(_zoneId: string, mode: HVACMode): Promise<void> {
    const raw = HVACMapper.unmapBACnetValue(this.bacnetMap.mode.mapping, mode);
    await this.writeBACnetProperty(
      this.bacnetMap.mode.objectType,
      this.bacnetMap.mode.instance,
      this.bacnetMap.mode.property,
      raw,
    );
  }

  async writeFanSpeed(_zoneId: string, fanSpeed: HVACFanSpeed): Promise<void> {
    const raw = HVACMapper.unmapBACnetValue(this.bacnetMap.fanSpeed.mapping, fanSpeed);
    await this.writeBACnetProperty(
      this.bacnetMap.fanSpeed.objectType,
      this.bacnetMap.fanSpeed.instance,
      this.bacnetMap.fanSpeed.property,
      raw,
    );
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
