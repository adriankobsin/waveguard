import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save } from "lucide-react";

const METRICS = [
  { value: "port_latency", label: "Port Latency", unit: "ms", defaultOp: "gt", defaultVal: 500 },
  { value: "cpu_load", label: "CPU Load", unit: "%", defaultOp: "gt", defaultVal: 80 },
  { value: "packet_loss", label: "Packet Loss", unit: "%", defaultOp: "gt", defaultVal: 2 },
  { value: "wan_speed_down", label: "WAN Speed (Down)", unit: "Mbps", defaultOp: "lt", defaultVal: 10 },
  { value: "wan_latency", label: "WAN Latency", unit: "ms", defaultOp: "gt", defaultVal: 150 },
  { value: "device_offline", label: "Device Offline", unit: "min", defaultOp: "gt", defaultVal: 5 },
  { value: "ups_battery", label: "UPS Battery", unit: "%", defaultOp: "lt", defaultVal: 20 },
];

const OPERATORS = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
];

const ACTIONS = [
  { value: "snmp_port_bounce", label: "SNMP Port Bounce" },
  { value: "send_alert", label: "Send Alert Email" },
  { value: "log_only", label: "Log Only" },
  { value: "ping_restart", label: "Ping & Restart" },
  { value: "power_cycle", label: "Power Cycle" },
  { value: "capture_traffic", label: "Capture Traffic Snapshot" },
];

const DEFAULT_RULE = {
  name: "",
  enabled: true,
  trigger_metric: "port_latency",
  trigger_device: "any",
  trigger_operator: "gt",
  trigger_value: 500,
  trigger_unit: "ms",
  action: "snmp_port_bounce",
  action_target: "",
  requires_approval: false,
  cooldown_minutes: 10,
};

export default function RuleFormModal({ rule, onSave, onClose }) {
  const [form, setForm] = useState(rule ? { ...rule } : { ...DEFAULT_RULE });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleMetricChange = (metric) => {
    const m = METRICS.find(x => x.value === metric);
    setForm(f => ({
      ...f,
      trigger_metric: metric,
      trigger_operator: m?.defaultOp || "gt",
      trigger_value: m?.defaultVal || 0,
      trigger_unit: m?.unit || "",
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const inputCls = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "text-xs font-medium text-muted-foreground mb-1 block";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="text-base font-semibold text-foreground">{rule ? "Edit Rule" : "New Automation Rule"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Rule Name</label>
            <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="e.g. High Latency Port Bounce" required />
          </div>

          {/* Trigger section */}
          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">IF Condition</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Metric</label>
                <select className={inputCls} value={form.trigger_metric} onChange={e => handleMetricChange(e.target.value)}>
                  {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Device / Port</label>
                <input className={inputCls} value={form.trigger_device}
                  onChange={e => set("trigger_device", e.target.value)} placeholder="any" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Operator</label>
                <select className={inputCls} value={form.trigger_operator} onChange={e => set("trigger_operator", e.target.value)}>
                  {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Threshold</label>
                <input className={inputCls} type="number" value={form.trigger_value}
                  onChange={e => set("trigger_value", parseFloat(e.target.value))} required />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <input className={inputCls} value={form.trigger_unit}
                  onChange={e => set("trigger_unit", e.target.value)} placeholder="ms" />
              </div>
            </div>
          </div>

          {/* Action section */}
          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">THEN Action</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Action</label>
                <select className={inputCls} value={form.action} onChange={e => set("action", e.target.value)}>
                  {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Target Device / Port</label>
                <input className={inputCls} value={form.action_target}
                  onChange={e => set("action_target", e.target.value)} placeholder="e.g. SW-Bridge:12" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cooldown (minutes)</label>
                <input className={inputCls} type="number" min={1} value={form.cooldown_minutes}
                  onChange={e => set("cooldown_minutes", parseInt(e.target.value))} />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <input type="checkbox" id="req_approval" checked={form.requires_approval}
                  onChange={e => set("requires_approval", e.target.checked)}
                  className="w-4 h-4 accent-cyan-400" />
                <label htmlFor="req_approval" className="text-sm text-foreground cursor-pointer">Require Approval</label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Save size={14} />
              {rule ? "Save Changes" : "Create Rule"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}