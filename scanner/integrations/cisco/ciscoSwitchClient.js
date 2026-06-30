/**
 * Cisco switch orchestrator — wraps the SSH client, the SNMP poller and
 * the in-memory mock engine behind one EventEmitter-shaped surface used
 * by the mock-server routes.
 *
 * Per-host singleton keyed by `host:sshPort:username` — same pattern as
 * `getLeapClient(conn)` in `scanner/integrations/lutron/leapClient.js`.
 * The previous client is disposed automatically when credentials change.
 *
 * The orchestrator chooses the data source per call:
 *   - SSH when reachable (rich `show` output)
 *   - SNMP for FDB + LLDP fallback when SSH didn't expose it
 *   - Mock when neither is reachable AND `allowMock` is true
 */

import { EventEmitter } from "node:events";
import { CiscoSshClient } from "./ciscoSshClient.js";
import { pollCiscoSwitch as pollCiscoSnmp } from "./ciscoSnmpPoller.js";
import { CiscoMockEngine, getCiscoMockEngine } from "./ciscoMockEngine.js";
import { probeCiscoPorts, recommendationFromPorts } from "./probeCiscoPorts.js";

class CiscoSwitchClient extends EventEmitter {
  constructor(connection) {
    super();
    this.connection = { ...connection };
    this.host = connection.host;
    this.sshPort = Number(connection.sshPort) || 22;
    this.snmpPort = Number(connection.snmpPort) || 161;
    this.username = connection.sshUsername || connection.username || "cisco";
    // Live deployments must not silently substitute demo data when SSH fails.
    this.allowMock =
      connection.allowMock === true ||
      process.env.WAVEGUARD_CISCO_ALLOW_MOCK === "1";
    this.snmpEnabled = connection.snmpEnabled !== false;
    this.platform = connection.platform || "auto";
    this._ssh = new CiscoSshClient({
      host: this.host,
      port: this.sshPort,
      username: this.username,
      password: connection.sshPassword || connection.password || "",
      enablePassword: connection.enablePassword || "",
      platform: this.platform,
      timeoutMs: connection.timeoutMs || 15_000,
    });
    this._lastSshError = null;
    this._lastSnapshot = null;
    this._disposed = false;
  }

  get key() {
    return `${this.host}:${this.sshPort}:${this.username}`;
  }

  get lastSnapshot() {
    return this._lastSnapshot;
  }

  async connect() {
    if (this._disposed) throw new Error("client disposed");
    try {
      await this._ssh.connect();
      this._lastSshError = null;
      this.emit("ready");
      return true;
    } catch (err) {
      this._lastSshError = err;
      this.emit("error", err);
      return false;
    }
  }

  /**
   * Lightweight connection test: probe ports, attempt SSH login, return
   * a structured result suitable for the modal banner.
   */
  async testConnection() {
    const ports = await probeCiscoPorts(this.host);
    const sshOnly = this.snmpEnabled === false;
    const recommendation = recommendationFromPorts(ports, { sshOnly });
    const sshPort = ports.find((p) => p.role === "ssh");
    const snmpPort = ports.find((p) => p.role === "snmp");
    if (!sshPort?.open) {
      return {
        success: false,
        host: this.host,
        ports,
        recommendation,
        message: `SSH (port ${this.sshPort}) is not reachable on ${this.host}.`,
      };
    }
    // SSH port is open — try a real login + a simple command.
    try {
      await this._ssh.connect();
      const probe = await this._ssh.ping();
      // Pull a system snapshot for the success banner.
      let system = null;
      try {
        system = await this._ssh.getSystem();
      } catch (sysErr) {
        // Connection succeeded but `show` output failed — still report success
        // and surface the failure in the message.
        return {
          success: true,
          host: this.host,
          ports,
          snmpReachable: !!snmpPort?.open,
          recommendation,
          system: null,
          message: `Authenticated successfully but \`show version\` failed: ${sysErr?.message || sysErr}`,
        };
      }
      return {
        success: true,
        host: this.host,
        ports,
        snmpReachable: sshOnly ? false : !!snmpPort?.open,
        sshOnly,
        recommendation,
        system,
        ping: probe,
        message:
          system?.model || system?.hostname
            ? `Connected to ${system.hostname || system.model} (${system.model || "switch"})${sshOnly ? " — SSH only" : ""}.`
            : sshOnly
              ? "SSH authenticated successfully (SSH-only mode)."
              : "SSH authenticated successfully.",
      };
    } catch (err) {
      return {
        success: false,
        host: this.host,
        ports,
        recommendation,
        message: `SSH login failed: ${err?.message || err}`,
        error: err?.message || String(err),
      };
    }
  }

  async getSystem() {
    try {
      return await this._ssh.getSystem();
    } catch (err) {
      this._lastSshError = err;
      if (this.allowMock) return getCiscoMockEngine({ host: this.host }).getSystem();
      throw err;
    }
  }

  async getInterfaces() {
    try {
      return await this._ssh.getInterfaces();
    } catch (err) {
      this._lastSshError = err;
      if (this.allowMock) return getCiscoMockEngine({ host: this.host }).getInterfaces();
      throw err;
    }
  }

  async getMacTable() {
    try {
      return await this._ssh.getMacTable();
    } catch (err) {
      this._lastSshError = err;
      if (this.allowMock) return getCiscoMockEngine({ host: this.host }).getMacTable();
      throw err;
    }
  }

  async getNeighbors() {
    try {
      return await this._ssh.getNeighbors();
    } catch (err) {
      this._lastSshError = err;
      if (this.allowMock) return getCiscoMockEngine({ host: this.host }).getNeighbors();
      throw err;
    }
  }

  /**
   * One-shot snapshot of every datapoint the UI cares about.
   *
   * Tries SSH first. If SSH succeeds we OPTIONALLY enrich with SNMP for
   * better LLDP/FDB coverage (helps when LLDP is enabled on the switch
   * but the CLI output format isn't fully parsed). If SSH fails AND
   * `allowMock` is true, returns mock data so the demo UI keeps working.
   */
  async pollAll({ snmpCommunity, snmpVersion } = {}) {
    let snapshot = null;
    try {
      snapshot = await this._ssh.pollAll();
      this._lastSshError = null;
    } catch (err) {
      this._lastSshError = err;
      if (this.allowMock) {
        snapshot = getCiscoMockEngine({ host: this.host }).pollAll();
      } else {
        throw err;
      }
    }

    if (snmpCommunity && this.snmpEnabled) {
      try {
        const snmp = await pollCiscoSnmp(this.host, {
          community: snmpCommunity,
          version: snmpVersion === "3" ? "3" : "2c",
          timeoutMs: 5000,
        });
        if (snmp?.fdb?.length) snapshot.macs = mergeMacTables(snapshot.macs, snmp.fdb);
        if (snmp?.lldp?.length) snapshot.neighbors = mergeLldp(snapshot.neighbors, snmp.lldp);
      } catch (snmpErr) {
        // SNMP failure is non-fatal — log and continue.
         
        console.warn(`[ciscoSwitchClient] SNMP enrich failed for ${this.host}:`, snmpErr?.message || snmpErr);
      }
    }

    this._lastSnapshot = snapshot;
    this.emit("snapshot", snapshot);
    return snapshot;
  }

  dispose() {
    this._disposed = true;
    try { this._ssh.dispose(); } catch { /* */ }
    this.removeAllListeners();
  }
}

function mergeMacTables(sshMacs, snmpFdb) {
  if (!Array.isArray(sshMacs) || sshMacs.length === 0) {
    return (snmpFdb || []).map((row) => ({
      vlan: row.vlan || 1,
      mac: row.mac,
      port: row.ifIndex ? `if${row.ifIndex}` : `br${row.bridgePort}`,
      type: "dynamic",
    }));
  }
  return sshMacs;
}

function mergeLldp(sshNeighbors, snmpLldp) {
  const out = { lldp: [...(sshNeighbors?.lldp || [])], cdp: [...(sshNeighbors?.cdp || [])] };
  // Append any SNMP-only neighbors (SSH may have missed them when paging
  // truncated the output).
  for (const n of snmpLldp || []) {
    const sshHit = out.lldp.find((s) => s.systemName === n.systemName);
    if (sshHit) continue;
    out.lldp.push({
      port: n.localPort ? `bp${n.localPort}` : "",
      chassisId: n.chassisId,
      portId: n.portId,
      portDescription: n.portDescription,
      systemName: n.systemName,
      systemDescription: n.systemDescription,
      capabilities: null,
    });
  }
  return out;
}

// ── Per-host singleton ───────────────────────────────────────────────────

const clients = new Map();

export function getCiscoSwitchClient(connection) {
  if (!connection?.host) return null;
  const key = `${connection.host}:${connection.sshPort || 22}:${connection.sshUsername || connection.username || "cisco"}`;
  const existing = clients.get(key);
  if (existing && !existing._disposed) return existing;
  for (const [k, c] of clients) {
    if (c.host === connection.host && k !== key) {
      c.dispose();
      clients.delete(k);
    }
  }
  const client = new CiscoSwitchClient(connection);
  clients.set(key, client);
  return client;
}

export function closeCiscoSwitchClient(host) {
  for (const [k, c] of clients) {
    if (!host || c.host === host) {
      c.dispose();
      clients.delete(k);
    }
  }
}

export { CiscoSwitchClient, CiscoMockEngine, probeCiscoPorts, recommendationFromPorts };
