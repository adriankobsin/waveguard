/**
 * Lighting System Integration Template
 *
 * Every lighting system type (Lutron, KNX, DALI, DMX, etc.) follows this
 * interface. Create an adapter per system type in a subdirectory under
 * src/lib/integrations/ and register it in lightingRegistry.js.
 *
 * An adapter can run in two modes:
 *   - mock: an in-memory engine that simulates zone/scene/button state.
 *   - live: connects to a real processor/controller via its native protocol.
 *
 * Each adapter module exports:
 *   buildMockEngine()  → MockEngine instance
 *   createClient(conn) → LiveClient instance (or null if conn is incomplete)
 *
 * MockEngine interface:
 *   setZoneLevel(href, level, fadeSeconds) → { href, level, on, updatedAt, fade }
 *   raiseLower(href, action)             → { href, level, on, updatedAt }
 *   activateScene(href, sceneZones)      → { sceneHref, zones: [...] }
 *   pressButton(href)                    → { buttonHref, pressedAt }
 *   pollZones(hrefs)                     → [{ href, level, on, updatedAt }]
 *   snapshot()                           → { zones, activeScene, ... }
 *
 * LiveClient interface:
 *   connect()                                 → Promise<void>
 *   isReady()                                 → boolean
 *   setOutput(id, level, fadeSeconds)         → Promise<{ id, level, on, updatedAt }>
 *   raiseLower(id, action)                    → Promise<void>
 *   activateAreaScene(areaId, sceneNumber)    → Promise<void>
 *   pressButton(deviceId, componentId)        → Promise<{ deviceId, componentId, pressedAt }>
 *   getOutput(id)                             → Promise<{ id, level, on }>
 *   pollOutputs(ids)                          → Promise<[{ id, level, on }]>
 *   ping()                                    → Promise<void>
 *   dispose()                                 → void
 *
 * Port probe interface (probe template):
 *   probePorts(host, timeoutMs) → [{ port, label, role, open }]
 *   recommendationFromPorts(ports, protocol) → string | null
 */
export const LIGHTING_SYSTEM_TYPES = {
  LUTRON: "lutron",
  KNX: "knx",
  DALI: "dali",
  DMX: "dmx",
  YACHTICA: "yachtica",
};

export const LIGHTING_SYSTEM_LABELS = {
  lutron: "Lutron (HomeWorks QSX / Athena / RadioRA 3)",
  knx: "KNX (EIB / KNX IP) + HVAC",
  dali: "DALI (IEC 62386)",
  dmx: "DMX512 (ENTTEC / Art-Net / sACN)",
  yachtica: "Yachtica (Lighting TCP Gateway)",
};

export const LIGHTING_PROTOCOLS = {
  lutron: ["telnet", "leap"],
  knx: ["knx-ip", "knx-tunnelling"],
  dali: ["dali-usb", "dali-ip"],
  dmx: ["art-net", "sacn", "enttec-usb"],
  yachtica: ["yachtica-tcp"],
};

export const LIGHTING_DEFAULT_PORTS = {
  lutron: { telnet: 23, leap: 8081 },
  knx: { "knx-ip": 3671, "knx-tunnelling": 3671 },
  dali: { "dali-usb": 0, "dali-ip": 5582 },
  dmx: { "art-net": 6454, "sacn": 5568, "enttec-usb": 0 },
  yachtica: { "yachtica-tcp": 5000 },
};

export const LIGHTING_DEFAULT_CREDENTIALS = {
  lutron: { username: "lutron", password: "integration" },
  knx: { username: "", password: "" },
  dali: { username: "", password: "" },
  dmx: { username: "", password: "" },
  yachtica: { username: "", password: "" },
};

export const LIGHTING_SYSTEM_DESCRIPTIONS = {
  lutron: "Lutron HomeWorks QSX, Athena, or RadioRA 3 processor via Telnet or LEAP.",
  knx: "KNX IP gateway or router using tunnelling or routing (port 3671). Supports lighting and HVAC DPTs (temperature, setpoint, mode).",
  dali: "DALI-2 USB gateway or IP bridge (IEC 62386).",
  dmx: "DMX512 controller via Art-Net, sACN, or ENTTEC USB Pro.",
  yachtica: "Yachtica lighting TCP gateway (port 5000). Supports up to 64 addresses × 8 channels of dimmers, relays, scenes (56), and keypad inputs per gateway.",
};

/**
 * Extract a numeric integration ID from a LEAP-style href.
 * Each system type may override this parser.
 */
export function integrationIdFromHref(href, systemType = "lutron") {
  if (!href) return null;
  if (systemType === "knx") {
    const m = /\/(?:zone|group|device)\/([\d.]+)/.exec(String(href));
    return m ? m[1] : null;
  }
  if (systemType === "dali") {
    const m = /\/(?:zone|ballast|group)\/(\d+)/.exec(String(href));
    return m ? m[1] : null;
  }
  if (systemType === "yachtica") {
    return String(href);
  }
  if (systemType === "dmx") {
    const m = /\/(?:zone|fixture|channel)\/(\d+)/.exec(String(href));
    return m ? m[1] : null;
  }
  // Lutron default
  const m = /\/(?:zone|area|areascene|device|button|led)\/(\d+)/.exec(String(href));
  return m ? m[1] : String(href).split("/").filter(Boolean).pop() || null;
}
