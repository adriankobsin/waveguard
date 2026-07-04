import type { HVACMode, HVACFanSpeed, HVACPowerState, HVACManufacturer, HVACProtocol } from "./HVACTypes";

export class HVACZone {
  online = false;
  currentTemperature: number | null = null;
  targetTemperature: number | null = null;
  humidity: number | null = null;
  mode: HVACMode = "off";
  fanSpeed: HVACFanSpeed = "auto";
  powerState: HVACPowerState = "off";
  valveStatus: number | null = null;
  compressorStatus: boolean | null = null;
  alarmStatus = false;
  alarmCode = "";
  lastUpdated: string | null = null;
  lastError: string | null = null;

  private _rawDiagnostics: Record<string, unknown> = {};

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly deck: string,
    public readonly room: string,
    public readonly manufacturer: HVACManufacturer,
    public readonly protocol: HVACProtocol,
  ) {}

  get rawDiagnostics(): Record<string, unknown> {
    return { ...this._rawDiagnostics };
  }

  setRawDiagnostics(value: Record<string, unknown>): void {
    this._rawDiagnostics = { ...value };
  }

  toState(): {
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
    lastUpdated: string | null;
  } {
    return {
      id: this.id,
      name: this.name,
      deck: this.deck,
      room: this.room,
      manufacturer: this.manufacturer,
      protocol: this.protocol,
      online: this.online,
      currentTemperature: this.currentTemperature,
      targetTemperature: this.targetTemperature,
      humidity: this.humidity,
      mode: this.mode,
      fanSpeed: this.fanSpeed,
      powerState: this.powerState,
      valveStatus: this.valveStatus,
      compressorStatus: this.compressorStatus,
      alarmStatus: this.alarmStatus,
      alarmCode: this.alarmCode,
      lastUpdated: this.lastUpdated,
    };
  }
}
