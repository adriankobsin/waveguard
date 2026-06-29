import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSpeedMbps } from "@/lib/snmp/snmpAnalytics";

const STATUS_BADGE = {
  up: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  down: "bg-red-500/15 text-red-400 border-red-500/30",
  disabled: "bg-secondary text-muted-foreground",
  unknown: "bg-secondary text-muted-foreground",
};

export default function SnmpPortTable({ ports, selectedPort, onSelectPort, showInactive = true }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = ports || [];
    if (!showInactive) list = list.filter((p) => p.status === "up" || p.connectedDevice);
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          String(p.index).includes(q) ||
          (p.name || "").toLowerCase().includes(q) ||
          (p.ifAlias || "").toLowerCase().includes(q) ||
          (p.connectedDevice || "").toLowerCase().includes(q) ||
          (p.macAddr || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [ports, query, statusFilter, showInactive]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search port, alias, device, MAC…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-secondary/30"
          />
        </div>
        {["all", "up", "down", "disabled"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 text-xs rounded-lg border capitalize ${
              statusFilter === s
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/40 hover:bg-secondary/40">
              <TableHead className="w-12">Port</TableHead>
              <TableHead>Interface</TableHead>
              <TableHead>Alias</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Connected</TableHead>
              <TableHead>Traffic</TableHead>
              <TableHead>PoE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No ports match filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const selected = selectedPort?.index === p.index;
                const fault = p.status === "down" && p.connectedDevice;
                return (
                  <TableRow
                    key={p.index}
                    onClick={() => onSelectPort?.(selected ? null : p)}
                    className={`cursor-pointer ${selected ? "bg-primary/10" : ""} ${fault ? "bg-red-500/5" : ""}`}
                  >
                    <TableCell className="font-mono font-medium">{p.index}</TableCell>
                    <TableCell className="font-mono text-xs">{p.name}</TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate">{p.ifAlias || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[p.status] || STATUS_BADGE.unknown}>
                        {(p.status || "unknown").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatSpeedMbps(p.speedMbps || p.speed)}</TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate">
                      {p.connectedDevice || "—"}
                      {p.vlan != null && (
                        <span className="text-muted-foreground ml-1">V{p.vlan}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      ↓{(p.inMbps || 0).toFixed(1)} ↑{(p.outMbps || 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.poeWatts != null ? `${p.poeWatts}W` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
