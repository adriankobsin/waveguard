import type { RegisterMap } from "../../core/HVACTypes";

export const DOMETIC_DEFAULT_REGISTER_MAP: RegisterMap = {
  currentTemperature: { address: 2001, type: "holding", scale: 0.1, unit: "celsius", readOnly: true },
  targetTemperature: { address: 2002, type: "holding", scale: 0.1, unit: "celsius", readOnly: false },
  powerState: { address: 2003, type: "coil", readOnly: false },
  mode: {
    address: 2004, type: "holding", readOnly: false,
    mapping: { "0": "off", "1": "cool", "2": "heat", "3": "auto", "4": "dry", "5": "fan_only" },
  },
  fanSpeed: {
    address: 2005, type: "holding", readOnly: false,
    mapping: { "0": "auto", "1": "low", "2": "medium", "3": "high" },
  },
  humidity: { address: 2006, type: "holding", scale: 0.1, unit: "percent", readOnly: true },
  compressorStatus: { address: 2007, type: "coil", readOnly: true },
  alarmCode: { address: 2010, type: "holding", readOnly: true },
};
