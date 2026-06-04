import { useState } from "react";
import { Clock, Trash2, Play, Search, Loader2, X } from "lucide-react";

const SCAN_TYPE_LABEL = { ping: "Ping", arp: "ARP", full: "Full" };

export default function ScanHistoryPanel({
  history,
  activeScanId,
  onSelectScan,
  onDeleteScan,
  onRunNew,
  loading,
}) {
  const [query, setQuery] = useState("");

  const filtered = (history || []).filter((entry) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (entry.scanType || "").toLowerCase().includes(q) ||
      (entry.subnets || []).some((s) => s.toLowerCase().includes(q)) ||
      String(entry.totalFound || 0).includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Scan History
          </h3>
          <span className="text-[10px] text-muted-foreground ml-1">
            {history.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onRunNew}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400"
        >
          <Play size={10} /> New
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter scans…"
            className="w-full bg-secondary border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Clock size={24} className="text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">
            {query ? "No scans match your filter" : "No previous scans yet"}
          </p>
          {!query && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Run a scan and results will appear here
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.map((entry) => {
            const isActive = entry.id === activeScanId;
            const subnets = entry.subnets || [];
            const cls = entry.scanType || "ping";
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelectScan(entry)}
                className={`w-full text-left px-4 py-2.5 transition-colors hover:bg-secondary/40 ${
                  isActive ? "bg-cyan-500/10 border-l-2 border-cyan-400" : "border-l-2 border-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {formatScanDate(entry.scannedAt)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {entry.totalFound ?? 0} devices · {SCAN_TYPE_LABEL[cls] || cls}
                      {entry.durationMs != null && ` · ${Math.round(entry.durationMs / 100) / 10}s`}
                    </p>
                    {subnets.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                        {subnets.join(", ")}
                      </p>
                    )}
                  </div>
                  {!isActive && (
                    <button
                      type="button"
                      title="Delete scan"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScan(entry.id);
                      }}
                      className="shrink-0 p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatScanDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
