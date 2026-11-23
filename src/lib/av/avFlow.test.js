import { describe, it, expect } from "vitest";
import { buildAvFlowDemo } from "./avFlowDemo";
import { buildAvFlow, classifyGroup, portKey } from "./avFlowModel";

describe("AV flow model", () => {
  const flow = buildAvFlowDemo();
  it("links decoders to encoders and finds planted faults", () => {
    const enc = flow.streams.find((s) => s.id === "nvx:192.168.40.22");
    expect(enc.receivers.map((r) => r.name).sort()).toEqual(["DEC-Cinema-Projector", "DEC-Owner-TV"]);
    const titles = flow.findings.map((f) => f.title).join("\n");
    expect(titles).toMatch(/DEC-Sky-Lounge linked at 100 Mb\/s/);
    expect(titles).toMatch(/ENC-Sky-Deck-TV: no video on the HDMI input/);
    expect(titles).toMatch(/DEC-Cinema-Projector hasn't joined 239.8.0.22/);
    expect(titles).toMatch(/DEC-VIP-TV is not responding/);
    expect(titles).toMatch(/No IGMP querier on VLAN 41/);
    expect(titles).toMatch(/errors on/);
    expect(flow.summary).toMatchObject({ nvxTx: 3, nvxRx: 5, dante: 4, offline: 1 });
    expect(flow.summary.clockLeader.name).toBe("QSYS-Core-110f");
  });
  it("classifies multicast groups", () => {
    expect(classifyGroup("239.255.220.1")).toBe("dante");
    expect(classifyGroup("239.69.1.1")).toBe("aes67");
    expect(classifyGroup("224.0.1.129")).toBe("ptp");
    expect(classifyGroup("239.255.255.250")).toBe(null);
    expect(classifyGroup("239.8.0.1", { nvxGroups: new Set(["239.8.0.1"]) })).toBe("nvx");
  });
  it("normalises port names across commands", () => {
    expect(portKey("GigabitEthernet1/0/3")).toBe("gi1/0/3");
    expect(portKey("Gi1/0/3")).toBe("gi1/0/3");
    expect(portKey("gi1/0/3")).toBe("gi1/0/3");
  });
  it("flags IGMP snooping off as critical", () => {
    const f = buildAvFlow({ switches: [{ host: "s", snapshot: { multicast: { snoopingEnabled: false, vlans: [], queriers: [], groups: [] } } }] });
    expect(f.findings[0]).toMatchObject({ severity: "critical" });
  });
});
