import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Package, ChevronDown, ChevronRight, Wifi, Camera, Monitor, Zap, Server, HardDrive, Lightbulb, HelpCircle } from "lucide-react";

const CATEGORY_ICONS = {
  Network:  { icon: Wifi,      color: "text-cyan-400",   bg: "bg-cyan-500/12" },
  Camera:   { icon: Camera,    color: "text-purple-400", bg: "bg-purple-500/12" },
  AV:       { icon: Monitor,   color: "text-blue-400",   bg: "bg-blue-500/12" },
  Power:    { icon: Zap,       color: "text-amber-400",  bg: "bg-amber-500/12" },
  Server:   { icon: Server,    color: "text-emerald-400",bg: "bg-emerald-500/12" },
  Lighting: { icon: Lightbulb, color: "text-yellow-400", bg: "bg-yellow-500/12" },
  Unknown:  { icon: HelpCircle,color: "text-slate-400",  bg: "bg-slate-500/12" },
};

const CLASS_CFG = {
  unclassified: { label: "Pending",   color: "text-amber-400",   badge: "border-amber-500/25 bg-amber-500/10" },
  monitored:    { label: "Monitored", color: "text-emerald-400", badge: "border-emerald-500/25 bg-emerald-500/10" },
  inventory:    { label: "Inventory", color: "text-blue-400",    badge: "border-blue-500/25 bg-blue-500/10" },
  ignored:      { label: "Ignored",   color: "text-slate-400",   badge: "border-slate-500/25 bg-slate-500/10" },
};

function PortBadge({ port }) {
  const labels = { 22: "SSH", 23: "Telnet", 80: "HTTP", 443: "HTTPS", 161: "SNMP", 554: "RTSP", 502: "Modbus", 1702: "Q-SYS", 3671: "KNX", 5000: "DSM", 37777: "Dahua", 41794: "CIP" };
  const label = labels[port] || port;
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-slate-400">{label}</span>
  );
}

function DeviceRow({ device, onClassify, index }) {
  const [expanded, setExpanded] = useState(false);
  const catMeta = CATEGORY_ICONS[device.category] || CATEGORY_ICONS.Unknown;
  const Icon = catMeta.icon;
  const classCfg = CLASS_CFG[device.classification] || CLASS_CFG.unclassified;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={`border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer ${
          device.classification === "ignored" ? "opacity-50" : ""
        }`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Expand */}
        <td className="pl-4 pr-2 py-3 w-8">
          {expanded
            ? <ChevronDown size={12} className="text-slate-500" />
            : <ChevronRight size={12} className="text-slate-600" />
          }
        </td>

        {/* Category icon */}
        <td className="px-2 py-3 w-10">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${catMeta.bg}`}>
            <Icon size={14} className={catMeta.color} />
          </div>
        </td>

        {/* IP + Hostname */}
        <td className="px-3 py-3">
          <p className="text-sm font-mono font-semibold text-white">{device.ip}</p>
          <p className="text-xs text-slate-500 mt-0.5">{device.hostname || "—"}</p>
        </td>

        {/* Vendor */}
        <td className="px-3 py-3 hidden md:table-cell">
          <p className="text-xs text-slate-300">{device.vendor || "—"}</p>
          <p className="text-[10px] text-slate-600 mt-0.5 font-mono">{device.mac}</p>
        </td>

        {/* Category */}
        <td className="px-3 py-3 hidden lg:table-cell">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border border-white/8 bg-white/4 ${catMeta.color}`}>
            {device.category || "Unknown"}
          </span>
        </td>

        {/* Ports */}
        <td className="px-3 py-3 hidden xl:table-cell">
          <div className="flex flex-wrap gap-1">
            {(device.openPorts || []).slice(0, 4).map(p => <PortBadge key={p} port={p} />)}
            {(device.openPorts || []).length > 4 && (
              <span className="text-[9px] text-slate-600">+{device.openPorts.length - 4}</span>
            )}
          </div>
        </td>

        {/* Response time */}
        <td className="px-3 py-3 hidden lg:table-cell">
          <span className="text-xs font-mono text-slate-400">{device.responseTimeMs}ms</span>
        </td>

        {/* Classification */}
        <td className="px-3 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${classCfg.badge} ${classCfg.color}`}>
            {classCfg.label}
          </span>
        </td>

        {/* Actions — stop propagation */}
        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onClassify(device.id, "monitored")}
              title="Monitor"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${
                device.classification === "monitored"
                  ? "bg-emerald-500/25 border-emerald-500/40 text-emerald-400"
                  : "border-white/8 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30"
              }`}
            >
              <Eye size={12} />
            </button>
            <button
              onClick={() => onClassify(device.id, "inventory")}
              title="Add to Inventory"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${
                device.classification === "inventory"
                  ? "bg-blue-500/25 border-blue-500/40 text-blue-400"
                  : "border-white/8 text-slate-500 hover:text-blue-400 hover:border-blue-500/30"
              }`}
            >
              <Package size={12} />
            </button>
            <button
              onClick={() => onClassify(device.id, "ignored")}
              title="Ignore"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${
                device.classification === "ignored"
                  ? "bg-slate-500/25 border-slate-500/40 text-slate-300"
                  : "border-white/8 text-slate-500 hover:text-slate-300 hover:border-slate-500/30"
              }`}
            >
              <EyeOff size={12} />
            </button>
          </div>
        </td>
      </motion.tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-white/4 bg-white/1">
          <td colSpan={9} className="px-14 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-600 mb-1 uppercase tracking-wide text-[10px]">IP Address</p>
                <p className="font-mono text-slate-200">{device.ip}</p>
              </div>
              <div>
                <p className="text-slate-600 mb-1 uppercase tracking-wide text-[10px]">MAC Address</p>
                <p className="font-mono text-slate-200">{device.mac}</p>
              </div>
              <div>
                <p className="text-slate-600 mb-1 uppercase tracking-wide text-[10px]">Subnet</p>
                <p className="font-mono text-slate-200">{device.subnet}</p>
              </div>
              <div>
                <p className="text-slate-600 mb-1 uppercase tracking-wide text-[10px]">First Seen</p>
                <p className="text-slate-200">{new Date(device.firstSeen).toLocaleTimeString()}</p>
              </div>
              <div className="col-span-2 md:col-span-4">
                <p className="text-slate-600 mb-1 uppercase tracking-wide text-[10px]">Open Ports</p>
                <div className="flex flex-wrap gap-1.5">
                  {(device.openPorts || []).map(p => <PortBadge key={p} port={p} />)}
                  {!device.openPorts?.length && <span className="text-slate-600">None detected</span>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DiscoveryResultsTable({ devices, onClassify }) {
  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-2">
        <HelpCircle size={24} />
        <p className="text-sm">No devices match your filter</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left">
      <thead className="sticky top-0 z-10 bg-[#07090f] border-b border-white/6">
        <tr className="text-[10px] uppercase tracking-widest text-slate-600">
          <th className="pl-4 pr-2 py-2.5 w-8" />
          <th className="px-2 py-2.5 w-10" />
          <th className="px-3 py-2.5">IP / Hostname</th>
          <th className="px-3 py-2.5 hidden md:table-cell">Vendor / MAC</th>
          <th className="px-3 py-2.5 hidden lg:table-cell">Category</th>
          <th className="px-3 py-2.5 hidden xl:table-cell">Open Ports</th>
          <th className="px-3 py-2.5 hidden lg:table-cell">RTT</th>
          <th className="px-3 py-2.5">Status</th>
          <th className="px-3 py-2.5">Actions</th>
        </tr>
      </thead>
      <tbody>
        {devices.map((device, i) => (
          <DeviceRow key={device.id} device={device} onClassify={onClassify} index={i} />
        ))}
      </tbody>
    </table>
  );
}