import { base44, isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import {
  SNMP_SWITCHES_SETTINGS_KEY,
  DEFAULT_SNMP_SWITCHES,
  normalizeSnmpSwitchesState,
  saveSnmpSwitchesLocal,
  loadSnmpSwitchesLocal,
  mergePollIntoProfile,
  getEquipmentIp,
  buildConnectionMap,
} from "@/lib/snmp/snmpSwitchProfiles";
import { buildMockPollResult } from "@/lib/snmp/snmpMockPoll";
import {
  buildMockPeplinkPoll,
  mergePeplinkIntoPoll,
} from "@/lib/integrations/peplink/peplinkAdapter";
import { portCountFromModel } from "@/lib/snmp/switchModelCatalog";
import { listEquipment, updateEquipment } from "@/api/equipmentApi";
import { isDemoModeActive } from "@/lib/platformMode";

async function postSnmpFunction(functionName, body) {
  const base = getMockAppApiBase();
  if (!base) return null;
  const res = await fetch(`${base}/functions/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

async function loadFromSystemSettings() {
  if (isDemoModeActive()) {
    const demo = await import("@/lib/demo/demoSystemSnapshot");
    return normalizeSnmpSwitchesState(demo.getDemoSnmpSwitches());
  }
  try {
    const records = await base44.entities.SystemSettings.filter({ key: SNMP_SWITCHES_SETTINGS_KEY });
    if (records.length > 0 && records[0].value != null) {
      return normalizeSnmpSwitchesState(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[snmpSwitchApi] settings load failed:", err);
  }
  const local = loadSnmpSwitchesLocal();
  return local || DEFAULT_SNMP_SWITCHES;
}

async function persistToSystemSettings(state) {
  const normalized = normalizeSnmpSwitchesState(state);
  if (isDemoModeActive()) {
    return normalized;
  }
  saveSnmpSwitchesLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({ key: SNMP_SWITCHES_SETTINGS_KEY });
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, {
        key: SNMP_SWITCHES_SETTINGS_KEY,
        value: normalized,
      });
    } else {
      await base44.entities.SystemSettings.create({
        key: SNMP_SWITCHES_SETTINGS_KEY,
        value: normalized,
      });
    }
  } catch (err) {
    console.warn("[snmpSwitchApi] settings save failed:", err);
  }
  return normalized;
}

async function syncEquipmentLocations(profiles) {
  if (isDemoModeActive()) return;
  for (const p of profiles || []) {
    if (!p.equipmentId) continue;
    try {
      await updateEquipment(p.equipmentId, {
        deckId: p.deckId || "",
        roomId: p.roomId || "",
        location: p.location || "",
      });
    } catch (err) {
      console.warn(`[snmpSwitchApi] equipment sync failed for ${p.equipmentId}:`, err);
    }
  }
}

async function clientPollSwitch(equipmentId) {
  const state = await loadFromSystemSettings();
  const profile = state.profiles.find((p) => p.equipmentId === equipmentId);
  if (!profile) {
    throw new Error("Managed switch profile not found");
  }
  const equipment = await listEquipment();
  const eq = equipment.find((e) => e.id === equipmentId);
  const ip = getEquipmentIp(eq) || "192.168.10.2";
  const stateFull = await loadFromSystemSettings();
  const portCount =
    portCountFromModel(eq?.model, profile.portCount) || profile.portCount || 12;
  let poll = buildMockPollResult(ip, eq?.name || profile.id, portCount);
  if (profile.pollMethod === "peplink_hybrid" || profile.integrationVendor === "peplink") {
    const pep = buildMockPeplinkPoll(eq?.model, ip);
    poll = mergePeplinkIntoPoll(poll, pep);
  }
  const updated = mergePollIntoProfile(profile, poll, {
    trafficHistorySamples: stateFull.global?.trafficHistorySamples,
    equipment: eq,
  });
  if (!isDemoModeActive()) {
    const nextState = {
      profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
    };
    await persistToSystemSettings(nextState);
  }
  return {
    success: true,
    profile: updated,
    poll,
    source: "mock",
    snmpWalkAvailable: false,
  };
}

function buildClientPollAllResponse(profiles, equipment) {
  const switches = profiles
    .filter((p) => p.enabled !== false && p.lastPoll)
    .map((p) => {
      const eq = equipment.find((e) => e.id === p.equipmentId);
      const ports = p.lastPoll?.ports || [];
      return {
        ip: getEquipmentIp(eq),
        name: eq?.name || p.lastPoll?.sysName,
        location: p.location || eq?.location,
        portsUp: ports.filter((pt) => pt.status === "up").length,
        portsDown: ports.filter((pt) => pt.status === "down").length,
        ports: ports.map((pt) => ({
          port: pt.index,
          ifAlias: pt.ifAlias,
          ifOperStatus: pt.status,
          ifSpeed: pt.speedMbps || pt.speed,
          connectedDevice: pt.connectedDevice,
          macAddr: pt.macAddr,
          vlan: pt.vlan,
          poeWatts: pt.poeWatts,
        })),
      };
    });
  const connectionMap = buildConnectionMap(
    switches.map((sw) => ({
      name: sw.name,
      ip: sw.ip,
      ports: sw.ports.map((pt) => ({
        index: pt.port,
        ifAlias: pt.ifAlias,
        status: pt.ifOperStatus,
        connectedDevice: pt.connectedDevice,
        macAddr: pt.macAddr,
        speedMbps: pt.ifSpeed,
        vlan: pt.vlan,
        poeWatts: pt.poeWatts,
      })),
    }))
  );
  return {
    success: true,
    switches,
    connectionMap,
    profiles,
    totalConnections: connectionMap.length,
    disconnectedPorts: connectionMap.filter((c) => c.status === "down").length,
    polledAt: new Date().toISOString(),
    snmpWalkAvailable: false,
  };
}

export async function listManagedSwitches() {
  return loadFromSystemSettings();
}

export async function saveManagedSwitches(state) {
  const normalized = normalizeSnmpSwitchesState(state);
  await syncEquipmentLocations(normalized.profiles);
  return persistToSystemSettings(normalized);
}

export async function pollSwitch(equipmentId) {
  if (isDemoModeActive()) {
    return clientPollSwitch(equipmentId);
  }
  if (isMockServer) {
    const server = await postSnmpFunction("snmpPollSwitch", { equipmentId });
    if (server) return server;
    return clientPollSwitch(equipmentId);
  }
  const res = await base44.functions.invoke("snmpPollSwitch", { equipmentId });
  return res.data;
}

export async function pollAll() {
  if (isDemoModeActive() || isMockServer) {
    if (!isDemoModeActive()) {
      const server = await postSnmpFunction("snmpPollAll", {});
      if (server) return server;
    }
    const state = await loadFromSystemSettings();
    const enabled = state.profiles.filter((p) => p.enabled !== false);
    const profiles = [];
    for (const p of enabled) {
      const result = await clientPollSwitch(p.equipmentId);
      profiles.push(result.profile);
    }
    const equipment = await listEquipment();
    return buildClientPollAllResponse(profiles, equipment);
  }
  const res = await base44.functions.invoke("snmpPollAll", {});
  return res.data;
}

export async function testInterface(equipmentId, ifIndex) {
  if (isDemoModeActive()) {
    const poll = await clientPollSwitch(equipmentId);
    const port = poll.profile?.lastPoll?.ports?.find((p) => p.index === Number(ifIndex));
    return port
      ? { success: true, port, polledAt: new Date().toISOString(), source: "mock" }
      : { success: false, message: `Interface ${ifIndex} not found` };
  }
  if (isMockServer) {
    const server = await postSnmpFunction("snmpTestInterface", { equipmentId, ifIndex });
    if (server) return server;
    const poll = await clientPollSwitch(equipmentId);
    const port = poll.profile?.lastPoll?.ports?.find((p) => p.index === Number(ifIndex));
    return port
      ? { success: true, port, polledAt: new Date().toISOString(), source: "mock" }
      : { success: false, message: `Interface ${ifIndex} not found` };
  }
  const res = await base44.functions.invoke("snmpTestInterface", { equipmentId, ifIndex });
  return res.data;
}

export async function testPeplinkConnection(equipmentId, profileDraft = null) {
  if (isMockServer) {
    const server = await postSnmpFunction("peplinkTestConnection", {
      equipmentId,
      profile: profileDraft,
    });
    if (server) return server;
    return { success: true, source: "peplink-mock", portCount: 5, online: true };
  }
  const res = await base44.functions.invoke("peplinkTestConnection", {
    equipmentId,
    profile: profileDraft,
  });
  return res.data;
}

export async function fetchPortMap() {
  if (isMockServer) {
    const server = await postSnmpFunction("snmpPortMap", {});
    if (server) return server;
    const poll = await pollAll();
    return poll;
  }
  const res = await base44.functions.invoke("snmpPortMap", {});
  return res.data;
}
