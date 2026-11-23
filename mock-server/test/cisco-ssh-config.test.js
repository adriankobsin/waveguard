import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { CiscoSshClient } from "../../scanner/integrations/cisco/ciscoSshClient.js";

const require = createRequire(import.meta.url);
const { Server } = require("../../scanner/node_modules/ssh2");

// Minimal IOS-XE shell: echoes, tracks config mode in the prompt, rejects one bad command.
const log = [];
let server;
let port;

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "pkcs1", format: "pem" } });
  server = new Server({ hostKeys: [privateKey] }, (client) => {
    client.on("authentication", (ctx) => (ctx.method === "password" && ctx.password === "pw" ? ctx.accept() : ctx.reject()));
    client.on("session", (accept) => {
      const session = accept();
      session.on("pty", (a) => a && a());
      session.on("shell", (acceptShell) => {
        const st = acceptShell();
        let mode = "";
        const prompt = () => `SW1${mode}#`;
        st.write(`\r\n${prompt()}`);
        let buf = "";
        st.on("data", (d) => {
          buf += d.toString();
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).replace(/\r$/, "");
            buf = buf.slice(i + 1);
            log.push(line);
            let out = "";
            if (line === "configure terminal") mode = "(config)";
            else if (line.startsWith("interface ")) mode = "(config-if)";
            else if (line === "end") mode = "";
            else if (line === "show version") out = "Cisco IOS XE Software\r\ncisco C9200L-24P-4G\r\n";
            else if (line === "switchport access vlan 999") out = "% Invalid input detected at '^' marker.\r\n";
            else if (line === "write memory") out = "[OK]\r\n";
            st.write(`${line}\r\n${out}${prompt()}`);
          }
        });
      });
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  port = server.address().port;
});
afterAll(() => server?.close());

describe("Cisco SSH port control", () => {
  it("applies changes in config mode, surfaces switch errors and blocks injection", async () => {
    const c = new CiscoSshClient({ host: "127.0.0.1", port, username: "u", password: "pw", timeoutMs: 4000 });
    expect(await c.ensurePlatform()).toBe("ios-xe");
    await c.portAction({ action: "setVlan", port: "Gi1/0/4", vlan: 40 });
    expect(log).toEqual(expect.arrayContaining(["configure terminal", "interface Gi1/0/4", "switchport access vlan 40", "end"]));
    await c.portAction({ action: "setDescription", port: "Gi1/0/4", description: "NVX\nreload" });
    expect(log).toContain("description NVXreload");
    expect(log).not.toContain("reload");
    await expect(c.configure(["interface Gi1/0/4", "switchport access vlan 999"])).rejects.toThrow(/Invalid input/);
    await expect(c.portAction({ action: "bounce", port: "Gi1/0/4\nreload" })).rejects.toThrow(/not a valid switch port/);
    await expect(c.portAction({ action: "setVlan", port: "Gi1/0/4", vlan: 5000 })).rejects.toThrow(/1–4094/);
    expect((await c.saveConfig()).saved).toBe(true);
    c.dispose();
  }, 20000);
});
