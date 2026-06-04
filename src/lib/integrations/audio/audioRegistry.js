import { buildMockQsysEngine, createQsysClient } from "@/lib/integrations/audio/qsys/qsysAdapter";

const adapters = {
  qsys: {
    buildMockEngine: buildMockQsysEngine,
    createClient: createQsysClient,
  },
  symetrix: {
    buildMockEngine: () => import("@/lib/integrations/audio/symetrix/symetrixAdapter").then(m => m.buildMockSymetrixEngine()),
    createClient: (conn) => import("@/lib/integrations/audio/symetrix/symetrixAdapter").then(m => m.createSymetrixClient(conn)),
  },
  "crestron-nax": {
    buildMockEngine: () => import("@/lib/integrations/audio/crestron-nax/crestronNaxAdapter").then(m => m.buildMockCrestronNaxEngine()),
    createClient: (conn) => import("@/lib/integrations/audio/crestron-nax/crestronNaxAdapter").then(m => m.createCrestronNaxClient(conn)),
  },
};

export function getAdapter(systemType) {
  const adapter = adapters[systemType];
  if (adapter) return adapter;
  return adapters.qsys;
}

export function getRegisteredTypes() {
  return Object.keys(adapters);
}
