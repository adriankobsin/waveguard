/**
 * Client-side demo snapshot for the Cisco Wireless page.
 * Shape matches wlcRestconfClient.pollSnapshot() output.
 */

export function buildClientWlcMockSnapshot(conn = {}) {
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
      ],
      ssids: [
        { wlanId: 1, profileName: "CREW-WIFI", ssid: "Yacht-Crew", bssid: "E4:A4:1C:D8:BA:28", slot: 0 },
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
      clientCount: 2,
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
