import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, HelpCircle, Search } from "lucide-react";

const STATUS_STYLES = {
  online: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  offline: "text-red-400 bg-red-500/10 border-red-500/30",
  unknown: "text-muted-foreground bg-muted border-border",
};

export default function CiscoAccessPointTable({ accessPoints = [], onSelectAp }) {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = accessPoints;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    const q = filter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.wtpMac?.toLowerCase().includes(q) ||
          a.ip?.includes(q) ||
          a.model?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [accessPoints, filter, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search AP name, MAC, IP…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-secondary text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
        >
          <option value="all">All statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-2.5 font-bold">AP</th>
              <th className="px-4 py-2.5 font-bold hidden md:table-cell">Status</th>
              <th className="px-4 py-2.5 font-bold hidden lg:table-cell">IP</th>
              <th className="px-4 py-2.5 font-bold hidden lg:table-cell">Model</th>
              <th className="px-4 py-2.5 font-bold hidden xl:table-cell">Clients</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                  No access points match the filter.
                </td>
              </tr>
            ) : (
              filtered.map((ap) => {
                const clientCount = ap.radios?.reduce(
                  (s, r) => s + (Number(r.clientCount) || 0),
                  0
                );
                const statusClass = STATUS_STYLES[ap.status] || STATUS_STYLES.unknown;
                return (
                  <tr
                    key={ap.id || ap.wtpMac}
                    onClick={() => onSelectAp?.(ap)}
                    className="border-b border-border/60 hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{ap.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {ap.wtpMac}
                      </p>
                      {ap.joinError && (
                        <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                          <HelpCircle size={10} />
                          {ap.joinError}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusClass}`}
                      >
                        {ap.status === "online" ? (
                          <CheckCircle2 size={10} />
                        ) : ap.status === "offline" ? (
                          <AlertCircle size={10} />
                        ) : null}
                        {ap.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs hidden lg:table-cell">
                      {ap.ip || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs hidden lg:table-cell">{ap.model || "—"}</td>
                    <td className="px-4 py-3 text-xs hidden xl:table-cell">
                      {clientCount || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
