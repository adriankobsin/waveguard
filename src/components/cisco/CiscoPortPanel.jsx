import { useEffect, useState } from "react";
import { Loader2, Power, RotateCcw, PlugZap, Ban, Tag, Network } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ciscoPortAction, CISCO_PORT_ACTIONS } from "@/api/ciscoApi";

const BTN = "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary/40 hover:bg-muted text-left disabled:opacity-50";

/**
 * One port, the jobs an ETO actually does on it, no IOS required.
 * Changes are live immediately; the workspace offers "Save to switch" after.
 */
export default function CiscoPortPanel({ open, port, switchRecord, vlans = [], canEdit, onClose, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [vlan, setVlan] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (!port) return;
    setVlan(port.vlan ? String(port.vlan) : "");
    setDesc(port.ifAlias || "");
  }, [port]);

  if (!port) return null;

  const run = async (action, extra = {}, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    const r = await ciscoPortAction(switchRecord, { action, port: port.name, ...extra });
    setBusy(null);
    if (r?.success) {
      toast.success(`${CISCO_PORT_ACTIONS[action].label}: ${port.name} done`);
      onChanged?.();
    } else {
      toast.error(r?.error || `${CISCO_PORT_ACTIONS[action].label} failed`);
    }
  };

  const Action = ({ action, icon: Icon, danger, extra, confirmText }) => (
    <button type="button" disabled={!canEdit || !!busy} onClick={() => run(action, extra, confirmText)} className={BTN}>
      {busy === action ? <Loader2 size={15} className="animate-spin mt-0.5" /> : <Icon size={15} className={`mt-0.5 ${danger ? "text-red-400" : "text-primary"}`} />}
      <span>
        <span className="block text-sm font-semibold text-foreground">{CISCO_PORT_ACTIONS[action].label}</span>
        <span className="block text-[11px] text-muted-foreground">{CISCO_PORT_ACTIONS[action].hint}</span>
      </span>
    </button>
  );

  const isUp = port.status === "up";
  const poe = port.poeWatts > 0 || port.poeStatus === "on";
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{port.name}{port.ifAlias ? <span className="font-sans text-muted-foreground font-normal"> · {port.ifAlias}</span> : null}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-border p-2"><div className="text-muted-foreground">Link</div><div className={`font-semibold ${isUp ? "text-emerald-400" : "text-muted-foreground"}`}>{port.status}{port.speedMbps ? ` · ${port.speedMbps >= 1000 ? `${port.speedMbps / 1000}G` : `${port.speedMbps}M`}` : ""}</div></div>
          <div className="rounded-lg border border-border p-2"><div className="text-muted-foreground">VLAN</div><div className="font-semibold">{port.trunk ? "trunk" : port.vlan ?? "—"}</div></div>
          <div className="rounded-lg border border-border p-2"><div className="text-muted-foreground">PoE</div><div className="font-semibold">{port.poeWatts != null ? `${port.poeWatts} W` : "—"}</div></div>
        </div>
        {(port.connectedDevice || port.macCount > 0) && (
          <p className="text-xs text-muted-foreground">Connected: <span className="text-foreground">{port.connectedDevice || `${port.macCount} device(s)`}</span>{port.macAddr ? <span className="font-mono"> · {port.macAddr}</span> : null}</p>
        )}
        {port.errors && (port.errors.fcs > 0 || port.errors.in > 0) && (
          <p className="text-xs text-amber-400">{(port.errors.fcs + port.errors.in).toLocaleString()} receive errors — usually a bad cable or termination.</p>
        )}
        {port.isUplink && <p className="text-xs text-amber-400">This is an uplink. Changing it can cut off everything behind it — including WaveGuard&apos;s access to other switches.</p>}
        {!canEdit && <p className="text-xs text-muted-foreground">Only admins and technicians can change ports.</p>}

        <div className="space-y-2">
          <Action action="bounce" icon={RotateCcw} confirmText={`Restart ${port.name}? The device loses its connection for a few seconds.`} />
          {poe && <Action action="poeCycle" icon={PlugZap} confirmText={`Cut power to the device on ${port.name} for 5 seconds?`} />}
          {port.adminDown || port.status === "err-disabled"
            ? <Action action="enable" icon={Power} />
            : <Action action="shutdown" icon={Ban} danger confirmText={`Disable ${port.name}? It stays off until you enable it again.`} />}
        </div>

        {!port.trunk && !port.isUplink && (
          <div className="flex items-end gap-2 pt-1">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Network size={11} /> Access VLAN</label>
              {vlans.length ? (
                <select value={vlan} onChange={(e) => setVlan(e.target.value)} disabled={!canEdit} className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm">
                  {vlans.map((v) => <option key={v.id} value={v.id}>{v.id} · {v.name}</option>)}
                </select>
              ) : (
                <input type="number" min={1} max={4094} value={vlan} onChange={(e) => setVlan(e.target.value)} disabled={!canEdit} className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm" />
              )}
            </div>
            <button type="button" disabled={!canEdit || !!busy || String(port.vlan) === vlan || !vlan} onClick={() => run("setVlan", { vlan: Number(vlan) }, `Move ${port.name} to VLAN ${vlan}?`)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
              {busy === "setVlan" ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Tag size={11} /> Port name</label>
            <input value={desc} maxLength={64} onChange={(e) => setDesc(e.target.value)} disabled={!canEdit} placeholder="e.g. NVX DEC Saloon TV" className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm" />
          </div>
          <button type="button" disabled={!canEdit || !!busy || desc === (port.ifAlias || "")} onClick={() => run("setDescription", { description: desc })} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {busy === "setDescription" ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
