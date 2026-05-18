import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
  Network, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, Unplug
} from "lucide-react";

const SPEED_LABEL = { 10: "10M", 100: "100M", 1000: "1G", 10000: "10G" };

function PortBadge({ port }) {
  const up = port.ifOperStatus === "up";
  return (
    <div
      title={`Port ${port.port}${port.ifAlias ? ` · ${port.ifAlias}` : ""}${port.connectedDevice ? ` → ${port.connectedDevice}` : ""}`}
      className={`relative group w-8 h-8 rounded-md border text-[10px] font-bold flex items-center justify-center cursor-default transition-all
        ${up
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : port.connectedDevice
            ? "border-red-500/40 bg-red-500/10 text-red-400 animate-pulse"
            : "border-white/8 bg-white/3 text-slate-600"
        }`}
    >
      {port.port}
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block w-max max-w-[200px]">
        <div className="bg-[#0d1321] border border-white/10 rounded-lg px-2.5 py-2 text-xs shadow-2xl">
          <p className="font-semibold text-white mb-0.5">Port {port.port}</p>
          {port.ifAlias && <p className="text-slate-400">{port.ifAlias}</p>}
          {port.connectedDevice && <p className="text-cyan-400">{port.connectedDevice}</p>}
          {port.macAddr && <p className="font-mono text-slate-500">{port.macAddr}</p>}
          <p className={`mt-1 font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
            {up ? "UP" : "DOWN"} · {SPEED_LABEL[port.ifSpeed] || port.ifSpeed + "M"}
          </p>
          {port.vlan && <p className="text-slate-500">VLAN {port.vlan}</p>}
        </div>
      </div>
    </div>
  );
}

function SwitchCard({ sw }) {
  const [open, setOpen] = useState(true);
  const downWithDevice = sw.ports.filter(p => p.ifOperStatus === "down" && p.connectedDevice);

  return (
    <div className="rounded-xl border border-white/8 bg-[#0a0f1c] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Network size={14} className="text-cyan-400" />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{sw.name}</p>
            <p className="text-xs text-slate-500 font-mono">{sw.ip}</p>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{sw.portsUp} up
            </span>
            {sw.portsDown > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />{sw.portsDown} down
              </span>
            )}
            {downWithDevice.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
                <AlertTriangle size={10} /> {downWithDevice.length} cable fault{downWithDevice.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Port grid */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {sw.ports.map(p => <PortBadge key={p.port} port={p} />)}
              </div>

              {/* Faults */}
              {downWithDevice.length > 0 && (
                <div className="space-y-1.5 mt-3 border-t border-white/6 pt-3">
                  <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5 mb-2">
                    <Unplug size={11} /> Disconnected cable detections
                  </p>
                  {downWithDevice.map(p => (
                    <div key={p.port} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/20">
                      <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />
                      <span className="text-red-300 font-medium">Port {p.port}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-300">{p.connectedDevice}</span>
                      <span className="font-mono text-slate-500 ml-auto">{p.macAddr}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Connection table */}
              <div className="mt-3 border-t border-white/6 pt-3 space-y-1">
                {sw.ports.filter(p => p.connectedDevice).map(p => (
                  <div key={p.port} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.ifOperStatus === "up" ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="text-slate-500 w-12 font-mono">Gi0/{p.port}</span>
                    <span className="text-slate-300 flex-1 truncate">{p.connectedDevice}</span>
                    <span className="text-slate-600 font-mono">{SPEED_LABEL[p.ifSpeed]}</span>
                    <span className="text-slate-600">VLAN {p.vlan}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SnmpPortMapPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const poll = async () => {
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke("snmpPortMap", {});
    if (res.data?.success) {
      setData(res.data);
    } else {
      setError(res.data?.error || "SNMP poll failed");
    }
    setLoading(false);
  };

  const faults = data?.connectionMap?.filter(c => c.status === "down") || [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={15} className="text-cyan-400" />
          <p className="text-sm font-semibold text-white">SNMP Port Map</p>
          {data && (
            <span className="text-xs text-slate-500">
              · polled {new Date(data.polledAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={poll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-white hover:border-cyan-500/40 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Polling…" : "Poll SNMP"}
        </button>
      </div>

      {/* Summary bar */}
      {data && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/3 border border-white/6 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 size={11} className="text-emerald-400" />
            {data.totalConnections - data.disconnectedPorts} active connections
          </span>
          {faults.length > 0 ? (
            <span className="flex items-center gap-1.5 text-red-400 font-semibold">
              <AlertTriangle size={11} />
              {faults.length} cable fault{faults.length > 1 ? "s" : ""} detected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={11} />
              No cable faults
            </span>
          )}
          <span className="text-slate-600 ml-auto">{data.switches?.length} switches polled</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={11} /> {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Network size={28} className="text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">Click "Poll SNMP" to map switch ports to devices</p>
          <p className="text-xs text-slate-600 mt-1">Reads MIB-II ifTable + MAC address tables from all managed switches</p>
        </div>
      )}

      {/* Switch cards */}
      {data?.switches?.map(sw => (
        <SwitchCard key={sw.ip} sw={sw} />
      ))}
    </div>
  );
}