const DEFAULT_AGENT = "http://localhost:3002";
const APP_ID = Deno.env.get("BASE44_APP_ID") || "mock-app";

const SCAN_UNAVAILABLE_MSG =
  "Real scanning requires the WaveGuard scanner on your network. Run npm run mock from the project root, or set SCANNER_AGENT_URL to your on-prem agent.";

export async function proxyToScanner(
  functionName: string,
  body: Record<string, unknown>,
  agentUrl?: string | null
) {
  const base = (agentUrl || Deno.env.get("SCANNER_AGENT_URL") || DEFAULT_AGENT).replace(/\/$/, "");
  const url = `${base}/api/apps/${APP_ID}/functions/${functionName}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json(
        { success: false, error: data.error || data.message || `Scanner returned ${res.status}` },
        { status: res.status >= 500 ? 503 : res.status }
      );
    }
    return Response.json(data);
  } catch (err) {
    console.error(`[scannerProxy] ${functionName} failed:`, err);
    return Response.json({ success: false, error: SCAN_UNAVAILABLE_MSG }, { status: 503 });
  }
}

export async function resolveAgentUrl(base44: { entities: { SystemSettings: { filter: (q: object) => Promise<Array<{ value?: { agentUrl?: string } }>> } } } }) {
  try {
    const records = await base44.entities.SystemSettings.filter({ key: "discovery" });
    const v = records[0]?.value;
    if (v && typeof v === "object" && v.agentUrl) return v.agentUrl as string;
  } catch {
    /* use env default */
  }
  return Deno.env.get("SCANNER_AGENT_URL") || null;
}
