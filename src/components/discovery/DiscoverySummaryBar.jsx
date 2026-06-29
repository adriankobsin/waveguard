import { CheckCircle2, Eye, EyeOff, Package, Clock, Wifi } from "lucide-react";

export default function DiscoverySummaryBar({ result, unclassified, monitored, ignored, inventory, onClassifyAll }) {
  return (
    <div className="px-5 py-3 border-b border-border bg-card/60 flex items-center gap-4 flex-wrap">
      {/* Scan info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-1">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 size={11} /> {result.totalFound} devices found
        </span>
        <span className="hidden sm:block">·</span>
        <span className="hidden sm:flex items-center gap-1.5">
          <Wifi size={11} className="text-cyan-400" /> Interface: <b className="text-secondary-foreground font-mono text-[10px]">{result.scanInterface}</b>
        </span>
        <span className="hidden md:block">·</span>
        <span className="hidden md:flex items-center gap-1.5">
          <Clock size={11} /> {(result.durationMs / 1000).toFixed(1)}s · {result.subnets?.join(", ")}
        </span>
      </div>

      {/* Classification counts */}
      <div className="flex items-center gap-2 text-xs">
        {unclassified > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock size={10} /> {unclassified} pending
          </span>
        )}
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Eye size={10} /> {monitored} monitored
        </span>
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <Package size={10} /> {inventory} equipment
        </span>
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-500/10 border border-slate-500/20 text-muted-foreground">
          <EyeOff size={10} /> {ignored} ignored
        </span>
      </div>

      {/* Bulk classify unclassified */}
      {unclassified > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Add all as:</span>
          <button onClick={() => onClassifyAll("monitored")} className="text-xs px-2.5 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">Monitor</button>
          <button onClick={() => onClassifyAll("inventory")} className="text-xs px-2.5 py-1 rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">Equipment</button>
          <button onClick={() => onClassifyAll("ignored")} className="text-xs px-2.5 py-1 rounded-lg border border-slate-500/25 bg-slate-500/10 text-muted-foreground hover:bg-slate-500/20 transition-colors">Ignore all</button>
        </div>
      )}
    </div>
  );
}