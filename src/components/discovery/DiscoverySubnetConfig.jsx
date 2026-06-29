import { useState, useMemo } from "react";
import { Plus, X, Network, Cpu, Radar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeSubnetList } from "@/lib/discoverySettings";

const COMMON_SUBNETS = [
  "192.168.1.0/24", "192.168.0.0/24", "192.168.10.0/24",
  "10.0.0.0/24", "10.0.1.0/24", "172.16.0.0/24",
];

const SCAN_TYPES = [
  { id: "ping",    label: "Ping Scan",     desc: "ICMP echo — fast, works on most networks" },
  { id: "arp",     label: "ARP Scan",      desc: "Layer 2 — more reliable on local segment" },
  { id: "full",    label: "Full Scan",     desc: "Ping + port detection + hostname resolve" },
];

export default function DiscoverySubnetConfig({
  subnets,
  onSubnetsChange,
  scanType,
  onScanTypeChange,
  onDetectSubnets,
}) {
  const [newSubnet, setNewSubnet] = useState("");
  const [detecting, setDetecting] = useState(false);
  const safeSubnets = useMemo(() => normalizeSubnetList(subnets), [subnets]);

  const detectLocal = async () => {
    if (!onDetectSubnets) return;
    setDetecting(true);
    try {
      const list = await onDetectSubnets();
      if (list?.length) toast.success(`Added ${list.length} local subnet(s) from this machine`);
      else toast.info("No local subnets detected — add a CIDR manually or start the scanner agent");
    } catch (e) {
      toast.error(e.message || "Detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const addSubnet = (s) => {
    const val = (s || newSubnet).trim();
    if (!val || safeSubnets.includes(val)) return;
    onSubnetsChange([...safeSubnets, val]);
    setNewSubnet("");
  };

  const removeSubnet = (s) => onSubnetsChange(safeSubnets.filter((x) => x !== s));

  return (
    <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Subnets */}
      <div>
        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2"><Network size={13} className="text-cyan-400" /> Target Subnets</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {safeSubnets.map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-lg font-mono">
              {s}
              <button onClick={() => removeSubnet(s)} className="text-cyan-400/60 hover:text-red-400 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={newSubnet}
            onChange={e => setNewSubnet(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSubnet()}
            placeholder="e.g. 192.168.20.0/24"
            className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
          />
          <button onClick={() => addSubnet()} className="px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors">
            <Plus size={13} />
          </button>
        </div>

        {onDetectSubnets && (
          <button
            type="button"
            onClick={detectLocal}
            disabled={detecting}
            className="mb-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {detecting ? <Loader2 size={12} className="animate-spin" /> : <Radar size={12} />}
            Detect local subnets
          </button>
        )}

        <p className="text-[10px] text-muted-foreground mb-2">Quick add:</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_SUBNETS.filter(s => !safeSubnets.includes(s)).map(s => (
            <button key={s} onClick={() => addSubnet(s)}
              className="text-[10px] font-mono px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/30 transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Scan type */}
      <div>
        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2"><Cpu size={13} className="text-cyan-400" /> Scan Method</p>
        <div className="space-y-2">
          {SCAN_TYPES.map(t => (
            <label key={t.id} onClick={() => onScanTypeChange(t.id)}
              className={`flex items-start gap-3 cursor-pointer px-3 py-2.5 rounded-xl border transition-all ${
                scanType === t.id ? "border-cyan-500/30 bg-cyan-500/8" : "border-border hover:bg-muted"
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
                scanType === t.id ? "border-cyan-400 bg-cyan-400" : "border-border"
              }`}>
                {scanType === t.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className={`text-xs font-semibold ${scanType === t.id ? "text-cyan-400" : "text-foreground"}`}>{t.label}</p>
                <p className="text-[10px] text-muted-foreground">{t.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {scanType === "full" && (
          <p className="text-[10px] text-cyan-500/80 mt-3">
            Full scan probes common TCP ports and resolves hostnames — slower than ping-only. Click Run Scan to start.
          </p>
        )}
      </div>
    </div>
  );
}