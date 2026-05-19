import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, SkipForward, Trash2 } from "lucide-react";

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", label: "Success" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Failed" },
  pending_approval: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", label: "Pending" },
  skipped: { icon: SkipForward, color: "text-muted-foreground", bg: "bg-secondary", label: "Skipped" },
};

const ACTION_LABELS = {
  snmp_port_bounce: "Port Bounce",
  send_alert: "Alert Sent",
  log_only: "Logged",
  ping_restart: "Ping Restart",
  power_cycle: "Power Cycle",
  capture_traffic: "Traffic Capture",
};

export default function ActionLogTable({ logs, onClear }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Clock size={28} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No actions logged yet.</p>
        <p className="text-xs mt-1">Actions will appear here when automation rules fire.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={onClear}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors">
          <Trash2 size={12} /> Clear Log
        </button>
      </div>

      <div className="space-y-2">
        {logs.map((log, i) => {
          const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.success;
          const Icon = cfg.icon;
          const ts = log.created_date
            ? new Date(log.created_date).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })
            : "—";

          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0"
            >
              <div className={`w-6 h-6 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={12} className={cfg.color} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{log.rule_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{ACTION_LABELS[log.action] || log.action}</span>
                  {log.action_target && <span> → {log.action_target}</span>}
                  {log.trigger_device && <span className="ml-2">on {log.trigger_device}</span>}
                  {log.observed_value != null && (
                    <span className="ml-2 text-yellow-400">(observed: {log.observed_value}{log.trigger_unit})</span>
                  )}
                </p>
                {log.result_message && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{log.result_message}</p>
                )}
              </div>

              <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">{ts}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}