const MOCK_SERVER = 'http://localhost:3002';
const APP_ID = 'mock-app';

async function get(path) {
  const res = await fetch(`${MOCK_SERVER}/api/apps/${APP_ID}${path}`);
  if (!res.ok) throw new Error(`WaveGuard API ${path}: ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${MOCK_SERVER}/api/apps/${APP_ID}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`WaveGuard API POST ${path}: ${res.status}`);
  return res.json();
}

export const waveguardTools = {
  list_equipment: async () => {
    const data = await get('/entities/Equipment');
    return (data || []).map(e => ({
      id: e.id, name: e.name, model: e.model, ip: e.ip,
      category: e.category, status: e.status, location: e.location,
    }));
  },

  get_diagnoses: async () => {
    const equipment = await get('/entities/Equipment');
    const rows = equipment || [];
    return {
      offline: rows.filter(e => e.status === 'offline').map(e => ({ name: e.name, ip: e.ip, location: e.location })),
      warning: rows.filter(e => e.status === 'warning').map(e => ({ name: e.name, ip: e.ip, location: e.location })),
      total: rows.length,
      online: rows.filter(e => e.status === 'online').length,
    };
  },

  get_topology: async () => {
    return post('/functions/snmpTopologyScan', {});
  },

  get_events: async () => {
    const logs = await get('/entities/ActionLog');
    return (logs || []).slice(-20).map(l => ({
      action: l.action, status: l.status, created_date: l.created_date,
    }));
  },

  get_speed_tests: async () => {
    return get('/speedTests');
  },

  get_equipment_by_ip: async ({ ip }) => {
    const all = await get('/entities/Equipment');
    return (all || []).find(e => e.ip === ip) || null;
  },
};
