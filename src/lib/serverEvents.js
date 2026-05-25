import { getMockAppApiBase } from "@/api/mockApiHelpers";
import { isMockServer } from "@/api/base44Client";

let eventSource = null;
let reconnectTimer = null;
let listeners = {};

export function addServerEventListener(type, fn) {
  if (!listeners[type]) listeners[type] = [];
  listeners[type].push(fn);
  return () => {
    listeners[type] = listeners[type].filter((l) => l !== fn);
  };
}

function notifyListeners(type, data) {
  (listeners[type] || []).forEach((fn) => fn(data));
}

export function connectServerEvents() {
  if (!isMockServer) return;
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) return;

  const base = getMockAppApiBase();
  eventSource = new EventSource(`${base}/events`);

  eventSource.addEventListener("connected", (e) => {
    const data = JSON.parse(e.data);
  });

  eventSource.addEventListener("data-changed", (e) => {
    const data = JSON.parse(e.data);
    notifyListeners("data-changed", data);

    if (data.path && data.path.includes("Equipment")) {
      window.dispatchEvent(new CustomEvent("waveguard-equipment-changed"));
    }
    if (data.path && data.path.includes("snmp")) {
      window.dispatchEvent(new CustomEvent("waveguard-snmp-switches-changed"));
    }
    if (data.path && data.path.includes("wan")) {
      window.dispatchEvent(new CustomEvent("waveguard-wan-management-changed"));
    }

    // Generic catch-all: dispatch a refresh event for everything
    window.dispatchEvent(new CustomEvent("waveguard-server-data-changed"));
  });

  eventSource.addEventListener("error", () => {
    eventSource.close();
    eventSource = null;
    reconnectTimer = setTimeout(connectServerEvents, 5000);
  });
}

export function disconnectServerEvents() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
