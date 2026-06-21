import { buildMockLutronEngine, createLutronClient } from "@/lib/integrations/lutron/lutronAdapter";
import { buildMockKnxEngine, createKnxClient } from "@/lib/integrations/knx/knxAdapter";
import { buildMockDaliEngine, createDaliClient } from "@/lib/integrations/dali/daliAdapter";
import { buildMockDmxEngine, createDmxClient } from "@/lib/integrations/dmx/dmxAdapter";
import { buildMockCrestronEngine, createCrestronClient } from "@/lib/integrations/crestron/crestronAdapter";
import { buildMockPharosEngine, createPharosClient } from "@/lib/integrations/pharos/pharosAdapter";
import { buildMockYachticaEngine, createYachticaClient } from "@/lib/integrations/yachtica/yachticaAdapter";

const adapters = {
  lutron: {
    buildMockEngine: buildMockLutronEngine,
    createClient: createLutronClient,
  },
  knx: {
    buildMockEngine: buildMockKnxEngine,
    createClient: createKnxClient,
  },
  dali: {
    buildMockEngine: buildMockDaliEngine,
    createClient: createDaliClient,
  },
  dmx: {
    buildMockEngine: buildMockDmxEngine,
    createClient: createDmxClient,
  },
  pharos: {
    buildMockEngine: buildMockPharosEngine,
    createClient: createPharosClient,
  },
  crestron: {
    buildMockEngine: buildMockCrestronEngine,
    createClient: createCrestronClient,
  },
  yachtica: {
    buildMockEngine: buildMockYachticaEngine,
    createClient: createYachticaClient,
  },
};

export function getAdapter(systemType) {
  return adapters[systemType] || adapters.lutron;
}

export function getRegisteredTypes() {
  return Object.keys(adapters);
}
