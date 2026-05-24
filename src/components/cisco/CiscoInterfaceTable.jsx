import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Search, Zap, Filter } from "lucide-react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
  { id: "poe", label: "PoE active" },
  { id: "uplink", label: "Uplinks" },
];

function StatusDot({ status }) {
  const color =
    status === "up"
      ? "bg-emerald-400"
      : status === "down"
      ? "bg-muted-foreground"
      : "bg-amber-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function speedLabel(p) {
  if (!p.speedMbps && !p.speed) return "—";
  const mbps = p.speedMbps || p.speed;
  if (mbps >= 1000) return `${mbps / 1000}G`;
  return `${mbps}M`;
}

export default function CiscoInterfaceTable({ interfaces = [], onSelect }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return interfaces.filter((p) => {
      if (filter === "up" && p.status !== "up") return false;
      if (filter === "down" && p.status !== "down") return false;
      if (filter === "poe" && !(p.poeWatts > 0)) return false;
      if (filter === "uplink" && !p.isUplink) return false;
      if (!q) return true;
      const blob = `${p.name} ${p.ifAlias || ""} ${p.connectedDevice || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [interfaces, filter, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary">
          <Search size={12} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ports, descriptions or devices…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={11} className="text-muted-foreground" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${
                filter === f.id
                  ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-muted/30 border-b border-border">
          <div className="col-span-2">Port</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1 text-center">Speed</div>
          <div className="col-span-1 text-center">Duplex</div>
          <div className="col-span-1 text-center">VLAN</div>
          <div className="col-span-1 text-center">PoE</div>
          <div className="col-span-2">Connected</div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No ports match this filter.
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.index}
                onClick={() => onSelect?.(p)}
                className="w-full grid grid-cols-12 gap-2 px-3 py-2 text-xs hover:bg-muted/40 transition-colors text-left"
              >
                <div className="col-span-2 flex items-center gap-1.5 font-mono">
                  <StatusDot status={p.status} />
                  <span className={p.isUplink ? "text-cyan-300 font-semibold" : "text-foreground"}>
                    {p.name}
                  </span>
                </div>
                <div className="col-span-3 truncate text-muted-foreground">
                  {p.ifAlias || (p.isUplink ? "Uplink" : "—")}
                </div>
                <div className={`col-span-1 text-center font-mono uppercase text-[10px] ${
                  p.status === "up" ? "text-emerald-400" : p.status === "down" ? "text-muted-foreground" : "text-amber-400"
                }`}>
                  {p.status}
                </div>
                <div className="col-span-1 text-center font-mono text-foreground">{speedLabel(p)}</div>
                <div className="col-span-1 text-center font-mono text-muted-foreground">
                  {p.duplex || "—"}
                </div>
                <div className="col-span-1 text-center font-mono text-muted-foreground">
                  {p.vlan != null ? p.vlan : "—"}
                </div>
                <div className="col-span-1 text-center font-mono">
                  {p.poeWatts != null ? (
                    p.poeWatts > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Zap size={10} />
                        {p.poeWatts.toFixed(1)}W
                      </span>
                    ) : (
                      <span className="text-muted-foreground">off</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-2 truncate text-muted-foreground font-mono">
                  {p.connectedDevice || p.macAddr || "—"}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ArrowDown size={9} className="text-sky-400" /> Inbound
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ArrowUp size={9} className="text-amber-400" /> Outbound
        </span>
        <span className="ml-auto">
          {filtered.length} of {interfaces.length} ports shown
        </span>
      </div>
    </div>
  );
}
