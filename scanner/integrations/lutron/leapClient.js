import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import tls from "node:tls";
import path from "node:path";
import crypto from "node:crypto";

// ── Ports ────────────────────────────────────────────────────────────────────
// Pairing (certificate enrollment) happens on port 8083.
// Normal LEAP operations use port 8081.
const LEAP_PORT = 8081;
const PAIRING_PORT = 8083;
const PAIRING_TIMEOUT_MS = 180_000; // 3 min for user to press the button
const CERTS_DIR = path.resolve(
  process.env.WAVEGUARD_CONFIG_DIR || path.join(process.cwd(), "leap-certs")
);

// ── Lutron built-in pairing certificates ────────────────────────────────────
// These are the well-known Caséta Local Access Protocol (LAP) credentials that
// Lutron processors accept during the initial TLS handshake on the pairing
// port.  Caséta SmartBridge trusts LAP_CA_PEM; QSX / RA3 trusts
// LUTRON_ROOT_CA_PEM.

const LAP_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIEsjCCA5qgAwIBAgIBATANBgkqhkiG9w0BAQ0FADCBlzELMAkGA1UEBhMCVVMx
FTATBgNVBAgTDFBlbm5zeWx2YW5pYTElMCMGA1UEChMcTHV0cm9uIEVsZWN0cm9u
aWNzIENvLiwgSW5jLjEUMBIGA1UEBxMLQ29vcGVyc2J1cmcxNDAyBgNVBAMTK0Nh
c2V0YSBMb2NhbCBBY2Nlc3MgUHJvdG9jb2wgQ2VydCBBdXRob3JpdHkwHhcNMTUx
MDMxMDAwMDAwWhcNMzUxMDMxMDAwMDAwWjCBlzELMAkGA1UEBhMCVVMxFTATBgNV
BAgTDFBlbm5zeWx2YW5pYTElMCMGA1UEChMcTHV0cm9uIEVsZWN0cm9uaWNzIENv
LiwgSW5jLjEUMBIGA1UEBxMLQ29vcGVyc2J1cmcxNDAyBgNVBAMTK0Nhc2V0YSBM
b2NhbCBBY2Nlc3MgUHJvdG9jb2wgQ2VydCBBdXRob3JpdHkwggEiMA0GCSqGSIb3
DQEBAQUAA4IBDwAwggEKAoIBAQDamUREO0dENJxvxdbsDATdDFq+nXdbe62XJ4hI
t15nrUolwv7S28M/6uPPFtRSJW9mwvk/OKDlz0G2D3jw6SdzV3I7tNzvDptvbAL2
aDy9YNp9wTub/pLF6ONDa56gfAxsPQnMBwgoZlKqNQQsjykiyBv8FX42h3Nsa+Bl
q3hjnZEdOAkdn0rvCWD605c0+VWWOWm2vv7bwyOsfgsvCPxooAyBhTDeA0JPjVE/
wHPfiDF3WqA8JzWv4Ibvkg1g33oD6lG8LulWKDS9TPBYF+cvJ40aFPMreMoAQcrX
uD15vaS7iWXKI+anVrBpqE6pRkwLhR+moFjv5GZ+9oP8eawzAgMBAAGjggEFMIIB
ATAMBgNVHRMEBTADAQH/MB0GA1UdDgQWBBSB7qznOajKywOtZypVvV7ECAsgZjCB
xAYDVR0jBIG8MIG5gBSB7qznOajKywOtZypVvV7ECAsgZqGBnaSBmjCBlzELMAkG
A1UEBhMCVVMxFTATBgNVBAgTDFBlbm5zeWx2YW5pYTElMCMGA1UEChMcTHV0cm9u
IEVsZWN0cm9uaWNzIENvLiwgSW5jLjEUMBIGA1UEBxMLQ29vcGVyc2J1cmcxNDAy
BgNVBAMTK0Nhc2V0YSBMb2NhbCBBY2Nlc3MgUHJvdG9jb2wgQ2VydCBBdXRob3Jp
dHmCAQEwCwYDVR0PBAQDAgG+MA0GCSqGSIb3DQEBDQUAA4IBAQB9UDVi2DQI7vHp
F2Lape8SCtcdGEY/7BV4a3F+Xp9WxpE4bVtwoHlb+HG4tYQk9LO7jReE3VBmzvmU
aj+Y3xa25PSb+/q6U6MuY5OscyWo6ZGwtlsrWcP5xsey950WLwW6i8mfIkqFf6uT
gPbUjLsOstB4p7PQVpFgS2rP8h50Psue+XtUKRpR+JSBrHXKX9VuU/aM4PYexSvF
WSHa2HEbjvp6ccPm53/9/EtOtzcUMNspKt3YzABAoQ5/69nebRtC5lWjFI0Ga6kv
zKyu/aZJXWqskHkMz+Mbnky8tP37NmVkMnmRLCfdCG0gHiq/C2tjWDfPQID6HY0s
zq38av5E
-----END CERTIFICATE-----`;

const LAP_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIECjCCAvKgAwIBAgIBAzANBgkqhkiG9w0BAQ0FADCBlzELMAkGA1UEBhMCVVMx
FTATBgNVBAgTDFBlbm5zeWx2YW5pYTElMCMGA1UEChMcTHV0cm9uIEVsZWN0cm9u
aWNzIENvLiwgSW5jLjEUMBIGA1UEBxMLQ29vcGVyc2J1cmcxNDAyBgNVBAMTK0Nh
c2V0YSBMb2NhbCBBY2Nlc3MgUHJvdG9jb2wgQ2VydCBBdXRob3JpdHkwHhcNMTUx
MDMxMDAwMDAwWhcNMzUxMDMxMDAwMDAwWjB+MQswCQYDVQQGEwJVUzEVMBMGA1UE
CBMMUGVubnN5bHZhbmlhMSUwIwYDVQQKExxMdXRyb24gRWxlY3Ryb25pY3MgQ28u
LCBJbmMuMRQwEgYDVQQHEwtDb29wZXJzYnVyZzEbMBkGA1UEAxMSQ2FzZXRhIEFw
cGxpY2F0aW9uMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyAOELqTw
WNkF8ofSYJ9QkOHAYMmkVSRjVvZU2AqFfaZYCfWLoors7EBeQrsuGyojqxCbtRUd
l2NQrkPrGVw9cp4qsK54H8ntVadNsYi7KAfDW8bHQNf3hzfcpe8ycXcdVPZram6W
pM9P7oS36jV2DLU59A/OGkcO5AkC0v5ESqzab3qaV3ZvELP6qSt5K4MaJmm8lZT2
6deHU7Nw3kR8fv41qAFe/B0NV7IT+hN+cn6uJBxG5IdAimr4Kl+vTW9tb+/Hh+f+
pQ8EzzyWyEELRp2C72MsmONarnomei0W7dVYbsgxUNFXLZiXBdtNjPCMv1u6Znhm
QMIu9Fhjtz18LwIDAQABo3kwdzAJBgNVHRMEAjAAMB0GA1UdDgQWBBTiN03yqw/B
WK/jgf6FNCZ8D+SgwDAfBgNVHSMEGDAWgBSB7qznOajKywOtZypVvV7ECAsgZjAL
BgNVHQ8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMCMA0GCSqG
SIb3DQEBDQUAA4IBAQABdgPkGvuSBCwWVGO/uzFEIyRius/BF/EOZ7hMuZluaF05
/FT5PYPWg+UFPORUevB6EHyfezv+XLLpcHkj37sxhXdDKB4rrQPNDY8wzS9DAqF4
WQtGMdY8W9z0gDzajrXRbXkYLDEXnouUWA8+AblROl1Jr2GlUsVujI6NE6Yz5JcJ
zDLVYx7pNZkhYcmEnKZ30+ICq6+0GNKMW+irogm1WkyFp4NHiMCQ6D2UMAIMfeI4
xsamcaGquzVMxmb+Py8gmgtjbpnO8ZAHV6x3BG04zcaHRDOqyA4g+Xhhbxp291c8
B31ZKg0R+JaGyy6ZpE5UPLVyUtLlN93V2V8n66kR
-----END CERTIFICATE-----`;

const LAP_KEY_PEM = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAyAOELqTwWNkF8ofSYJ9QkOHAYMmkVSRjVvZU2AqFfaZYCfWL
oors7EBeQrsuGyojqxCbtRUdl2NQrkPrGVw9cp4qsK54H8ntVadNsYi7KAfDW8bH
QNf3hzfcpe8ycXcdVPZram6WpM9P7oS36jV2DLU59A/OGkcO5AkC0v5ESqzab3qa
V3ZvELP6qSt5K4MaJmm8lZT26deHU7Nw3kR8fv41qAFe/B0NV7IT+hN+cn6uJBxG
5IdAimr4Kl+vTW9tb+/Hh+f+pQ8EzzyWyEELRp2C72MsmONarnomei0W7dVYbsgx
UNFXLZiXBdtNjPCMv1u6ZnhmQMIu9Fhjtz18LwIDAQABAoIBAQCXDtDNyZQcBgwP
17RzdN8MDPOWJbQO+aRtES2S3J9k/jSPkPscj3/QDe0iyOtRaMn3cFuor4HhzAgr
FPCB/sAJyJrFRX9DwuWUQv7SjkmLOhG5Rq9FsdYoMXBbggO+3g8xE8qcX1k2r7vW
kDW2lRnLDzPtt+IYxoHgh02yvIYnPn1VLuryM0+7eUrTVmdHQ1IGS5RRAGvtoFjf
4QhkkwLzZzCBly/iUDtNiincwRx7wUG60c4ZYu/uBbdJKT+8NcDLnh6lZyJIpGns
jjZvvYA9kgCB2QgQ0sdvm0rA31cbc72Y2lNdtE30DJHCQz/K3X7T0PlfR191NMiX
E7h2I/oBAoGBAPor1TqsQK0tT5CftdN6j49gtHcPXVoJQNhPyQldKXADIy8PVGnn
upG3y6wrKEb0w8BwaZgLAtqOO/TGPuLLFQ7Ln00nEVsCfWYs13IzXjCCR0daOvcF
3FCb0IT/HHym3ebtk9gvFY8Y9AcV/GMH5WkAufWxAbB7J82M//afSghPAoGBAMys
g9D0FYO/BDimcBbUBpGh7ec+XLPaB2cPM6PtXzMDmkqy858sTNBLLEDLl+B9yINi
FYcxpR7viNDAWtilVGKwkU3hM514k+xrEr7jJraLzd0j5mjp55dnmH0MH0APjEV0
qum+mIJmWXlkfKKIiIDgr6+FwIiF5ttSbX1NwnYhAoGAMRvjqrXfqF8prEk9xzra
7ZldM7YHbEI+wXfADh+En+FtybInrvZ3UF2VFMIQEQXBW4h1ogwfTkn3iRBVje2x
v4rHRbzykjwF48XPsTJWPg2E8oPK6Wz0F7rOjx0JOYsEKm3exORRRhru5Gkzdzk4
lok29/z8SOmUIayZHo+cV88CgYEAgPsmhoOLG19A9cJNWNV83kHBfryaBu0bRSMb
U+6+05MtpG1pgaGVNp5o4NxsdZhOyB0DnBL5D6m7+nF9zpFBwH+s0ftdX5sg/Rfs
1Eapmtg3f2ikRvFAdPVf7024U9J4fzyqiGsICQUe1ZUxxetsumrdzCrpzh80AHrN
bO2X4oECgYEAxoVXNMdFH5vaTo3X/mOaCi0/j7tOgThvGh0bWcRVIm/6ho1HXk+o
+kY8ld0vCa7VvqT+iwPt+7x96qesVPyWQN3+uLz9oL3hMOaXCpo+5w8U2Qxjinod
uHnNjMTXCVxNy4tkARwLRwI+1aV5PMzFSi+HyuWmBaWOe19uz3SFbYs=
-----END RSA PRIVATE KEY-----`;

const LUTRON_ROOT_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIH5DCCBMygAwIBAgIJAKk++JqaJetSMA0GCSqGSIb3DQEBCwUAMH8xCzAJBgNV
BAYTAlVTMQswCQYDVQQIDAJQQTELMAkGA1UEBwwCQ0IxHzAdBgNVBAoMFkx1dHJv
biBFbGVjdHJvbmljcyBJbmMxHzAdBgNVBAsMFkx1dHJvbiBFbGVjdHJvbmljcyBJ
bmMxFDASBgNVBAMMC2x1dHJvbi1yb290MB4XDTE2MDkyODE5NTk0MVoXDTM2MDky
MzE5NTk0MVowfzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAlBBMQswCQYDVQQHDAJD
QjEfMB0GA1UECgwWTHV0cm9uIEVsZWN0cm9uaWNzIEluYzEfMB0GA1UECwwWTHV0
cm9uIEVsZWN0cm9uaWNzIEluYzEUMBIGA1UEAwwLbHV0cm9uLXJvb3QwggMiMA0G
CSqGSIb3DQEBAQUAA4IDDwAwggMKAoIDAQDBZbMODMzm+qpsOF5hhQ272GUlOaKz
n5b5YxokSAoxY4TqQApb9/uRHIBuuGLntq0QhR0Y3b0lXBeJWzWC6zscZJrheUKW
+2aHVvU4ugPAAXK/WVI68adBSY1UP0BcO1paYrXONcuXQgdy2/GV1mo1b+bmjNFT
zeDopkUoBxivBDZZ7B5vFfbJSgSF47Xsz8cspCEUIaV1rZbaDYBzsimdvrKusJfZ
Pci+Cx71sZuKunGTCgwHduYFsBfYRgTG1ihNEASi2++Er67AcabUGaqVQr/kIrUD
sS9jB6uaqPgMajjwXiZPDm82tTHobbKSav7aq+kSBNIFyvhK5y+vAWoGeZr5WK7n
9EekO3x7LXc6XSCASuhzK6zquAGUBSQNEO3c7sZ1rIdNs1lBSkCSxs+Bl8eEHO8k
O20TqKzKF9bQtccNkFWtRKIhVLFxQt234P+XJtWvWKVOlkLCAo0QgDivFJQVnNKM
Hr2/CIsOLC+ZSWAYl0lZEJaszt7wjR9cc7DRizq9aoKcGlPRvxzobFoQ4H0Z8vIR
DQRUQWFaTTOGiEk7JKxqjXX8xuGZpoXWw8VX0gz3Y0Bz8sU58ZZbugmVjvnKKYzd
ueZ/9+FsaYX6CKdJDANEJf+fqfkGXwQGt8Ns7SeG0JyCdJ4K2ECoOURYS4P1vSY1
40L9OldDjsW2qhpSBPHppfJ4rPRUu5J9Ux3AX4Mz+ibl6MS3wRpP1Rg+9TLITK5o
3AYrJO6oMsYrQkQvc+k20ocD7Iq0522iyw62/DpKMsPZXHNTT/rqzIihkaZaR8aa
ZOgAKi5o398mcfsuv42f8DriYc0Gr+3btiDU7rINqM935YNIABBDtVT9Ybc5uPHa
wXLmAIx2yLjqYaRDhr01Sql6WGy8Y0HcI5lM1pw4Vpx+VKWG/QdORGtZgKySGZ0+
9bY9cRN9IBFz4J60xoqx0MsM5o6FqVDypDCB32KaobVZSAnHifwEGtJJimNIzHpY
jGCTzBHSpuZcvV2dVAuPTHzck37ifpNTUFUCAwEAAaNjMGEwHQYDVR0OBBYEFErb
2SmGkh+4kYe2twSie5+xaqRsMB8GA1UdIwQYMBaAFErb2SmGkh+4kYe2twSie5+x
aqRsMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEB
CwUAA4IDAQAP9t0STrn0xENQEDNwRMQUBYTA/r7BmzXX6b0Ip6HW7QNmTkFc5pUb
KT86v6g8cJ7ls96JwdTu1kRQt4Qpbyvzp2p5YlRFnm3NTVVdcffcZNo95x9Z/1Cv
5xZgw0OKODwPBJLCyq5ET4W6WrIZucRVBs035YXIN+z3EzCxBj6O1lcjOTTHSFFR
jI3t3AGdkFo7tCBu5TFlNEFfmaqjse140vfGWJpRKyOT4ahzXLcVxzfg/SKRID3Q
2Rop4KqLNCddzz+UM+IiwyFkOfjrXWStW46cLUzM1k5GRrl0aBg5oqMCBY4/Eeh3
W0ZATsxxfg2Ly4FIO5d7/xiZqARFuurYe/2PSzVSPIKQrPVjDEekD+qQ0bRRQGvL
KBiMhYZHwnz/OEQl21PNp5rksuFjKG4/PimQ8V96jpbzzsOZuic3aScszgNUPbdI
0LYjCQ8xCOFPpFC4x1+rGubRjKEuGCvvYErVkX9rQlFRGPOp+k8bYTlIUKZeNsuL
KiZ4VH5+ZUAIf94DHayoo/SvBsQ5Qizb17KVRKil+vidUkMtndrNtjr3GWmH+nkn
PhRXBlekUy3dgRvTE8RFDOG9TYAN1Bs/uMgNc8Sg5Yz0SG96SLXVer2zsjmQ7tf9
6s+UVvrr+wlL7jSJCfJo6gaUQh1sD3umPXDS+Fq+J7tiRwOvP3cejo8dLyhesDun
FGIHlKmUCIwS/3Kzvd9OtAJMsmV9Q2B1dXudJloj6ADaAmVvhI/eMUncL9sXMJZH
3CCorh2OSZt0vtdA59osgDSMrsQZSMrtovrKgeFmP1Z0ENvo90Zenm7Bjn6Hw3Y/
GebIgSgoc149ElxjN4nagIqSJJHRrYq85sjTUSESvQUL1oi4R/VU+qMIRSHju/ZM
bkqONDohUc7/pg5rnLTZnnaQ09KvdF0yySx3hYph7L7MZWV/tF7O7yj1egRKh7lT
rgZOI7EiN4DPfTTpXoWVmIpiB/ouKp6uZ/Zrq00WthT8lUaBsFYaC3FDkkcxwdkk
lJ+cvdbUdsU=
-----END CERTIFICATE-----`;

const LOG_PREFIX = "[leap]";
function log(...args) {
  // eslint-disable-next-line no-console
  console.log(LOG_PREFIX, ...args);
}
function logWarn(...args) {
  // eslint-disable-next-line no-console
  console.warn(LOG_PREFIX, ...args);
}
function logError(...args) {
  // eslint-disable-next-line no-console
  console.error(LOG_PREFIX, ...args);
}

// Node 22 / OpenSSL 3 refuses legacy PKCS#1 ("-----BEGIN RSA PRIVATE KEY-----")
// RSA keys when they're passed into `tls.connect`/secure contexts, failing with
// `error:1E08010C:DECODER routines::unsupported`. `crypto.createPrivateKey` still
// accepts the legacy format, so we re-export the key as PKCS#8 once at module
// load and use that everywhere. Any key that is already in PKCS#8 (or any other
// supported format) passes through unchanged.
function ensurePkcs8PrivateKeyPem(pem) {
  if (typeof pem !== "string" || !pem.includes("PRIVATE KEY")) return pem;
  if (pem.includes("BEGIN PRIVATE KEY") || pem.includes("BEGIN ENCRYPTED PRIVATE KEY")) {
    return pem;
  }
  try {
    const keyObject = crypto.createPrivateKey({ key: pem, format: "pem" });
    return keyObject.export({ type: "pkcs8", format: "pem" });
  } catch (err) {
    logWarn(
      `Could not normalize PEM private key to PKCS#8 (${err?.message || err}). ` +
        "Returning original PEM — TLS handshake may fail on OpenSSL 3."
    );
    return pem;
  }
}

let activeClient = null;

// ── Minimal ASN.1 DER encoder for CSR generation ──────────────────────────

function encodeLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  let len = length;
  while (len > 0) { bytes.unshift(len & 0xff); len >>>= 8; }
  return Buffer.concat([Buffer.from([0x80 | bytes.length]), Buffer.from(bytes)]);
}

function encodeSequence(children) {
  const inner = Buffer.concat(children);
  return Buffer.concat([Buffer.from([0x30]), encodeLength(inner.length), inner]);
}

function encodeSet(children) {
  const inner = Buffer.concat(children);
  return Buffer.concat([Buffer.from([0x31]), encodeLength(inner.length), inner]);
}

function encodeInteger(value) {
  if (value === 0) return Buffer.from([0x02, 0x01, 0x00]);
  const bytes = [];
  let v = value;
  while (v > 0) { bytes.unshift(v & 0xff); v >>>= 8; }
  if (bytes[0] & 0x80) bytes.unshift(0);
  return Buffer.concat([Buffer.from([0x02, bytes.length]), Buffer.from(bytes)]);
}

function encodeOID(oid) {
  const parts = oid.split(".").map(Number);
  const bytes = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v < 0x80) { bytes.push(v); continue; }
    const tmp = [];
    while (v > 0) { tmp.unshift((v & 0x7f) | (tmp.length ? 0x80 : 0)); v >>>= 7; }
    bytes.push(...tmp);
  }
  return Buffer.concat([Buffer.from([0x06, bytes.length]), Buffer.from(bytes)]);
}

function encodeNull() {
  return Buffer.from([0x05, 0x00]);
}

function encodeBitString(bytes) {
  const payload = Buffer.concat([Buffer.from([0x00]), bytes]);
  return Buffer.concat([Buffer.from([0x03]), encodeLength(payload.length), payload]);
}

function encodeString(tag, str) {
  const buf = Buffer.from(str, "utf8");
  return Buffer.concat([Buffer.from([tag]), encodeLength(buf.length), buf]);
}

function encodeContextExplicit(tag, inner) {
  return Buffer.concat([Buffer.from([0xa0 | tag]), encodeLength(inner.length), inner]);
}

function createCSR(keyPair, commonName) {
  // keyPair.publicKey is already DER-encoded SPKI (from generateKeyPairSync above)
  const publicKeyDer = keyPair.publicKey;

  const subject = encodeSequence([
    encodeSet([
      encodeSequence([
        encodeOID("2.5.4.3"),
        encodeString(0x0c, commonName),
      ]),
    ]),
  ]);

  const attributes = encodeContextExplicit(0, Buffer.from([0x31, 0x00]));

  const info = encodeSequence([
    encodeInteger(0),
    subject,
    publicKeyDer,
    attributes,
  ]);

  const sign = crypto.createSign("sha256");
  sign.update(info);
  const signature = sign.sign(keyPair.privateKey);

  const csrDer = encodeSequence([
    info,
    encodeSequence([
      encodeOID("1.2.840.113549.1.1.11"),
      encodeNull(),
    ]),
    encodeBitString(signature),
  ]);

  const b64 = csrDer.toString("base64");
  const lines = b64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN CERTIFICATE REQUEST-----\n${lines}\n-----END CERTIFICATE REQUEST-----\n`;
}

// ── Certificate management ─────────────────────────────────────────────────

function certDirForHost(host) {
  return path.join(CERTS_DIR, host.replace(/[^a-zA-Z0-9.-]/g, "_"));
}

function loadCerts(host) {
  if (!host) return null;
  const dir = certDirForHost(host);
  const keyPath = path.join(dir, "client.key");
  const certPath = path.join(dir, "client.crt");
  const caPath = path.join(dir, "ca.crt");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath) || !fs.existsSync(caPath)) {
    return null;
  }
  return {
    key: ensurePkcs8PrivateKeyPem(fs.readFileSync(keyPath, "utf8")),
    cert: fs.readFileSync(certPath, "utf8"),
    ca: fs.readFileSync(caPath, "utf8"),
  };
}

function saveCerts(host, key, cert, ca) {
  const dir = certDirForHost(host);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "client.key"), key, "utf8");
  fs.writeFileSync(path.join(dir, "client.crt"), cert, "utf8");
  fs.writeFileSync(path.join(dir, "ca.crt"), ca, "utf8");
  log(`Saved LEAP certificates for ${host} at ${dir}`);
}

function deleteCerts(host) {
  const dir = certDirForHost(host);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    log(`Deleted LEAP certificates for ${host}`);
  } catch { /* */ }
}

// ── Pairing state machine ──────────────────────────────────────────────────
const pairingStates = new Map();

function setPairingState(host, patch) {
  const current = pairingStates.get(host) || {};
  const next = { ...current, ...patch };
  pairingStates.set(host, next);
  log(`[${host}] state → ${next.state} :: ${next.message}`);
  return next;
}

/**
 * Open a TLS connection and return a promise that resolves with the socket
 * on 'secureConnect'.  Tries the given CA first; on verification failure
 * falls back to Lutron-Root CA (for QSX / RA3 processors).
 */
// Lazily normalize the bundled LAP private key from PKCS#1 to PKCS#8 so that
// Node 22 / OpenSSL 3 accepts it in `tls.connect`. We compute it once on first
// use to avoid paying the cost (or risking module-load failure) for processes
// that never touch the pairing flow.
let LAP_KEY_PEM_NORMALIZED = null;
function getLapKeyPem() {
  if (LAP_KEY_PEM_NORMALIZED === null) {
    LAP_KEY_PEM_NORMALIZED = ensurePkcs8PrivateKeyPem(LAP_KEY_PEM);
  }
  return LAP_KEY_PEM_NORMALIZED;
}

function tlsConnectToPairingPort(host, timeoutMs = 10_000) {
  const tlsOpts = {
    host,
    port: PAIRING_PORT,
    servername: "",         // no SNI — required by Lutron
    rejectUnauthorized: true,
    // Lutron processor certificates are signed by the Lutron Root CA but their
    // CN/SAN is the processor's serial / hostname, never the LAN IP. Skip
    // Node's IP/hostname verification (CA verification still applies via
    // `rejectUnauthorized: true`) so pairing works regardless of how the
    // operator addresses the processor.
    checkServerIdentity: () => undefined,
    cert: LAP_CERT_PEM,
    key: getLapKeyPem(),
    ca: LAP_CA_PEM,
    secureProtocol: "TLSv1_2_method",
    timeout: timeoutMs,
  };

  return new Promise((resolve, reject) => {
    let attempt = 0;
    let socket = null;

    function tryConnect(caPem) {
      attempt++;
      const opts = { ...tlsOpts, ca: caPem };
      socket = tls.connect(PAIRING_PORT, host, opts);

      let settled = false;
      const finish = (ok, err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (ok) {
          log(`[${host}:${PAIRING_PORT}] TLS connected (attempt ${attempt})`);
          resolve(socket);
        } else if (attempt === 1 && (err?.code === "CERT_VERIFY_ERROR" || err?.message?.includes?.("certificate"))) {
          log(`[${host}:${PAIRING_PORT}] LAP CA rejected, retrying with Lutron Root CA...`);
          tryConnect(LUTRON_ROOT_CA_PEM);
        } else if (attempt <= 2 && err) {
          // Second attempt also failed or first attempt non-cert error
          log(`[${host}:${PAIRING_PORT}] TLS failed (attempt ${attempt}): ${err.message}`);
          finish(false, err);
        } else {
          reject(err || new Error(`TLS connection to ${host}:${PAIRING_PORT} failed`));
        }
      };

      const timer = setTimeout(() => {
        finish(false, new Error(`TLS handshake timed out (${timeoutMs}ms)`));
      }, timeoutMs);

      socket.on("secureConnect", () => finish(true));
      socket.on("error", (err) => finish(false, err));
      socket.on("timeout", () => finish(false, new Error("TLS handshake timed out")));
    }

    tryConnect(LAP_CA_PEM);
  });
}

// ── Client wrapper (post-pairing live connection) ──────────────────────────

// ── Raw TLS LEAP client (bypasses lutron-leap's fragile message-type parser) ──
//
// The `lutron-leap` LeapClient expects specific MessageBodyType values in
// responses.  QSX processors may respond with types it doesn't recognise,
// causing the response parser to throw and the request to silently time out.
// This lightweight implementation handles *any* JSON response and is fully
// compatible with both Caséta and QSX / RA3.

class SimpleLeapClient extends EventEmitter {
  constructor(host, port, ca, key, cert) {
    super();
    this.host = host;
    this.port = port;
    this.ca = ca;
    this.key = key;
    this.cert = cert;
    this.socket = null;
    this.buffer = "";
    this.inFlight = new Map();
    // ClientTag → { handler } for long-lived subscriptions. The processor
    // reuses the same ClientTag for the initial SubscribeResponse and for
    // every subsequent ReadResponse update on that subscription, so we keep
    // these separate from the one-shot `inFlight` map (which deletes the tag
    // after the first response).
    this.subscriptions = new Map();
    this.connected = false;
    this.disposed = false;
    this.connectPromise = null;
  }

  async connect() {
    if (this.connected) return;
    if (this.disposed) throw new Error("SimpleLeapClient disposed");
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      const sock = tls.connect({
        host: this.host,
        port: this.port,
        ca: this.ca,
        key: this.key,
        cert: this.cert,
        servername: "",
        rejectUnauthorized: false,
        secureProtocol: "TLSv1_2_method",
        timeout: 15000,
      });
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        if (err) {
          reject(err);
        } else {
          this.connected = true;
          resolve();
        }
      };
      sock.on("secureConnect", () => {
        log(`[${this.host}:${this.port}] SimpleLeapClient TLS connected`);
        this.socket = sock;
        done();
      });
      sock.on("error", (err) => {
        logError(`[${this.host}:${this.port}] SimpleLeapClient TLS error: ${err.message}`);
        done(err);
      });
      sock.on("timeout", () => {
        sock.destroy();
        done(new Error("TLS connect timed out"));
      });
      sock.on("data", (data) => this._handleData(data));
      sock.on("close", () => {
        this.connected = false;
        this.connectPromise = null;
        // Reject all in-flight requests
        for (const [, { reject, timer }] of this.inFlight) {
          clearTimeout(timer);
          reject(new Error("Connection closed"));
        }
        this.inFlight.clear();
        // Subscriptions don't have a pending promise to reject — they just
        // stop receiving updates. Notify any consumer.
        for (const [, sub] of this.subscriptions) {
          try { sub.onClose?.(); } catch { /* */ }
        }
        this.subscriptions.clear();
      });
    });

    return this.connectPromise;
  }

  _handleData(data) {
    this.buffer += data.toString();
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        const tag = msg?.Header?.ClientTag;
        // Subscriptions are checked first — a SubscribeRequest receives an
        // initial SubscribeResponse on the same ClientTag AND continues to
        // receive every subsequent ReadResponse update on that same tag.
        if (tag && this.subscriptions.has(tag)) {
          try {
            this.subscriptions.get(tag).handler(msg);
          } catch (err) {
            logWarn(`[${this.host}:${this.port}] subscription handler threw: ${err.message}`);
          }
          continue;
        }
        if (tag && this.inFlight.has(tag)) {
          const entry = this.inFlight.get(tag);
          clearTimeout(entry.timer);
          this.inFlight.delete(tag);
          entry.resolve(msg);
        } else if (tag) {
          logWarn(`[${this.host}:${this.port}] SimpleLeapClient: unexpected tag ${tag}`);
        } else {
          log(`[${this.host}:${this.port}] SimpleLeapClient: untagged message`);
        }
      } catch {
        logWarn(`[${this.host}:${this.port}] SimpleLeapClient: malformed JSON: ${trimmed.substring(0, 120)}`);
      }
    }
  }

  async request(communiqueType, url, body, timeoutMs = 10000) {
    const tag = crypto.randomUUID();
    const msg = { CommuniqueType: communiqueType, Header: { ClientTag: tag, Url: url } };
    if (body !== undefined) msg.Body = body;

    await this.connect();
    if (!this.socket || this.socket.destroyed) {
      throw new Error("Socket not connected");
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inFlight.delete(tag);
        reject(new Error(`LEAP request timed out after ${timeoutMs}ms (${communiqueType} ${url})`));
      }, timeoutMs);
      this.inFlight.set(tag, { resolve, reject, timer });
      const payload = JSON.stringify(msg) + "\n";
      this.socket.write(payload, (err) => {
        if (err) {
          clearTimeout(timer);
          this.inFlight.delete(tag);
          reject(err);
        }
      });
    });
  }

  /**
   * Open a long-lived subscription. The processor responds to the initial
   * `SubscribeRequest` with one snapshot message and then keeps streaming
   * `ReadResponse` updates on the same ClientTag whenever the subscribed
   * resource changes. `handler` is invoked for every message that arrives
   * on that tag. Returns the tag so the caller can unsubscribe later.
   */
  async subscribe(url, { handler, onClose, body, initialTimeoutMs = 8000 } = {}) {
    if (typeof handler !== "function") {
      throw new Error("subscribe() requires a handler function");
    }
    const tag = crypto.randomUUID();
    const msg = { CommuniqueType: "SubscribeRequest", Header: { ClientTag: tag, Url: url } };
    if (body !== undefined) msg.Body = body;

    await this.connect();
    if (!this.socket || this.socket.destroyed) {
      throw new Error("Socket not connected");
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const initialTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.subscriptions.delete(tag);
        reject(new Error(`LEAP subscription timed out after ${initialTimeoutMs}ms (${url})`));
      }, initialTimeoutMs);

      this.subscriptions.set(tag, {
        url,
        onClose,
        handler: (m) => {
          if (!settled) {
            settled = true;
            clearTimeout(initialTimer);
            // Surface the initial snapshot to the caller AND keep delivering
            // subsequent updates through the same handler.
            try { handler(m); } catch (err) {
              logWarn(`[${this.host}:${this.port}] initial subscription handler threw: ${err.message}`);
            }
            resolve({ tag, initial: m });
            return;
          }
          handler(m);
        },
      });

      const payload = JSON.stringify(msg) + "\n";
      this.socket.write(payload, (err) => {
        if (err && !settled) {
          settled = true;
          clearTimeout(initialTimer);
          this.subscriptions.delete(tag);
          reject(err);
        }
      });
    });
  }

  unsubscribe(tag) {
    if (!tag || !this.subscriptions.has(tag)) return;
    this.subscriptions.delete(tag);
    // Best-effort UnsubscribeRequest; we ignore failures (the connection may
    // already be torn down or the processor may not support it).
    if (this.socket && !this.socket.destroyed) {
      try {
        const payload =
          JSON.stringify({
            CommuniqueType: "UnsubscribeRequest",
            Header: { ClientTag: crypto.randomUUID(), Url: `/subscription/${tag}` },
          }) + "\n";
        this.socket.write(payload);
      } catch { /* */ }
    }
  }

  async setVersion() {
    const resp = await this.request("UpdateRequest", "/clientsetting", {
      ClientSetting: { ClientMajorVersion: 1 },
    });
    log(`[${this.host}:${this.port}] setVersion response: ${resp.CommuniqueType} status=${resp.Header?.StatusCode}`);
    return resp;
  }

  async ping() {
    const resp = await this.request("ReadRequest", "/server/1/status/ping");
    return resp.Body?.PingResponse || resp;
  }

  drain() {
    this.disposed = true;
    this.removeAllListeners();
    for (const [, entry] of this.inFlight) {
      clearTimeout(entry.timer);
    }
    this.inFlight.clear();
    if (this.socket && !this.socket.destroyed) {
      try { this.socket.end(); } catch { /* */ }
    }
  }
}

// ── Client wrapper (post-pairing live connection) ──────────────────────────

class LutronLeapClientWrapper extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = Number(opts.port) || LEAP_PORT;
    this.lastLevels = new Map();
    // Authoritative per-zone control type cache: "dimmed" | "switched" |
    // "shade" | "tilt" | "shadeAndTilt". Populated by:
    //   1. The zone-status subscription when a zone carries Lift/Tilt
    //      payloads (shades + tilt-only).
    //   2. A lazy ReadRequest /zone/<id> probe that asks the processor
    //      what ControlType the zone has the moment we first need to send
    //      it a command. Once known, setOutput / raiseLower can pick the
    //      right CreateRequest shape without guessing.
    //   3. An explicit `kindHint` passed by the API (the UI knows from the
    //      parsed Integration Report which zones are shades / blinds).
    this._kindByZone = new Map();
    // In-flight probe promises, so concurrent setOutput calls for the
    // same zone share a single ReadRequest.
    this._kindProbes = new Map();
    this.disposed = false;
    this.state = "disconnected";
    this.client = null;
    this.zoneSubscriptionTag = null;
    this.zoneSubscriptionAttempted = false;
  }

  get key() {
    return `${this.host}:${this.port}`;
  }

  isReady() {
    return this.state === "ready";
  }

  async connect() {
    if (this.disposed) throw new Error("LEAP client disposed");
    if (this.state === "ready") return;

    const certs = loadCerts(this.host);
    if (!certs) {
      throw new Error(`No LEAP certificates found for ${this.host}. Pair the processor first.`);
    }

    this.state = "connecting";
    log(`[${this.host}:${this.port}] connecting with paired certificate...`);
    log(`[${this.host}:${this.port}] cert files: key=${certs.key.length}bytes cert=${certs.cert.length}bytes ca=${certs.ca.length}bytes`);
    try {
      this.client = new SimpleLeapClient(this.host, this.port, certs.ca, certs.key, certs.cert);
      log(`[${this.host}:${this.port}] SimpleLeapClient created, connecting on port ${this.port}...`);
      await this.client.connect();
      log(`[${this.host}:${this.port}] TLS connected! Performing version handshake...`);
      try {
        await this.client.setVersion();
        log(`[${this.host}:${this.port}] version handshake complete`);
      } catch (err) {
        logWarn(`[${this.host}:${this.port}] version handshake failed (non-fatal):`, err.message);
      }
      this.state = "ready";
      this.emit("ready");
      log(`[${this.host}:${this.port}] READY for commands`);
      // Kick off the zone-status subscription so `lastLevels` mirrors what the
      // processor knows. We don't `await` it: a slow subscription must not
      // block command sending.
      this._subscribeToAllZones().catch((err) => {
        logWarn(`[${this.host}:${this.port}] zone subscription failed: ${err.message}`);
      });
    } catch (err) {
      this.state = "disconnected";
      logError(`[${this.host}:${this.port}] connection FAILED: ${err.message}`);
      if (err.stack) logError(`[${this.host}:${this.port}] stack:`, err.stack.split("\n").slice(0, 5).join("\n"));
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Subscribe once to the processor's zone-status feed. The first message
   * back is a snapshot of every zone the processor knows about; subsequent
   * messages stream live updates (wall keypad presses, time-clock events,
   * scene activations, and our own GoToLevel commands). Each update lands
   * in `lastLevels` so `pollOutputs` becomes effectively free.
   */
  async _subscribeToAllZones() {
    if (!this.client || this.zoneSubscriptionAttempted) return;
    this.zoneSubscriptionAttempted = true;
    log(`[${this.host}:${this.port}] subscribing to /zone/status (initial snapshot + live updates)...`);
    try {
      const { tag } = await this.client.subscribe("/zone/status", {
        handler: (msg) => this._applyZoneStatusMessage(msg),
        initialTimeoutMs: 12_000,
      });
      this.zoneSubscriptionTag = tag;
      log(
        `[${this.host}:${this.port}] zone subscription active (tag=${tag.slice(0, 8)}…); seeded ${this.lastLevels.size} zone(s) from snapshot.`
      );
    } catch (err) {
      this.zoneSubscriptionAttempted = false;
      logWarn(
        `[${this.host}:${this.port}] /zone/status subscription rejected (${err.message}); falling back to per-zone reads.`
      );
    }
  }

  _applyZoneStatusMessage(msg) {
    const body = msg?.Body || {};
    // LEAP returns zone status in a few shapes depending on the processor
    // and the request type. We accept all of them so the cache stays
    // consistent.
    const candidates = [];
    if (Array.isArray(body.ZoneStatuses)) candidates.push(...body.ZoneStatuses);
    if (Array.isArray(body.ZoneStatus)) candidates.push(...body.ZoneStatus);
    else if (body.ZoneStatus && typeof body.ZoneStatus === "object") candidates.push(body.ZoneStatus);
    if (body.OneZoneStatus?.ZoneStatus) candidates.push(body.OneZoneStatus.ZoneStatus);
    if (!candidates.length) return;
    for (const entry of candidates) {
      const parsed = parseZoneStatusEntry(entry);
      if (!parsed) continue;
      // Once we've learned the authoritative ControlType from a ReadRequest
      // probe, prefer it over the subscription's best-guess: on most HWQS
      // firmwares the live ZoneStatus for a shade still only carries
      // `Level` (no `Lift`/`Tilt`), so the parser falls back to "dimmed"
      // and we'd send the wrong CreateRequest. The probed kind is correct.
      const learned = this._kindByZone.get(parsed.id);
      if (learned) parsed.kind = learned;
      else if (parsed.kind !== "dimmed") this._kindByZone.set(parsed.id, parsed.kind);
      this.lastLevels.set(parsed.id, parsed);
      this.emit("zoneLevel", parsed);
    }
  }

  /**
   * Map a Lutron LEAP `ControlType` onto our internal kind tag. Known
   * values returned by HomeWorks QSX / RA3 / Athena / Caséta:
   *   - Dimmed                  → dimmed       (continuous 0–100 lights)
   *   - Switched / Relay        → switched     (on/off relays)
   *   - Shade / LiftOnly / Lift → shade        (lift-only motorised shades)
   *   - TiltOnly / Tilt         → tilt         (tilt-only horizontal blinds)
   *   - LiftAndTilt /
   *     ShadeAndTilt            → shadeAndTilt (dual axis venetians)
   *   - OpenCloseStop           → openCloseStop (binary blinds — Raise/
   *                                              Lower/Stop only, no level)
   *   - FanSpeed                → fan           (treated as dimmer for now)
   */
  _kindFromControlType(controlType) {
    if (!controlType) return null;
    const c = String(controlType).toLowerCase();
    if (c === "dimmed") return "dimmed";
    if (c === "switched" || c === "relay") return "switched";
    if (c === "tiltonly" || c === "tilt") return "tilt";
    if (c === "liftandtilt" || c === "shadeandtilt") return "shadeAndTilt";
    if (c === "openclosestop" || c === "openclose") return "openCloseStop";
    if (c === "shade" || c === "liftonly" || c === "lift" || c.includes("shade")) return "shade";
    if (c === "fanspeed") return "dimmed";
    return null;
  }

  /**
   * Normalise an externally-supplied kind hint ("shade", "blind",
   * "blackout", "curtain", "light", "load", "switched", ...) into one of
   * the canonical control-type tags the CreateRequest router below
   * understands. The hint is a best-guess from the parsed Integration
   * Report — `_probeZoneKind` will still go to the processor to learn
   * the real ControlType because a "blind" in the report can be either
   * a Shade (level-based) or an OpenCloseStop blind on the wire.
   */
  _kindFromHint(hint) {
    if (!hint) return null;
    const h = String(hint).toLowerCase();
    if (h === "switched" || h === "relay") return "switched";
    if (h === "tilt" || h === "tiltonly") return "tilt";
    if (h === "shadeandtilt" || h === "liftandtilt") return "shadeAndTilt";
    if (h === "openclosestop" || h === "openclose") return "openCloseStop";
    if (h === "shade" || h === "blind" || h === "blackout" || h === "curtain" || h === "roman") {
      // Default shade-family hints to "shade"; the live probe will replace
      // this with "openCloseStop" / "tilt" / etc. when the processor says
      // otherwise.
      return "shade";
    }
    if (h === "dimmed" || h === "light" || h === "load") return "dimmed";
    return null;
  }

  /**
   * Learn the ControlType of a zone so subsequent commands use the right
   * CreateRequest shape. Resolution order:
   *   1. Cache (`_kindByZone`) — the result of any previous probe.
   *   2. Live `ReadRequest /zone/<id>` against the processor — authoritative.
   *   3. Caller-supplied hint — only used when the probe itself failed.
   *
   * The probe always wins when it succeeds because the UI hint is derived
   * from the zone name in the Integration Report (e.g. "BLACKOUT BLIND"),
   * which can't distinguish a level-based Shade from a binary
   * OpenCloseStop blind. Concurrent callers for the same zone share a
   * single probe.
   */
  async _probeZoneKind(id, kindHint = null) {
    const key = String(id);
    const cached = this._kindByZone.get(key);
    if (cached) return cached;

    if (this._kindProbes.has(key)) return this._kindProbes.get(key);

    const probe = (async () => {
      try {
        const resp = await this.client.request(
          "ReadRequest",
          `/zone/${key}`,
          undefined
        );
        const body = resp?.Body || {};
        const zone = body.Zone || body.OneZoneDefinition?.Zone || body;
        const ct = zone?.ControlType || zone?.Category?.Type || null;
        const mapped = this._kindFromControlType(ct);
        if (mapped) {
          log(`[${this.host}:${this.port}] probed /zone/${key} ControlType=${ct} → kind=${mapped}`);
          this._kindByZone.set(key, mapped);
          return mapped;
        }
        // Probe responded but with an unrecognised ControlType — fall
        // through to the hint before defaulting to dimmed so a UI-known
        // "shade" doesn't get downgraded.
        const hinted = this._kindFromHint(kindHint);
        if (hinted) {
          log(`[${this.host}:${this.port}] probed /zone/${key} (ControlType=${ct || "?"}); using hint=${hinted}`);
          this._kindByZone.set(key, hinted);
          return hinted;
        }
        log(`[${this.host}:${this.port}] probed /zone/${key} (ControlType=${ct || "?"}); defaulting to dimmed`);
        return "dimmed";
      } catch (err) {
        // Probe failed (network blip, processor temporarily refusing). Use
        // the hint if we have one — better than blindly defaulting to
        // dimmed and breaking shade control.
        const hinted = this._kindFromHint(kindHint);
        if (hinted) {
          logWarn(`[${this.host}:${this.port}] kind probe for /zone/${key} failed (${err.message}); using hint=${hinted}`);
          this._kindByZone.set(key, hinted);
          return hinted;
        }
        logWarn(`[${this.host}:${this.port}] kind probe for /zone/${key} failed (${err.message}); defaulting to dimmed`);
        return "dimmed";
      } finally {
        this._kindProbes.delete(key);
      }
    })();
    this._kindProbes.set(key, probe);
    return probe;
  }

  /**
   * Format a fade duration as the canonical LEAP `HH:MM:SS` string.
   * Fractional seconds are supported via `.SSS` but processors generally
   * round to the nearest second, so we drop them.
   */
  _formatFade(fadeSeconds) {
    const s = Math.max(0, Math.round(Number(fadeSeconds) || 0));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  /**
   * Throw if a LEAP response is an ExceptionResponse, surfacing the
   * processor's own `Exception.Message`. Without this, a 400 BadRequest
   * resolves like a success and silently breaks every command.
   */
  _ensureSuccess(resp, label) {
    const status = resp?.Header?.StatusCode || "";
    const isException = resp?.CommuniqueType === "ExceptionResponse";
    const is4xx5xx = /^[45]\d\d/.test(status);
    if (!isException && !is4xx5xx) return resp;
    const msg = resp?.Body?.Exception?.Message || resp?.Body?.Message || status || "unknown";
    const detail = JSON.stringify(resp?.Body || {}).slice(0, 240);
    logError(
      `[${this.host}:${this.port}] ${label} rejected by processor: ${status || "ExceptionResponse"} :: ${msg} :: ${detail}`
    );
    const err = new Error(`Lutron processor rejected ${label}: ${msg}`);
    err.leapStatus = status;
    err.leapBody = resp?.Body;
    throw err;
  }

  /**
   * Send a CreateRequest /zone/<id>/commandprocessor and throw on
   * ExceptionResponse. Centralised so retries are trivial.
   */
  async _sendZoneCommand(id, body, label) {
    const resp = await this.client.request(
      "CreateRequest",
      `/zone/${id}/commandprocessor`,
      body
    );
    log(
      `[${this.host}:${this.port}] ${label} zone=${id} ← ${resp?.CommuniqueType || "?"} status=${resp?.Header?.StatusCode || "?"}`
    );
    return this._ensureSuccess(resp, `${label} on /zone/${id}`);
  }

  /**
   * Set a zone level (0-100). HomeWorks QSX / RA3 / Athena uses the typed
   * `GoToDimmedLevel` / `GoToSwitchedLevel` / `GoToShadeLevel` commands;
   * Caséta SmartBridge uses the generic `GoToLevel` with a Parameter array.
   * We pick the typed command based on what the subscription snapshot has
   * already told us about the zone, and transparently fall back to the
   * Caséta dialect if the processor rejects the first attempt — that way a
   * single client speaks every Lutron processor without configuration.
   */
  async setOutput(id, level, fadeSeconds = 0, kindHint = null) {
    const lvl = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    const fade = this._formatFade(fadeSeconds);
    // Discover the zone's control type via live probe so the CreateRequest
    // body matches what the processor expects. Without this, every
    // shade / blind / blackout gets a GoToDimmedLevel and the processor
    // rejects it with 400.
    const kind = await this._probeZoneKind(id, kindHint);

    // OpenCloseStop zones (motorised blinds / curtains where the
    // processor only exposes binary Open/Close/Stop semantics) refuse
    // every level-based command, so we translate Set-to-100 → Raise and
    // Set-to-0 → Lower and bail before we build the GoToLevel chain.
    // The Lighting UI's Open/Close buttons already send 100 / 0, so this
    // is a no-op for the user.
    if (kind === "openCloseStop") {
      const action = lvl >= 50 ? "raise" : "lower";
      log(
        `[${this.host}:${this.port}] setOutput: zone=${id} level=${lvl} kind=openCloseStop → routing to ${action.toUpperCase()}`
      );
      await this.raiseLower(id, action, "openCloseStop");
      const updatedAt = new Date().toISOString();
      const next = {
        id: String(id),
        level: lvl,
        on: lvl > 0,
        kind: "openCloseStop",
        updatedAt,
      };
      this.lastLevels.set(String(id), next);
      this.emit("zoneLevel", next);
      return next;
    }

    // Build an ordered list of CreateRequest bodies to try. The first entry
    // is the canonical HomeWorks QSX shape for the detected kind; the rest
    // are pragmatic fallbacks for older QSX firmwares, Caséta SmartBridge,
    // and dual lift/tilt shades that won't accept the strict shape.
    const attempts = [];
    if (kind === "switched") {
      attempts.push({
        label: "GoToSwitchedLevel",
        body: {
          Command: {
            CommandType: "GoToSwitchedLevel",
            SwitchedLevelParameters: { SwitchedLevel: lvl > 0 ? "On" : "Off" },
          },
        },
      });
    } else if (kind === "shade") {
      attempts.push({
        label: "GoToShadeLevel",
        body: {
          Command: {
            CommandType: "GoToShadeLevel",
            ShadeLevelParameters: { Level: lvl, FadeTime: fade, DelayTime: "00:00:00" },
          },
        },
      });
    } else if (kind === "tilt") {
      attempts.push({
        label: "GoToTiltLevel",
        body: {
          Command: {
            CommandType: "GoToTiltLevel",
            TiltLevelParameters: { Tilt: lvl, FadeTime: fade },
          },
        },
      });
    } else if (kind === "shadeAndTilt") {
      attempts.push({
        label: "GoToShadeAndTiltLevel",
        body: {
          Command: {
            CommandType: "GoToShadeAndTiltLevel",
            ShadeAndTiltLevelParameters: {
              ShadeLevel: lvl,
              TiltLevel: lvl,
              FadeTime: fade,
              DelayTime: "00:00:00",
            },
          },
        },
      });
      attempts.push({
        label: "GoToShadeLevel",
        body: {
          Command: {
            CommandType: "GoToShadeLevel",
            ShadeLevelParameters: { Level: lvl, FadeTime: fade, DelayTime: "00:00:00" },
          },
        },
      });
    } else {
      attempts.push({
        label: "GoToDimmedLevel",
        body: {
          Command: {
            CommandType: "GoToDimmedLevel",
            DimmedLevelParameters: { Level: lvl, FadeTime: fade, DelayTime: "00:00:00" },
          },
        },
      });
    }
    // Universal last-ditch fallback: Caséta's generic GoToLevel. Caséta
    // doesn't speak any of the typed CommandTypes above, so this gets us
    // a working command even on a SmartBridge.
    attempts.push({
      label: "GoToLevel",
      body: {
        Command: {
          CommandType: "GoToLevel",
          Parameter: [
            { Type: "Level", Value: lvl },
            ...(fadeSeconds > 0 ? [{ Type: "Fade", Value: fade }] : []),
          ],
        },
      },
    });

    log(
      `[${this.host}:${this.port}] setOutput: zone=${id} level=${lvl} fade=${fade} kind=${kind} cmd=${attempts[0].label}${attempts.length > 1 ? ` (+${attempts.length - 1} fallback)` : ""}`
    );

    let lastError = null;
    for (let i = 0; i < attempts.length; i++) {
      const { label, body } = attempts[i];
      try {
        await this._sendZoneCommand(id, body, label);
        lastError = null;
        if (i > 0) {
          log(`[${this.host}:${this.port}] zone=${id}: ${label} accepted after ${i} earlier rejection(s)`);
        }
        break;
      } catch (err) {
        lastError = err;
        const isBadRequest =
          err?.leapStatus?.startsWith?.("400") ||
          err?.leapStatus === "" ||
          /BadRequest/i.test(err?.message);
        if (!isBadRequest) break;
        if (i < attempts.length - 1) {
          log(
            `[${this.host}:${this.port}] zone=${id}: ${label} rejected with 400 — falling back to ${attempts[i + 1].label}.`
          );
        }
      }
    }
    if (lastError) {
      logError(
        `[${this.host}:${this.port}] setOutput FAILED zone=${id} level=${lvl} kind=${kind}: ${lastError.message}`
      );
      throw lastError;
    }

    // Optimistically update the cache so the UI reflects the commanded
    // level immediately. The subscription will overwrite this with the
    // processor's reported value (with any rounding) a moment later.
    const updatedAt = new Date().toISOString();
    const next = {
      id: String(id),
      level: lvl,
      on: lvl > 0,
      kind,
      updatedAt,
    };
    this.lastLevels.set(String(id), next);
    this.emit("zoneLevel", next);
    return next;
  }

  async raiseLower(id, action, kindHint = null) {
    const cmdType =
      action === "raise" ? "Raise" : action === "lower" ? "Lower" : "Stop";
    const body = { Command: { CommandType: cmdType } };
    // Stash a kind hint if the UI knows — handy for downstream consumers
    // (subscription updates emitted after a Raise/Lower will keep this
    // kind sticky on the cache).
    if (kindHint) await this._probeZoneKind(id, kindHint);
    log(`[${this.host}:${this.port}] raiseLower: zone=${id} action=${action} cmd=${cmdType}`);
    try {
      await this._sendZoneCommand(id, body, cmdType);
    } catch (err) {
      // Older firmwares expect "StopRaisingOrLowering" instead of "Stop".
      if (action === "stop" && err?.leapStatus?.startsWith?.("400")) {
        await this._sendZoneCommand(
          id,
          { Command: { CommandType: "StopRaisingOrLowering" } },
          "StopRaisingOrLowering"
        );
      } else {
        throw err;
      }
    }
    // Fire an immediate `zoneLevel` event so any UI listening over SSE
    // pulses the row (and so the platform's pendingZones guard releases).
    // The subscription will overwrite the level a moment later with the
    // processor's real position; we don't fake a level here because
    // raise/lower runs for an unknown duration.
    const updatedAt = new Date().toISOString();
    const cached = this.lastLevels.get(String(id));
    if (cached) {
      const next = { ...cached, updatedAt };
      this.lastLevels.set(String(id), next);
      this.emit("zoneLevel", next);
    }
    return { id, action, updatedAt };
  }

  async pressButton(deviceId, componentId) {
    // HomeWorks QSX exposes buttons under
    //   /device/<dev>/buttongroup/<grp>/button/<btn>/commandprocessor
    // but the Integration Report only ever gives us the button's bare
    // component ID. Try the flat URL first (Caséta + most QSX); if the
    // processor 404s we fall back to the grouped form with group 0, which
    // is the default group on every QSX keypad.
    const tryUrl = async (url) => {
      const resp = await this.client.request(
        "CreateRequest",
        url,
        { Command: { CommandType: "PressAndRelease" } }
      );
      log(`[${this.host}:${this.port}] pressButton url=${url} ← ${resp?.CommuniqueType} status=${resp?.Header?.StatusCode}`);
      return this._ensureSuccess(resp, `PressAndRelease on ${url}`);
    };
    try {
      await tryUrl(`/device/${deviceId}/button/${componentId}/commandprocessor`);
    } catch (err) {
      if (err?.leapStatus?.startsWith?.("404") || /not.*found/i.test(err.message)) {
        await tryUrl(
          `/device/${deviceId}/buttongroup/0/button/${componentId}/commandprocessor`
        );
      } else {
        throw err;
      }
    }
    return { deviceId, componentId, pressedAt: new Date().toISOString() };
  }

  async activateAreaScene(areaId, sceneNumber) {
    const sceneN = Math.max(
      0,
      Math.min(16, Math.round(Number(sceneNumber) || 0))
    );
    log(`[${this.host}:${this.port}] activateAreaScene: area=${areaId} scene=${sceneN}`);

    // QSX / RA3 use a Properties wrapper; Caséta uses the bare Parameter
    // array. We try the QSX shape first and fall back on 400.
    const qsxBody = {
      Command: {
        CommandType: "ActivateScene",
        ActivateSceneParameters: { SceneNumber: sceneN },
      },
    };
    const casetaBody = {
      Command: {
        CommandType: "ActivateScene",
        Parameter: [{ Type: "SceneNumber", Value: sceneN }],
      },
    };
    const sendArea = async (body, label) => {
      const resp = await this.client.request(
        "CreateRequest",
        `/area/${areaId}/commandprocessor`,
        body
      );
      log(
        `[${this.host}:${this.port}] activateAreaScene area=${areaId} scene=${sceneN} cmd=${label} ← ${resp?.CommuniqueType} status=${resp?.Header?.StatusCode}`
      );
      return this._ensureSuccess(resp, `${label} on /area/${areaId}`);
    };
    try {
      await sendArea(qsxBody, "ActivateScene/QSX");
    } catch (err) {
      if (err?.leapStatus?.startsWith?.("400") || /BadRequest/i.test(err.message)) {
        await sendArea(casetaBody, "ActivateScene/Caséta");
      } else {
        throw err;
      }
    }
    return { areaId, sceneNumber: sceneN, activatedAt: new Date().toISOString() };
  }

  async getOutput(id, { force = false } = {}) {
    const key = String(id);
    if (!force && this.lastLevels.has(key)) {
      // The subscription cache is authoritative once it's been populated for
      // a given zone. The processor pushes a fresh value the instant the
      // zone changes, so a cache hit is always at least as fresh as a
      // synchronous ReadRequest.
      return this.lastLevels.get(key);
    }
    try {
      const resp = await this.client.request("ReadRequest", `/zone/${id}/status`);
      this._applyZoneStatusMessage(resp);
      if (this.lastLevels.has(key)) return this.lastLevels.get(key);
      // The processor replied but with a shape we couldn't parse. Log it
      // once for diagnostics — silently returning zero hides the issue.
      logWarn(
        `[${this.host}:${this.port}] /zone/${id}/status returned an unrecognised body: ${
          JSON.stringify(resp?.Body || {}).slice(0, 200)
        }`
      );
    } catch (err) {
      logWarn(`[${this.host}:${this.port}] /zone/${id}/status read failed: ${err.message}`);
      return {
        id: key,
        level: this.lastLevels.get(key)?.level ?? 0,
        on: this.lastLevels.get(key)?.on ?? false,
        error: err.message,
        updatedAt: new Date().toISOString(),
      };
    }
    return { id: key, level: 0, on: false, updatedAt: new Date().toISOString() };
  }

  async pollOutputs(ids) {
    const list = Array.isArray(ids) ? ids.map(String) : [];
    if (!list.length) return [];
    // Re-trigger the subscription if it was never established (e.g., the
    // processor rejected the first attempt). This is cheap and idempotent
    // because `_subscribeToAllZones` is guarded by `zoneSubscriptionAttempted`.
    if (!this.zoneSubscriptionTag) {
      this._subscribeToAllZones().catch(() => {});
    }
    // Use the cache for everything we already know about; fan out parallel
    // reads for the rest so a 50-zone poll completes in one network burst
    // rather than 50 sequential round-trips.
    const missing = list.filter((id) => !this.lastLevels.has(id));
    if (missing.length) {
      await Promise.allSettled(
        missing.map((id) => this.getOutput(id, { force: true }))
      );
    }
    return list.map(
      (id) =>
        this.lastLevels.get(id) || {
          id,
          level: 0,
          on: false,
          updatedAt: new Date().toISOString(),
        }
    );
  }

  async ping() {
    log(`[${this.host}:${this.port}] ping...`);
    try {
      const resp = await this.client.ping();
      log(`[${this.host}:${this.port}] ping OK`);
      return resp;
    } catch (err) {
      logError(`[${this.host}:${this.port}] ping FAILED: ${err.message}`);
      throw err;
    }
  }

  dispose() {
    this.disposed = true;
    this.state = "disconnected";
    this.lastLevels.clear();
    if (this.client) {
      try { this.client.drain(); } catch { /* */ }
      this.client = null;
    }
  }
}

/**
 * Normalize a LEAP ZoneStatus entry to `{ id, level, on, kind, updatedAt }`.
 *
 * The processor returns several variants depending on the underlying zone:
 *   - Dimmed:   { href: "/zone/<id>/status", Level: 75, Zone: { href: "/zone/<id>" } }
 *   - Switched: { href: ..., SwitchedLevel: "On" | "Off" }
 *   - Shade:    { href: ..., Level: 100, Tilt: 100 }
 *   - Tilt:     { href: ..., Tilt: 50 }                         (TiltOnly zones)
 *   - HWQS:     same as above but sometimes nested in OneZoneStatus.ZoneStatus
 *
 * `kind` lets `setOutput()` pick the right typed CreateRequest payload
 * (GoToDimmedLevel / GoToSwitchedLevel / GoToShadeLevel / GoToTiltLevel) so
 * HomeWorks QSX / RA3 / Athena accept the command on the first try.
 */
function parseZoneStatusEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const zoneHref = entry.Zone?.href || entry.href || "";
  const match = /\/zone\/(\d+)/.exec(zoneHref);
  if (!match) return null;
  const id = match[1];

  let kind = "dimmed";
  let level = null;

  // Order matters: Switched + TiltOnly entries never carry Level, while a
  // shade carries both Level and Tilt — Level alone wins for dimmers.
  if (entry.SwitchedLevel !== undefined && entry.SwitchedLevel !== null) {
    kind = "switched";
    level = /on/i.test(String(entry.SwitchedLevel)) ? 100 : 0;
  } else if (entry.Tilt !== undefined && entry.Level === undefined) {
    kind = "tilt";
    level = Number(entry.Tilt);
  } else if (entry.Lift !== undefined || entry.Tilt !== undefined) {
    kind = "shade";
    level = entry.Lift !== undefined ? Number(entry.Lift) : Number(entry.Level ?? entry.Tilt);
  } else if (entry.Level !== undefined && entry.Level !== null) {
    kind = "dimmed";
    level = Number(entry.Level);
  }
  if (level == null || Number.isNaN(level)) return null;
  return {
    id,
    level: Math.max(0, Math.min(100, Math.round(level))),
    on: level > 0,
    kind,
    updatedAt: new Date().toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getLeapClient(conn) {
  if (!conn?.host) return null;
  const certs = loadCerts(conn.host);
  if (!certs) return null;

  const key = `${conn.host}:${conn.port || LEAP_PORT}`;
  if (activeClient && activeClient.key === key && !activeClient.disposed) {
    return activeClient;
  }
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
  activeClient = new LutronLeapClientWrapper({
    host: conn.host,
    port: conn.port || LEAP_PORT,
  });
  return activeClient;
}

export function closeLeapClient() {
  if (activeClient) {
    try { activeClient.dispose(); } catch { /* */ }
    activeClient = null;
  }
}

export function isPaired(host) {
  if (!host) return false;
  return loadCerts(host) !== null;
}

export function getPairedHosts() {
  const hosts = [];
  if (!fs.existsSync(CERTS_DIR)) return hosts;
  for (const entry of fs.readdirSync(CERTS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const certs = loadCerts(entry.name);
      if (certs) hosts.push(entry.name);
    }
  }
  return hosts;
}

export function removePairedHost(host) {
  deleteCerts(host);
  pairingStates.delete(host);
}

export function mockPairing(host) {
  const keyPair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const mockCert = [
    "-----BEGIN CERTIFICATE-----",
    "MIIBmTCCAQECAQAwADAeMA0GCSqGSIb3DQEBCwUAMC0xCzAJBgNVBAYTAlVTMR4w",
    "HAYDVQQDExVXYXZlR3VhcmQgTW9jayBDZXJ0MB4XDTI1MDEwMTAwMDAwMFoXDTM1",
    "MDEwMTAwMDAwMFowLTELMAkGA1UEBhMCVVMxHjAcBgNVBAMTFVdhdmVHYWFyZCBN",
    "b2NrIENlcnQwXDANBgkqhkiG9w0BAQEFAANLADBIAkEA0I9V6JMB/v7y2nBtv5ZY",
    "t2yyoGJe1Wsj+QmAV2l0t0H0dAsnfFb9PmG0mo/lQ48A8Jo9H6Qx8DsX5PYLIDbT",
    "DQIDAQABMA0GCSqGSIb3DQEBCwUAA0EAmQJhG4L8GP3VhUQXhKzVFXab5KBVZzhY",
    "hbYs2A0XPAZn9LIsGy9yoR8Y06HjYk1qwZgvLFgYBFqYMi6p+Q5t",
    "-----END CERTIFICATE-----",
  ].join("\n");
  const mockCa = [
    "-----BEGIN CERTIFICATE-----",
    "MIIBdTCCAR4CAQEwDQYJKoZIhvcNAQELBQAwLTELMAkGA1UEBhMCVVMxHjAcBgNV",
    "BAMTFVdhdmVHYWFyZCBNb2NrIENBMB4XDTI1MDEwMTAwMDAwMFoXDTM1MDEwMTAw",
    "MDAwMFowLTELMAkGA1UEBhMCVVMxHjAcBgNVBAMTFVdhdmVHYWFyZCBNb2NrIENB",
    "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAM1sHGmB5V/TosVjFsT3sXcH6J4Fc8jW",
    "i7mJYSQZPRBxYp/Hh8o0Uh5xQGEhO5qF/wD3ACtMF9wqYRPw7Y8CAwEAATANBgkq",
    "hkiG9w0BAQsFAANBAJXKHHGCBrX4HqAERB2/jQrJq0MBHUJR7YEYiJzBHlFMiLg/",
    "5fJ6Kx7B8QoXsDH+/YJkYgPdjhNxFWNhMDnD",
    "-----END CERTIFICATE-----",
  ].join("\n");
  saveCerts(host, keyPair.privateKey, mockCert, mockCa);
  return { host, success: true };
}

/**
 * Test raw TCP + TLS connectivity to the processor's ports.
 * Tests BOTH port 8081 (LEAP) and port 8083 (pairing).
 */
export async function testConnection(host, port, timeoutMs = 5000) {
  const portsToTest = [8081, 8083];
  const startedAt = Date.now();
  const result = {
    host,
    port: undefined,
    reachable: false,
    tlsAccepted: false,
    peerCert: null,
    error: null,
    durationMs: 0,
    ports: {},
  };

  for (const p of portsToTest) {
    const portResult = { reachable: false, tlsAccepted: false, error: null };
    const label = `port ${p}`;

    // TCP probe
    log(`[${host}:${p}] testing TCP connectivity...`);
    const tcpOk = await new Promise((resolve) => {
      const sock = net.createConnection({ host, port: p, timeout: timeoutMs });
      let done = false;
      const finish = (ok, err) => {
        if (done) return;
        done = true;
        try { sock.destroy(); } catch { /* */ }
        if (!ok && err) portResult.error = err;
        resolve(ok);
      };
      sock.once("connect", () => finish(true));
      sock.once("error", (err) => finish(false, err.message));
      sock.once("timeout", () => finish(false, `timed out after ${timeoutMs}ms`));
    });
    portResult.reachable = tcpOk;
    if (!tcpOk) {
      result.ports[p] = portResult;
      continue;
    }

    // TLS probe
    log(`[${host}:${p}] testing TLS handshake...`);
    await new Promise((resolve) => {
      const sock = tls.connect({
        host,
        port: p,
        servername: "",
        rejectUnauthorized: false,
        timeout: timeoutMs,
      });
      let done = false;
      const finish = (ok, err) => {
        if (done) return;
        done = true;
        try { sock.destroy(); } catch { /* */ }
        if (!ok && err) portResult.error = err;
        resolve();
      };
      sock.once("secureConnect", () => {
        try {
          const cert = sock.getPeerCertificate();
          if (cert && Object.keys(cert).length > 0 && cert.subject) {
            portResult.peerCert = {
              subject: cert.subject.CN || JSON.stringify(cert.subject),
              issuer: cert.issuer?.CN || JSON.stringify(cert.issuer || {}),
              validFrom: cert.valid_from,
              validTo: cert.valid_to,
              fingerprint: cert.fingerprint,
            };
          }
        } catch { /* */ }
        portResult.tlsAccepted = true;
        finish(true);
      });
      sock.once("error", (err) => finish(false, err.message));
      sock.once("timeout", () => finish(false, `timed out after ${timeoutMs}ms`));
    });
    result.ports[p] = portResult;
  }

  // Aggregate: set top-level fields from best available port
  const allPorts = Object.values(result.ports);
  result.port = allPorts.some((p) => p.tlsAccepted)
    ? (allPorts.find((p, i) => p.tlsAccepted && portsToTest[i]) !== undefined ? portsToTest[allPorts.findIndex((p) => p.tlsAccepted)] : undefined)
    : portsToTest.find((p) => result.ports[p]?.reachable) || 8081;
  result.reachable = allPorts.some((p) => p.reachable);
  result.tlsAccepted = allPorts.some((p) => p.tlsAccepted);
  const firstTls = allPorts.find((p) => p.tlsAccepted);
  if (firstTls) {
    result.peerCert = firstTls.peerCert || null;
  }
  const firstErr = allPorts.find((p) => p.error);
  if (firstErr) result.error = firstErr.error;
  result.durationMs = Date.now() - startedAt;

  log(`[${host}] TCP ports: ${portsToTest.map((p) => `${p}=${result.ports[p]?.reachable ? "open" : "closed"}`).join(", ")}`);
  log(`[${host}] TLS: ${result.tlsAccepted ? "OK" : "FAIL"} (${result.durationMs}ms)`);
  return result;
}

/**
 * Start the LEAP certificate pairing flow with a processor.
 *
 * Based on the reference implementation from pylutron-caseta:
 *   1. TLS connect to port 8083 (pairing port) with Caséta LAP client cert.
 *   2. If TLS fails with LAP CA, retry with Lutron Root CA (for QSX/RA3).
 *   3. Read status messages — wait for PhysicalAccess permission (button press).
 *   4. Send CSR via /pair (Header uses RequestType: "Execute", NOT CommuniqueType).
 *   5. Receive SigningResult with Certificate + RootCertificate.
 *   6. Save certs, disconnect from 8083.
 *
 * Normal LEAP operations (after pairing) use port 8081 via LutronLeapClientWrapper.
 *
 * Returns { done: Promise<{host, cert, ca}>, cancel(): void }
 */
export function startPairing(host) {
  if (!host) throw new Error("startPairing: host is required");

  const existing = pairingStates.get(host);
  if (existing && existing.state !== "complete" && existing.state !== "failed") {
    throw new Error(`Pairing already in progress for ${host}`);
  }

  setPairingState(host, {
    state: "connecting",
    message: `Opening TLS connection to ${host}:${PAIRING_PORT}...`,
    error: null,
    startedAt: Date.now(),
    completedAt: null,
  });

  let timeout = null;
  let socket = null;
  let csr = null;
  let pemKey = null;
  let resolved = false;
  let resolveOuter;
  let rejectOuter;
  let buffer = "";

  const done = new Promise((resolve, reject) => {
    resolveOuter = resolve;
    rejectOuter = reject;
  });

  function finishSuccess(payload) {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    setPairingState(host, {
      state: "complete",
      message: "Pairing successful! Certificates saved.",
      completedAt: Date.now(),
    });
    cleanup();
    resolveOuter(payload);
  }

  function finishFailure(err) {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    setPairingState(host, {
      state: "failed",
      message: err.message || "Pairing failed",
      error: err.message || String(err),
      completedAt: Date.now(),
    });
    cleanup();
    rejectOuter(err);
  }

  function cleanup() {
    if (socket && !socket.destroyed) {
      try { socket.removeAllListeners(); } catch { /* */ }
      try { socket.end(); } catch { /* */ }
    }
  }

  function sendCsr(tag) {
    const csrTag = tag || `pair-${Date.now()}`;
    const message = JSON.stringify({
      Header: {
        RequestType: "Execute",
        Url: "/pair",
        ClientTag: csrTag,
      },
      Body: {
        CommandType: "CSR",
        Parameters: {
          CSR: csr,
          DisplayName: "WaveGuard",
          DeviceUID: "000000000000",
          Role: "Admin",
        },
      },
    });
    log(`[${host}:${PAIRING_PORT}] sending CSR (tag=${csrTag})...`);
    if (socket && !socket.destroyed) {
      socket.write(message + "\n");
    }
  }

  function handleData(data) {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        handleMessage(msg);
      } catch (e) {
        logWarn(`[${host}:${PAIRING_PORT}] malformed JSON:`, trimmed.substring(0, 120));
      }
    }
  }

  function handleMessage(msg) {
    if (resolved) return;
    const body = msg?.Body || {};
    const header = msg?.Header || {};
    const contentType = header.ContentType || "?";
    const statusCode = header.StatusCode || "?";
    log(`[${host}:${PAIRING_PORT}] ← ${contentType} status=${statusCode}`);

    // PhysicalAccess = button press detected
    if (body.Status?.Permissions?.includes("PhysicalAccess")) {
      log(`[${host}:${PAIRING_PORT}] BUTTON PRESS — Permissions=${body.Status.Permissions.join(",")}`);
      setPairingState(host, {
        state: "signing",
        message: "Button press detected — requesting signed certificate...",
      });
      sendCsr();
      return;
    }

    // Successful signing
    if (body.SigningResult) {
      log(`[${host}:${PAIRING_PORT}] received SigningResult`);
      const cert = body.SigningResult.Certificate;
      const ca = body.SigningResult.RootCertificate;
      if (cert && ca) {
        saveCerts(host, pemKey, cert, ca);
        finishSuccess({ host, cert, ca });
      } else {
        finishFailure(new Error("Pairing response missing certificate data"));
      }
      return;
    }

    // 401 = button not pressed yet
    if (body.Exception) {
      const exMsg = body.Exception.Message || "Unknown error";
      if (/unauthorized|not authorized/i.test(exMsg) ||
          statusCode === "401 Unauthorized" ||
          statusCode?.startsWith?.("401")) {
        log(`[${host}:${PAIRING_PORT}] 401 — waiting for button press (${exMsg})`);
        setPairingState(host, {
          state: "waiting-button",
          message: `Press the physical button on the processor at ${host} to authorize pairing.`,
        });
        return;
      }
      logError(`[${host}:${PAIRING_PORT}] exception: ${exMsg}`);
      finishFailure(new Error(`Processor rejected pairing: ${exMsg}`));
      return;
    }

    // Non-PhysicalAccess status update
    if (body.Status) {
      log(`[${host}:${PAIRING_PORT}] Status: ${JSON.stringify(body.Status)}`);
    }
  }

  // ── Async bootstrap ────────────────────────────────────────────────────
  (async () => {
    try {
      // 1. Generate RSA key pair + CSR
      log(`[${host}:${PAIRING_PORT}] generating RSA key pair (2048-bit)...`);
      const keyPair = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      pemKey = keyPair.privateKey;
      csr = createCSR(keyPair, `WaveGuard-${host.replace(/[^a-zA-Z0-9]/g, "-")}`);
      log(`[${host}:${PAIRING_PORT}] CSR generated`);

      // 2. TLS connect to port 8083 — try LAP CA first, fall back to Lutron Root CA
      log(`[${host}:${PAIRING_PORT}] connecting (TLS with LAP client cert)...`);
      socket = await tlsConnectToPairingPort(host, 10_000);
      log(`[${host}:${PAIRING_PORT}] TLS handshake complete`);

      setPairingState(host, {
        state: "waiting-button",
        message: `Connected to ${host}. Press the physical button on the processor now.`,
      });

      // 3. Wire up data handlers
      socket.on("data", handleData);
      socket.on("error", (err) => {
        logError(`[${host}:${PAIRING_PORT}] socket error: ${err.message}`);
        if (err.code) logError(`[${host}:${PAIRING_PORT}]   code: ${err.code}`);
        if (err.library) logError(`[${host}:${PAIRING_PORT}]   library: ${err.library}`);
        if (!resolved) {
          finishFailure(new Error(`Pairing connection lost: ${err.message}`));
        }
      });
      socket.on("close", () => {
        log(`[${host}:${PAIRING_PORT}] socket closed`);
        if (!resolved) {
          finishFailure(new Error("Connection closed by processor before pairing completed"));
        }
      });

      // 4. Send the initial CSR.  The processor will either:
      //    - Sign immediately (if button was already pressed recently) or
      //    - Respond 401, and we wait for the PhysicalAccess event.
      sendCsr();

      // 5. Overall timeout
      timeout = setTimeout(() => {
        if (!resolved) {
          finishFailure(new Error(
            `Pairing timed out after 3 minutes. ` +
            `Make sure you pressed the physical button on the processor at ${host}. ` +
            `On HomeWorks QSX, press the front panel button.`
          ));
        }
      }, PAIRING_TIMEOUT_MS);

    } catch (err) {
      logError(`[${host}:${PAIRING_PORT}] bootstrap error: ${err.message}`);
      if (err.code) logError(`[${host}:${PAIRING_PORT}]   code: ${err.code}`);
      if (err.stack) logError(`[${host}:${PAIRING_PORT}]   stack: ${err.stack.split("\n").slice(0, 6).join("\n")}`);
      finishFailure(err);
    }
  })();

  // Store cancel function in state
  const state = pairingStates.get(host);
  if (state) {
    state.cancel = () => {
      if (!resolved) {
        finishFailure(new Error("Pairing cancelled by user"));
      }
    };
  }

  done.catch(() => { /* error already in pairingStates */ });

  return {
    done,
    cancel: () => state?.cancel?.(),
  };
}

export function getPairingStatus(host) {
  if (!host) return "unpaired";
  if (loadCerts(host)) return "paired";
  const s = pairingStates.get(host);
  if (s && (s.state === "connecting" || s.state === "waiting-button" || s.state === "signing")) {
    return "pairing";
  }
  return "unpaired";
}

export function getPairingDetails(host) {
  if (!host) return { status: "unpaired" };
  if (loadCerts(host)) {
    return { status: "paired", message: "Processor is paired and ready." };
  }
  const s = pairingStates.get(host);
  if (!s) return { status: "unpaired" };
  if (s.state === "complete") {
    return { status: "paired", message: s.message, completedAt: s.completedAt };
  }
  if (s.state === "failed") {
    return {
      status: "failed",
      message: s.message,
      error: s.error,
      completedAt: s.completedAt,
    };
  }
  return {
    status: "pairing",
    state: s.state,
    message: s.message,
    startedAt: s.startedAt,
    elapsedMs: Date.now() - (s.startedAt || Date.now()),
  };
}

export function cancelPairing(host) {
  const s = pairingStates.get(host);
  if (s?.cancel) s.cancel();
}
