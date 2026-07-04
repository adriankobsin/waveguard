#!/usr/bin/env node

import { waveguardTools } from './waveguard-tools.js';

const tools = Object.entries(waveguardTools).map(([name, fn]) => ({
  name,
  description: ({
    list_equipment: 'List all equipment on the WaveGuard network',
    get_diagnoses: 'Get current diagnoses showing offline or warning devices',
    get_topology: 'Get the current network topology scan',
    get_events: 'Get recent action logs and events',
    get_speed_tests: 'Get WAN speed test results',
    get_equipment_by_ip: 'Find a device by its IP address',
  })[name] || `WaveGuard tool: ${name}`,
  inputSchema: name === 'get_equipment_by_ip'
    ? { type: 'object', properties: { ip: { type: 'string' } }, required: ['ip'] }
    : { type: 'object', properties: {} },
}));

// JSON-RPC over stdio (MCP transport)
let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      handleRequest(JSON.parse(line));
    } catch {}
  }
});

async function handleRequest(req) {
  const { id, method, params } = req;

  const respond = (result) => {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  };
  const respondError = (code, message) => {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
  };

  switch (method) {
    case 'initialize':
      respond({
        protocolVersion: '0.1.0',
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: { name: 'waveguard-mcp', version: '1.0.0' },
      });
      break;

    case 'tools/list':
      respond({ tools });
      break;

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      const tool = waveguardTools[name];
      if (!tool) {
        respondError(-32602, `Unknown tool: ${name}`);
        return;
      }
      try {
        const result = await tool(args || {});
        respond({
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        respondError(-32603, err.message);
      }
      break;
    }

    default:
      respondError(-32601, `Method not found: ${method}`);
  }
}
