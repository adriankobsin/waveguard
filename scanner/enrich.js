/** MAC vendor prefix lookup (common AV / marine / IT vendors). */
export const VENDOR_MAP = {
  "00:00:0C": "Cisco",
  "00:01:42": "Cisco",
  "00:04:6B": "Cisco",
  "00:0A:41": "Cisco",
  "B8:27:EB": "Raspberry Pi",
  "DC:A6:32": "Raspberry Pi",
  "E4:5F:01": "Raspberry Pi",
  "00:50:56": "VMware",
  "00:0C:29": "VMware",
  "00:1C:42": "Parallels",
  "00:15:5D": "Microsoft Hyper-V",
  "00:03:FF": "Microsoft",
  "00:1A:11": "Google",
  "F4:F5:E8": "Google",
  "AC:BC:32": "Apple",
  "00:1B:63": "Apple",
  "00:1C:B3": "Apple",
  "3C:07:54": "Apple",
  "18:FE:34": "Espressif",
  "2C:F4:32": "Espressif",
  "A4:CF:12": "Espressif",
  "00:0F:BB": "MikroTik",
  "4C:5E:0C": "MikroTik",
  "48:8F:5A": "MikroTik",
  "00:1D:AA": "Dahua",
  "3C:EF:8C": "Dahua",
  "90:02:A9": "Dahua",
  "00:30:48": "Supermicro",
  "AC:1F:6B": "Supermicro",
  "00:50:BA": "D-Link",
  "00:19:5B": "D-Link",
  "1C:AF:F7": "D-Link",
  "00:1C:57": "Ubiquiti",
  "04:18:D6": "Ubiquiti",
  "24:A4:3C": "Ubiquiti",
  "00:23:EB": "Cisco Meraki",
  "0C:8D:DB": "Cisco Meraki",
  "88:15:44": "Cisco Meraki",
  "00:1D:E5": "AudioCodes",
  "00:90:8F": "AudioCodes",
  "00:40:9D": "Crestron",
  "00:10:7F": "Crestron",
  "00:50:C2": "DALI Gateway",
  "00:60:47": "Schneider Electric",
  "00:80:F4": "Schneider Electric",
  "00:1B:8F": "Synology",
  "00:11:32": "Synology",
  "00:17:88": "Philips Hue",
  "EC:B5:FA": "Philips",
  "00:07:32": "Siemens",
  "00:0E:8C": "Siemens",
  "00:1A:4B": "QSC",
  "00:16:E0": "QSC",
  "00:1D:FE": "APC/Schneider",
  "00:C0:B7": "APC",
};

export function lookupVendor(mac) {
  if (!mac) return "Unknown";
  const normalized = mac.toUpperCase().replace(/-/g, ":");
  const prefix6 = normalized.slice(0, 8);
  const prefix8 = normalized.slice(0, 11);
  return VENDOR_MAP[prefix8] || VENDOR_MAP[prefix6] || "Unknown";
}

export function guessCategory(hostname, vendor, ports) {
  const h = (hostname || "").toLowerCase();
  const v = (vendor || "").toLowerCase();
  if (h.includes("cam") || h.includes("nvr") || h.includes("ipc")) return "Camera";
  if (h.includes("ap-") || h.includes("uap") || h.includes("wifi") || v.includes("ubiquiti")) return "Network";
  if (h.includes("sw-") || h.includes("switch") || v.includes("cisco") || v.includes("mikrotik")) return "Network";
  if (h.includes("router") || h.includes("wan") || h.includes("fw-")) return "Network";
  if (h.includes("ups") || h.includes("apc")) return "Power";
  if (h.includes("nas") || h.includes("synology") || h.includes("qnap")) return "Server";
  if (h.includes("av-") || h.includes("crestron") || h.includes("qsys") || v.includes("crestron") || v.includes("qsc")) return "AV";
  if (h.includes("dali") || h.includes("knx") || h.includes("dmx") || h.includes("lutron")) return "Lighting";
  if (v.includes("raspberry")) return "Server";
  if (ports?.includes(80) || ports?.includes(443)) return "Network";
  return "Unknown";
}

export function parseSysDescr(descr) {
  if (!descr) return { vendor: "Unknown", model: "" };
  const parts = descr.split(/\s+/).filter(Boolean);
  return { vendor: parts[0] || "Unknown", model: parts.slice(1, 4).join(" ") || descr.slice(0, 80) };
}
