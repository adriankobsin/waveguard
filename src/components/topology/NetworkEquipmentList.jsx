import { ScanLine, Pencil } from "lucide-react";

const STATUS_DOT = {
  online: "bg-emerald-400",
  offline: "bg-red-400",
  warning: "bg-amber-400",
  unknown: "bg-slate-500",
};

export default function NetworkEquipmentList({
  devices,
  selectedNode,
  pathSource,
  pathTarget,
  pathMode,
  onRowClick,
  onScan,
  onEdit,
}) {
  if (!devices.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No devices match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1 min-h-0">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-secondary z-10 border-b border-border">
          <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider">
            <th className="px-3 py-2 w-8" />
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 hidden lg:table-cell">IP</th>
            <th className="px-3 py-2 hidden xl:table-cell">MAC</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 hidden md:table-cell">Location</th>
            <th className="px-3 py-2 hidden lg:table-cell">Model</th>
            <th className="px-3 py-2 text-center">Links</th>
            <th className="px-3 py-2 w-24" />
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const isSelected = selectedNode?.id === device.id;
            const isPathSource = pathSource?.id === device.id;
            const isPathTarget = pathTarget?.id === device.id;
            const connCount = device.connections?.length ?? 0;
            const status = device.status || "unknown";

            return (
              <tr
                key={device.id}
                onClick={() => onRowClick(device)}
                className={`border-b border-border cursor-pointer transition-colors ${
                  isPathSource || isPathTarget
                    ? "bg-orange-500/10"
                    : isSelected
                      ? "bg-cyan-500/10"
                      : "hover:bg-muted/50"
                }`}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[status] || STATUS_DOT.unknown}`} />
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground truncate max-w-[200px]">{device.name}</p>
                  {pathMode && (isPathSource || isPathTarget) && (
                    <span className="text-[10px] text-orange-400">
                      {isPathSource ? "Source" : "Target"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 hidden lg:table-cell font-mono text-xs text-muted-foreground">
                  {device.ip || "—"}
                </td>
                <td className="px-3 py-2 hidden xl:table-cell font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                  {device.mac || "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{device.category || "—"}</td>
                <td className="px-3 py-2">
                  <span className="text-xs capitalize text-muted-foreground">{status}</span>
                </td>
                <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground truncate max-w-[140px]">
                  {device.location || "—"}
                </td>
                <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
                  {device.model || "—"}
                </td>
                <td className="px-3 py-2 text-center text-xs text-muted-foreground">{connCount}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-0.5 justify-end">
                    <button
                      type="button"
                      title="Scan device"
                      onClick={() => onScan?.(device)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-cyan-400"
                    >
                      <ScanLine size={13} />
                    </button>
                    <button
                      type="button"
                      title="Edit device"
                      onClick={() => onEdit?.(device)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
