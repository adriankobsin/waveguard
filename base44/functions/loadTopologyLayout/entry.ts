import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get default layout or most recent
    let layouts = await base44.entities.LayoutTopology.filter({ is_default: true });
    
    if (layouts.length === 0) {
      layouts = await base44.entities.LayoutTopology.list('-created_date', 1);
    }

    if (layouts.length === 0) {
      return Response.json({ layout: null });
    }

    return Response.json({ layout: layouts[0] });
  } catch (error) {
    console.error('Failed to load layout:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});