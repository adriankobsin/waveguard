import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings, Trash2, X, ExternalLink } from "lucide-react";
import LocationPicker from "@/components/location/LocationPicker";
import { parseSwitchModel, resolveSwitchChassis } from "@/lib/snmp/switchModelCatalog";

export default function SnmpSwitchSettingsDrawer({
  profile,
  equipment,
  discovery,
  onSave,
  onRemove,
  onClose,
}) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  if (!draft) return null;

  const chassis = resolveSwitchChassis(equipment, draft);
  const modelSpec = parseSwitchModel(equipment?.model || "");

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Settings size={16} /> Switch configuration
        </h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled !== false}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-foreground">Include in scheduled / fleet polls</span>
        </label>

        {equipment?.model && (
          <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5 text-sm">
            <p className="text-xs text-muted-foreground">Equipment model (chassis)</p>
            <p className="font-mono font-medium text-foreground mt-0.5">{equipment.model}</p>
            {chassis ? (
              <p className="text-xs text-muted-foreground mt-1">{chassis.label}</p>
            ) : (
              <p className="text-xs text-amber-400/90 mt-1">
                Model not in catalog — use Cisco SKU format (e.g. C9300L-24P-4X-E) or set port override below.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Port override {modelSpec ? `(default ${modelSpec.portCount})` : ""}
            </label>
            <input
              type="number"
              min={1}
              max={128}
              placeholder={modelSpec ? String(modelSpec.portCount) : "From model"}
              value={draft.portCount ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, portCount: v === "" ? null : Number(v) }));
              }}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Poll interval override (sec)</label>
            <input
              type="number"
              min={60}
              placeholder="Platform default"
              value={draft.pollIntervalSec ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, pollIntervalSec: v === "" ? null : Number(v) }));
              }}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Location</p>
          <LocationPicker
            dark={false}
            deckId={draft.deckId}
            roomId={draft.roomId}
            onChange={({ deckId, roomId, location }) =>
              setDraft((d) => ({ ...d, deckId, roomId, location }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">SNMP community</label>
            <input
              value={draft.snmpCommunity}
              placeholder={discovery.snmpCommunity || "public"}
              onChange={(e) => setDraft((d) => ({ ...d, snmpCommunity: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">SNMP version</label>
            <select
              value={draft.snmpVersion}
              onChange={(e) => setDraft((d) => ({ ...d, snmpVersion: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
            >
              <option value="2c">v2c</option>
              <option value="3">v3</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm resize-none"
            placeholder="Rack position, maintenance window, STP root, etc."
          />
        </div>

        <Link
          to="/equipment"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink size={12} /> Edit hardware record in Equipment
        </Link>
      </div>
      <div className="p-4 border-t border-border flex gap-2">
        <button
          type="button"
          onClick={() => onRemove(draft)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10"
        >
          <Trash2 size={14} /> Remove
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}
