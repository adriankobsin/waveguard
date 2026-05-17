import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
  Zap, Plus, Play, History, CheckCircle2, XCircle,
  Clock, Filter, RefreshCw
} from "lucide-react";
import RuleCard from "../components/automation/RuleCard";
import RuleFormModal from "../components/automation/RuleFormModal";
import ActionLogTable from "../components/automation/ActionLogTable";

const TABS = [
  { id: "rules", label: "Rules", icon: Zap },
  { id: "log", label: "Action Log", icon: History },
];

// Simulate firing a rule and creating a log entry
async function simulateFire(rule, observedValue) {
  const result_message = rule.action === "snmp_port_bounce"
    ? `SNMP SET ifAdminStatus=down then up on port ${rule.action_target || "target"}`
    : rule.action === "send_alert"
    ? `Alert email dispatched to ops team`
    : rule.action === "log_only"
    ? `Metric recorded for review`
    : rule.action === "power_cycle"
    ? `PDU outlet cycle command sent to ${rule.action_target || "target"}`
    : rule.action === "ping_restart"
    ? `Restart command issued via SNMP`
    : `Traffic capture snapshot saved`;

  const status = rule.requires_approval ? "pending_approval" : "success";

  await base44.entities.ActionLog.create({
    rule_id: rule.id,
    rule_name: rule.name,
    trigger_metric: rule.trigger_metric,
    trigger_device: rule.trigger_device || "any",
    observed_value: observedValue,
    trigger_unit: rule.trigger_unit,
    action: rule.action,
    action_target: rule.action_target || "",
    status,
    result_message,
  });

  await base44.entities.AutomationRule.update(rule.id, {
    last_fired_at: new Date().toISOString(),
    fire_count: (rule.fire_count || 0) + 1,
  });
}

export default function AutomationPage() {
  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [filter, setFilter] = useState("all");
  const [simulating, setSimulating] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [r, l] = await Promise.all([
      base44.entities.AutomationRule.list("-created_date", 50),
      base44.entities.ActionLog.list("-created_date", 100),
    ]);
    setRules(r);
    setLogs(l);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveRule = async (form) => {
    if (editingRule) {
      await base44.entities.AutomationRule.update(editingRule.id, form);
    } else {
      await base44.entities.AutomationRule.create({ ...form, fire_count: 0 });
    }
    setShowModal(false);
    setEditingRule(null);
    await loadData();
  };

  const handleDelete = async (rule) => {
    await base44.entities.AutomationRule.delete(rule.id);
    setRules(r => r.filter(x => x.id !== rule.id));
  };

  const handleToggle = async (rule) => {
    await base44.entities.AutomationRule.update(rule.id, { enabled: !rule.enabled });
    setRules(r => r.map(x => x.id === rule.id ? { ...x, enabled: !x.enabled } : x));
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleSimulate = async (rule) => {
    setSimulating(rule.id);
    // Simulate an observed value that exceeds the threshold
    const bump = rule.trigger_operator === "lt" || rule.trigger_operator === "lte"
      ? rule.trigger_value * 0.5
      : rule.trigger_value * 1.3;
    const observed = Math.round(bump * 10) / 10;
    await simulateFire(rule, observed);
    await loadData();
    setSimulating(null);
    setTab("log");
  };

  const handleClearLogs = async () => {
    await Promise.all(logs.map(l => base44.entities.ActionLog.delete(l.id)));
    setLogs([]);
  };

  const enabledCount = rules.filter(r => r.enabled).length;
  const filteredRules = filter === "all" ? rules
    : filter === "enabled" ? rules.filter(r => r.enabled)
    : rules.filter(r => !r.enabled);

  const recentFired = logs.filter(l => l.status === "success").length;
  const pendingApproval = logs.filter(l => l.status === "pending_approval").length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Zap size={22} className="text-cyan-400" />
            Automation Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trigger-action rules for automated corrective responses</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setEditingRule(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> New Rule
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Rules", value: rules.length, icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10" },
          { label: "Active", value: enabledCount, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Actions Fired", value: recentFired, icon: Play, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Pending Approval", value: pendingApproval, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
              <kpi.icon size={15} className={kpi.color} />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} />
            {t.label}
            {t.id === "log" && logs.length > 0 && (
              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">{logs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {tab === "rules" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-muted-foreground" />
            {["all", "enabled", "disabled"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
                  filter === f ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-border/80"
                }`}>
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="glass rounded-xl p-10 text-center text-muted-foreground">
              <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-cyan-400" />
              <p className="text-sm">Loading rules…</p>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="glass rounded-xl p-10 text-center">
              <Zap size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No rules yet.</p>
              <button onClick={() => { setEditingRule(null); setShowModal(true); }}
                className="mt-3 text-xs text-primary hover:underline">
                Create your first rule →
              </button>
            </div>
          ) : (
            <AnimatePresence>
              {filteredRules.map((rule, i) => (
                <div key={rule.id} className="relative group">
                  <RuleCard rule={rule} index={i} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggle} />
                  {/* Simulate fire button */}
                  <button
                    onClick={() => handleSimulate(rule)}
                    disabled={simulating === rule.id}
                    className="absolute bottom-3 right-16 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    {simulating === rule.id
                      ? <RefreshCw size={11} className="animate-spin" />
                      : <Play size={11} />}
                    Simulate
                  </button>
                </div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Log Tab */}
      {tab === "log" && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <History size={14} className="text-cyan-400" />
            Action History
            {logs.length > 0 && <span className="text-xs text-muted-foreground">({logs.length} entries)</span>}
          </h3>
          <ActionLogTable logs={logs} onClear={handleClearLogs} />
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <RuleFormModal
            rule={editingRule}
            onSave={handleSaveRule}
            onClose={() => { setShowModal(false); setEditingRule(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}