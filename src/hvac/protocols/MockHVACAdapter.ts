import type { HVACProtocolAdapter } from "../core/HVACService";
import type { HVACMode, HVACFanSpeed, HVACZoneState, HVACDiagnostics, HVACConfig } from "../core/HVACTypes";

const MOCK_ZONES: HVACZoneState[] = [
  { id: "owner_cabin", name: "Owner Cabin", deck: "Main Deck", room: "Owner Suite", manufacturer: "mock", protocol: "mock", online: true, currentTemperature: 22.5, targetTemperature: 22, humidity: 52, mode: "cool", fanSpeed: "medium", powerState: "on", valveStatus: 65, compressorStatus: true, alarmStatus: false, alarmCode: "0" },
  { id: "vip_cabin", name: "VIP Cabin", deck: "Main Deck", room: "VIP Suite", manufacturer: "mock", protocol: "mock", online: true, currentTemperature: 23.0, targetTemperature: 23, humidity: 48, mode: "auto", fanSpeed: "low", powerState: "on", valveStatus: 45, compressorStatus: true, alarmStatus: false, alarmCode: "0" },
  { id: "guest_cabin_port", name: "Guest Cabin Port", deck: "Lower Deck", room: "Guest Cabin Port", manufacturer: "mock", protocol: "mock", online: true, currentTemperature: 21.0, targetTemperature: 22, humidity: 55, mode: "heat", fanSpeed: "auto", powerState: "on", valveStatus: 30, compressorStatus: false, alarmStatus: false, alarmCode: "0" },
  { id: "guest_cabin_stbd", name: "Guest Cabin Starboard", deck: "Lower Deck", room: "Guest Cabin Starboard", manufacturer: "mock", protocol: "mock", online: false, currentTemperature: 19.5, targetTemperature: 22, humidity: null, mode: "off", fanSpeed: "auto", powerState: "off", valveStatus: 0, compressorStatus: false, alarmStatus: true, alarmCode: "E-02" },
  { id: "main_saloon", name: "Main Saloon", deck: "Main Deck", room: "Saloon", manufacturer: "mock", protocol: "mock", online: true, currentTemperature: 24.0, targetTemperature: 24, humidity: 45, mode: "cool", fanSpeed: "high", powerState: "on", valveStatus: 80, compressorStatus: true, alarmStatus: false, alarmCode: "0" },
  { id: "bridge", name: "Bridge", deck: "Upper Deck", room: "Wheelhouse", manufacturer: "mock", protocol: "mock", online: true, currentTemperature: 25.0, targetTemperature: 24, humidity: 40, mode: "cool", fanSpeed: "auto", powerState: "on", valveStatus: 55, compressorStatus: true, alarmStatus: false, alarmCode: "0" },
  { id: "crew_mess", name: "Crew Mess", deck: "Lower Deck", room: "Crew Mess", manufacturer: "mock", protocol: "mock", online: true, currentTemperature: 20.0, targetTemperature: 21, humidity: 58, mode: "heat", fanSpeed: "low", powerState: "on", valveStatus: 25, compressorStatus: false, alarmStatus: false, alarmCode: "0" },
  { id: "galley", name: "Galley", deck: "Main Deck", room: "Galley", manufacturer: "mock", protocol: "mock", online: true, currentTemperature: 26.0, targetTemperature: 24, humidity: 60, mode: "cool", fanSpeed: "high", powerState: "on", valveStatus: 90, compressorStatus: true, alarmStatus: false, alarmCode: "0" },
];

export class MockHVACAdapter implements HVACProtocolAdapter {
  private connected = false;
  private zones: Map<string, HVACZoneState>;
  private simulationTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.zones = new Map(MOCK_ZONES.map((z) => [z.id, { ...z }]));
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.startSimulation();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private startSimulation(): void {
    this.simulationTimer = setInterval(() => {
      for (const zone of this.zones.values()) {
        if (!zone.online) continue;
        const drift = (Math.random() - 0.5) * 0.4;
        if (zone.currentTemperature != null) {
          zone.currentTemperature = Math.round((zone.currentTemperature + drift) * 10) / 10;
        }
        if (zone.humidity != null) {
          zone.humidity = Math.round((zone.humidity + (Math.random() - 0.5) * 2) * 10) / 10;
        }
      }
    }, 3000);
  }

  async readZone(zoneId: string): Promise<HVACZoneState> {
    if (!this.connected) throw new Error("Adapter not connected");
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    const hasDelay = Math.random() < 0.1;
    if (hasDelay) await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    const shouldFail = Math.random() < 0.02;
    if (shouldFail) throw new Error("Simulated read failure");
    return { ...zone };
  }

  async writePower(zoneId: string, power: boolean): Promise<void> {
    if (!this.connected) throw new Error("Adapter not connected");
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    if (Math.random() < 0.05) throw new Error("Simulated write failure");
    zone.powerState = power ? "on" : "off";
    zone.online = true;
  }

  async writeSetpoint(zoneId: string, temperature: number): Promise<void> {
    if (!this.connected) throw new Error("Adapter not connected");
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    if (Math.random() < 0.05) throw new Error("Simulated write failure");
    zone.targetTemperature = temperature;
  }

  async writeMode(zoneId: string, mode: HVACMode): Promise<void> {
    if (!this.connected) throw new Error("Adapter not connected");
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    if (Math.random() < 0.05) throw new Error("Simulated write failure");
    zone.mode = mode;
  }

  async writeFanSpeed(zoneId: string, fanSpeed: HVACFanSpeed): Promise<void> {
    if (!this.connected) throw new Error("Adapter not connected");
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    if (Math.random() < 0.05) throw new Error("Simulated write failure");
    zone.fanSpeed = fanSpeed;
  }

  async readDiagnostics(zoneId: string): Promise<HVACDiagnostics> {
    if (!this.connected) throw new Error("Adapter not connected");
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    return {
      zoneId,
      protocol: "mock",
      manufacturer: "mock",
      lastCommunicationTime: new Date().toISOString(),
      lastSuccessfulRead: new Date().toISOString(),
      lastWriteTime: null,
      lastWriteSuccess: null,
      lastErrorMessage: null,
      rawValues: { ...zone },
      retryCount: 0,
      connectionState: "connected",
    };
  }

  static getDefaultZones(): HVACZoneState[] {
    return MOCK_ZONES.map((z) => ({ ...z }));
  }
}
