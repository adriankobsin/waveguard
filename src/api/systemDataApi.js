import { base44 } from "@/api/base44Client";
import { listEquipment } from "@/api/equipmentApi";
import { listManagedSwitches } from "@/api/snmpSwitchApi";
import { loadWanManagement } from "@/api/wanManagementApi";
import { isDemoModeActive } from "@/lib/platformMode";
import { buildDemoSystemSources } from "@/lib/demo/demoSystemSnapshot";

function unwrapList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

export async function fetchSystemDataSources({ demo } = {}) {
  const useDemo = demo ?? isDemoModeActive();
  if (useDemo) {
    return buildDemoSystemSources();
  }

  const [equipment, tasks, logs, rules, snmpSwitches, wanManagement] = await Promise.all([
    listEquipment(),
    base44.entities.MaintenanceTask.list().then(unwrapList).catch(() => []),
    base44.entities.ActionLog.list().then(unwrapList).catch(() => []),
    base44.entities.AutomationRule.list().then(unwrapList).catch(() => []),
    listManagedSwitches().catch(() => ({ profiles: [], global: {} })),
    loadWanManagement().catch(() => ({
      defaultDashboardLink: null,
      assignedRouterEquipmentIds: [],
      linkOverrides: {},
      manualLinks: [],
    })),
  ]);

  return {
    equipment: Array.isArray(equipment) ? equipment : [],
    tasks: tasks || [],
    logs: logs || [],
    rules: rules || [],
    snmpSwitches: snmpSwitches || { profiles: [], global: {} },
    wanManagement: wanManagement || {
      defaultDashboardLink: null,
      assignedRouterEquipmentIds: [],
      linkOverrides: {},
      manualLinks: [],
    },
  };
}
