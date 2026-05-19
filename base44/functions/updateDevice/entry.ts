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

    const { deviceId, deviceData } = await req.json();

    if (!deviceId || !deviceData) {
      return Response.json({ error: 'Missing deviceId or deviceData' }, { status: 400 });
    }

    // In a real implementation, this would update the device in the actual network
    // For now, we'll just return success
    return Response.json({ 
      success: true, 
      message: 'Device updated successfully',
      deviceId,
      updatedData: deviceData
    });
  } catch (error) {
    console.error('Error updating device:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});