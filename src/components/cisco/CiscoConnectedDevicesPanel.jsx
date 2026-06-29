import { useMemo, useState } from "react";
import { Cable, Search, Cpu, Antenna, Tag } from "lucide-react";

/**
 * Per-port connected devices panel — merges MAC table entries with
 * LLDP/CDP neighbor data so the operator can see what's plugged into
 * each interface.
 */
export default function CiscoConnectedDevicesPanel({ snapshot, equipment = [] }) {
  const [query, setQuery] = useState("");
  const macs = snapshot?.macs || [];
  const lldp = snapshot?.neighbors?.lldp || [];
  const cdp = snapshot?.neighbors?.cdp || [];

  const rows = useMemo(() => {
    const byPort = new Map();
    const ensure = (port) => {
      if (!byPort.has(port)) {
        byPort.set(port, { port, macs: [], lldp: null, cdp: null });
      }
      return byPort.get(port);
    };
    for (const m of macs) {
      const r = ensure(m.port);
      r.macs.push(m);
    }
    for (const n of lldp) {
      ensure(n.port).lldp = n;
    }
    for (const n of cdp) {
      ensure(n.port).cdp = n;
    }
    let all = [...byPort.values()];
    // Resolve Equipment by MAC for friendly names.
    const macToEq = new Map();
    for (const eq of equipment) {
      if (!eq?.mac) continue;
      const normalised = String(eq.mac).toUpperCase().replace(/[^0-9A-F:]/g, "");
      macToEq.set(normalised, eq);
    }
    for (const r of all) {
      r.macs = r.macs.map((m) => ({
        ...m,
        equipment: macToEq.get(String(m.mac).toUpperCase()) || null,
      }));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      all = all.filter((r) => {
        const blob = [
          r.port,
          r.lldp?.systemName,
          r.lldp?.systemDescription,
          r.cdp?.deviceId,
          r.cdp?.platform,
          ...r.macs.map((m) => `${m.mac} ${m.equipment?.name || ""}`),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }
    return all.sort((a, b) => a.port.localeCompare(b.port, undefined, { numeric: true }));
  }, [macs, lldp, cdp, equipment, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary">
        <Search size={12} className="text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by hostname, MAC, port, or device platform…"
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <Cable size={28} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-semibold text-foreground">No connected devices</p>
          <p className="text-xs text-muted-foreground mt-1">
            Switch hasn't reported any MAC table or LLDP/CDP entries yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.port}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cable size={13} className="text-sky-400" />
                  <span className="text-sm font-mono font-bold text-foreground">
                    {r.port}
                  </span>
                  {(r.lldp?.systemName || r.cdp?.deviceId) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400">
                      <Antenna size={9} />
                      {r.lldp?.systemName || r.cdp?.deviceId}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {r.macs.length} MAC{r.macs.length === 1 ? "" : "s"}
                </span>
              </div>
              {(r.lldp || r.cdp) && (
                <div className="grid grid-cols-2 gap-3 mb-2 text-[11px] text-muted-foreground">
                  {r.lldp && (
                    <div className="space-y-1">
                      <div className="font-bold text-foreground/80 flex items-center gap-1.5">
                        <Antenna size={10} className="text-cyan-400" />
                        LLDP
                      </div>
                      <div className="font-mono">
                        {r.lldp.systemDescription || r.lldp.portDescription || "—"}
                      </div>
                      {r.lldp.chassisId && (
                        <div className="font-mono text-[10px] text-muted-foreground/70">
                          {r.lldp.chassisId}
                        </div>
                      )}
                    </div>
                  )}
                  {r.cdp && (
                    <div className="space-y-1">
                      <div className="font-bold text-foreground/80 flex items-center gap-1.5">
                        <Cpu size={10} className="text-violet-400" />
                        CDP
                      </div>
                      <div className="font-mono">{r.cdp.platform || "—"}</div>
                      {r.cdp.ip && (
                        <div className="font-mono text-[10px] text-muted-foreground/70">
                          {r.cdp.ip}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {r.macs.length > 0 && (
                <div className="space-y-1">
                  {r.macs.map((m) => (
                    <div
                      key={m.mac}
                      className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-muted/40"
                    >
                      <span className="text-foreground">{m.mac}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {m.vlan != null && (
                          <span className="inline-flex items-center gap-1">
                            <Tag size={9} />
                            VLAN {m.vlan}
                          </span>
                        )}
                        {m.equipment && (
                          <span className="text-emerald-400">{m.equipment.name}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
