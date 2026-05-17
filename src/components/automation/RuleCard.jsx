import { motion } from "framer-motion";
import { Pencil, Trash2, Play, Pause, ShieldAlert, ChevronRight } from "lucide-react";

const METRIC_LABELS = {
  port_latency: "Port Latency",
  cpu_load: "CPU Load",
  packet_loss: "Packet Loss",
  wan_speed_down: "WAN Speed ↓",
  wan_latency: "WAN Latency",
  device_offline: "Device Offline",
  ups_battery: "UPS Battery",
};

const ACTION_LABELS = {
  snmp_port_bounce: "SNMP Port Bounce",
  send_alert: "Send Alert",
  log_only: "Log Only",
  ping_restart: "Ping & Restart",
  power_cycle: "Power Cycle",
  capture_traffic: "Capture Traffic",
};

const OP_LABELS = { gt: ">", gte: ">=", lt: "<", lte: "<=", eq: "=" };

export default function RuleCard({ rule, index, onEdit, onDelete, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.04 }}
      className={`glass rounded-xl p-4 border transition-all ${rule.enabled ? "border-border/50" : "border-border/20 opacity-60"}`}
    >
      <div className="flex items-start gap-3">
        {/* Toggle dot */}
        <button onClick={() => onToggle(rule)}
          className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 transition-colors ${rule.enabled ? "bg-green-500" : "bg-secondary border border-border"}`}
          title={rule.enabled ? "Disable rule" : "Enable rule"} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{rule.name}</span>
            {rule.requires_approval && (
              <span className="flex items-center gap-1 text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full">
                <ShieldAlert size={10} /> Approval Required
              </span>
            )}
            {rule.fire_count > 0 && (
              <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">
                Fired {rule.fire_count}×
              </span>
            )}
          </div>

          {/* Trigger → Action pill */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-lg font-mono">
              IF {METRIC_LABELS[rule.trigger_metric] || rule.trigger_metric}
              {rule.trigger_device && rule.trigger_device !== "any" && ` [${rule.trigger_device}]`}
              {" "}{OP_LABELS[rule.trigger_operator]}{" "}{rule.trigger_value}{rule.trigger_unit}
            </span>
            <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-lg font-mono">
              THEN {ACTION_LABELS[rule.action] || rule.action}
              {rule.action_target && ` → ${rule.action_target}`}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>Cooldown: {rule.cooldown_minutes}m</span>
            {rule.last_fired_at && (
              <span>Last fired: {new Date(rule.last_fired_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(rule)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(rule)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}