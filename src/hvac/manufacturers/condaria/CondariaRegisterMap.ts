import type { RegisterMap } from "../../core/HVACTypes";

export const CONDARIA_DEFAULT_REGISTER_MAP: RegisterMap = {
  currentTemperature: { address: 3001, type: "holding", scale: 0.1, unit: "celsius", readOnly: true },
  targetTemperature: { address: 3002, type: "holding", scale: 0.1, unit: "celsius", readOnly: false },
  powerState: { address: 3003, type: "coil", readOnly: false },
  mode: {
    address: 3004, type: "holding", readOnly: false,
    mapping: { "0": "off", "1": "cool", "2": "heat", "3": "auto" },
  },
  fanSpeed: {
    address: 3005, type: "holding", readOnly: false,
    mapping: { "0": "auto", "1": "low", "2": "medium", "3": "high" },
  },
  alarmCode: { address: 3010, type: "holding", readOnly: true },
};
