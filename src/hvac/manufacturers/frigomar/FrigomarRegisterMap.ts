import type { RegisterMap } from "../../core/HVACTypes";

export const FRIGOMAR_DEFAULT_REGISTER_MAP: RegisterMap = {
  currentTemperature: { address: 1001, type: "holding", scale: 0.1, unit: "celsius", readOnly: true },
  targetTemperature: { address: 1002, type: "holding", scale: 0.1, unit: "celsius", readOnly: false },
  powerState: { address: 1003, type: "coil", readOnly: false },
  mode: {
    address: 1004, type: "holding", readOnly: false,
    mapping: { "0": "off", "1": "cool", "2": "heat", "3": "auto", "4": "fan_only" },
  },
  fanSpeed: {
    address: 1005, type: "holding", readOnly: false,
    mapping: { "0": "auto", "1": "low", "2": "medium", "3": "high" },
  },
  humidity: { address: 1006, type: "holding", scale: 0.1, unit: "percent", readOnly: true },
  valveStatus: { address: 1007, type: "holding", scale: 1, unit: "percent", readOnly: true },
  compressorStatus: { address: 1008, type: "coil", readOnly: true },
  alarmCode: { address: 1010, type: "holding", readOnly: true },
};
