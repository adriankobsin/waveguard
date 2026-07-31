import { useState } from "react";
import { Plus, X, Radar } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_DISCOVERY_SETTINGS, normalizeSubnetList } from "@/lib/discoverySettings";
import { discoverSubnets } from "@/lib/discoveryApi";
import { toast } from "sonner";

const INPUT_CLS =
  "w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50";

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground block">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? "bg-primary" : "bg-secondary border border-border"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export default function DiscoverySettingsPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings(
    "discovery",
    DEFAULT_DISCOVERY_SETTINGS
  );
  const [newSubnet, setNewSubnet] = useState("");
  const [detecting, setDetecting] = useState(false);
  const subnets = normalizeSubnetList(cfg.subnets);

  const addSubnet = (s) => {
    const val = (s || newSubnet).trim();
    if (!val || subnets.includes(val)) return;
    setCfg((c) => ({ ...c, subnets: [...normalizeSubnetList(c.subnets), val] }));
    setNewSubnet("");
  };

  const detectLocal = async () => {
    setDetecting(true);
    try {
      const data = await discoverSubnets(cfg.agentUrl);
      const list = data?.subnets || [];
      if (list.length) {
        setCfg((c) => ({
          ...c,
          subnets: [...new Set([...normalizeSubnetList(c.subnets), ...normalizeSubnetList(list)])],
        }));
        toast.success(`Found ${list.length} local subnet(s)`);
      } else {
        toast.info("No local subnets detected");
      }
    } catch (e) {
      toast.error(e.message || "Subnet detection failed");
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-xs text-muted-foreground">
        Configure default targets for Network Discovery and topology scans. Scans run on the WaveGuard server or mock agent on your LAN.
      </p>

      <Field label="Default subnets (CIDR)">
        <div className="flex flex-wrap gap-2 mb-2">
          {subnets.map((s) => (
            <span
              key={s}
              title={cfg.subnetLabels?.[s] || s}
              className="flex items-center gap-1 text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-lg"
            >
              <span className="font-mono">{s}</span>
              {cfg.subnetLabels?.[s] && (
                <span className="text-[10px] opacity-70 max-w-[120px] truncate">{cfg.subnetLabels[s]}</span>
              )}
              <button
                type="button"
                onClick={() =>
                  setCfg((c) => ({ ...c, subnets: normalizeSubnetList(c.subnets).filter((x) => x !== s) }))
                }
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        {(cfg.knownHosts?.length || 0) > 0 && (
          <p className="text-[11px] text-muted-foreground mb-2">
            {cfg.knownHosts.length} known IT hosts from vessel spreadsheet (priority-probed on scan).
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={newSubnet}
            onChange={(e) => setNewSubnet(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubnet()}
            placeholder="192.168.1.0/24"
            className={`${INPUT_CLS} font-mono`}
          />
          <button type="button" onClick={() => addSubnet()} className="px-3 rounded-xl border border-border hover:bg-secondary">
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={detectLocal}
            disabled={detecting}
            className="px-3 rounded-xl border border-primary/30 text-primary text-xs whitespace-nowrap"
          >
            {detecting ? "Detecting…" : "Detect local"}
          </button>
        </div>
      </Field>

      <Field label="Default scan method">
        <select
          value={cfg.scanType}
          onChange={(e) => setCfg((c) => ({ ...c, scanType: e.target.value }))}
          className={INPUT_CLS}
        >
          <option value="ping">Ping (ICMP)</option>
          <option value="arp">ARP (local segment)</option>
          <option value="full">Full (ping + ports + DNS)</option>
        </select>
      </Field>

      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-foreground">Auto-include local subnets</p>
          <p className="text-xs text-muted-foreground">Merge detected interfaces when no subnets are passed</p>
        </div>
        <Toggle
          on={cfg.autoDetectLocalSubnets}
          onToggle={() => setCfg((c) => ({ ...c, autoDetectLocalSubnets: !c.autoDetectLocalSubnets }))}
        />
      </div>

      <div className="border-t border-border pt-4 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Radar size={14} className="text-primary" /> SNMP enrichment
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">Query SNMP on discovered hosts (port 161)</p>
          <Toggle on={cfg.snmpEnabled} onToggle={() => setCfg((c) => ({ ...c, snmpEnabled: !c.snmpEnabled }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Community (v2c)">
            <input
              type="password"
              value={cfg.snmpCommunity}
              onChange={(e) => setCfg((c) => ({ ...c, snmpCommunity: e.target.value }))}
              className={`${INPUT_CLS} font-mono`}
            />
          </Field>
          <Field label="SNMP version">
            <select
              value={cfg.snmpVersion}
              onChange={(e) => setCfg((c) => ({ ...c, snmpVersion: e.target.value }))}
              className={INPUT_CLS}
            >
              <option value="2c">2c</option>
              <option value="3">3</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Max concurrent probes">
          <input
            type="number"
            min={8}
            max={128}
            value={cfg.maxConcurrent}
            onChange={(e) => setCfg((c) => ({ ...c, maxConcurrent: Number(e.target.value) }))}
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Timeout (ms)">
          <input
            type="number"
            min={500}
            max={5000}
            value={cfg.timeoutMs}
            onChange={(e) => setCfg((c) => ({ ...c, timeoutMs: Number(e.target.value) }))}
            className={INPUT_CLS}
          />
        </Field>
      </div>

      <Field label="Scanner agent URL (cloud proxy, optional)">
        <input
          value={cfg.agentUrl || ""}
          onChange={(e) => setCfg((c) => ({ ...c, agentUrl: e.target.value }))}
          placeholder="http://192.168.1.10:3002"
          className={INPUT_CLS}
        />
      </Field>

      <button
        type="button"
        onClick={() => save()}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
      >
        {saving ? "Saving…" : saved ? "Saved!" : "Save discovery settings"}
      </button>
    </div>
  );
}
