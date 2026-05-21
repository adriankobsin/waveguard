import { Link } from "react-router-dom";
import { Save, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SnmpPlatformSettings({
  global,
  discovery,
  onChange,
  onSave,
  saving,
}) {
  const set = (patch) => onChange({ ...global, ...patch });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Polling</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Auto-poll enabled switches</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Periodically refresh all enabled switches in the background
            </p>
          </div>
          <Switch
            checked={global.autoPollEnabled}
            onCheckedChange={(v) => set({ autoPollEnabled: v })}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Auto-poll interval (seconds)</Label>
            <input
              type="number"
              min={60}
              max={3600}
              value={global.autoPollIntervalSec}
              onChange={(e) => set({ autoPollIntervalSec: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">SNMP timeout (ms)</Label>
            <input
              type="number"
              min={500}
              max={10000}
              value={global.defaultPollTimeoutMs}
              onChange={(e) => set({ defaultPollTimeoutMs: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Traffic history samples per switch</Label>
          <input
            type="number"
            min={12}
            max={96}
            value={global.trafficHistorySamples}
            onChange={(e) => set({ trafficHistorySamples: Number(e.target.value) })}
            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Cable fault detection</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Flag ports that are down but have a known connected device (FDB / alias)
            </p>
          </div>
          <Switch
            checked={global.alertOnCableFault}
            onCheckedChange={(v) => set({ alertOnCableFault: v })}
          />
        </div>
        <div>
          <Label className="text-xs">Fleet alert when ports down (%)</Label>
          <input
            type="number"
            min={0}
            max={100}
            value={global.alertOnPortDownPct}
            onChange={(e) => set({ alertOnPortDownPct: Number(e.target.value) })}
            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">0 = disabled</p>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Display</h3>
        <div>
          <Label className="text-xs">Default port view</Label>
          <select
            value={global.defaultPortView}
            onChange={(e) => set({ defaultPortView: e.target.value })}
            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
          >
            <option value="panel">Front panel</option>
            <option value="table">Table</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Show inactive ports in table</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Include empty down ports in table filters</p>
          </div>
          <Switch
            checked={global.showInactivePorts}
            onCheckedChange={(v) => set({ showInactivePorts: v })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 flex gap-3">
        <Info size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Default SNMP community and version come from{" "}
            <Link to="/settings?section=discovery" className="text-primary hover:underline">
              Settings → Discovery
            </Link>{" "}
            ({discovery.snmpEnabled ? "enabled" : "disabled"}, community{" "}
            <code className="text-xs">{discovery.snmpCommunity || "public"}</code>).
          </p>
          <p>
            Live polls require Net-SNMP (<code className="text-xs">snmpwalk</code>) on the scanner host.
            Without it, deterministic mock data is used for development.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
      >
        <Save size={14} /> Save platform settings
      </button>
    </div>
  );
}
