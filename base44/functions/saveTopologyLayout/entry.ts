import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { layoutData } = await req.json();

    if (!layoutData || !layoutData.name) {
      return Response.json({ error: 'Layout name is required' }, { status: 400 });
    }

    // Check if a default layout exists
    if (layoutData.is_default) {
      const existingDefaults = await base44.entities.LayoutTopology.filter({ is_default: true });
      // Unset other defaults
      for (const layout of existingDefaults) {
        await base44.entities.LayoutTopology.update(layout.id, { is_default: false });
      }
    }

    // Create or update layout
    let savedLayout;
    if (layoutData.id) {
      // Update existing
      const { id, ...updateData } = layoutData;
      savedLayout = await base44.entities.LayoutTopology.update(id, updateData);
    } else {
      // Create new
      savedLayout = await base44.entities.LayoutTopology.create(layoutData);
    }

    return Response.json({ 
      success: true, 
      layout: savedLayout,
      message: 'Layout saved successfully' 
    });
  } catch (error) {
    console.error('Failed to save layout:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});