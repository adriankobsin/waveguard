import { AlertCircle } from "lucide-react";

export default function CiscoWirelessAlertsPanel({ snapshot }) {
  const offlineAps = snapshot?.accessPoints?.filter((a) => a.status === "offline") || [];
  const missingSubnet = snapshot?.wlans?.filter((w) => w.enabled && !w.subnetCidr) || [];

  if (!offlineAps.length && !missingSubnet.length) {
    return (
      <p className="text-xs text-muted-foreground py-4">
        No wireless alerts — all joined APs are online and SSIDs have subnet mappings.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {offlineAps.map((ap) => (
        <div
          key={ap.id || ap.wtpMac}
          className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs"
        >
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">{ap.name} offline</p>
            <p className="text-muted-foreground mt-0.5">
              {ap.joinError || "AP is not joined to the WLC."}
            </p>
          </div>
        </div>
      ))}
      {missingSubnet.map((w) => (
        <div
          key={w.profileName}
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
        >
          <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">
              SSID {w.ssid} — no subnet mapped
            </p>
            <p className="text-muted-foreground mt-0.5">
              Policy {w.policyProfile || "unknown"} · VLAN{" "}
              {w.vlanId ?? w.vlanName ?? "—"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
