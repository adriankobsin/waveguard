import { useState } from "react";
import { Search, X } from "lucide-react";
import {
  isLikelyManagedNetworkDevice,
  getEquipmentIp,
  detectDeviceRole,
  detectIntegrationVendor,
} from "@/lib/snmp/snmpSwitchProfiles";
import { parseSwitchModel } from "@/lib/snmp/switchModelCatalog";
import { parseNetworkDeviceModel } from "@/lib/snmp/networkDeviceCatalog";
import { DEVICE_ROLE_LABELS } from "@/lib/integrations/vendorRegistry";

const ROLE_BADGE = {
  switch: "bg-cyan-500/15 text-cyan-400",
  router: "bg-blue-500/15 text-blue-400",
  firewall: "bg-orange-500/15 text-orange-400",
  wan_router: "bg-amber-500/15 text-amber-400",
};

export default function SnmpAddSwitchModal({ equipment, existingIds, onAdd, onClose }) {
  const [query, setQuery] = useState("");

  const candidates = equipment
    .filter((e) => isLikelyManagedNetworkDevice(e) && !existingIds.has(e.id))
    .filter((e) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const blob = `${e.name} ${e.model} ${getEquipmentIp(e)} ${e.category} ${e.make}`.toLowerCase();
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
          <h3 className="font-semibold text-foreground">Register managed device</h3>
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
              placeholder="Search Equipment (switch, Peplink, router, firewall)…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-secondary/30"
            />
          </div>
        </div>
        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No matching network devices in Equipment. Add a switch, Peplink Balance/Max BR, Cisco router,
              or firewall, then refresh.
            </p>
          ) : (
            candidates.map((eq) => {
              const ip = getEquipmentIp(eq);
              const role = detectDeviceRole(eq);
              const vendor = detectIntegrationVendor(eq);
              const spec = parseNetworkDeviceModel(eq.model) || parseSwitchModel(eq.model);
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => onAdd(eq)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{eq.name}</p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[role] || ROLE_BADGE.switch}`}
                    >
                      {DEVICE_ROLE_LABELS[role] || "Device"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {ip || "No IP — add in Equipment before polling"}
                  </p>
                  {eq.model && (
                    <p className="text-xs text-muted-foreground">
                      {eq.model}
                      {vendor === "peplink" && (
                        <span className="text-primary/90"> · Peplink hybrid poll</span>
                      )}
                      {spec && (
                        <span className="text-primary/90">
                          {" "}
                          · {spec.portCount} interface{spec.portCount !== 1 ? "s" : ""}
                          {spec.layout ? ` (${spec.layout.replace(/-/g, " ")})` : ""}
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
