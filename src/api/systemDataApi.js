import { base44 } from "@/api/base44Client";
import { listEquipment } from "@/api/equipmentApi";

function unwrapList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

export async function fetchSystemDataSources() {
  const [equipment, tasks, logs, rules] = await Promise.all([
    listEquipment(),
    base44.entities.MaintenanceTask.list().then(unwrapList).catch(() => []),
    base44.entities.ActionLog.list().then(unwrapList).catch(() => []),
    base44.entities.AutomationRule.list().then(unwrapList).catch(() => []),
  ]);

  return {
    equipment: Array.isArray(equipment) ? equipment : [],
    tasks: tasks || [],
    logs: logs || [],
    rules: rules || [],
  };
}
