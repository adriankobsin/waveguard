import type { HVACProtocolAdapter } from "./HVACService";
import type { HVACManufacturer, HVACProtocol, ZoneConfig } from "./HVACTypes";

type AdapterFactory = (config: ZoneConfig) => HVACProtocolAdapter;

const protocolFactories = new Map<string, AdapterFactory>();
const manufacturerOverrides = new Map<string, AdapterFactory>();

export function registerProtocolAdapter(protocol: HVACProtocol | string, factory: AdapterFactory): void {
  protocolFactories.set(protocol, factory);
}

export function registerManufacturerAdapter(manufacturer: HVACManufacturer | string, factory: AdapterFactory): void {
  manufacturerOverrides.set(manufacturer, factory);
}

export function getAdapterForZone(config: ZoneConfig): HVACProtocolAdapter {
  const override = manufacturerOverrides.get(config.manufacturer);
  if (override) return override(config);
  const factory = protocolFactories.get(config.protocol);
  if (!factory) {
    throw new Error(
      `No adapter registered for protocol "${config.protocol}" (zone: ${config.id}, manufacturer: ${config.manufacturer})`,
    );
  }
  return factory(config);
}

export function listRegisteredProtocols(): string[] {
  return [...protocolFactories.keys()];
}

export function listRegisteredManufacturers(): string[] {
  return [...manufacturerOverrides.keys()];
}

export function clearRegistry(): void {
  protocolFactories.clear();
  manufacturerOverrides.clear();
}
