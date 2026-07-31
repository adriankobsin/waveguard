import { X, Radio, Wifi } from "lucide-react";

export default function CiscoAccessPointDetail({ ap, onClose }) {
  if (!ap) return null;

  const clientTotal = ap.radios?.reduce((s, r) => s + (Number(r.clientCount) || 0), 0) || 0;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md z-50 bg-card border-l border-border shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">{ap.name}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">{ap.wtpMac}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground font-bold">Status</p>
            <p className="font-semibold mt-1 capitalize">{ap.status}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground font-bold">Clients</p>
            <p className="font-semibold mt-1">{clientTotal}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground font-bold">IP</p>
            <p className="font-mono mt-1">{ap.ip || "—"}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground font-bold">Model</p>
            <p className="mt-1">{ap.model || "—"}</p>
          </div>
        </div>

        {ap.joinError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
            Join error: {ap.joinError}
          </div>
        )}

        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2 flex items-center gap-1">
            <Radio size={12} /> Radios
          </p>
          {ap.radios?.length ? (
            <div className="space-y-2">
              {ap.radios.map((r) => (
                <div key={r.slot} className="rounded-lg border border-border p-3 text-xs">
                  <p className="font-semibold">
                    Slot {r.slot} · {r.band || "Radio"}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Ch {r.channel ?? "—"} · Tx {r.txPower ?? "—"} · Util{" "}
                    {r.channelUtil != null ? `${r.channelUtil}%` : "—"} · Clients{" "}
                    {r.clientCount ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No radio data.</p>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2 flex items-center gap-1">
            <Wifi size={12} /> SSIDs
          </p>
          {ap.ssids?.length ? (
            <div className="space-y-1">
              {ap.ssids.map((s, i) => (
                <div
                  key={`${s.ssid}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="font-semibold">{s.ssid}</span>
                  <span className="text-muted-foreground font-mono">{s.bssid || ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No SSID broadcast data.</p>
          )}
        </div>

        {(ap.siteTag || ap.policyTag || ap.serial) && (
          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
            {ap.serial && <p>Serial: {ap.serial}</p>}
            {ap.swVersion && <p>Firmware: {ap.swVersion}</p>}
            {ap.siteTag && <p>Site tag: {ap.siteTag}</p>}
            {ap.policyTag && <p>Policy tag: {ap.policyTag}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
