import assert from "node:assert/strict";
import {
  isPrivateOrLocalHostname,
  listLanIPv4Addresses,
  formatLanAccessBanner,
} from "../mock-server/lanAccess.js";

assert.equal(isPrivateOrLocalHostname("localhost"), true);
assert.equal(isPrivateOrLocalHostname("127.0.0.1"), true);
assert.equal(isPrivateOrLocalHostname("192.168.10.50"), true);
assert.equal(isPrivateOrLocalHostname("10.0.0.1"), true);
assert.equal(isPrivateOrLocalHostname("172.20.1.1"), true);
assert.equal(isPrivateOrLocalHostname("169.254.1.1"), true);
assert.equal(isPrivateOrLocalHostname("waveguard.local"), true);
assert.equal(isPrivateOrLocalHostname("8.8.8.8"), false);
assert.equal(isPrivateOrLocalHostname("example.com"), false);

const banner = formatLanAccessBanner({ host: "0.0.0.0", port: 8080, uiMounted: true });
assert.match(banner, /Listening on 0\.0\.0\.0:8080/);
assert.match(banner, /http:\/\/127\.0\.0\.1:8080/);
assert.match(banner, /Web UI is served/);

const ips = listLanIPv4Addresses();
assert.ok(Array.isArray(ips));
console.log("lanAccess self-check OK");
console.log(banner);
