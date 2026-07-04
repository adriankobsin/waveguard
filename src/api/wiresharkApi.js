import { base44, isMockServer } from "@/api/base44Client";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";
import { appParams } from "@/lib/app-params";
import {
  mockWiresharkAnalyze,
  mockWiresharkCapture,
  mockWiresharkStats,
  mockWiresharkStatus,
} from "../../scanner/integrations/wireshark/wiresharkMockEngine.js";

const APP_ID = appParams.appId || import.meta.env.VITE_BASE44_APP_ID || "mock-app";

function unwrapInvokeResponse(res) {
  if (!res) return {};
  if (res.data && typeof res.data === "object" && "success" in res.data) return res.data;
  if (typeof res.success === "boolean") return res;
  return res.data ?? res;
}

async function postWiresharkFunction(functionName, body = {}) {
  const base = getMockAppApiBase();
  const url = `${base}/functions/${functionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getMockAuthHeaders(),
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid scanner response (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Scanner error (${res.status})`);
  }
  return data;
}

async function invokeOrMock(functionName, body, mockFn) {
  if (isMockServer) {
    try {
      return await postWiresharkFunction(functionName, body);
    } catch {
      return mockFn(body);
    }
  }
  try {
    const res = await base44.functions.invoke(functionName, body);
    return unwrapInvokeResponse(res);
  } catch {
    return mockFn(body);
  }
}

/** Check tshark availability and list capture interfaces. */
export async function checkWiresharkStatus() {
  return invokeOrMock("wiresharkStatus", {}, () => mockWiresharkStatus());
}

/** Run a timed live capture on the scanner host. */
export async function captureTraffic({
  interface: iface,
  durationSec = 10,
  bpfFilter = "",
  hostIp = "",
  maxPackets = 100,
} = {}) {
  return invokeOrMock(
    "wiresharkCapture",
    { interface: iface, durationSec, bpfFilter, hostIp, maxPackets },
    () => mockWiresharkCapture({ hostIp, durationSec, interface: iface })
  );
}

/** Analyze an existing capture by ID with optional display filter. */
export async function analyzeCapture({ captureId, displayFilter, maxPackets } = {}) {
  return invokeOrMock(
    "wiresharkAnalyze",
    { captureId, displayFilter, maxPackets },
    () => mockWiresharkAnalyze({ displayFilter })
  );
}

/** Upload a pcap/pcapng file and analyze it. */
export async function uploadAndAnalyze(file, { displayFilter, maxPackets } = {}) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });

  return invokeOrMock(
    "wiresharkAnalyze",
    { uploadBase64: base64, displayFilter, maxPackets },
    () => mockWiresharkAnalyze({ displayFilter })
  );
}

/** Get protocol/conversation statistics for a capture. */
export async function getCaptureStats(captureId) {
  return invokeOrMock(
    "wiresharkStats",
    { captureId },
    () => mockWiresharkStats()
  );
}

/** Download capture file URL for browser fetch. */
export function getCaptureDownloadUrl(captureId) {
  if (!captureId) return null;
  const base = getMockAppApiBase();
  if (base) {
    return `${base}/wireshark/captures/${encodeURIComponent(captureId)}/download`;
  }
  return `/api/apps/${APP_ID}/wireshark/captures/${encodeURIComponent(captureId)}/download`;
}

export async function downloadCapture(captureId) {
  const url = getCaptureDownloadUrl(captureId);
  if (!url) throw new Error("Download URL unavailable");
  const res = await fetch(url, { headers: getMockAuthHeaders() });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.blob();
}
