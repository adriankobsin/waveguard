import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Wifi,
} from "lucide-react";
import {
  SYSTEM_TYPE_LABELS,
  connectionForSystemType,
  resolveZoneSystemType,
} from "@/lib/lighting/lightingSettings";

/**
 * Compact house / processor status panel for the Deck Control sidebar.
 * Shows counts from the loaded house and connection status for each
 * enabled lighting/shade system (Lutron, KNX, Crestron, Pharos, etc.).
 */
export default function LightingSystemStatus({
  house,
  hierarchy,
  zoneState,
  systemsConfig,
  connection,
  lutronConn,
}) {
  const enabled = systemsConfig?.enabled || ["lutron"];
  const zones = (house?.zones || []).filter((z) =>
    enabled.includes(resolveZoneSystemType(z))
  );
  const totalZones = zones.length;
  const onZones = zones.filter((z) => zoneState?.[z.href]?.on).length;
  const totalAreas = house?.areas?.length || 0;
  const totalScenes = house?.scenes?.length || 0;
  const totalDevices = house?.devices?.length || 0;
  const totalFloors = (hierarchy || []).length;

  const cards = [
    { label: "Loads", value: totalZones, color: "text-foreground" },
    {
      label: "On",
      value: onZones,
      color: onZones > 0 ? "text-amber-400" : "text-muted-foreground",
    },
    { label: "Areas", value: totalAreas, color: "text-foreground" },
    { label: "Floors", value: totalFloors, color: "text-foreground" },
    { label: "Scenes", value: totalScenes, color: "text-foreground" },
    { label: "Keypads", value: totalDevices, color: "text-foreground" },
  ];

  const systemRows = enabled.map((type) => {
    const conn = connectionForSystemType(systemsConfig, type);
    let procStatus = "unset";
    let procLabel = "Not configured";
    if (conn?.host) {
      if (type === "lutron" && connection?.success) {
        procStatus = "online";
        procLabel = "Online";
      } else if (type === "lutron" && connection && !connection.success) {
        procStatus = "fault";
        procLabel = "Offline";
      } else if (conn.enabled) {
        procStatus = "warning";
        procLabel = "Configured";
      } else {
        procStatus = "warning";
        procLabel = "Host set";
      }
    }
    return { type, conn, procStatus, procLabel };
  });

  return (
    <div className="flex-1 px-4 pt-4 pb-4 space-y-4 overflow-y-auto">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          House Summary
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {cards.map((s) => (
            <div
              key={s.label}
              className="rounded-lg bg-muted border border-border p-2 text-center"
            >
              <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Systems ({enabled.length})
        </p>
        <div className="space-y-2">
          {systemRows.map(({ type, conn, procStatus, procLabel }) => (
            <div
              key={type}
              className="rounded-lg bg-muted/50 border border-border p-2.5 space-y-1"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center ${
                    procStatus === "online"
                      ? "bg-emerald-500/15"
                      : procStatus === "fault"
                      ? "bg-red-500/15"
                      : procStatus === "warning"
                      ? "bg-amber-500/15"
                      : "bg-secondary"
                  }`}
                >
                  {procStatus === "online" ? (
                    <CheckCircle2 size={11} className="text-emerald-400" />
                  ) : procStatus === "fault" ? (
                    <AlertTriangle size={11} className="text-red-400" />
                  ) : procStatus === "warning" ? (
                    <KeyRound size={11} className="text-amber-400" />
                  ) : (
                    <Wifi size={11} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">
                    {SYSTEM_TYPE_LABELS[type] || type}
                  </p>
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      procStatus === "online"
                        ? "text-emerald-400"
                        : procStatus === "fault"
                        ? "text-red-400"
                        : procStatus === "warning"
                        ? "text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {procLabel}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground truncate pl-7">
                {conn?.host
                  ? `${conn.protocol || "—"} · ${conn.host}:${conn.port}`
                  : "No host — using local mock engine"}
              </p>
              {type === "lutron" && connection?.processor && lutronConn?.host && (
                <p className="text-[10px] text-muted-foreground truncate pl-7 border-t border-border/50 pt-1 mt-1">
                  {connection.product || connection.processor}
                  {connection.firmware ? ` · v${connection.firmware}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
