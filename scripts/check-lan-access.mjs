import assert from "node:assert/strict";
import { isVesselHostname, formatLanAccessBanner } from "../mock-server/lanAccess.js";

for (const host of [
  "192.168.10.20",
  "192.168.20.15",
  "192.168.88.1",
  "10.20.0.5",
  "172.16.1.1",
  "172.31.255.4",
  "localhost",
  "bridge.local",
]) {
  assert.equal(isVesselHostname(host), true, host);
}

for (const host of ["8.8.8.8", "1.1.1.1", "example.com"]) {
  assert.equal(isVesselHostname(host), false, host);
}

const banner = formatLanAccessBanner({ host: "0.0.0.0", port: 5173 });
assert.match(banner, /every IPv4 interface/);
assert.match(banner, /does not filter clients by source VLAN/);
console.log("vlan access self-check OK");
console.log(banner);
