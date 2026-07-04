export class HVACDevice {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly manufacturer: string,
    public readonly protocol: string,
    public readonly address: string,
  ) {}

  static fromConfig(config: {
    id: string;
    name: string;
    manufacturer: string;
    protocol: string;
    connection: { type: string };
  }): HVACDevice {
    const addr = config.connection.type === "modbus_rtu" || config.connection.type === "modbus_tcp"
      ? `slave-${(config.connection as { slaveId?: number }).slaveId ?? 0}`
      : config.connection.type === "bacnet_ip" || config.connection.type === "bacnet_mstp"
        ? `device-${(config.connection as { deviceInstance?: number }).deviceInstance ?? 0}`
        : config.connection.type === "canbus"
          ? `can-${(config.connection as { interface?: string }).interface ?? "can0"}`
          : config.connection.type === "crestron_gateway"
            ? `crestron-${(config.connection as { host?: string }).host ?? "local"}`
            : "mock";
    return new HVACDevice(config.id, config.name, config.manufacturer, config.protocol, addr);
  }
}
