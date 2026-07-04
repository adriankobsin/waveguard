/**
 * Mock Wireshark/tshark responses when tshark is not installed.
 */

const MOCK_INTERFACES = [
  { index: 1, name: "\\Device\\NPF_{MOCK-ETH0}", label: "1. eth0 (Mock Ethernet)" },
  { index: 2, name: "\\Device\\NPF_{MOCK-WLAN}", label: "2. wlan0 (Mock Wi-Fi)" },
  { index: 3, name: "\\Device\\NPF_Loopback", label: "3. Loopback (Mock)" },
];

function mockPackets(hostIp) {
  const dst = hostIp || "192.168.10.42";
  const now = Date.now();
  return [
    {
      num: 1,
      time: new Date(now - 4000).toISOString(),
      src: "192.168.10.1",
      dst,
      protocol: "ICMP",
      length: 74,
      info: "Echo (ping) request",
    },
    {
      num: 2,
      time: new Date(now - 3990).toISOString(),
      src: dst,
      dst: "192.168.10.1",
      protocol: "ICMP",
      length: 74,
      info: "Echo (ping) reply",
    },
    {
      num: 3,
      time: new Date(now - 2500).toISOString(),
      src: dst,
      dst: "8.8.8.8",
      protocol: "DNS",
      length: 82,
      info: "Standard query A vessel.local",
    },
    {
      num: 4,
      time: new Date(now - 2490).toISOString(),
      src: "8.8.8.8",
      dst,
      protocol: "DNS",
      length: 98,
      info: "Standard query response A 192.168.10.42",
    },
    {
      num: 5,
      time: new Date(now - 1200).toISOString(),
      src: dst,
      dst: "192.168.10.10",
      protocol: "TCP",
      length: 66,
      info: "443 → 52431 [SYN] Seq=0 Win=64240 Len=0 MSS=1460",
    },
    {
      num: 6,
      time: new Date(now - 1190).toISOString(),
      src: "192.168.10.10",
      dst,
      protocol: "TCP",
      length: 66,
      info: "52431 → 443 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=1460",
    },
  ];
}

export function mockWiresharkStatus() {
  return {
    success: true,
    available: false,
    mock: true,
    version: null,
    npcapHint:
      "Install Wireshark and Npcap on the scanner host, or use mock data for UI testing.",
    interfaces: MOCK_INTERFACES,
    source: "mock",
  };
}

export function mockWiresharkCapture({ hostIp, durationSec = 10, interface: iface } = {}) {
  const captureId = `mock-${Date.now()}`;
  const packets = mockPackets(hostIp);
  return {
    success: true,
    captureId,
    interface: iface || MOCK_INTERFACES[0].name,
    durationSec,
    hostIp: hostIp || null,
    bpfFilter: hostIp ? `host ${hostIp}` : null,
    packetCount: packets.length,
    packets,
    stats: mockCaptureStats(),
    source: "mock",
    capturedAt: new Date().toISOString(),
    message: "Mock capture — install tshark for live packet capture.",
  };
}

export function mockWiresharkAnalyze({ displayFilter, hostIp } = {}) {
  let packets = mockPackets(hostIp);
  if (displayFilter) {
    const f = displayFilter.toLowerCase();
    if (f.includes("dns")) packets = packets.filter((p) => p.protocol === "DNS");
    else if (f.includes("icmp")) packets = packets.filter((p) => p.protocol === "ICMP");
    else if (f.includes("tcp")) packets = packets.filter((p) => p.protocol === "TCP");
  }
  return {
    success: true,
    displayFilter: displayFilter || null,
    packetCount: packets.length,
    packets,
    stats: mockCaptureStats(),
    source: "mock",
    analyzedAt: new Date().toISOString(),
  };
}

export function mockCaptureStats() {
  return {
    protocolHierarchy: [
      { protocol: "eth", frames: 6, bytes: 460 },
      { protocol: "ip", frames: 6, bytes: 420 },
      { protocol: "icmp", frames: 2, bytes: 148 },
      { protocol: "udp", frames: 2, bytes: 180 },
      { protocol: "dns", frames: 2, bytes: 180 },
      { protocol: "tcp", frames: 2, bytes: 132 },
    ],
    conversations: [
      { addrA: "192.168.10.42", addrB: "192.168.10.1", frames: 2, bytes: 148, protocol: "ICMP" },
      { addrA: "192.168.10.42", addrB: "8.8.8.8", frames: 2, bytes: 180, protocol: "DNS" },
      { addrA: "192.168.10.42", addrB: "192.168.10.10", frames: 2, bytes: 132, protocol: "TCP" },
    ],
    endpoints: [
      { address: "192.168.10.42", frames: 6, bytes: 460 },
      { address: "192.168.10.1", frames: 2, bytes: 148 },
      { address: "8.8.8.8", frames: 2, bytes: 180 },
      { address: "192.168.10.10", frames: 2, bytes: 132 },
    ],
  };
}

export function mockWiresharkStats() {
  return {
    success: true,
    ...mockCaptureStats(),
    source: "mock",
  };
}
