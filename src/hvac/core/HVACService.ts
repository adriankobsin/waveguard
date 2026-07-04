import { HVACZone } from "./HVACZone";
import { getAdapterForZone } from "./HVACRegistry";
import { HVACMapper } from "./HVACMapper";
import type {
  HVACConfig,
  HVACMode,
  HVACFanSpeed,
  HVACZoneState,
  HVACDiagnostics,
  HVACSystemStatus,
  ZoneConfig,
} from "./HVACTypes";

export interface HVACProtocolAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  readZone(zoneId: string): Promise<HVACZoneState>;
  writePower(zoneId: string, power: boolean): Promise<void>;
  writeSetpoint(zoneId: string, temperature: number): Promise<void>;
  writeMode(zoneId: string, mode: HVACMode): Promise<void>;
  writeFanSpeed(zoneId: string, fanSpeed: HVACFanSpeed): Promise<void>;
  readDiagnostics(zoneId: string): Promise<HVACDiagnostics>;
}

interface AdapterEntry {
  adapter: HVACProtocolAdapter;
  config: ZoneConfig;
  lastError: string | null;
}

export class HVACService {
  private zones = new Map<string, HVACZone>();
  private adapters = new Map<string, AdapterEntry>();
  private config: HVACConfig;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private onLog: (msg: string) => void;
  private onZoneUpdate: ((zone: HVACZone) => void) | null = null;

  constructor(config: HVACConfig, onLog?: (msg: string) => void) {
    this.config = config;
    this.onLog = onLog ?? (() => {});
    this.initialize();
  }

  setOnZoneUpdate(cb: ((zone: HVACZone) => void) | null): void {
    this.onZoneUpdate = cb;
  }

  private log(msg: string): void {
    this.onLog(`[HVACService] ${msg}`);
  }

  private initialize(): void {
    for (const zc of this.config.zones) {
      const zone = new HVACZone(zc.id, zc.name, zc.deck, zc.room, zc.manufacturer, zc.protocol);
      this.zones.set(zc.id, zone);
      try {
        const adapter = getAdapterForZone(zc);
        this.adapters.set(zc.id, { adapter, config: zc, lastError: null });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`Failed to create adapter for zone "${zc.id}": ${msg}`);
        this.adapters.set(zc.id, {
          adapter: new NullAdapter(zc.id),
          config: zc,
          lastError: msg,
        });
      }
    }
  }

  async connectAll(): Promise<void> {
    this.log(`Connecting ${this.adapters.size} adapter(s)...`);
    for (const [zoneId, entry] of this.adapters) {
      try {
        await entry.adapter.connect();
        this.log(`Zone "${zoneId}" adapter connected`);
        entry.lastError = null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`Zone "${zoneId}" adapter connect failed: ${msg}`);
        entry.lastError = msg;
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [zoneId, entry] of this.adapters) {
      try {
        await entry.adapter.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.log("All adapters disconnected");
  }

  async pollOnce(): Promise<void> {
    for (const [zoneId, entry] of this.adapters) {
      try {
        const state = await entry.adapter.readZone(zoneId);
        const zone = this.zones.get(zoneId);
        if (zone) {
          zone.online = state.online;
          zone.currentTemperature = state.currentTemperature;
          zone.targetTemperature = state.targetTemperature;
          zone.humidity = state.humidity;
          zone.mode = state.mode;
          zone.fanSpeed = state.fanSpeed;
          zone.powerState = state.powerState;
          zone.valveStatus = state.valveStatus;
          zone.compressorStatus = state.compressorStatus;
          zone.alarmStatus = state.alarmStatus;
          zone.alarmCode = state.alarmCode;
          zone.lastUpdated = new Date().toISOString();
          zone.lastError = null;
          entry.lastError = null;
          if (this.onZoneUpdate) this.onZoneUpdate(zone);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const zone = this.zones.get(zoneId);
        if (zone) {
          zone.lastError = msg;
          zone.online = false;
        }
        entry.lastError = msg;
        this.log(`Poll zone "${zoneId}" failed: ${msg}`);
      }
    }
  }

  startPolling(intervalMs?: number): void {
    if (this.pollTimer) return;
    const ms = intervalMs ?? this.config.pollIntervalMs;
    this.log(`Starting polling every ${ms}ms`);
    this.pollTimer = setInterval(() => this.pollOnce(), ms);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.log("Polling stopped");
    }
  }

  private getAdapterEntry(zoneId: string): { entry: AdapterEntry; zone: HVACZone } {
    const entry = this.adapters.get(zoneId);
    if (!entry) throw new Error(`No adapter found for zone "${zoneId}"`);
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`No zone found for "${zoneId}"`);
    return { entry, zone };
  }

  getAllZones(): HVACZoneState[] {
    return [...this.zones.values()].map((z) => z.toState());
  }

  getZone(zoneId: string): HVACZoneState | null {
    const zone = this.zones.get(zoneId);
    return zone ? zone.toState() : null;
  }

  async setPower(zoneId: string, power: boolean): Promise<void> {
    const { entry, zone } = this.getAdapterEntry(zoneId);
    if (!zone.online && !this.config.forceWrite) {
      throw new Error(`Zone "${zoneId}" is offline; write rejected (enable forceWrite to override)`);
    }
    const error = HVACMapper.validateMode(zone.mode, entry.config);
    if (error) throw new Error(error);
    await entry.adapter.writePower(zoneId, power);
    zone.powerState = power ? "on" : "off";
    zone.lastUpdated = new Date().toISOString();
    this.log(`Power set to ${power} for zone "${zoneId}"`);
  }

  async setSetpoint(zoneId: string, temperature: number): Promise<void> {
    const { entry, zone } = this.getAdapterEntry(zoneId);
    const error = HVACMapper.validateSetpoint(temperature, entry.config);
    if (error) throw new Error(error);
    if (!zone.online && !this.config.forceWrite) {
      throw new Error(`Zone "${zoneId}" is offline; write rejected`);
    }
    await entry.adapter.writeSetpoint(zoneId, temperature);
    zone.targetTemperature = temperature;
    zone.lastUpdated = new Date().toISOString();
    this.log(`Setpoint set to ${temperature}°C for zone "${zoneId}"`);
  }

  async setMode(zoneId: string, mode: HVACMode): Promise<void> {
    const { entry, zone } = this.getAdapterEntry(zoneId);
    const error = HVACMapper.validateMode(mode, entry.config);
    if (error) throw new Error(error);
    if (!zone.online && !this.config.forceWrite) {
      throw new Error(`Zone "${zoneId}" is offline; write rejected`);
    }
    await entry.adapter.writeMode(zoneId, mode);
    zone.mode = mode;
    zone.lastUpdated = new Date().toISOString();
    this.log(`Mode set to ${mode} for zone "${zoneId}"`);
  }

  async setFanSpeed(zoneId: string, fanSpeed: HVACFanSpeed): Promise<void> {
    const { entry, zone } = this.getAdapterEntry(zoneId);
    const error = HVACMapper.validateFanSpeed(fanSpeed);
    if (error) throw new Error(error);
    if (!zone.online && !this.config.forceWrite) {
      throw new Error(`Zone "${zoneId}" is offline; write rejected`);
    }
    await entry.adapter.writeFanSpeed(zoneId, fanSpeed);
    zone.fanSpeed = fanSpeed;
    zone.lastUpdated = new Date().toISOString();
    this.log(`Fan speed set to ${fanSpeed} for zone "${zoneId}"`);
  }

  async getDiagnostics(zoneId: string): Promise<HVACDiagnostics> {
    const { entry, zone } = this.getAdapterEntry(zoneId);
    try {
      return await entry.adapter.readDiagnostics(zoneId);
    } catch (err) {
      return {
        zoneId,
        protocol: zone.protocol,
        manufacturer: zone.manufacturer,
        lastCommunicationTime: zone.lastUpdated,
        lastSuccessfulRead: zone.lastUpdated,
        lastWriteTime: null,
        lastWriteSuccess: null,
        lastErrorMessage: err instanceof Error ? err.message : String(err),
        rawValues: {},
        retryCount: 0,
        connectionState: "error",
      };
    }
  }

  getSystemStatus(): HVACSystemStatus {
    const allZones = [...this.zones.values()];
    const totalZones = allZones.length;
    const onlineZones = allZones.filter((z) => z.online).length;
    const offlineZones = totalZones - onlineZones;
    const alarmZones = allZones.filter((z) => z.alarmStatus).length;

    const adapterStatuses: Record<string, { connected: boolean; lastError: string | null }> = {};
    for (const [zoneId, entry] of this.adapters) {
      adapterStatuses[zoneId] = {
        connected: entry.adapter.isConnected(),
        lastError: entry.lastError,
      };
    }

    let overall: "healthy" | "degraded" | "offline";
    if (onlineZones === totalZones) overall = "healthy";
    else if (onlineZones > 0) overall = "degraded";
    else overall = "offline";

    const lastPoll = [...this.zones.values()]
      .map((z) => z.lastUpdated)
      .filter(Boolean)
      .sort()
      .pop();

    return {
      overall,
      totalZones,
      onlineZones,
      offlineZones,
      alarmZones,
      lastPollTime: lastPoll ?? null,
      adapters: adapterStatuses,
    };
  }

  getConfig(): HVACConfig {
    return this.config;
  }
}

class NullAdapter implements HVACProtocolAdapter {
  constructor(private zoneId: string) {}

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  isConnected(): boolean {
    return false;
  }
  async readZone(_zoneId: string): Promise<HVACZoneState> {
    throw new Error(`No real adapter for zone "${this.zoneId}"`);
  }
  async writePower(_zoneId: string, _power: boolean): Promise<void> {
    throw new Error(`No real adapter for zone "${this.zoneId}"`);
  }
  async writeSetpoint(_zoneId: string, _temperature: number): Promise<void> {
    throw new Error(`No real adapter for zone "${this.zoneId}"`);
  }
  async writeMode(_zoneId: string, _mode: HVACMode): Promise<void> {
    throw new Error(`No real adapter for zone "${this.zoneId}"`);
  }
  async writeFanSpeed(_zoneId: string, _fanSpeed: HVACFanSpeed): Promise<void> {
    throw new Error(`No real adapter for zone "${this.zoneId}"`);
  }
  async readDiagnostics(_zoneId: string): Promise<HVACDiagnostics> {
    throw new Error(`No real adapter for zone "${this.zoneId}"`);
  }
}
