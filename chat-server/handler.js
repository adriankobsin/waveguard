import { waveguardTools } from "./tools/waveguard-tools.js";
import { webTools } from "./tools/web-tools.js";
import { runOfflineAgent } from "./offline-agent.js";

const MOCK_SERVER = process.env.WAVEGUARD_API_URL || "http://localhost:3002";
const APP_ID = process.env.WAVEGUARD_APP_ID || "mock-app";

const allTools = { ...waveguardTools, ...webTools };

async function resolveApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const res = await fetch(
      `${MOCK_SERVER}/api/apps/${APP_ID}/entities/SystemSettings?q=${encodeURIComponent(JSON.stringify({ key: "ai" }))}`
    );
    if (res.ok) {
      const records = await res.json();
      const aiSettings = Array.isArray(records) ? records.find((r) => r.key === "ai") : null;
      if (aiSettings?.value?.key) return aiSettings.value.key;
    }
  } catch {
    /* settings unavailable */
  }
  return null;
}

const toolDefinitions = [
  { type: "function", function: { name: "list_equipment", description: "List all monitored equipment", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_diagnoses", description: "Get offline and warning equipment", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_topology", description: "Get network topology scan", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_events", description: "Get recent action logs", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_speed_tests", description: "Get WAN speed test results", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_equipment_by_ip", description: "Find equipment by IP", parameters: { type: "object", properties: { ip: { type: "string" } }, required: ["ip"] } } },
];

const SYSTEM_PROMPT = `You are Wave Guard, an expert AV/IT assistant for luxury yacht and high-end residential systems. You have live access to the WaveGuard platform's monitored equipment, events, network topology, and speed test results.

Rules:
- Check WaveGuard data FIRST before answering questions about equipment, network, or events
- Be concise, practical, and specific
- Suggest concrete next steps for troubleshooting
- If you lack specific data, say so clearly — do not invent devices or values`;

async function executeToolCalls(toolCalls) {
  const results = [];
  for (const call of toolCalls) {
    const name = call.function?.name || call.name;
    let args = {};
    try {
      args = JSON.parse(call.function?.arguments || call.arguments || "{}");
    } catch {
      /* */
    }
    try {
      const fn = allTools[name];
      if (!fn) {
        results.push({ role: "tool", content: `Unknown tool: ${name}`, tool_call_id: call.id });
        continue;
      }
      const result = await fn(args);
      results.push({
        role: "tool",
        content: typeof result === "string" ? result : JSON.stringify(result),
        tool_call_id: call.id,
      });
    } catch (err) {
      results.push({ role: "tool", content: `Error: ${err.message}`, tool_call_id: call.id });
    }
  }
  return results;
}

async function callOpenAI(messages, apiKey) {
  const body = {
    model: "gpt-4o-mini",
    messages,
    tools: toolDefinitions,
    tool_choice: "auto",
  };

  let turns = 0;
  while (turns++ < 6) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) throw new Error("Invalid OpenAI API key");
      throw new Error(`OpenAI error ${res.status}: ${err}`);
    }
    const data = await res.json();
    const message = data.choices[0].message;
    if (!message.tool_calls?.length) return message.content;
    messages.push(message);
    messages.push(...(await executeToolCalls(message.tool_calls)));
    body.messages = messages;
  }
  return "I had trouble processing that request. Please try again.";
}

async function prefetchWaveGuardContext() {
  const ctx = [];
  try {
    const [equipment, diagnoses, events] = await Promise.all([
      allTools.list_equipment(),
      allTools.get_diagnoses(),
      allTools.get_events(),
    ]);
    ctx.push(`Equipment (${equipment.length} devices):\n${JSON.stringify(equipment, null, 2).slice(0, 2500)}`);
    ctx.push(`Diagnoses:\n${JSON.stringify(diagnoses, null, 2).slice(0, 1000)}`);
    ctx.push(`Recent events:\n${JSON.stringify(events.slice(0, 10), null, 2).slice(0, 1000)}`);
  } catch {
    ctx.push("(Live data unavailable)");
  }
  return ctx.join("\n\n");
}

async function ollamaReachable(ollamaHost) {
  try {
    const res = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function callOllama(messages, ollamaHost) {
  const liveContext = await prefetchWaveGuardContext();
  const ollamaMessages = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n## Current WaveGuard Data\n\n${liveContext}` },
    ...messages.filter((m) => m.role !== "system"),
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  let res;
  try {
    res = await fetch(`${ollamaHost}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OLLAMA_MODEL || "llama3.2", messages: ollamaMessages, stream: false }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Ollama timed out loading the model. Try again in a moment.");
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error("Ollama is not running or the model is missing. Pull a model with `ollama pull llama3.2`.");
  }
  const data = await res.json();
  return data.message?.content || "I could not generate a response.";
}

export async function getChatHealth() {
  const apiKey = await resolveApiKey();
  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
  const ollama = await ollamaReachable(ollamaHost);
  let platform = false;
  try {
    await waveguardTools.list_equipment();
    platform = true;
  } catch {
    platform = false;
  }
  return {
    status: "ok",
    openai: !!apiKey,
    ollama,
    offlineAgent: platform,
    ollamaHost,
    platform,
  };
}

export async function handleChatRequest(body) {
  const { prompt, mode = "local", conversation } = body || {};
  if (!prompt) {
    return { status: 400, body: { error: "prompt is required" } };
  }

  const messages = conversation?.length ? conversation.slice(-10) : [];
  messages.push({ role: "user", content: prompt });

  const apiKey = await resolveApiKey();
  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
  let response;
  let engine = mode;

  switch (mode) {
    case "online": {
      if (!apiKey) {
        return {
          status: 400,
          body: {
            error: "OpenAI API key not configured. Add it in Settings → AI & OpenAI, or switch to Local mode.",
            needsKey: true,
          },
        };
      }
      response = await callOpenAI([{ role: "system", content: SYSTEM_PROMPT }, ...messages], apiKey);
      break;
    }
    case "offline":
    case "local": {
      const ollamaUp = await ollamaReachable(ollamaHost);
      if (ollamaUp) {
        try {
          response = await callOllama(messages, ollamaHost);
          engine = "ollama";
          break;
        } catch (err) {
          console.warn("[chat] Ollama failed, using offline agent:", err.message);
        }
      }
      response = await runOfflineAgent(prompt);
      engine = "offline-agent";
      break;
    }
    case "both": {
      const parts = [];
      if (apiKey) {
        try {
          parts.push("## Online (OpenAI)\n\n" + (await callOpenAI([{ role: "system", content: SYSTEM_PROMPT }, ...messages], apiKey)));
        } catch (err) {
          parts.push("## Online Error\n\n" + err.message);
        }
      } else {
        parts.push("## Online\n\n_OpenAI key not configured._");
      }
      try {
        const ollamaUp = await ollamaReachable(ollamaHost);
        if (ollamaUp) {
          parts.push("## Local (Ollama)\n\n" + (await callOllama(messages, ollamaHost)));
        } else {
          parts.push("## Local (offline agent)\n\n" + (await runOfflineAgent(prompt)));
        }
      } catch (err) {
        parts.push("## Local\n\n" + (await runOfflineAgent(prompt)));
      }
      response = parts.join("\n\n---\n\n");
      engine = "both";
      break;
    }
    default:
      response = await runOfflineAgent(prompt);
      engine = "offline-agent";
  }

  return { status: 200, body: { response, mode, engine } };
}
