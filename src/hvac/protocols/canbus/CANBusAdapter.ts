import type { HVACProtocolAdapter } from "../../core/HVACService";
import type { HVACMode, HVACFanSpeed, HVACZoneState, HVACDiagnostics, ZoneConfig, CANMessageMap } from "../../core/HVACTypes";
import { HVACMapper } from "../../core/HVACMapper";

export class CANBusAdapter implements HVACProtocolAdapter {
  private connected = false;
  private config: ZoneConfig;
  private canMap: CANMessageMap;

  constructor(config: ZoneConfig) {
    this.config = config;
    if (!config.canMap) throw new Error(`CANBus adapter for "${config.id}" requires a canMap`);
    this.canMap = config.canMap;
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

  private async readCANMessage(_id: number): Promise<number[]> {
    return [0, 0, 0, 0, 0, 0, 0, 0];
  }

  private async writeCANMessage(_id: number, _data: number[]): Promise<void> {}

  async readZone(_zoneId: string): Promise<HVACZoneState> {
    const tempBuf = await this.readCANMessage(this.canMap.currentTemperature.id);
    const targetBuf = await this.readCANMessage(this.canMap.targetTemperature.id);
    const powerBuf = await this.readCANMessage(this.canMap.powerState.id);
    const modeBuf = await this.readCANMessage(this.canMap.mode.id);
    const fanBuf = await this.readCANMessage(this.canMap.fanSpeed.id);
    const alarmBuf = await this.readCANMessage(this.canMap.alarmCode.id);

    const currentTemperature = HVACMapper.extractCANValue(
      tempBuf, this.canMap.currentTemperature.offset,
      this.canMap.currentTemperature.length, this.canMap.currentTemperature.scale,
    );
    const targetTemperature = HVACMapper.extractCANValue(
      targetBuf, this.canMap.targetTemperature.offset,
      this.canMap.targetTemperature.length, this.canMap.targetTemperature.scale,
    );
    const rawPower = HVACMapper.extractCANValue(
      powerBuf, this.canMap.powerState.offset, this.canMap.powerState.length,
    );
    const rawMode = HVACMapper.extractCANValue(
      modeBuf, this.canMap.mode.offset, this.canMap.mode.length,
    );
    const rawFan = HVACMapper.extractCANValue(
      fanBuf, this.canMap.fanSpeed.offset, this.canMap.fanSpeed.length,
    );
    const rawAlarm = HVACMapper.extractCANValue(
      alarmBuf, this.canMap.alarmCode.offset, this.canMap.alarmCode.length,
    );

    const mode = this.canMap.mode.mapping?.[rawMode] as HVACMode | undefined ?? "off";
    const fanSpeed = this.canMap.fanSpeed.mapping?.[rawFan] as HVACFanSpeed | undefined ?? "auto";
    const alarmCode = String(rawAlarm);

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
      humidity: null,
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
    const data = HVACMapper.encodeCANValue(power ? 1 : 0, this.canMap.powerState.offset, this.canMap.powerState.length);
    await this.writeCANMessage(this.canMap.powerState.id, data);
  }

  async writeSetpoint(_zoneId: string, temperature: number): Promise<void> {
    const data = HVACMapper.encodeCANValue(
      temperature, this.canMap.targetTemperature.offset,
      this.canMap.targetTemperature.length, this.canMap.targetTemperature.scale,
    );
    await this.writeCANMessage(this.canMap.targetTemperature.id, data);
  }

  async writeMode(_zoneId: string, mode: HVACMode): Promise<void> {
    const rev = this.canMap.mode.mapping
      ? Object.entries(this.canMap.mode.mapping).find(([, v]) => v === mode)
      : null;
    const raw = rev ? Number(rev[0]) : 0;
    const data = HVACMapper.encodeCANValue(raw, this.canMap.mode.offset, this.canMap.mode.length);
    await this.writeCANMessage(this.canMap.mode.id, data);
  }

  async writeFanSpeed(_zoneId: string, fanSpeed: HVACFanSpeed): Promise<void> {
    const rev = this.canMap.fanSpeed.mapping
      ? Object.entries(this.canMap.fanSpeed.mapping).find(([, v]) => v === fanSpeed)
      : null;
    const raw = rev ? Number(rev[0]) : 0;
    const data = HVACMapper.encodeCANValue(raw, this.canMap.fanSpeed.offset, this.canMap.fanSpeed.length);
    await this.writeCANMessage(this.canMap.fanSpeed.id, data);
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
