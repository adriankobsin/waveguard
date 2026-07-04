# Marine HVAC Abstraction Layer

A modular, protocol-agnostic HVAC middleware layer for the WaveGuard yacht control platform. Supports multiple marine HVAC brands and protocols through a unified API.

## Architecture

```
src/hvac/
├── core/                    # Core types, models, and service
│   ├── HVACTypes.ts         # All shared TypeScript types
│   ├── HVACZone.ts          # Zone state model
│   ├── HVACDevice.ts        # Device identity model
│   ├── HVACService.ts       # Main orchestrator (polling, validation, writes)
│   ├── HVACRegistry.ts      # Factory/registry for adapters
│   ├── HVACMapper.ts        # Register/BACnet/CAN value mapping
│   └── index.ts             # Barrel exports
├── protocols/               # Protocol-level adapters
│   ├── modbus/
│   │   ├── ModbusRTUAdapter.ts
│   │   └── ModbusTCPAdapter.ts
│   ├── bacnet/
│   │   ├── BACnetIPAdapter.ts
│   │   └── BACnetMSTPAdapter.ts
│   ├── canbus/
│   │   └── CANBusAdapter.ts
│   ├── crestron/
│   │   └── CrestronGatewayAdapter.ts  # Crestron 4-Series/VC-4 REST + Modbus fallback
│   └── MockHVACAdapter.ts   # Simulated adapter for testing
├── manufacturers/           # Brand-specific overrides
│   ├── frigomar/
│   │   ├── FrigomarAdapter.ts
│   │   └── FrigomarRegisterMap.ts
│   ├── dometic/
│   │   ├── DometicAdapter.ts
│   │   └── DometicRegisterMap.ts
│   ├── condaria/
│   │   ├── CondariaAdapter.ts
│   │   └── CondariaRegisterMap.ts
│   └── generic/
│       ├── GenericModbusHVACAdapter.ts
│       └── GenericBACnetHVACAdapter.ts
├── api/
│   ├── hvacRoutes.ts        # Express-style router
│   └── hvacController.ts    # Adapter registration + service factory
├── config/
│   └── hvacConfig.example.json
├── components/
│   ├── HVACZoneCard.jsx     # Zone card with full controls
│   ├── HVACSystemStatus.jsx # System health summary
│   ├── HVACDiagnosticsModal.jsx # Engineer diagnostics view
│   └── HVACEmptyState.jsx   # Empty state placeholder
└── README.md
```

## Protocol Support

| Protocol | Adapter | Status |
|----------|---------|--------|
| Modbus RTU (RS485) | `ModbusRTUAdapter` | Implemented |
| Modbus TCP | `ModbusTCPAdapter` | Implemented |
| BACnet/IP | `BACnetIPAdapter` | Implemented |
| BACnet MSTP | `BACnetMSTPAdapter` | Implemented |
| CANBus | `CANBusAdapter` | Implemented |
| Crestron Gateway | `CrestronGatewayAdapter` | Implemented |
| Mock (testing) | `MockHVACAdapter` | Implemented |

## Manufacturer Support

| Brand | Adapter | Protocol | Notes |
|-------|---------|----------|-------|
| Frigomar | `FrigomarAdapter` | Modbus RTU | Register map at 0x03E9+ |
| Dometic | `DometicAdapter` | Modbus RTU/TCP | Register map at 0x07D1+ |
| Condaria | `CondariaAdapter` | Modbus RTU/BACnet | Register map at 0x0BB9+ |
| Generic Modbus | `GenericModbusHVACAdapter` | Modbus RTU/TCP | Config-driven register map |
| Generic BACnet | `GenericBACnetHVACAdapter` | BACnet IP/MSTP | Config-driven object map |

## Adding a New HVAC Manufacturer

1. Create a directory under `src/hvac/manufacturers/<name>/`
2. Create a register map file (if using Modbus):
   ```ts
   // MyBrandRegisterMap.ts
   import type { RegisterMap } from "../../core/HVACTypes";
   export const MY_BRAND_REGISTER_MAP: RegisterMap = { ... };
   ```
3. Create an adapter class:
   ```ts
   // MyBrandAdapter.ts
   import { ModbusRTUAdapter } from "../../protocols/modbus/ModbusRTUAdapter";
   import { MY_BRAND_REGISTER_MAP } from "./MyBrandRegisterMap";
   import type { ZoneConfig } from "../../core/HVACTypes";
   
   export class MyBrandAdapter extends ModbusRTUAdapter {
     constructor(config: ZoneConfig) {
       const enriched: ZoneConfig = {
         ...config,
         registerMap: config.registerMap ?? MY_BRAND_REGISTER_MAP,
         supportedModes: config.supportedModes ?? ["off", "cool", "heat"],
         minSetpoint: config.minSetpoint ?? 16,
         maxSetpoint: config.maxSetpoint ?? 30,
       };
       super(enriched);
     }
   }
   ```
4. Register it in `src/hvac/api/hvacController.ts`:
   ```ts
   import { MyBrandAdapter } from "../manufacturers/mybrand/MyBrandAdapter";
   registerManufacturerAdapter("mybrand", (cfg) => new MyBrandAdapter(cfg));
   ```
5. Add zone definitions to the config file.

## Adding a New Protocol

1. Create a directory under `src/hvac/protocols/<name>/`
2. Implement the `HVACProtocolAdapter` interface:
   ```ts
   import type { HVACProtocolAdapter } from "../../core/HVACService";
   import type { HVACMode, HVACFanSpeed, HVACZoneState, HVACDiagnostics } from "../../core/HVACTypes";
   
   export class MyProtocolAdapter implements HVACProtocolAdapter {
     async connect(): Promise<void> { /* ... */ }
     async disconnect(): Promise<void> { /* ... */ }
     isConnected(): boolean { /* ... */ }
     async readZone(zoneId: string): Promise<HVACZoneState> { /* ... */ }
     async writePower(zoneId: string, power: boolean): Promise<void> { /* ... */ }
     async writeSetpoint(zoneId: string, temperature: number): Promise<void> { /* ... */ }
     async writeMode(zoneId: string, mode: HVACMode): Promise<void> { /* ... */ }
     async writeFanSpeed(zoneId: string, fanSpeed: HVACFanSpeed): Promise<void> { /* ... */ }
     async readDiagnostics(zoneId: string): Promise<HVACDiagnostics> { /* ... */ }
   }
   ```
3. Register it:
   ```ts
   import { MyProtocolAdapter } from "../protocols/myprotocol/MyProtocolAdapter";
   registerProtocolAdapter("my_protocol", (cfg) => new MyProtocolAdapter(cfg));
   ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hvac/zones` | All zones |
| GET | `/api/hvac/zones/:id` | Single zone |
| POST | `/api/hvac/zones/:id/power` | `{ "power": true/false }` |
| POST | `/api/hvac/zones/:id/setpoint` | `{ "temperature": 22 }` (16-30°C) |
| POST | `/api/hvac/zones/:id/mode` | `{ "mode": "cool" }` |
| POST | `/api/hvac/zones/:id/fan` | `{ "fanSpeed": "auto" }` |
| GET | `/api/hvac/zones/:id/diagnostics` | Raw protocol data |
| GET | `/api/hvac/system/status` | Global status |

## Safety Limits

- **Setpoint range**: 16°C – 30°C (configurable per zone)
- **Mode validation**: Unsupported modes are rejected per manufacturer
- **Offline guard**: Writes to offline zones are rejected unless `forceWrite: true` in config
- **Client validation**: Frontend validates all inputs before sending

## Mock Mode

When the mock server is running, HVAC data is simulated with:
- 10 yacht zones (8 standard + 2 Crestron Gateway zones: Owner Cabin Crestron, VIP Cabin Crestron)
- Random temperature drift every 3 seconds
- 2% random read failures
- 5% random write failures
- 10% random delayed responses (200-500ms)
- Guest Cabin Starboard starts offline with an alarm
- Crestron gateway simulation at /cws/api with CP4 device info, analog/digital register endpoints
