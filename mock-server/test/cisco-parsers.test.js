import { describe, it, expect } from "vitest";
import { __test as t, shortPortName, assertPortName } from "../../scanner/integrations/cisco/ciscoSshClient.js";
import { pick } from "../lib/avFlow.js";

describe("Cisco parsers", () => {
  it("parses IOS-XE interface status incl. descriptions with spaces and 10G", () => {
    const status = [
      "Port         Name               Status       Vlan       Duplex  Speed Type",
      "Gi1/0/1      Saloon NVX enc     connected    40         a-full a-1000 10/100/1000BaseTX",
      "Gi1/0/2                         notconnect   1            auto   auto 10/100/1000BaseTX",
      "Te1/1/1      Uplink core        connected    trunk        full    10G SFP-10GBase-SR",
      "Gi1/0/3      Old cam            err-disabled 20           auto   auto 10/100/1000BaseTX",
    ].join("\n");
    const power = "Gi1/0/1   auto   on         12.9    Ieee PD             4     30.0";
    const ports = t.parseInterfaces({ status, description: "", power, platform: "ios-xe" });
    expect(ports[0]).toMatchObject({ name: "Gi1/0/1", ifAlias: "Saloon NVX enc", status: "up", vlan: 40, speedMbps: 1000, poeWatts: 12.9 });
    expect(ports[1]).toMatchObject({ status: "down", speedMbps: 0 });
    expect(ports[2]).toMatchObject({ trunk: true, speedMbps: 10000 });
    expect(ports[3].status).toBe("err-disabled");
  });
  it("reads the IOS-XE MAC table column order (Vlan Mac Type Ports)", () => {
    const raw = "  40    0010.7fa1.0021    DYNAMIC     Gi1/0/1\n All    0100.0ccc.cccc    STATIC      CPU";
    expect(t.parseMacTable(raw, { platform: "ios-xe" })).toEqual([{ vlan: 40, mac: "00:10:7F:A1:00:21", port: "Gi1/0/1", type: "dynamic" }]);
    expect(t.parseMacTable("1   74:86:0b:aa:bb:cc   gi1/0/3   dynamic")[0].port).toBe("gi1/0/3");
  });
  it("parses IGMP snooping groups and querier", () => {
    const m = t.parseMulticast({
      status: "Global IGMP Snooping configuration:\nIGMP snooping              : Enabled\nVlan 40:\n--------\nIGMP snooping                       : Enabled\nImmediate leave                     : Disabled",
      querier: "Vlan      IP Address               IGMP Version   Port\n-------------------------------------------------------------\n40        192.168.40.1             v2             Te1/1/1",
      groups: "Vlan      Group                    Type        Version     Port List\n-----------------------------------------------------------------------\n40        239.8.0.21               igmp        v2          Gi1/0/4, Gi1/0/7",
    });
    expect(m.snoopingEnabled).toBe(true);
    expect(m.vlans[0]).toMatchObject({ vlan: 40, snooping: true, immediateLeave: false });
    expect(m.queriers[0]).toMatchObject({ vlan: 40, address: "192.168.40.1" });
    expect(m.groups[0]).toEqual({ vlan: 40, group: "239.8.0.21", ports: ["Gi1/0/4", "Gi1/0/7"] });
  });
  it("validates port names before they reach config mode", () => {
    expect(assertPortName("Gi1/0/3")).toBe("Gi1/0/3");
    expect(() => assertPortName("Gi1/0/3\nreload")).toThrow();
    expect(() => assertPortName("vlan 1")).toThrow();
    expect(shortPortName("TenGigabitEthernet1/1/1")).toBe("te1/1/1");
  });
  it("speed parser checks longest values first", () => {
    expect(t.parseIosXeSpeed("a-10000")).toBe(10000);
    expect(t.parseIosXeSpeed("2.5G")).toBe(2500);
    expect(t.parseIosXeSpeed("a-100")).toBe(100);
  });
  it("NVX deep pick is case-insensitive", () => {
    expect(pick({ Device: { StreamTransmit: { Streams: [{ multicastaddress: "239.8.0.1" }] } } }, "MulticastAddress")).toBe("239.8.0.1");
  });
});
