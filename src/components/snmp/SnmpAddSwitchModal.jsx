import { useState } from "react";
import { Search, X } from "lucide-react";
import { isLikelySwitch, getEquipmentIp } from "@/lib/snmp/snmpSwitchProfiles";
import { parseSwitchModel } from "@/lib/snmp/switchModelCatalog";

export default function SnmpAddSwitchModal({ equipment, existingIds, onAdd, onClose }) {
  const [query, setQuery] = useState("");

  const candidates = equipment
    .filter((e) => isLikelySwitch(e) && !existingIds.has(e.id))
    .filter((e) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const blob = `${e.name} ${e.model} ${getEquipmentIp(e)} ${e.category}`.toLowerCase();
      return blob.includes(q);
    })
    .sort((a, b) => {
      const aIp = !!getEquipmentIp(a);
      const bIp = !!getEquipmentIp(b);
      if (aIp !== bIp) return aIp ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Register managed switch</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Equipment…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-secondary/30"
            />
          </div>
        </div>
        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No matching switches in Equipment. Add a network switch (name/model containing
              &quot;switch&quot;, Cisco CBS/SG, or category Network) then refresh.
            </p>
          ) : (
            candidates.map((eq) => {
              const ip = getEquipmentIp(eq);
              const spec = parseSwitchModel(eq.model);
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => onAdd(eq)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                >
                  <p className="font-medium text-foreground">{eq.name}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {ip || "No IP — add in Equipment before polling"}
                  </p>
                  {eq.model && (
                    <p className="text-xs text-muted-foreground">
                      {eq.model}
                      {spec && (
                        <span className="text-primary/90">
                          {" "}
                          · {spec.portCount}-port {spec.layout.replace("-", " ")}
                        </span>
                      )}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
