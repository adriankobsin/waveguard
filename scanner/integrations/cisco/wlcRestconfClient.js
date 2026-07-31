/**
 * Catalyst 9800 WLC RESTCONF client.
 *
 * Connects directly to the controller over HTTPS with HTTP Basic Auth.
 * Mirrors the singleton pattern used by ciscoSwitchClient.js.
 */

import https from "node:https";
import { EventEmitter } from "node:events";
import { buildWlcSnapshot, buildMockWlcSnapshot } from "./wlcSnapshot.js";

export const WLC_YANG_PATHS = {
  apOper: "Cisco-IOS-XE-wireless-access-point-oper:access-point-oper-data",
  apGlobalOper: "Cisco-IOS-XE-wireless-ap-global-oper:ap-global-oper-data",
  wlanCfg: "Cisco-IOS-XE-wireless-wlan-cfg:wlan-cfg-data/wlan-cfg-entries/wlan-cfg-entry",
  policyCfg: "Cisco-IOS-XE-wireless-policy-cfg:policy-cfg-data/policy-profile",
  tagCfg: "Cisco-IOS-XE-wireless-tag-cfg:tag-cfg-data/policy-tag",
  nativeInterface: "Cisco-IOS-XE-native:native/interface",
  nativeHostname: "Cisco-IOS-XE-native:native/hostname",
  rrmOper: "Cisco-IOS-XE-wireless-rrm-oper:rrm-oper-data",
  yangLibrary: "ietf-yang-library:modules-state",
};

const AP_NAME_MAC_KEYS = [
  "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map",
  "ap-name-mac-map",
];
const CAPWAP_KEYS = [
  "Cisco-IOS-XE-wireless-access-point-oper:capwap-data",
  "capwap-data",
];
const AP_OPER_ROOT_KEYS = [
  "Cisco-IOS-XE-wireless-access-point-oper:access-point-oper-data",
  "access-point-oper-data",
];

const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_CONCURRENCY = 8;

function formatHttpsError(err, client) {
  const code = err?.code || "";
  const msg = err?.message || String(err);
  if (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    /self[- ]signed|certificate/i.test(msg)
  ) {
    if (!client.allowInsecure) {
      return "TLS certificate verification failed. Enable “Accept self-signed certificate” for yacht WLCs.";
    }
    return `TLS error: ${msg}`;
  }
  if (code === "ECONNREFUSED") {
    return `HTTPS (port ${client.port}) refused connection on ${client.host}. Ensure ip http secure server is enabled.`;
  }
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || msg.includes("timed out")) {
    return `Connection to ${client.host}:${client.port} timed out. Check IP and firewall.`;
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `Host ${client.host} could not be resolved.`;
  }
  if (msg === "fetch failed") {
    return client.allowInsecure
      ? `HTTPS request to ${client.host}:${client.port} failed. Verify the IP, port, and that RESTCONF is enabled.`
      : "HTTPS request failed — try enabling “Accept self-signed certificate”.";
  }
  return msg;
}

function normalizeMac(mac) {
  if (!mac) return "";
  return String(mac).toUpperCase().replace(/-/g, ":");
}

/** RESTCONF list keys must percent-encode ':' in MAC addresses (RFC 8040). */
function encodeMacKey(mac) {
  return encodeURIComponent(normalizeMac(mac));
}

function encodeListKey(mac, slot) {
  return `${encodeMacKey(mac)},${slot}`;
}

function firstArray(data, keys) {
  for (const key of keys) {
    const v = data?.[key];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return [v];
  }
  return [];
}

function emptyApNameMacPayload() {
  return { "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map": [] };
}

function apRowsFromCapwap(capwapPayload) {
  const entries = firstArray(capwapPayload, CAPWAP_KEYS);
  return entries
    .map((cap) => {
      const wtpMac = normalizeMac(cap["wtp-mac"] || cap.wtpMac);
      if (!wtpMac) return null;
      return {
        "wtp-mac": wtpMac,
        "wtp-name": cap["ap-name"] || cap.apName || wtpMac,
        "eth-mac": normalizeMac(cap["ethernet-mac"] || cap.ethernetMac || cap["eth-mac"]),
      };
    })
    .filter(Boolean);
}

function extractApNameMac(payload) {
  if (!payload || typeof payload !== "object") return null;
  const direct = firstArray(payload, AP_NAME_MAC_KEYS);
  if (direct.length) {
    return { "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map": direct };
  }
  for (const rootKey of AP_OPER_ROOT_KEYS) {
    const root = payload[rootKey];
    if (!root || typeof root !== "object") continue;
    const nested = firstArray(root, AP_NAME_MAC_KEYS);
    if (nested.length) {
      return { "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map": nested };
    }
    const fromCapwap = apRowsFromCapwap(root);
    if (fromCapwap.length) {
      return { "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map": fromCapwap };
    }
  }
  const fromCapwap = apRowsFromCapwap(payload);
  if (fromCapwap.length) {
    return { "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map": fromCapwap };
  }
  return null;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

class WlcRestconfClient extends EventEmitter {
  constructor(connection) {
    super();
    this.on("error", (err) => {
      console.warn(`[wlcRestconfClient] ${connection.host} error:`, err?.message || err);
    });
    this.connection = { ...connection };
    this.host = connection.host;
    this.port = Number(connection.httpsPort) || Number(connection.port) || 443;
    this.username = connection.username || connection.sshUsername || "admin";
    this.password = connection.password || connection.sshPassword || "";
    this.allowInsecure = connection.allowInsecure !== false;
    this.allowMock =
      connection.allowMock === true || process.env.WAVEGUARD_CISCO_WLC_ALLOW_MOCK === "1";
    this.timeoutMs = connection.timeoutMs || DEFAULT_TIMEOUT_MS;
    this._lastSnapshot = null;
    this._disposed = false;
  }

  get key() {
    return `${this.host}:${this.port}:${this.username}`;
  }

  get lastSnapshot() {
    return this._lastSnapshot;
  }

  get baseUrl() {
    return `https://${this.host}:${this.port}/restconf/data`;
  }

  dispose() {
    this._disposed = true;
    this.removeAllListeners();
  }

  _httpsGet(yangPath) {
    if (this._disposed) return Promise.reject(new Error("client disposed"));
    const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    const path = `/restconf/data/${yangPath}`;
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.host,
          port: this.port,
          path,
          method: "GET",
          headers: {
            Accept: "application/yang-data+json",
            Authorization: `Basic ${auth}`,
          },
          rejectUnauthorized: !this.allowInsecure,
          servername: this.host,
          timeout: this.timeoutMs,
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            const status = res.statusCode || 0;
            if (status >= 400) {
              console.warn(
                `[wlcRestconfClient] GET ${path} → HTTP ${status}: ${text.slice(0, 180) || "(empty body)"}`
              );
            }
            resolve({
              status,
              ok: status >= 200 && status < 300,
              text,
            });
          });
        }
      );
      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Connection timed out"));
      });
      req.setTimeout(this.timeoutMs);
      req.end();
    });
  }

  async restconfGet(path, { optional = false } = {}) {
    const res = await this._httpsGet(path);
    // Cisco often returns 404 (or 204) for empty YANG lists — treat as empty data.
    if (res.status === 404 || res.status === 204) {
      if (optional) return {};
      const err = new Error(`RESTCONF GET ${path} failed: HTTP ${res.status}`);
      err.status = res.status;
      err.body = res.text.slice(0, 500);
      err.emptyList = true;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`RESTCONF GET ${path} failed: HTTP ${res.status}`);
      err.status = res.status;
      err.body = res.text.slice(0, 500);
      throw err;
    }
    if (!res.text.trim()) return {};
    return JSON.parse(res.text);
  }

  async restconfGetOptional(path) {
    try {
      return await this.restconfGet(path, { optional: true });
    } catch (err) {
      if (err?.status === 404 || err?.status === 204 || err?.emptyList) return {};
      throw err;
    }
  }

  /**
   * Resolve AP inventory. Prefer ap-name-mac-map; fall back to parent container
   * or capwap-data when the leaf list 404s (empty / older images).
   */
  async fetchApNameMacMap() {
    const attempts = [
      `${WLC_YANG_PATHS.apOper}/ap-name-mac-map`,
      WLC_YANG_PATHS.apOper,
      `${WLC_YANG_PATHS.apOper}/capwap-data`,
    ];
    let lastErr = null;
    let sawEmpty = false;
    for (const path of attempts) {
      try {
        const data = await this.restconfGet(path, { optional: true });
        const extracted = extractApNameMac(data);
        if (extracted) return extracted;
        sawEmpty = true;
      } catch (err) {
        lastErr = err;
        if (err?.status === 404 || err?.status === 204 || err?.emptyList) {
          sawEmpty = true;
          continue;
        }
        throw err;
      }
    }
    if (sawEmpty) return emptyApNameMacPayload();
    if (lastErr) throw lastErr;
    return emptyApNameMacPayload();
  }

  applyConnection(connection = {}) {
    if (!connection || typeof connection !== "object") return;
    this.connection = { ...this.connection, ...connection };
    this.host = connection.host || this.host;
    this.port = Number(connection.httpsPort) || Number(connection.port) || this.port || 443;
    this.username = connection.username || connection.sshUsername || this.username || "admin";
    if (connection.password != null || connection.sshPassword != null) {
      this.password = connection.password || connection.sshPassword || "";
    }
    if (connection.allowInsecure != null) {
      this.allowInsecure = connection.allowInsecure !== false;
    }
  }

  async probeHttps() {
    try {
      // Generic RESTCONF probe — AP list paths 404 when empty / model missing.
      const res = await this._httpsGet(WLC_YANG_PATHS.nativeHostname);
      if (res.status === 401 || res.status === 403 || res.ok || res.status === 404 || res.status === 204) {
        return {
          open: true,
          status: res.status,
          ok: res.ok,
          restconfOk: res.ok || res.status === 204,
          body: (res.text || "").slice(0, 200),
        };
      }
      return { open: true, status: res.status, ok: res.ok, restconfOk: false, body: (res.text || "").slice(0, 200) };
    } catch (err) {
      return { open: false, message: formatHttpsError(err, this) };
    }
  }

  async testConnection() {
    const probe = await this.probeHttps();
    if (!probe.open) {
      return {
        success: false,
        host: this.host,
        message:
          probe.message ||
          `HTTPS (port ${this.port}) is not reachable on ${this.host}. Ensure RESTCONF is enabled.`,
      };
    }
    if (probe.status === 401 || probe.status === 403) {
      return {
        success: false,
        host: this.host,
        authFailed: true,
        message: `Authentication failed (HTTP ${probe.status}). Check username/password and privilege 15.`,
      };
    }

    // Hostname 404 usually means RESTCONF itself is not enabled (web UI still answers HTTPS).
    if (!probe.restconfOk && probe.status === 404) {
      return {
        success: false,
        host: this.host,
        message:
          `HTTPS is up on ${this.host}:${this.port}, but RESTCONF returned HTTP 404 for /native/hostname. ` +
          `On the device run: ip http secure-server  then  restconf  then  show restconf state`,
      };
    }

    try {
      const data = await this.fetchApNameMacMap();
      const aps = data?.["Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map"] || [];
      const apCount = Array.isArray(aps) ? aps.length : aps ? 1 : 0;

      let wirelessPresent = apCount > 0;
      if (!wirelessPresent) {
        const operProbe = await this._httpsGet(WLC_YANG_PATHS.apOper);
        wirelessPresent = operProbe.ok || operProbe.status === 204;
        // Empty AP lists commonly 404 on IOS-XE — still treat as connected when RESTCONF works.
        if (!wirelessPresent && probe.restconfOk) {
          return {
            success: true,
            host: this.host,
            apCount: 0,
            wirelessModelMissing: true,
            controller: {
              model: "IOS-XE (RESTCONF OK — wireless AP model not found)",
              host: this.host,
            },
            message:
              `RESTCONF authenticated on ${this.host}, but wireless AP oper data was not found. ` +
              `Confirm this is a Catalyst 9800 (not a LAN switch) and wireless is enabled.`,
          };
        }
        if (!wirelessPresent) {
          return {
            success: false,
            host: this.host,
            message:
              `RESTCONF/wireless AP data not available on ${this.host} (HTTP ${operProbe.status}). ` +
              `Body: ${(operProbe.text || "").slice(0, 160) || "(empty)"}`,
          };
        }
      }

      return {
        success: true,
        host: this.host,
        apCount,
        controller: {
          model: "Catalyst 9800 WLC",
          host: this.host,
        },
        message:
          apCount > 0
            ? `RESTCONF connected — ${apCount} access point${apCount === 1 ? "" : "s"} registered.`
            : `RESTCONF connected — no access points currently registered (empty AP list).`,
      };
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        return {
          success: false,
          host: this.host,
          authFailed: true,
          message: `Authentication failed (HTTP ${err.status}). Check username/password and privilege 15.`,
        };
      }
      // RESTCONF auth worked earlier — don't fail the whole test on empty wireless lists.
      if (probe.restconfOk && (err.status === 404 || err.emptyList)) {
        return {
          success: true,
          host: this.host,
          apCount: 0,
          controller: { model: "Catalyst 9800 WLC", host: this.host },
          message: `RESTCONF connected — no access points currently registered (empty AP list).`,
        };
      }
      return {
        success: false,
        host: this.host,
        message: `${err?.message || String(err)}${err?.body ? ` — ${err.body}` : ""}`,
      };
    }
  }

  async fetchApCapwap(wtpMac) {
    const mac = encodeMacKey(wtpMac);
    try {
      return await this.restconfGetOptional(`${WLC_YANG_PATHS.apOper}/capwap-data=${mac}`);
    } catch {
      return null;
    }
  }

  async fetchApOper(wtpMac) {
    const mac = encodeMacKey(wtpMac);
    try {
      return await this.restconfGetOptional(`${WLC_YANG_PATHS.apOper}/oper-data=${mac}`);
    } catch {
      return null;
    }
  }

  async fetchApRadios(wtpMac, slotCount = 2) {
    const radios = [];
    for (let slot = 0; slot < slotCount; slot++) {
      try {
        const data = await this.restconfGetOptional(
          `${WLC_YANG_PATHS.apOper}/radio-oper-data=${encodeListKey(wtpMac, slot)}`
        );
        const entries =
          data?.["Cisco-IOS-XE-wireless-access-point-oper:radio-oper-data"] || [];
        const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
        for (const entry of list) {
          const bandInfo = entry["radio-band-info"]?.[0] || entry.radioBandInfo?.[0];
          const rrm = await this.fetchRrm(wtpMac, slot).catch(() => null);
          radios.push({
            slot,
            band: bandInfo?.band || entry.band || null,
            channel:
              entry["phy-ht-cfg"]?.["cfg-data"]?.["curr-freq"] ||
              entry.phyHtCfg?.cfgData?.currFreq ||
              null,
            txPower:
              bandInfo?.["phy-tx-pwr-cfg"]?.["cfg-data"]?.["current-tx-power-level"] ||
              null,
            clientCount: rrm?.stations ?? null,
            channelUtil: rrm?.ccaUtil ?? null,
            "vap-oper-config": entry["vap-oper-config"] || entry.vapOperConfig,
            vapOperConfig: entry["vap-oper-config"] || entry.vapOperConfig,
          });
        }
      } catch {
        /* slot may not exist */
      }
    }
    return radios;
  }

  async fetchRrm(wtpMac, slot) {
    const data = await this.restconfGetOptional(
      `${WLC_YANG_PATHS.rrmOper}/rrm-measurement=${encodeListKey(wtpMac, slot)}`
    );
    const entries = data?.["Cisco-IOS-XE-wireless-rrm-oper:rrm-measurement"] || [];
    const entry = Array.isArray(entries) ? entries[0] : entries;
    return {
      stations: entry?.load?.stations ?? null,
      ccaUtil: entry?.load?.["cca-util-percentage"] ?? null,
    };
  }

  async fetchNativeInterfaces() {
    try {
      return await this.restconfGetOptional(WLC_YANG_PATHS.nativeInterface);
    } catch {
      return {};
    }
  }

  async pollSnapshot() {
    if (this.allowMock) {
      const snapshot = buildMockWlcSnapshot(this.connection);
      this._lastSnapshot = snapshot;
      this.emit("snapshot", snapshot);
      return snapshot;
    }

    try {
      const [apNameMac, apJoinStats, wlanCfg, policyProfiles, policyTags, nativeIfaces] =
        await Promise.all([
          this.fetchApNameMacMap(),
          this.restconfGetOptional(`${WLC_YANG_PATHS.apGlobalOper}/ap-join-stats`),
          this.restconfGetOptional(WLC_YANG_PATHS.wlanCfg),
          this.restconfGetOptional(WLC_YANG_PATHS.policyCfg),
          this.restconfGetOptional(WLC_YANG_PATHS.tagCfg),
          this.fetchNativeInterfaces(),
        ]);

      const apList =
        apNameMac?.["Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map"] || [];

      // Empty AP inventory is valid (no APs joined). Missing wireless YANG still
      // yields an empty snapshot so the UI can show "0 APs" instead of a hard error.

      const capwapByMac = {};
      const operByMac = {};
      const radioByMac = {};

      await mapPool(apList, POLL_CONCURRENCY, async (row) => {
        const wtpMac = normalizeMac(row["wtp-mac"] || row.wtpMac);
        if (!wtpMac) return;
        const [capwap, oper] = await Promise.all([
          this.fetchApCapwap(wtpMac),
          this.fetchApOper(wtpMac),
        ]);
        if (capwap && Object.keys(capwap).length) capwapByMac[wtpMac] = capwap;
        if (oper && Object.keys(oper).length) operByMac[wtpMac] = oper;

        const capEntry = capwap?.["Cisco-IOS-XE-wireless-access-point-oper:capwap-data"];
        const cap = Array.isArray(capEntry) ? capEntry[0] : capEntry;
        const slotCount = cap?.["num-radio-slots"] || cap?.numRadioSlots || 2;
        radioByMac[wtpMac] = await this.fetchApRadios(wtpMac, slotCount);
      });

      const snapshot = buildWlcSnapshot(
        {
          apNameMac,
          apJoinStats,
          wlanCfg,
          policyProfiles,
          policyTags,
          nativeInterfaces: nativeIfaces,
          capwapByMac,
          operByMac,
          radioByMac,
          controllerInfo: { model: "Catalyst 9800 WLC" },
        },
        this.connection
      );

      this._lastSnapshot = snapshot;
      this.emit("snapshot", snapshot);
      return snapshot;
    } catch (err) {
      if (this.allowMock) {
        const snapshot = buildMockWlcSnapshot(this.connection);
        this._lastSnapshot = snapshot;
        return snapshot;
      }
      throw err;
    }
  }

  async getApDetail(wtpMac) {
    const mac = normalizeMac(wtpMac);
    const snapshot = this._lastSnapshot;
    const fromCache = snapshot?.accessPoints?.find(
      (a) => normalizeMac(a.wtpMac) === mac
    );
    if (fromCache) return fromCache;

    const [capwap, oper] = await Promise.all([
      this.fetchApCapwap(mac),
      this.fetchApOper(mac),
    ]);
    const capEntry = capwap?.["Cisco-IOS-XE-wireless-access-point-oper:capwap-data"];
    const cap = Array.isArray(capEntry) ? capEntry[0] : capEntry;
    const slotCount = cap?.["num-radio-slots"] || 2;
    const radios = await this.fetchApRadios(mac, slotCount);

    const partial = buildWlcSnapshot(
      {
        apNameMac: {
          "Cisco-IOS-XE-wireless-access-point-oper:ap-name-mac-map": [
            { "wtp-mac": mac, "wtp-name": cap?.["ap-name"] || mac },
          ],
        },
        apJoinStats: {},
        wlanCfg: {},
        policyProfiles: {},
        policyTags: {},
        nativeInterfaces: {},
        capwapByMac: { [mac]: capwap },
        operByMac: { [mac]: oper },
        radioByMac: { [mac]: radios },
      },
      this.connection
    );
    return partial.accessPoints[0] || null;
  }
}

const clients = new Map();

export function getWlcRestconfClient(connection) {
  if (!connection?.host) return null;
  const key = `${connection.host}:${connection.httpsPort || connection.port || 443}:${connection.username || connection.sshUsername || "admin"}`;
  const existing = clients.get(key);
  if (existing && !existing._disposed) {
    // Always refresh secrets/settings — password changes must not reuse a stale client.
    existing.applyConnection(connection);
    return existing;
  }
  for (const [k, c] of clients) {
    if (c.host === connection.host && k !== key) {
      c.dispose();
      clients.delete(k);
    }
  }
  const client = new WlcRestconfClient(connection);
  clients.set(key, client);
  return client;
}

export function closeWlcRestconfClient(host) {
  for (const [k, c] of clients) {
    if (!host || c.host === host) {
      c.dispose();
      clients.delete(k);
    }
  }
}

export { WlcRestconfClient };
