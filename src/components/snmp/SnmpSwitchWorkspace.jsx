import {
  RefreshCw,
  Settings,
  LayoutGrid,
  Table2,
  AlertTriangle,
} from "lucide-react";
import SwitchPortGrid from "@/components/SwitchPortGrid";
import SnmpPortTable from "@/components/snmp/SnmpPortTable";
import SnmpInterfaceDetailSheet from "@/components/snmp/SnmpInterfaceDetailSheet";
import { Badge } from "@/components/ui/badge";
import { formatUptime } from "@/lib/snmp/snmpAnalytics";

const HEALTH_BADGE = {
  healthy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  disabled: "bg-secondary text-muted-foreground",
  unknown: "bg-secondary text-muted-foreground",
};

export default function SnmpSwitchWorkspace({
  sw,
  equipment = [],
  portView,
  onPortViewChange,
  showInactivePorts,
  selectedPort,
  onSelectPort,
  polling,
  testingPort,
  onPoll,
  onTestPort,
  onEditSettings,
}) {
  if (!sw) return null;

  const upPorts = sw.ports.filter((p) => p.status === "up").length;
  const poeTotal = sw.ports.reduce((s, p) => s + (p.poeWatts > 0 ? p.poeWatts : 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">{sw.displayName}</h2>
            <Badge variant="outline" className={HEALTH_BADGE[sw.health?.status] || HEALTH_BADGE.unknown}>
              {sw.health?.label}
            </Badge>
            {sw.lastPoll?.source === "mock" && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                Mock data
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {sw.ip || "No IP"}
            {sw.model && ` · ${sw.model}`}
            {sw.chassis && ` · ${sw.chassis.portCount}-port`}
            {sw.serial && ` · S/N ${sw.serial}`}
          </p>
          {sw.chassis && (
            <p className="text-xs text-muted-foreground">{sw.chassis.label}</p>
          )}
          {!sw.chassis && (
            <p className="text-xs text-amber-400/90">
              Model not recognized — set SKU to Peplink Balance 2500 EC, MAX BR1 Pro, MAX BR2 Pro, or a Cisco model.
            </p>
          )}
          {sw.location && <p className="text-xs text-muted-foreground">{sw.location}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEditSettings}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-2.5 py-1.5"
          >
            <Settings size={12} /> Configure
          </button>
          <button
            type="button"
            onClick={onPoll}
            disabled={polling || !sw.ip}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-2.5 py-1.5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={polling ? "animate-spin" : ""} /> Poll now
          </button>
        </div>
      </div>

      {sw.lastPollError && (
        <p className="text-xs text-amber-400 flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={12} /> {sw.lastPollError}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Uptime", value: formatUptime(sw.sysUptime) },
          { label: "Ports up", value: `${upPorts} / ${sw.ports.length || "—"}` },
          { label: "PoE load", value: poeTotal ? `${poeTotal.toFixed(1)} W` : "—" },
          { label: "Last poll", value: sw.lastPollAt ? new Date(sw.lastPollAt).toLocaleString() : "Never" },
          { label: "SysName", value: sw.sysName || "—" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="text-sm font-semibold mt-0.5 truncate">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Interfaces</h3>
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => onPortViewChange("panel")}
              className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 ${
                portView === "panel" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <LayoutGrid size={12} /> Panel
            </button>
            <button
              type="button"
              onClick={() => onPortViewChange("table")}
              className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 ${
                portView === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Table2 size={12} /> Table
            </button>
          </div>
        </div>
        {sw.ports.length ? (
          portView === "table" ? (
            <SnmpPortTable
              ports={sw.ports}
              selectedPort={selectedPort}
              onSelectPort={onSelectPort}
              showInactive={showInactivePorts}
            />
          ) : (
            <SwitchPortGrid
              ports={sw.ports}
              chassis={sw.chassis}
              selectedPort={selectedPort}
              onSelectPort={onSelectPort}
            />
          )
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {sw.chassis
              ? `Chassis ready for ${sw.chassis.portCount} ports — poll to fill interface data.`
              : "Set Equipment model (e.g. C9300L-24P-4X-E) then poll for IF-MIB data."}
          </p>
        )}
      </div>

      <SnmpInterfaceDetailSheet
        open={!!selectedPort}
        onOpenChange={(isOpen) => {
          if (!isOpen) onSelectPort(null);
        }}
        port={selectedPort}
        sw={sw}
        equipmentList={equipment}
        testingPort={testingPort}
        onTestPort={onTestPort}
      />
    </div>
  );
}
