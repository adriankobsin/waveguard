import { useState } from "react";
import { motion } from "framer-motion";
import { Network, RefreshCw, TrendingUp, TrendingDown, Activity, Clock } from "lucide-react";
import SwitchPortGrid from "../components/SwitchPortGrid";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const MOCK_SWITCHES = [
  {
    id: "sw1", name: "SW-Bridge", ip: "192.168.10.2", sysUptime: 1234567,
    sysName: "SW-Bridge-Cisco", vendor: "Cisco", model: "SG350-28",
    ports: [
      { index: 1, name: "Gi0/1", status: "up", speed: 1000, mtu: 1500, inMbps: 12.3, outMbps: 8.1, connectedDevice: "Cam-Bridge-01", vlan: 20 },
      { index: 2, name: "Gi0/2", status: "up", speed: 1000, mtu: 1500, inMbps: 0.5, outMbps: 0.2, connectedDevice: "Cam-Bridge-02", vlan: 20 },
      { index: 3, name: "Gi0/3", status: "down", speed: 1000, mtu: 1500, inMbps: 0, outMbps: 0, connectedDevice: null, vlan: 1 },
      { index: 4, name: "Gi0/4", status: "up", speed: 1000, mtu: 1500, inMbps: 4.2, outMbps: 1.8, connectedDevice: "Cam-Fly-01", vlan: 20 },
      { index: 5, name: "Gi0/5", status: "up", speed: 1000, mtu: 1500, inMbps: 0.1, outMbps: 0.1, connectedDevice: "AP-Bridge", vlan: 30 },
      { index: 6, name: "Gi0/6", status: "down", speed: 100, mtu: 1500, inMbps: 0, outMbps: 0, connectedDevice: null, vlan: 1 },
      { index: 7, name: "Gi0/7", status: "up", speed: 1000, mtu: 1500, inMbps: 55.2, outMbps: 48.3, connectedDevice: "NVR-Main", vlan: 20 },
      { index: 8, name: "Gi0/8", status: "up", speed: 1000, mtu: 1500, inMbps: 2.1, outMbps: 1.5, connectedDevice: "AV-Proc-Main", vlan: 10 },
      { index: 9, name: "Gi0/9", status: "disabled", speed: 1000, mtu: 1500, inMbps: 0, outMbps: 0, connectedDevice: null, vlan: 1 },
      { index: 10, name: "Gi0/10", status: "up", speed: 1000, mtu: 1500, inMbps: 1.2, outMbps: 0.8, connectedDevice: "Helm-Display-1", vlan: 10 },
      { index: 11, name: "Gi0/11", status: "up", speed: 100, mtu: 1500, inMbps: 0.3, outMbps: 0.1, connectedDevice: "Starlink-Mgmt", vlan: 10 },
      { index: 12, name: "Gi0/12", status: "down", speed: 1000, mtu: 1500, inMbps: 0, outMbps: 0, connectedDevice: null, vlan: 1 },
    ]
  },
  {
    id: "sw2", name: "SW-Saloon", ip: "192.168.10.3", sysUptime: 987654,
    sysName: "SW-Saloon-Cisco", vendor: "Cisco", model: "SG350-10",
    ports: [
      { index: 1, name: "Gi0/1", status: "up", speed: 1000, mtu: 1500, inMbps: 3.5, outMbps: 2.1, connectedDevice: "Display-Saloon-1", vlan: 10 },
      { index: 2, name: "Gi0/2", status: "up", speed: 1000, mtu: 1500, inMbps: 1.2, outMbps: 0.9, connectedDevice: "Display-Saloon-2", vlan: 10 },
      { index: 3, name: "Gi0/3", status: "up", speed: 1000, mtu: 1500, inMbps: 22.1, outMbps: 18.4, connectedDevice: "Q-SYS-Core", vlan: 10 },
      { index: 4, name: "Gi0/4", status: "down", speed: 1000, mtu: 1500, inMbps: 0, outMbps: 0, connectedDevice: null, vlan: 1 },
      { index: 5, name: "Gi0/5", status: "up", speed: 1000, mtu: 1500, inMbps: 0.8, outMbps: 0.4, connectedDevice: "Cam-Saloon-01", vlan: 20 },
      { index: 6, name: "Gi0/6", status: "disabled", speed: 1000, mtu: 1500, inMbps: 0, outMbps: 0, connectedDevice: null, vlan: 1 },
    ]
  }
];

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

const MOCK_TRAFFIC = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2,"0")}:00`,
  inMbps: Math.random() * 60 + 10,
  outMbps: Math.random() * 45 + 5,
}));

function TrafficChart() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={MOCK_TRAFFIC} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(192,100%,48%)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(192,100%,48%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(145,65%,45%)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(145,65%,45%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,16%)" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(210,15%,50%)" }} interval={5} />
        <YAxis tick={{ fontSize: 10, fill: "hsl(210,15%,50%)" }} unit=" Mbps" />
        <Tooltip
          contentStyle={{ background: "hsl(220,18%,9%)", border: "1px solid hsl(220,15%,16%)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "hsl(210,20%,92%)" }}
        />
        <Area type="monotone" dataKey="inMbps" stroke="hsl(192,100%,48%)" fill="url(#inGrad)" strokeWidth={2} name="Inbound" />
        <Area type="monotone" dataKey="outMbps" stroke="hsl(145,65%,45%)" fill="url(#outGrad)" strokeWidth={2} name="Outbound" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function SnmpPage() {
  const [selectedSwitch, setSelectedSwitch] = useState(MOCK_SWITCHES[0]);
  const [selectedPort, setSelectedPort] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  const upPorts = selectedSwitch.ports.filter(p => p.status === "up").length;
  const downPorts = selectedSwitch.ports.filter(p => p.status === "down").length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Network size={22} className="text-primary" />
            SNMP Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live switch port status and traffic</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors border border-border rounded-xl px-3 py-2"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Switch Selector */}
      <div className="flex gap-2 flex-wrap">
        {MOCK_SWITCHES.map(sw => (
          <button
            key={sw.id}
            onClick={() => { setSelectedSwitch(sw); setSelectedPort(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedSwitch.id === sw.id
                ? "bg-primary text-primary-foreground"
                : "glass border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Network size={14} />
            {sw.name}
          </button>
        ))}
      </div>

      {/* Switch Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Model", value: selectedSwitch.model, icon: Network },
          { label: "IP Address", value: selectedSwitch.ip, icon: Activity, mono: true },
          { label: "Uptime", value: formatUptime(selectedSwitch.sysUptime), icon: Clock },
          { label: "Ports Up/Total", value: `${upPorts}/${selectedSwitch.ports.length}`, icon: TrendingUp },
        ].map(card => (
          <div key={card.label} className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-sm font-bold text-foreground mt-1 ${card.mono ? "font-mono" : ""}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Port Grid */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Port Status</h3>
        <SwitchPortGrid ports={selectedSwitch.ports} selectedPort={selectedPort} onSelectPort={setSelectedPort} />

        {/* Legend */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-border/50">
          {[
            { color: "bg-green-500", label: "Up" },
            { color: "bg-red-500", label: "Down" },
            { color: "bg-secondary", label: "Disabled" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-3 h-3 rounded-sm ${l.color}`} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Port Detail Panel */}
      {selectedPort && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{selectedPort.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedPort.connectedDevice || "No device connected"} · VLAN {selectedPort.vlan}</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              selectedPort.status === "up" ? "bg-green-500/20 text-green-400" :
              selectedPort.status === "down" ? "bg-red-500/20 text-red-400" :
              "bg-secondary text-muted-foreground"
            }`}>
              {selectedPort.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Speed", value: `${selectedPort.speed} Mbps` },
              { label: "MTU", value: selectedPort.mtu },
              { label: "Inbound", value: `${selectedPort.inMbps.toFixed(1)} Mbps`, icon: TrendingDown, color: "text-cyan-400" },
              { label: "Outbound", value: `${selectedPort.outMbps.toFixed(1)} Mbps`, icon: TrendingUp, color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="bg-secondary/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${s.color || "text-foreground"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">24h Traffic History</p>
            <TrafficChart />
          </div>
        </motion.div>
      )}
    </div>
  );
}