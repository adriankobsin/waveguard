import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { file_url } = await req.json();
    
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Extract data from CSV
    const { output, status, details } = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          devices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                ip_address: { type: "string" },
                mac_address: { type: "string" },
                category: { type: "string" },
                location: { type: "string" },
                model: { type: "string" },
                serial_number: { type: "string" },
                firmware: { type: "string" },
                notes: { type: "string" }
              },
              required: ["name"]
            }
          }
        },
        required: ["devices"]
      }
    });

    if (status !== "success") {
      return Response.json({ error: 'Failed to parse CSV', details }, { status: 400 });
    }

    const devices = output.devices || [];
    
    if (devices.length === 0) {
      return Response.json({ error: 'No devices found in CSV' }, { status: 400 });
    }

    const deviceRecords = devices.map(d => ({
      name: d.name,
      ip: d.ip_address || '',
      mac: d.mac_address || '',
      category: d.category || 'Other',
      location: d.location || '',
      model: d.model || '',
      serial: d.serial_number || '',
      firmware: d.firmware || '',
      notes: d.notes || '',
      status: 'unknown',
      inventoryOnly: true,
      waveguardClassification: 'inventory',
    }));

    const created = [];
    for (const record of deviceRecords) {
      const existing = record.ip
        ? (await base44.entities.Equipment.filter({ ip: record.ip }))[0]
        : null;
      if (existing?.id) {
        created.push(await base44.entities.Equipment.update(existing.id, { ...existing, ...record }));
      } else {
        created.push(await base44.entities.Equipment.create(record));
      }
    }

    return Response.json({
      success: true,
      count: created.length,
      devices: created
    });
  } catch (error) {
    console.error('Import failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});