import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { payload, options = {} } = await req.json();

    if (!payload?.equipment && !payload?.cables) {
      return Response.json({ error: 'payload with equipment or cables required' }, { status: 400 });
    }

    const result = {
      equipmentCreated: 0,
      equipmentUpdated: 0,
      cablesCreated: 0,
      cablesSkipped: 0,
      errors: [] as string[],
    };

    if (options.replace) {
      const existingEq = await base44.entities.Equipment.list();
      for (const e of existingEq) {
        if (e.id) await base44.entities.Equipment.delete(e.id);
      }
      const existingCables = await base44.entities.Cable.list();
      for (const c of existingCables) {
        if (c.id) await base44.entities.Cable.delete(c.id);
      }
    }

    const allEq = await base44.entities.Equipment.list();
    const byName = new Map(
      allEq.map((e: { name?: string }) => [(e.name || '').trim().toLowerCase(), e])
    );
    const byIp = new Map(
      allEq.filter((e: { ip?: string }) => e.ip).map((e: { ip: string }) => [e.ip, e])
    );

    for (const record of payload.equipment || []) {
      try {
        const nameKey = (record.name || '').trim().toLowerCase();
        const existing = byName.get(nameKey) || (record.ip ? byIp.get(record.ip) : null);
        if (existing?.id) {
          await base44.entities.Equipment.update(existing.id, { ...existing, ...record });
          result.equipmentUpdated++;
        } else {
          const created = await base44.entities.Equipment.create(record);
          result.equipmentCreated++;
          if (created?.name) byName.set(nameKey, created);
          if (created?.ip) byIp.set(created.ip, created);
        }
      } catch (err) {
        result.errors.push(`Equipment ${record.name}: ${(err as Error).message}`);
      }
    }

    const existingCables = await base44.entities.Cable.list();
    const cableLabels = new Set(existingCables.map((c: { label?: string }) => c.label));

    for (const cable of payload.cables || []) {
      if (!cable.label) continue;
      if (cableLabels.has(cable.label) && !options.replace) {
        result.cablesSkipped++;
        continue;
      }
      try {
        await base44.entities.Cable.create(cable);
        result.cablesCreated++;
        cableLabels.add(cable.label);
      } catch (err) {
        result.errors.push(`Cable ${cable.label}: ${(err as Error).message}`);
      }
    }

    if (payload.siteLocations?.decks?.length) {
      const key = 'site-locations';
      const records = await base44.entities.SystemSettings.filter({ key });
      const value = JSON.stringify(payload.siteLocations);
      if (records[0]?.id) {
        await base44.entities.SystemSettings.update(records[0].id, { key, value });
      } else {
        await base44.entities.SystemSettings.create({ key, value });
      }
    }

    if (payload.discoverySubnets?.length || payload.discoveryKnownHosts?.length) {
      const key = 'discovery';
      const records = await base44.entities.SystemSettings.filter({ key });
      let current: {
        subnets?: unknown[];
        subnetLabels?: Record<string, string>;
        knownHosts?: unknown[];
      } = { subnets: [], subnetLabels: {}, knownHosts: [] };
      if (records[0]?.value) {
        try {
          current =
            typeof records[0].value === 'string'
              ? JSON.parse(records[0].value)
              : records[0].value;
        } catch {
          current = { subnets: [], subnetLabels: {}, knownHosts: [] };
        }
      }
      const labels = { ...(current.subnetLabels || {}) };
      const cidrs: string[] = [];
      for (const entry of payload.discoverySubnets || []) {
        if (typeof entry === 'string' && entry.trim()) {
          cidrs.push(entry.trim());
        } else if (entry && typeof entry === 'object' && entry.cidr) {
          const cidr = String(entry.cidr).trim();
          if (!cidr) continue;
          cidrs.push(cidr);
          if (entry.label) labels[cidr] = String(entry.label).trim();
        }
      }
      current.subnets = [...new Set([...(current.subnets || []).map((s: unknown) =>
        typeof s === 'string' ? s : (s as { cidr?: string })?.cidr
      ).filter(Boolean), ...cidrs])];
      current.subnetLabels = labels;
      const hostByIp = new Map(
        (current.knownHosts || [])
          .filter((h: { ip?: string }) => h?.ip)
          .map((h: { ip: string }) => [String(h.ip).trim(), h])
      );
      for (const h of payload.discoveryKnownHosts || []) {
        const ip = String(h?.ip || '').trim();
        if (!ip || hostByIp.has(ip)) continue;
        hostByIp.set(ip, {
          ip,
          name: String(h.name || ip).trim(),
          vlan: String(h.vlan || '').trim(),
          source: h.source || 'import',
        });
      }
      current.knownHosts = [...hostByIp.values()];
      const value = JSON.stringify(current);
      if (records[0]?.id) {
        await base44.entities.SystemSettings.update(records[0].id, { key, value });
      } else {
        await base44.entities.SystemSettings.create({ key, value });
      }
    }

    if (payload.rackLayout) {
      await base44.entities.RackLayout.create(payload.rackLayout);
    }

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('importVesselSpreadsheet failed:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
