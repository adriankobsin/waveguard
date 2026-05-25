import express from 'express';
import cors from 'cors';
import { waveguardTools } from './tools/waveguard-tools.js';
import { webTools } from './tools/web-tools.js';

const MOCK_SERVER = 'http://localhost:3002';
const APP_ID = 'mock-app';

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const allTools = { ...waveguardTools, ...webTools };

async function resolveApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const res = await fetch(`${MOCK_SERVER}/api/apps/${APP_ID}/entities/SystemSettings?q=${encodeURIComponent(JSON.stringify({ key: 'ai' }))}`);
    if (res.ok) {
      const records = await res.json();
      const aiSettings = Array.isArray(records) ? records.find(r => r.key === 'ai') : null;
      if (aiSettings?.value?.key) return aiSettings.value.key;
    }
  } catch {}
  return null;
}

const toolDefinitions = [
  { type: 'function', function: { name: 'list_equipment', description: 'List all monitored equipment in the WaveGuard platform', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_diagnoses', description: 'Get current diagnoses — offline and warning equipment', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_topology', description: 'Get the current network topology scan result', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_events', description: 'Get recent action logs and events', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_speed_tests', description: 'Get recent WAN speed test results', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_equipment_by_ip', description: 'Find equipment by IP address', parameters: { type: 'object', properties: { ip: { type: 'string', description: 'IP address' } }, required: ['ip'] } } },
  { type: 'function', function: { name: 'web_search', description: 'Search the web for information', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'web_fetch', description: 'Fetch and read content from a URL', parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL to fetch' } }, required: ['url'] } } },
];

const SYSTEM_PROMPT = `You are Wave Guard, an expert AV/IT assistant for luxury yacht and high-end residential systems. You have live access to the WaveGuard platform's monitored equipment, events, network topology, and speed test results. You can also search the web.

Rules:
- Check WaveGuard data FIRST before answering questions about equipment, network, or events
- Be concise, practical, and specific
- Suggest concrete next steps for troubleshooting
- When asked about network problems, check equipment status and topology
- If you lack specific data, say so clearly — do not make up fake devices or values`;

async function executeToolCalls(toolCalls) {
  const results = [];
  for (const call of toolCalls) {
    const name = call.function?.name || call.name;
    let args = {};
    try {
      args = JSON.parse(call.function?.arguments || call.arguments || '{}');
    } catch {}
    try {
      const fn = allTools[name];
      if (!fn) {
        results.push({ role: 'tool', content: `Unknown tool: ${name}`, tool_call_id: call.id });
        continue;
      }
      const result = await fn(args);
      results.push({
        role: 'tool',
        content: typeof result === 'string' ? result : JSON.stringify(result),
        tool_call_id: call.id,
      });
    } catch (err) {
      results.push({ role: 'tool', content: `Error: ${err.message}`, tool_call_id: call.id });
    }
  }
  return results;
}

async function callOpenAI(messages, apiKey) {
  const body = {
    model: 'gpt-4o-mini',
    messages,
    tools: toolDefinitions,
    tool_choice: 'auto',
  };

  let turns = 0;
  while (turns++ < 6) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) throw new Error('Invalid OpenAI API key');
      throw new Error(`OpenAI error ${res.status}: ${err}`);
    }
    const data = await res.json();
    const message = data.choices[0].message;

    if (!message.tool_calls?.length) return message.content;

    messages.push(message);
    const toolResults = await executeToolCalls(message.tool_calls);
    messages.push(...toolResults);
    body.messages = messages;
  }
  return 'I had trouble processing that request. Please try again.';
}

async function prefetchWaveGuardContext() {
  const ctx = [];
  try {
    const [equipment, diagnoses, events, topology] = await Promise.all([
      allTools.list_equipment(),
      allTools.get_diagnoses(),
      allTools.get_events(),
      allTools.get_topology().catch(() => null),
    ]);
    ctx.push(`Equipment (${equipment.length} devices):\n${JSON.stringify(equipment, null, 2).slice(0, 2500)}`);
    ctx.push(`Diagnoses:\n${JSON.stringify(diagnoses, null, 2).slice(0, 1000)}`);
    ctx.push(`Recent events:\n${JSON.stringify(events.slice(0, 10), null, 2).slice(0, 1000)}`);
    if (topology?.devices?.length) {
      ctx.push(`Topology devices:\n${JSON.stringify(topology.devices.slice(0, 15), null, 2).slice(0, 1500)}`);
    }
  } catch (err) {
    ctx.push('(Live data unavailable)');
  }
  return ctx.join('\n\n');
}

async function callOllama(messages, ollamaHost) {
  const liveContext = await prefetchWaveGuardContext();
  const systemContent = SYSTEM_PROMPT + '\n\n## Current WaveGuard Data\n\n' + liveContext;

  const ollamaMessages = [
    { role: 'system', content: systemContent },
    ...messages.filter(m => m.role !== 'system'),
  ];

  const res = await fetch(`${ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2', messages: ollamaMessages, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 || res.status === 502) {
      throw new Error('Ollama is not running. Install Ollama and pull a model (e.g., llama3.2) to use offline mode.');
    }
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.message?.content || 'I could not generate a response.';
}

app.post('/chat', async (req, res) => {
  try {
    const { prompt, mode = 'online', conversation } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const messages = conversation?.length ? conversation.slice(-10) : [];
    messages.push({ role: 'user', content: prompt });

    const apiKey = await resolveApiKey();
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    let response;

    switch (mode) {
      case 'online': {
        if (!apiKey) {
          return res.status(400).json({
            error: 'OpenAI API key not configured. The platform operator can set the OPENAI_API_KEY environment variable, or add it in Settings → AI.',
            needsKey: true,
          });
        }
        response = await callOpenAI([{ role: 'system', content: SYSTEM_PROMPT }, ...messages], apiKey);
        break;
      }
      case 'offline': {
        response = await callOllama(messages, ollamaHost);
        break;
      }
      case 'both': {
        if (!apiKey) {
          return res.status(400).json({
            error: 'Both mode requires an OpenAI API key. Switch to Local mode or configure the key.',
            needsKey: true,
          });
        }
        const [onlineResult, offlineResult] = await Promise.allSettled([
          callOpenAI([{ role: 'system', content: SYSTEM_PROMPT }, ...messages], apiKey),
          callOllama(messages, ollamaHost),
        ]);
        const parts = [];
        if (onlineResult.value) parts.push('## Online Response\n\n' + onlineResult.value);
        if (offlineResult.value) parts.push('## Local Response\n\n' + offlineResult.value);
        if (onlineResult.reason) parts.push('## Online Error\n\n' + onlineResult.reason.message);
        if (offlineResult.reason) parts.push('## Local Error\n\n' + offlineResult.reason.message);
        response = parts.join('\n\n---\n\n');
        break;
      }
      default: {
        response = await callOpenAI([{ role: 'system', content: SYSTEM_PROMPT }, ...messages], apiKey);
        break;
      }
    }

    res.json({ response, mode });
  } catch (err) {
    console.error('[chat]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', async (_req, res) => {
  const key = await resolveApiKey();
  res.json({
    status: 'ok',
    openai: !!key,
    keySource: key ? (process.env.OPENAI_API_KEY ? 'env' : 'settings') : null,
    ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
  });
});

app.listen(PORT, () => {
  console.log(`[waveguard-chat] Running on port ${PORT}`);
  console.log(`[waveguard-chat] OpenAI: ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT configured'}`);
  console.log(`[waveguard-chat] Ollama: ${process.env.OLLAMA_HOST || 'http://localhost:11434'}`);
});
