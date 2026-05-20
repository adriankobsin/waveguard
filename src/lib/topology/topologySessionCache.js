/** In-memory topology cache so navigating away from /topology does not trigger a new SNMP scan. */

let sessionCache = {
  topologyData: null,
  lastScan: null,
};

export function getTopologySessionCache() {
  return sessionCache;
}

export function setTopologySessionCache(topologyData, lastScan) {
  sessionCache = {
    topologyData: topologyData ?? sessionCache.topologyData,
    lastScan: lastScan !== undefined ? lastScan : sessionCache.lastScan,
  };
}

export function clearTopologySessionCache() {
  sessionCache = { topologyData: null, lastScan: null };
}
