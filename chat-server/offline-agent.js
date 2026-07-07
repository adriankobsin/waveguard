/**
 * Rule-based offline troubleshooting agent.
 * Uses live WaveGuard platform data — no cloud LLM or Ollama required.
 */

import { waveguardTools } from "./tools/waveguard-tools.js";

function bulletList(items) {
  if (!items?.length) return "_None_";
  return items.map((i) => `- **${i.name || i.action || i}**${i.ip ? ` (${i.ip})` : ""}${i.location ? ` — ${i.location}` : ""}`).join("\n");
}

export async function runOfflineAgent(prompt) {
  const q = String(prompt || "").trim().toLowerCase();
  if (!q) return "Ask me about equipment status, offline devices, WAN speed tests, or troubleshooting steps.";

  let diagnoses = null;
  let equipment = null;
  let events = null;
  let speedTests = null;

  const needsDiagnoses =
    /offline|warning|alarm|diagnos|problem|issue|fault|down|status|equipment|device|network|monitor/.test(q);
  const needsEvents = /event|log|history|recent|action/.test(q);
  const needsSpeed = /wan|speed|latency|bandwidth|internet|link/.test(q);

  try {
    if (needsDiagnoses || !needsEvents) {
      [diagnoses, equipment] = await Promise.all([
        waveguardTools.get_diagnoses(),
        waveguardTools.list_equipment(),
      ]);
    }
    if (needsEvents) events = await waveguardTools.get_events();
    if (needsSpeed) {
      try {
        speedTests = await waveguardTools.get_speed_tests();
      } catch {
        speedTests = null;
      }
    }
  } catch (err) {
    return `⚠️ I couldn't reach the WaveGuard platform data (${err.message}). Make sure the mock/API server is running on port 3002.`;
  }

  // PoE / camera troubleshooting
  if (/poe|camera|cctv|access point|ap\b/.test(q)) {
    const offline = diagnoses?.offline?.filter((d) =>
      /camera|ap|poe|cctv/i.test(`${d.name} ${d.location || ""}`)
    ) || [];
    return [
      "## PoE / camera troubleshooting",
      "",
      offline.length
        ? `**Affected devices (${offline.length}):**\n${bulletList(offline)}`
        : "_No PoE cameras or APs are currently marked offline._",
      "",
      "**Recommended checks:**",
      "1. Verify switch PoE budget — `show power inline` or the Core Network switch view",
      "2. Test the cable run (continuity + PoE pairs)",
      "3. Bounce the switch port or move the device to a known-good port",
      "4. Confirm the device is drawing PoE (LED / web UI if reachable)",
      "5. Check for recent STP or VLAN changes on that segment",
    ].join("\n");
  }

  // WAN / speed tests
  if (needsSpeed) {
    const latest = Array.isArray(speedTests) ? speedTests[0] : speedTests?.results?.[0];
    const lines = ["## WAN / speed test summary", ""];
    if (latest) {
      lines.push(
        `**Latest result:** ${latest.downloadMbps ?? latest.download ?? "—"} Mbps down / ${latest.uploadMbps ?? latest.upload ?? "—"} Mbps up`,
        latest.latencyMs != null ? `**Latency:** ${latest.latencyMs} ms` : "",
        latest.timestamp || latest.createdAt ? `**When:** ${latest.timestamp || latest.createdAt}` : ""
      );
    } else {
      lines.push("_No WAN speed test results stored yet._ Run a test from **Core Network → WAN Management**.");
    }
    lines.push("", "**If WAN is slow or unstable:**", "1. Check Peplink/router link status and failover", "2. Review packet loss on the primary WAN", "3. Confirm no saturation from guest Wi‑Fi or CCTV uploads");
    return lines.filter(Boolean).join("\n");
  }

  // Offline / warning inventory
  if (/offline|warning|down|alarm|diagnos/.test(q)) {
    return [
      "## Platform status",
      "",
      `**Online:** ${diagnoses?.online ?? "—"} / **Total:** ${diagnoses?.total ?? equipment?.length ?? "—"}`,
      "",
      `**Offline (${diagnoses?.offline?.length ?? 0}):**`,
      bulletList(diagnoses?.offline),
      "",
      `**Warnings (${diagnoses?.warning?.length ?? 0}):**`,
      bulletList(diagnoses?.warning),
      "",
      "**Next steps:**",
      "1. Open **Diagnoses** for severity-ranked findings",
      "2. Ping the device IP from the server or use Discovery",
      "3. Trace the cable path in **Cables → Patch Panel Schedules**",
      "4. Check switch port status in **Core Network**",
    ].join("\n");
  }

  // Equipment list
  if (/equipment|device|what.*on|inventory|list/.test(q)) {
    const sample = (equipment || []).slice(0, 20);
    const byStatus = {
      online: sample.filter((e) => e.status === "online").length,
      offline: sample.filter((e) => e.status === "offline").length,
      warning: sample.filter((e) => e.status === "warning").length,
    };
    return [
      "## Monitored equipment",
      "",
      `Showing ${sample.length} of ${equipment?.length ?? 0} devices.`,
      "",
      sample.map((e) => `- **${e.name}** — ${e.status || "unknown"}${e.ip ? ` · ${e.ip}` : ""}${e.location ? ` · ${e.location}` : ""}`).join("\n"),
      "",
      `**Summary:** ${byStatus.online} online, ${byStatus.warning} warning, ${byStatus.offline} offline (in sample)`,
    ].join("\n");
  }

  // Events
  if (needsEvents && events) {
    return [
      "## Recent events",
      "",
      events.length ? events.slice(-8).map((e) => `- ${e.action || "Event"} (${e.status || "—"})`).join("\n") : "_No recent action logs._",
    ].join("\n");
  }

  // Switch / CPU
  if (/switch|cpu|snmp|cisco|port|broadcast|storm/.test(q)) {
    return [
      "## Network switch guidance",
      "",
      "**High CPU or unstable switch:**",
      "1. Check for STP topology changes or loops",
      "2. Review broadcast/multicast rates per port",
      "3. Reduce SNMP polling interval if the NMS is aggressive",
      "4. Review recent config changes and error counters",
      "5. Schedule a maintenance window for firmware if vendor notes match",
      "",
      diagnoses?.offline?.length
        ? `**Currently offline:** ${diagnoses.offline.map((d) => d.name).join(", ")}`
        : "",
    ].filter(Boolean).join("\n");
  }

  // General fallback with live snapshot
  return [
    "## Wave Guard assistant (offline mode)",
    "",
    "I'm running without a cloud LLM, using live platform data and built-in AV/IT playbooks.",
    "",
    `**Network snapshot:** ${diagnoses?.online ?? "—"} online, ${diagnoses?.offline?.length ?? 0} offline, ${diagnoses?.warning?.length ?? 0} warning`,
    "",
    "**You can ask me about:**",
    "- Which equipment is offline or in warning",
    "- PoE camera / AP troubleshooting",
    "- WAN speed test results",
    "- Switch and network fault finding",
    "",
    "_Tip: install Ollama with `llama3.2` for richer conversational answers while staying offline._",
  ].join("\n");
}
