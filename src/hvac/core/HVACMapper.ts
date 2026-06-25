import type { ZoneConfig, RegisterMap, RegisterMapEntry, BACnetObjectMap, CANMessageMap } from "./HVACTypes";

export class HVACMapper {
  static mapRegisterValue(entry: RegisterMapEntry, raw: number): number | string {
    let value = raw;
    if (entry.scale) value *= entry.scale;
    if (entry.mapping) {
      const mapped = entry.mapping[String(raw)];
      return mapped ?? raw;
    }
    return Math.round(value * 100) / 100;
  }

  static unmapRegisterValue(entry: RegisterMapEntry, value: number | string | boolean): number {
    if (entry.mapping) {
      const reverse = Object.entries(entry.mapping).find(([, v]) => v === value);
      if (reverse) return Number(reverse[0]);
      return 0;
    }
    let numeric: number;
    if (typeof value === "boolean") numeric = value ? 1 : 0;
    else numeric = Number(value);
    if (entry.scale) numeric /= entry.scale;
    return Math.round(numeric);
  }

  static mapBACnetValue(mapping: Record<number, string> | undefined, raw: number): string | number {
    if (mapping) {
      return mapping[raw] ?? raw;
    }
    return raw;
  }

  static unmapBACnetValue(mapping: Record<number, string> | undefined, value: string | number): number {
    if (mapping && typeof value === "string") {
      const rev = Object.entries(mapping).find(([, v]) => v === value);
      return rev ? Number(rev[0]) : 0;
    }
    return Number(value);
  }

  static extractCANValue(
    buffer: number[],
    offset: number,
    length: number,
    scale?: number,
  ): number {
    let raw = 0;
    for (let i = 0; i < length; i++) {
      raw = (raw << 8) | (buffer[offset + i] ?? 0);
    }
    if (scale) raw *= scale;
    return raw;
  }

  static encodeCANValue(value: number, _offset: number, length: number, scale?: number): number[] {
    let raw = Math.round(scale ? value / scale : value);
    const bytes: number[] = [];
    for (let i = length - 1; i >= 0; i--) {
      bytes.unshift(raw & 0xff);
      raw >>= 8;
    }
    return bytes;
  }

  static zoneConfigToAdapterConfig(config: ZoneConfig): Record<string, unknown> {
    const base: Record<string, unknown> = {
      id: config.id,
      manufacturer: config.manufacturer,
      protocol: config.protocol,
      connection: config.connection,
    };

    if (config.registerMap) base.registerMap = config.registerMap;
    if (config.bacnetMap) base.bacnetMap = config.bacnetMap;
    if (config.canMap) base.canMap = config.canMap;

    return base;
  }

  static validateSetpoint(temperature: number, config: ZoneConfig): string | null {
    const min = config.minSetpoint ?? 16;
    const max = config.maxSetpoint ?? 30;
    if (temperature < min) return `Setpoint ${temperature}°C is below minimum ${min}°C`;
    if (temperature > max) return `Setpoint ${temperature}°C is above maximum ${max}°C`;
    return null;
  }

  static validateMode(mode: string, config: ZoneConfig): string | null {
    const valid = config.supportedModes ?? ["off", "cool", "heat", "auto", "dry", "fan_only"];
    if (!valid.includes(mode as never)) {
      return `Mode "${mode}" not supported for zone "${config.name}". Supported: ${valid.join(", ")}`;
    }
    return null;
  }

  static validateFanSpeed(speed: string): string | null {
    const valid = ["auto", "low", "medium", "high"];
    if (!valid.includes(speed)) {
      return `Fan speed "${speed}" invalid. Must be one of: ${valid.join(", ")}`;
    }
    return null;
  }
}
