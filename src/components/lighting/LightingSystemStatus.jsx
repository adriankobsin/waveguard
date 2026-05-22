import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Wifi,
} from "lucide-react";

/**
 * Compact "house / processor" status panel for the Deck Control sidebar.
 *
 * Replaces the legacy DMX/DALI gateway list with the Lutron-only view:
 *   - load / area / scene / keypad counts from the imported house
 *   - integration processor status (online / offline / unset)
 *   - the configured LEAP/Telnet endpoint
 */
export default function LightingSystemStatus({
  house,
  hierarchy,
  zoneState,
  connection,
  lutronConn,
}) {
  const zones = house?.zones || [];
  const totalZones = zones.length;
  const onZones = zones.filter((z) => zoneState?.[z.href]?.on).length;
  const totalAreas = house?.areas?.length || 0;
  const totalScenes = house?.scenes?.length || 0;
  const totalDevices = house?.devices?.length || 0;
  const totalFloors = (hierarchy || []).length;

  let procStatus = "unset";
  let procLabel = "No processor";
  if (lutronConn?.host) {
    if (connection?.success) {
      procStatus = "online";
      procLabel = "Online";
    } else if (connection && !connection.success) {
      procStatus = "fault";
      procLabel = "Offline";
    } else {
      procStatus = "warning";
      procLabel = "Configured";
    }
  }

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
          Processor
        </p>
        <div className="rounded-lg bg-muted/50 border border-border p-2.5 space-y-1.5">
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
              <p
                className={`text-[10px] font-bold uppercase tracking-wide ${
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
              <p className="text-[10px] text-muted-foreground truncate">
                {lutronConn?.host
                  ? `${
                      lutronConn.protocol === "leap" ? "LEAP" : "Telnet"
                    } · ${lutronConn.host}:${lutronConn.port}`
                  : "Local mock engine"}
              </p>
            </div>
          </div>
          {connection?.processor && (
            <p className="text-[10px] text-muted-foreground border-t border-border pt-1.5 truncate">
              {connection.product || connection.processor}
              {connection.firmware ? ` · v${connection.firmware}` : ""}
            </p>
          )}
          {!lutronConn?.host && (
            <p className="text-[10px] text-muted-foreground border-t border-border pt-1.5">
              Add processor credentials to enable live LEAP / Telnet
              control.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
