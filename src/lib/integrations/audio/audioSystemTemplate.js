export const AUDIO_SYSTEM_TYPES = {
  QSYS: "qsys",
  SYMETRIX: "symetrix",
  CRESTRON_NAX: "crestron-nax",
};

export const AUDIO_SYSTEM_LABELS = {
  qsys: "Q-SYS (QSC)",
  symetrix: "Symetrix (Edge / Radius / Prism / Solus NX)",
  "crestron-nax": "Crestron DM NAX",
};

export const AUDIO_PROTOCOLS = {
  qsys: ["qrc", "reflect", "management"],
  symetrix: ["composer-tcp", "composer-udp", "rs232"],
  "crestron-nax": ["rest", "websocket"],
};

export const AUDIO_DEFAULT_PORTS = {
  qsys: { qrc: 1710, "ecp-legacy": 1702, management: 443 },
  symetrix: { "composer-tcp": 1024, "composer-udp": 1024, rs232: 0 },
  "crestron-nax": { rest: 443, websocket: 443 },
};

export const AUDIO_DEFAULT_CREDENTIALS = {
  qsys: { username: "", password: "" },
  symetrix: { username: "", password: "" },
  "crestron-nax": { username: "admin", password: "" },
};

export const AUDIO_SYSTEM_DESCRIPTIONS = {
  qsys:
    "Q-SYS Core processor via QRC (JSON-RPC over TCP port 1710). Supports Named Controls, Component control, Mixer control, Change Groups, and Snapshots.",
  symetrix:
    "Symetrix DSP via Composer Control Protocol (Telnet TCP/UDP). Supports controller-number-based fader/button/meter control, presets, and push subscriptions.",
  "crestron-nax":
    "Crestron DM NAX streaming amplifier/processor via CresNext REST API over HTTPS. Supports zone control, amplifier monitoring, streaming services, and AoIP routing.",
};

export function integrationIdFromHref(href, systemType = "qsys") {
  if (!href) return null;
  if (systemType === "qsys") {
    const m = /\/(?:component|control|named)\/(.+)/.exec(String(href));
    return m ? m[1] : null;
  }
  if (systemType === "symetrix") {
    const m = /\/controller\/(\d+)/.exec(String(href));
    return m ? m[1] : null;
  }
  if (systemType === "crestron-nax") {
    const m = /\/(?:zone|input|output|amplifier)\/(\d+)/.exec(String(href));
    return m ? m[1] : null;
  }
  const m = /\/([\w-]+)$/.exec(String(href));
  return m ? m[1] : String(href).split("/").filter(Boolean).pop() || null;
}
