import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import fs from "fs";
import path from "path";

beforeAll(() => {
  process.env.WAVEGUARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wg-test-"));
});

describe("secrets", () => {
  it("encrypts secret-named fields and round-trips them", async () => {
    const { encryptSecrets, decryptSecrets } = await import("../lib/secrets.js");
    const state = {
      systemSettings: [{ key: "discovery", value: { snmpCommunity: "public", subnets: ["10.0.0.0/24"] } }],
      switches: [{ host: "10.0.0.2", sshPassword: "hunter2", enablePassword: "en" }],
      users: [{ username: "admin", passwordHash: "scrypt$…" }],
    };
    const enc = encryptSecrets(state);
    expect(enc.switches[0].sshPassword).toMatch(/^enc:v1:/);
    expect(enc.systemSettings[0].value.snmpCommunity).toMatch(/^enc:v1:/);
    expect(enc.systemSettings[0].key).toBe("discovery"); // "key" is never treated as a secret
    expect(enc.users[0].passwordHash).toBe("scrypt$…"); // hashes are left alone
    expect(JSON.stringify(enc)).not.toContain("hunter2");
    expect(decryptSecrets(enc)).toEqual(state);
  });
});

describe("auth", () => {
  it("hashes and verifies passwords", async () => {
    const { hashPassword, verifyPassword, validatePasswordStrength } = await import("../lib/auth.js");
    const h = hashPassword("CorrectHorse42");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("CorrectHorse42", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(verifyPassword("x", undefined)).toBe(false);
    expect(validatePasswordStrength("short1")).toBeTruthy();
    expect(validatePasswordStrength("onlyletterslong")).toBeTruthy();
    expect(validatePasswordStrength("Good1Password")).toBeNull();
  });

  it("creates an admin on first boot and migrates plaintext passwords", async () => {
    const { createAuth, verifyPassword } = await import("../lib/auth.js");
    const db = { users: [{ id: "u1", username: "tech", role: "user", password: "legacy-pass-1" }] };
    const auth = createAuth(db);
    auth.ensureAdmin();
    const tech = db.users.find((u) => u.username === "tech");
    expect(tech.password).toBeUndefined();
    expect(verifyPassword("legacy-pass-1", tech.passwordHash)).toBe(true);
    const admin = db.users.find((u) => u.username === "admin");
    expect(admin.role).toBe("admin");
    expect(admin.mustChangePassword).toBe(true);
    expect(fs.existsSync(path.join(process.env.WAVEGUARD_DATA_DIR, "initial-admin-password.txt"))).toBe(true);
  });

  it("rejects requests without a session and ignores the old mock token", async () => {
    const { createAuth } = await import("../lib/auth.js");
    const auth = createAuth({ users: [] });
    const req = { path: "/api/apps/mock-app/entities/Equipment", method: "GET", headers: { authorization: "Bearer mock-dev-token" }, query: {} };
    let status = 0;
    const res = { status: (s) => ((status = s), { json: () => {} }) };
    auth.middleware(req, res, () => (status = 200));
    expect(status).toBe(401);
  });
});

describe("network tool parsers", () => {
  it("parses PTPv2 Announce messages", async () => {
    const { __test } = await import("../lib/netTools.js");
    const msg = Buffer.alloc(64);
    msg[0] = 0x0b; // Announce
    msg[1] = 0x02; // PTPv2
    msg[4] = 0; // domain
    msg[47] = 128; // priority1
    msg[48] = 248; // clockClass
    Buffer.from([0x00, 0x1d, 0xc1, 0xff, 0xfe, 0x12, 0x34, 0x56]).copy(msg, 53);
    const info = __test.parsePtp(msg);
    expect(info.version).toBe(2);
    expect(info.announce.priority1).toBe(128);
    expect(info.announce.grandmasterMac).toBe("00:1d:c1:12:34:56");
  });

  it("parses nmap XML including hosts without attributes", async () => {
    const { __test } = await import("../lib/netTools.js");
    const xml = `<nmaprun><host><status state="up"/><address addr="192.168.1.5" addrtype="ipv4"/><address addr="00:10:7F:AA:BB:CC" addrtype="mac" vendor="Crestron Electronics"/><hostnames><hostname name="cp4"/></hostnames><ports><port protocol="tcp" portid="41794"><state state="open"/><service name="crestron-cip"/></port></ports></host></nmaprun>`;
    const [h] = __test.parseNmapXml(xml);
    expect(h).toMatchObject({ ip: "192.168.1.5", hostname: "cp4", vendor: "Crestron Electronics" });
    expect(h.ports[0]).toMatchObject({ port: 41794, service: "crestron-cip" });
  });

  it("rejects shell-injection style targets", async () => {
    const { assertHost, assertCidr } = await import("../lib/exec.js");
    expect(() => assertHost("; rm -rf /")).toThrow();
    expect(() => assertHost("-oX")).toThrow();
    expect(assertHost("192.168.1.10")).toBe("192.168.1.10");
    expect(() => assertCidr("10.0.0.0/8")).toThrow(); // too large to scan
    expect(assertCidr("10.0.0.0/24")).toBe("10.0.0.0/24");
  });
});

describe("config backups", () => {
  it("ignores volatile lines when comparing configurations", async () => {
    const { normalizeConfig } = await import("../lib/configBackups.js");
    const a = normalizeConfig("Building configuration...\n! Last configuration change at 10:00\nhostname sw1\ninterface Gi1/0/1\n");
    const b = normalizeConfig("Building configuration...\n! Last configuration change at 11:30\nhostname sw1\ninterface Gi1/0/1\n");
    expect(a).toBe(b);
    expect(a).toContain("hostname sw1");
  });
});

describe("notification channels", () => {
  it("masks secrets and keeps them when the mask is sent back", async () => {
    const { normalizeChannel, maskChannel, mergeChannel, channelWants } = await import("../lib/notifier.js");
    const ch = normalizeChannel({ type: "telegram", name: "Crew", botToken: "123:abc", chatId: "42", minSeverity: "critical" });
    expect(maskChannel(ch).botToken).toBe("••••••••");
    expect(mergeChannel(ch, { ...maskChannel(ch), name: "Crew 2" }).botToken).toBe("123:abc");
    expect(channelWants(ch, { severity: "warning" })).toBe(false);
    expect(channelWants(ch, { severity: "critical" })).toBe(true);
    expect(channelWants(ch, { recovery: true })).toBe(true);
  });
});
