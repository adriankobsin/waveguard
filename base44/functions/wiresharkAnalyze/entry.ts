import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { proxyToScanner, resolveAgentUrl } from "../scannerProxy.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const agentUrl = await resolveAgentUrl(base44);
    return await proxyToScanner("wiresharkAnalyze", body, agentUrl);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
