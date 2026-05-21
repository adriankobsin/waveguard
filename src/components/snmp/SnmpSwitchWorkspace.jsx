import { AnimatePresence, motion } from "framer-motion";
import {
  RefreshCw,
  Settings,
  LayoutGrid,
  Table2,
  Zap,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import SwitchPortGrid from "@/components/SwitchPortGrid";
import SnmpPortTable from "@/components/snmp/SnmpPortTable";
import { Badge } from "@/components/ui/badge";
import { formatUptime, formatSpeedMbps } from "@/lib/snmp/snmpAnalytics";

function TrafficChart({ data }) {
  const chartData = data?.length ? data : [{ time: "—", inMbps: 0, outMbps: 0 }];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="snmpInGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(192,100%,48%)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(192,100%,48%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="snmpOutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(145,65%,45%)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(145,65%,45%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,16%)" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(210,15%,50%)" }} />
        <YAxis tick={{ fontSize: 10, fill: "hsl(210,15%,50%)" }} unit=" Mbps" />
        <Tooltip
          contentStyle={{
            background: "hsl(220,18%,9%)",
            border: "1px solid hsl(220,15%,16%)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="inMbps" stroke="hsl(192,100%,48%)" fill="url(#snmpInGrad)" strokeWidth={2} name="Inbound" />
        <Area type="monotone" dataKey="outMbps" stroke="hsl(145,65%,45%)" fill="url(#snmpOutGrad)" strokeWidth={2} name="Outbound" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const HEALTH_BADGE = {
  healthy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  disabled: "bg-secondary text-muted-foreground",
  unknown: "bg-secondary text-muted-foreground",
};

export default function SnmpSwitchWorkspace({
  sw,
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
          {!sw.chassis && sw.model && (
            <p className="text-xs text-amber-400/90">Model not recognized — set a standard SKU (e.g. C9300L-24P-4X-E)</p>
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

      <AnimatePresence>
        {selectedPort && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-border p-5 space-y-4 bg-card/30"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{selectedPort.name || `Port ${selectedPort.index}`}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedPort.ifAlias || "No alias"}
                  {selectedPort.connectedDevice && ` → ${selectedPort.connectedDevice}`}
                </p>
                {selectedPort.macAddr && (
                  <p className="text-xs font-mono text-muted-foreground">{selectedPort.macAddr}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTestPort}
                  disabled={testingPort}
                  className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-2.5 py-1.5"
                >
                  {testingPort ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                  Test interface
                </button>
                <Badge variant="outline" className={HEALTH_BADGE[selectedPort.status === "up" ? "healthy" : "critical"]}>
                  {(selectedPort.status || "unknown").toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Speed</p>
                <p className="font-medium">{formatSpeedMbps(selectedPort.speedMbps || selectedPort.speed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MTU</p>
                <p className="font-medium">{selectedPort.mtu ?? 1500}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inbound</p>
                <p className="font-medium text-cyan-400">{(selectedPort.inMbps || 0).toFixed(1)} Mbps</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outbound</p>
                <p className="font-medium text-emerald-400">{(selectedPort.outMbps || 0).toFixed(1)} Mbps</p>
              </div>
              {selectedPort.poeWatts != null && (
                <div>
                  <p className="text-xs text-muted-foreground">PoE</p>
                  <p className="font-medium text-amber-400">{selectedPort.poeWatts} W</p>
                </div>
              )}
              {selectedPort.vlan != null && (
                <div>
                  <p className="text-xs text-muted-foreground">VLAN</p>
                  <p className="font-medium">{selectedPort.vlan}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Aggregate traffic (poll history)</p>
              <TrafficChart data={sw.lastPoll?.trafficHistory} />
            </div>
            {sw.eq?.id && (
              <Link
                to="/equipment"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink size={12} /> View in Equipment
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
