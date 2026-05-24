import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Table2, PanelTop, Cpu, Zap, Lightbulb, X, Search } from "lucide-react";

export default function LoadScheduleTable({ house, open, onClose }) {
  const [filter, setFilter] = useState("");
  const [groupByPanel, setGroupByPanel] = useState(false);

  const entries = useMemo(() => house?.loadSchedule || [], [house?.loadSchedule]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return entries;
    const q = filter.toLowerCase();
    return entries.filter(
      (e) =>
        (e.zoneName || "").toLowerCase().includes(q) ||
        (e.areaFullPath || "").toLowerCase().includes(q) ||
        (e.panel || "").toLowerCase().includes(q) ||
        (e.module || "").toLowerCase().includes(q) ||
        (e.loadType || "").toLowerCase().includes(q)
    );
  }, [entries, filter]);

  const grouped = useMemo(() => {
    if (!groupByPanel) return null;
    const map = new Map();
    for (const e of filtered) {
      const key = e.panel || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupByPanel]);

  function kindIcon(loadType) {
    const t = (loadType || "").toLowerCase();
    if (t === "shade" || t === "blind" || t === "blackout") return "shade";
    if (t === "load") return "load";
    return "light";
  }

  const iconMap = { light: Lightbulb, load: Zap, shade: PanelTop };
  const colorMap = { light: "text-amber-400", load: "text-cyan-400", shade: "text-violet-400" };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-t border-border"
        >
          <div className="bg-card/80 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Table2 size={14} className="text-cyan-400" />
                Load Schedule
                <span className="text-muted-foreground font-normal">
                  ({entries.length} entries)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGroupByPanel(!groupByPanel)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    groupByPanel
                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PanelTop size={11} />
                  By panel
                </button>
                <button
                  onClick={onClose}
                  className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by zone, area, panel, module or load type…"
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-[11px] text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-border bg-secondary/30">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">Zone</th>
                    <th className="text-left px-3 py-2 font-semibold">Area</th>
                    <th className="text-left px-3 py-2 font-semibold">Type</th>
                    <th className="text-left px-3 py-2 font-semibold">Panel</th>
                    <th className="text-left px-3 py-2 font-semibold">Module</th>
                    <th className="text-right px-3 py-2 font-semibold">Wattage</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped
                    ? grouped.map(([panel, rows]) => (
                        <>
                          <tr key={panel} className="border-b border-border bg-muted/40">
                            <td colSpan={6} className="px-3 py-1.5">
                              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                                <Cpu size={11} className="text-indigo-400" />
                                {panel}
                                <span className="text-muted-foreground font-normal">
                                  · {rows.length} loads
                                </span>
                              </span>
                            </td>
                          </tr>
                          {rows.map((e, i) => (
                            <tr
                              key={`${panel}-${i}`}
                              className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                            >
                              <td className="px-3 py-1.5 text-foreground">{e.zoneName}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{e.areaFullPath}</td>
                              <td className="px-3 py-1.5">
                                <span className={`inline-flex items-center gap-1 ${colorMap[kindIcon(e.loadType)] || "text-muted-foreground"}`}>
                                  {(() => {
                                    const Icon = iconMap[kindIcon(e.loadType)] || Lightbulb;
                                    return <Icon size={10} />;
                                  })()}
                                  {e.loadType}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">{e.panel}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{e.module}</td>
                              <td className="px-3 py-1.5 text-right text-foreground font-medium">
                                {e.wattage != null ? `${e.wattage} W` : "—"}
                              </td>
                            </tr>
                          ))}
                        </>
                      ))
                    : filtered.map((e, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                        >
                          <td className="px-3 py-1.5 text-foreground">{e.zoneName}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{e.areaFullPath}</td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-flex items-center gap-1 ${colorMap[kindIcon(e.loadType)] || "text-muted-foreground"}`}>
                              {(() => {
                                const Icon = iconMap[kindIcon(e.loadType)] || Lightbulb;
                                return <Icon size={10} />;
                              })()}
                              {e.loadType}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{e.panel}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{e.module}</td>
                          <td className="px-3 py-1.5 text-right text-foreground font-medium">
                            {e.wattage != null ? `${e.wattage} W` : "—"}
                          </td>
                        </tr>
                      ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        {entries.length === 0
                          ? "No load schedule imported. Add a CSV in the Import dialog."
                          : "No entries match your filter."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
