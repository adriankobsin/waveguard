/**
 * Normalize Catalyst 9800 RESTCONF YANG JSON into a WaveGuard WLC snapshot.
 */

function firstArray(data, ...keys) {
  for (const key of keys) {
    const v = data?.[key];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return [v];
  }
  return [];
}

function maskToPrefix(mask) {
  if (!mask || typeof mask !== "string") return null;
  const parts = mask.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  let bits = 0;
  for (const octet of parts) {
    if (octet === 255) bits += 8;
    else if (octet === 254) bits += 7;
    else if (octet === 252) bits += 6;
    else if (octet === 248) bits += 5;
    else if (octet === 240) bits += 4;
    else if (octet === 224) bits += 3;
    else if (octet === 192) bits += 2;
    else if (octet === 128) bits += 1;
    else if (octet === 0) break;
    else return null;
  }
  return bits || null;
}

function subnetFromIpMask(ip, mask) {
  const prefix = maskToPrefix(mask);
  if (!ip || prefix == null) return null;
  return `${ip}/${prefix}`;
}

function normalizeMac(mac) {
  if (!mac) return "";
  return String(mac).toUpperCase().replace(/-/g, ":");
}

function apIdFromMac(mac) {
  return normalizeMac(mac).replace(/:/g, "").toLowerCase() || `ap-${Date.now()}`;
}

function parseVlanRef(vlan) {
  if (vlan == null || vlan === "") return { vlanId: null, vlanName: null };
  const s = String(vlan).trim();
  if (/^\d+$/.test(s)) return { vlanId: Number(s), vlanName: null };
  return { vlanId: null, vlanName: s };
}

function securitySummaryFromWlan(wlan) {
  const parts = [];
  if (wlan?.["security-wpa3"] || wlan?.securityWpa3) parts.push("WPA3");
  else if (wlan?.["security-wpa2"] || wlan?.securityWpa2) parts.push("WPA2");
  else if (wlan?.["security-wpa"] || wlan?.securityWpa) parts.push("WPA");
  if (wlan?.["security-owe"] || wlan?.securityOwe) parts.push("OWE");
  if (wlan?.psk || wlan?.["psk-key"]) parts.push("PSK");
  return parts.length ? parts.join(" + ") : "Open / unknown";
}

/**
 * Build WLAN → policy profile → VLAN mapping from policy tags and profiles.
 */
export function buildWlanVlanMap({ wlanEntries = [], policyProfiles = [], policyTags = [] } = {}) {
  const profileVlan = new Map();
  for (const pp of policyProfiles) {
    const name = pp["policy-profile-name"] || pp.policyProfileName;
    if (!name) continue;
    const vlanRaw = pp.vlan ?? pp["vlan-id"] ?? pp.interfaceName;
    profileVlan.set(name, parseVlanRef(vlanRaw));
  }

  const wlanToPolicy = new Map();
  for (const tag of policyTags) {
    const policies = tag["wlan-policies"]?.["wlan-policy"] || tag.wlanPolicies?.wlanPolicy || [];
    const list = Array.isArray(policies) ? policies : policies ? [policies] : [];
    for (const wp of list) {
      const wlanProfile = wp["wlan-profile-name"] || wp.wlanProfileName;
      const policyProfile = wp["policy-profile-name"] || wp.policyProfileName;
      if (wlanProfile && policyProfile) {
        wlanToPolicy.set(wlanProfile, policyProfile);
      }
    }
  }

  const map = new Map();
  for (const wlan of wlanEntries) {
    const profileName = wlan["profile-name"] || wlan.profileName;
    if (!profileName) continue;
    const policyProfile = wlanToPolicy.get(profileName) || null;
    const vlanInfo = policyProfile ? profileVlan.get(policyProfile) : null;
    map.set(profileName, { policyProfile, ...vlanInfo });
  }
  return map;
}

/**
 * Index VLAN interfaces by id and name for subnet lookup.
 */
export function indexVlanInterfaces(nativeInterfaces = []) {
  const byId = new Map();
  const byName = new Map();
  for (const iface of nativeInterfaces) {
    const name = iface.name || iface["interface-name"];
    if (!name || !String(name).toLowerCase().startsWith("vlan")) continue;
    const idMatch = String(name).match(/vlan(\d+)/i);
    const vlanId = idMatch ? Number(idMatch[1]) : null;
    const ip = iface.ip?.address || iface["ip-address"] || iface["ip-address-primary"]?.address;
    const mask = iface.ip?.mask || iface["ip-mask"] || iface["ip-address-primary"]?.mask;
    const entry = {
      vlanId,
      vlanName: name,
      interfaceIp: ip || null,
      subnetCidr: subnetFromIpMask(ip, mask),
    };
    if (vlanId != null) byId.set(vlanId, entry);
    byName.set(String(name).toLowerCase(), entry);
    if (vlanId != null) byName.set(String(vlanId), entry);
  }
  return { byId, byName };
}

function resolveSubnet(vlanInfo, vlanIndex) {
  if (!vlanInfo) return { interfaceIp: null, subnetCidr: null };
  const { byId, byName } = vlanIndex;
  if (vlanInfo.vlanId != null && byId.has(vlanInfo.vlanId)) {
    const e = byId.get(vlanInfo.vlanId);
    return { interfaceIp: e.interfaceIp, subnetCidr: e.subnetCidr };
  }
  if (vlanInfo.vlanName && byName.has(String(vlanInfo.vlanName).toLowerCase())) {
    const e = byName.get(String(vlanInfo.vlanName).toLowerCase());
    return { interfaceIp: e.interfaceIp, subnetCidr: e.subnetCidr };
  }
  if (vlanInfo.vlanName && byName.has(String(vlanInfo.vlanName))) {
    const e = byName.get(String(vlanInfo.vlanName));
    return { interfaceIp: e.interfaceIp, subnetCidr: e.subnetCidr };
  }
  return { interfaceIp: null, subnetCidr: null };
}

/**
 * @param {object} raw - collected RESTCONF responses
 * @param {object} conn - connection metadata
 */
export function buildWlcSnapshot(raw, conn = {}) {
  const polledAt = new Date().toISOString();
  const host = conn.host || "";

  const apNameMac = firstArray(
    raw.apNameMac || {},
    "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map",
    "ap-name-mac-map"
  );
  const joinStats = firstArray(
    raw.apJoinStats || {},
    "Cisco-IOS-XE-wireless-ap-global-oper:ap-join-stats",
    "ap-join-stats"
  );
  const wlanEntries = firstArray(
    raw.wlanCfg || {},
    "Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-entry",
    "wlan-cfg-entry"
  );
  const policyProfiles = firstArray(
    raw.policyProfiles || {},
    "Cisco-IOS-XE-wireless-policy-cfg:policy-profile",
    "policy-profile"
  );
  const policyTags = firstArray(
    raw.policyTags || {},
    "Cisco-IOS-XE-wireless-tag-cfg:policy-tag",
    "policy-tag"
  );
  const nativeIfaces = firstArray(
    raw.nativeInterfaces || {},
    "Cisco-IOS-XE-native:interface",
    "interface"
  );

  const joinByMac = new Map();
  for (const js of joinStats) {
    const mac = normalizeMac(js["wtp-mac"] || js.wtpMac);
    if (!mac) continue;
    const joinInfo = js["ap-join-info"] || js.apJoinInfo || js;
    const isJoined = joinInfo["is-joined"] ?? joinInfo.isJoined;
    joinByMac.set(mac, {
      isJoined: isJoined === true || isJoined === "true",
      joinError: joinInfo["last-error-type"] || joinInfo.lastErrorType || js["ap-disconnect-reason"] || null,
      apName: joinInfo["ap-name"] || joinInfo.apName || null,
      apIp: joinInfo["ap-ip-addr"] || joinInfo.apIpAddr || null,
    });
  }

  const capwapByMac = raw.capwapByMac || {};
  const operByMac = raw.operByMac || {};
  const radioByMac = raw.radioByMac || {};

  const wlanVlanMap = buildWlanVlanMap({ wlanEntries, policyProfiles, policyTags });
  const vlanIndex = indexVlanInterfaces(nativeIfaces);

  const accessPoints = apNameMac.map((row) => {
    const wtpMac = normalizeMac(row["wtp-mac"] || row.wtpMac);
    const ethMac = normalizeMac(row["eth-mac"] || row.ethMac);
    const name = row["wtp-name"] || row.wtpName || joinByMac.get(wtpMac)?.apName || wtpMac;
    const join = joinByMac.get(wtpMac);
    const capwap = capwapByMac[wtpMac];
    const oper = operByMac[wtpMac];
    const radios = radioByMac[wtpMac] || [];

    const capEntry = capwap
      ? firstArray(capwap, "Cisco-IOS-XE-wireless-access-point-oper:capwap-data", "capwap-data")[0]
      : null;
    const operEntry = oper
      ? firstArray(oper, "Cisco-IOS-XE-wireless-access-point-oper:oper-data", "oper-data")[0]
      : null;

    const deviceDetail = capEntry?.["device-detail"] || capEntry?.deviceDetail;
    const tagInfo = capEntry?.["tag-info"]?.["resolved-tag-info"] || capEntry?.tagInfo?.resolvedTagInfo;
    const apIpData = operEntry?.["ap-ip-data"] || operEntry?.apIpData;

    let status = "unknown";
    if (join?.isJoined === true) status = "online";
    else if (join?.isJoined === false) status = "offline";

    const ssids = [];
    for (const radio of radios) {
      const vapList = radio["vap-oper-config"] || radio.vapOperConfig || [];
      const vaps = Array.isArray(vapList) ? vapList : vapList ? [vapList] : [];
      for (const vap of vaps) {
        ssids.push({
          wlanId: vap["wlan-id"] ?? vap.wlanId,
          profileName: vap["wlan-profile-name"] || vap.wlanProfileName,
          ssid: vap.ssid || "",
          bssid: normalizeMac(vap["bssid-mac"] || vap.bssidMac) || null,
          slot: radio.slot ?? radio["radio-slot-id"],
        });
      }
    }

    return {
      id: apIdFromMac(wtpMac),
      name,
      wtpMac,
      ethMac,
      status,
      joinError: join?.joinError || null,
      ip: apIpData?.["ap-ip-addr"] || apIpData?.apIpAddr || join?.apIp || null,
      model:
        deviceDetail?.["static-info"]?.["ap-models"]?.model ||
        deviceDetail?.staticInfo?.apModels?.model ||
        null,
      serial:
        deviceDetail?.["static-info"]?.["board-data"]?.["wtp-serial-num"] ||
        deviceDetail?.staticInfo?.boardData?.wtpSerialNum ||
        null,
      swVersion:
        deviceDetail?.["wtp-version"]?.["sw-version"] ||
        deviceDetail?.wtpVersion?.swVersion ||
        null,
      siteTag: tagInfo?.["resolved-site-tag"] || tagInfo?.resolvedSiteTag || null,
      policyTag: tagInfo?.["resolved-policy-tag"] || tagInfo?.resolvedPolicyTag || null,
      radios: radios.map((r) => ({
        slot: r.slot ?? r["radio-slot-id"] ?? 0,
        band: r.band || r["radio-band"] || null,
        channel: r.channel ?? r["curr-freq"] ?? null,
        txPower: r.txPower ?? r["current-tx-power-level"] ?? null,
        clientCount: r.clientCount ?? r["stations"] ?? null,
        channelUtil: r.channelUtil ?? r["cca-util-percentage"] ?? null,
      })),
      ssids,
    };
  });

  const wlans = wlanEntries.map((wlan) => {
    const profileName = wlan["profile-name"] || wlan.profileName;
    const ssid = wlan.ssid || wlan["ssid-name"] || profileName;
    const wlanId = wlan["wlan-id"] ?? wlan.wlanId;
    const enabled = wlan["admin-status"] !== "DOWN" && wlan["admin-status"] !== false;
    const vlanInfo = wlanVlanMap.get(profileName) || {};
    const subnet = resolveSubnet(vlanInfo, vlanIndex);
    const clientCount = accessPoints.reduce((sum, ap) => {
      const match = ap.ssids?.filter((s) => s.profileName === profileName || s.wlanId === wlanId);
      return sum + (match?.length ? 1 : 0);
    }, 0);

    return {
      wlanId,
      profileName,
      ssid,
      enabled,
      securitySummary: securitySummaryFromWlan(wlan),
      policyProfile: vlanInfo.policyProfile || null,
      vlanId: vlanInfo.vlanId ?? null,
      vlanName: vlanInfo.vlanName || (vlanInfo.vlanId != null ? `Vlan${vlanInfo.vlanId}` : null),
      interfaceIp: subnet.interfaceIp,
      subnetCidr: subnet.subnetCidr,
      clientCount,
    };
  });

  const apOnline = accessPoints.filter((a) => a.status === "online").length;
  const apOffline = accessPoints.filter((a) => a.status === "offline").length;
  const clientCount = accessPoints.reduce(
    (sum, ap) => sum + (ap.radios?.reduce((rs, r) => rs + (Number(r.clientCount) || 0), 0) || 0),
    0
  );

  return {
    controller: {
      host,
      model: raw.controllerInfo?.model || "Catalyst 9800 WLC",
      swVersion: raw.controllerInfo?.swVersion || null,
      polledAt,
      reachable: true,
    },
    summary: {
      apTotal: accessPoints.length,
      apOnline,
      apOffline,
      wlanCount: wlans.length,
      clientCount,
    },
    accessPoints,
    wlans,
  };
}

export function buildMockWlcSnapshot(conn = {}) {
  const host = conn.host || "192.168.10.1";
  const polledAt = new Date().toISOString();

  const accessPoints = [
    {
      id: "ap344aft",
      name: "AP Ext. - 344 Aft",
      wtpMac: "E4:A4:1C:D8:BA:3C",
      ethMac: "E4:A4:1C:D8:BA:3D",
      status: "online",
      joinError: null,
      ip: "192.168.20.44",
      model: "C9120AXI-E",
      serial: "FCW2645X0AP1",
      swVersion: "17.12.4",
      siteTag: "Yacht-Site",
      policyTag: "Yacht-Policy",
      radios: [
        { slot: 0, band: "5GHz", channel: 36, txPower: 4, clientCount: 8, channelUtil: 22 },
        { slot: 1, band: "2.4GHz", channel: 1, txPower: 5, clientCount: 3, channelUtil: 15 },
      ],
      ssids: [
        { wlanId: 1, profileName: "CREW-WIFI", ssid: "Yacht-Crew", bssid: "E4:A4:1C:D8:BA:3C", slot: 0 },
        { wlanId: 2, profileName: "GUEST-WIFI", ssid: "Yacht-Guest", bssid: "E4:A4:1C:D8:BA:3E", slot: 0 },
      ],
    },
    {
      id: "ap400aft",
      name: "AP Ext. - 400 Aft",
      wtpMac: "E4:A4:1C:D8:BA:28",
      ethMac: "E4:A4:1C:D8:BA:29",
      status: "online",
      joinError: null,
      ip: "192.168.20.45",
      model: "C9120AXI-E",
      serial: "FCW2645X0AP2",
      swVersion: "17.12.4",
      siteTag: "Yacht-Site",
      policyTag: "Yacht-Policy",
      radios: [
        { slot: 0, band: "5GHz", channel: 40, txPower: 4, clientCount: 12, channelUtil: 35 },
        { slot: 1, band: "2.4GHz", channel: 6, txPower: 5, clientCount: 5, channelUtil: 28 },
      ],
      ssids: [
        { wlanId: 1, profileName: "CREW-WIFI", ssid: "Yacht-Crew", bssid: "E4:A4:1C:D8:BA:28", slot: 0 },
        { wlanId: 3, profileName: "OWNER-WIFI", ssid: "Yacht-Owner", bssid: "E4:A4:1C:D8:BA:2A", slot: 0 },
      ],
    },
    {
      id: "ap500aft",
      name: "AP Ext. - 500 Aft",
      wtpMac: "E4:A4:1C:D8:B4:78",
      ethMac: "E4:A4:1C:D8:B4:79",
      status: "offline",
      joinError: "Heartbeat timeout",
      ip: null,
      model: "C9120AXI-E",
      serial: "FCW2645X0AP3",
      swVersion: "17.12.4",
      siteTag: "Yacht-Site",
      policyTag: "Yacht-Policy",
      radios: [],
      ssids: [],
    },
    {
      id: "ap303cor",
      name: "AP - 303 Corridor",
      wtpMac: "AC:C3:E5:1E:A0:50",
      ethMac: "AC:C3:E5:1E:A0:51",
      status: "online",
      joinError: null,
      ip: "192.168.20.46",
      model: "C9136I",
      serial: "FCW2645X0AP4",
      swVersion: "17.12.4",
      siteTag: "Yacht-Site",
      policyTag: "Yacht-Policy",
      radios: [
        { slot: 0, band: "5GHz", channel: 149, txPower: 3, clientCount: 18, channelUtil: 42 },
        { slot: 1, band: "2.4GHz", channel: 11, txPower: 4, clientCount: 7, channelUtil: 31 },
      ],
      ssids: [
        { wlanId: 1, profileName: "CREW-WIFI", ssid: "Yacht-Crew", bssid: "AC:C3:E5:1E:A0:50", slot: 0 },
        { wlanId: 2, profileName: "GUEST-WIFI", ssid: "Yacht-Guest", bssid: "AC:C3:E5:1E:A0:52", slot: 0 },
      ],
    },
  ];

  const wlans = [
    {
      wlanId: 1,
      profileName: "CREW-WIFI",
      ssid: "Yacht-Crew",
      enabled: true,
      securitySummary: "WPA2 + 802.1X",
      policyProfile: "CREW-POLICY",
      vlanId: 20,
      vlanName: "Vlan20",
      interfaceIp: "192.168.20.1",
      subnetCidr: "192.168.20.0/24",
      clientCount: 3,
    },
    {
      wlanId: 2,
      profileName: "GUEST-WIFI",
      ssid: "Yacht-Guest",
      enabled: true,
      securitySummary: "WPA2 PSK",
      policyProfile: "GUEST-POLICY",
      vlanId: 30,
      vlanName: "Vlan30",
      interfaceIp: "192.168.30.1",
      subnetCidr: "192.168.30.0/24",
      clientCount: 2,
    },
    {
      wlanId: 3,
      profileName: "OWNER-WIFI",
      ssid: "Yacht-Owner",
      enabled: true,
      securitySummary: "WPA3",
      policyProfile: "OWNER-POLICY",
      vlanId: 10,
      vlanName: "Vlan10",
      interfaceIp: "192.168.10.1",
      subnetCidr: "192.168.10.0/24",
      clientCount: 1,
    },
  ];

  const apOnline = accessPoints.filter((a) => a.status === "online").length;
  const clientCount = accessPoints.reduce(
    (sum, ap) => sum + ap.radios.reduce((rs, r) => rs + (r.clientCount || 0), 0),
    0
  );

  return {
    controller: {
      host,
      model: "C9800-CL-K9",
      swVersion: "17.12.4",
      polledAt,
      reachable: true,
    },
    summary: {
      apTotal: accessPoints.length,
      apOnline,
      apOffline: accessPoints.length - apOnline,
      wlanCount: wlans.length,
      clientCount,
    },
    accessPoints,
    wlans,
  };
}
