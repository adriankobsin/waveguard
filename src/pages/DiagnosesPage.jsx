import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Activity, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DiagnosisCard from "../components/DiagnosisCard";
import WiresharkToolsPanel from "../components/diagnostics/WiresharkToolsPanel";
import { useSystemData } from "@/contexts/SystemDataContext";
import { getDiagnosisCounts } from "@/lib/systemData/generateDiagnoses";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

export default function DiagnosesPage() {
  const { diagnoses, loading, refreshing, refresh, dismissDiagnosis, acknowledgeDiagnosis } =
    useSystemData();
  const [filter, setFilter] = useState("active");
  const [approvedIds, setApprovedIds] = useState(new Set());

  const handleDismiss = (id) => dismissDiagnosis(id);
  const handleAcknowledge = (id) => {
    acknowledgeDiagnosis(id);
    toast.success("Fault acknowledged");
  };

  const handleApprove = (id) => {
    setApprovedIds((prev) => new Set([...prev, id]));
  };

  const enriched = diagnoses.map((d) => ({
    ...d,
    approved: approvedIds.has(d.id) || d.approved,
  }));

  const filtered = enriched
    .filter((d) => {
      if (filter === "active") return !d.resolvedAt && !d.acknowledgedAt;
      if (filter === "acknowledged") return !d.resolvedAt && !!d.acknowledgedAt;
      if (filter === "resolved") return !!d.resolvedAt;
      return true;
    })
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const counts = getDiagnosisCounts(enriched);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity size={22} className="text-primary" />
            AI Diagnoses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading && !diagnoses.length ? (
              "Loading system health…"
            ) : (
              <>
                {counts.active} active ·{" "}
                {counts.critical > 0 ? (
                  <span className="text-red-400">{counts.critical} critical</span>
                ) : (
                  "no critical issues"
                )}
                {counts.snmp > 0 && (
                  <>
                    {" "}
                    · <span className="text-cyan-400">{counts.snmp} SNMP</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors border border-border rounded-xl px-3 py-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Run Diagnosis"}
        </button>
      </div>

      <div className="flex bg-secondary rounded-xl p-1 w-fit gap-1">
        {[
          { key: "all", label: "All" },
          { key: "active", label: `Active (${counts.active})` },
          { key: "acknowledged", label: `Acknowledged (${counts.acknowledged})` },
          { key: "resolved", label: "Resolved" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <WiresharkToolsPanel />

      {loading && !diagnoses.length ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin" />
          Analysing equipment and maintenance records…
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((d, i) => (
              <motion.div
                key={d.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
              >
                <DiagnosisCard
                  diagnosis={d}
                  onDismiss={() => handleDismiss(d.id)}
                  onAcknowledge={() => handleAcknowledge(d.id)}
                  onApprove={() => handleApprove(d.id)}
                  expanded
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <CheckIcon />
              <p className="text-foreground font-medium mt-4">No diagnoses</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === "acknowledged"
                  ? "No acknowledged faults. Acknowledge items from the Active tab after review."
                  : "All monitored equipment is healthy, or issues have been acknowledged/dismissed."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <div className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto">
      <AlertTriangle size={24} className="text-green-400" />
    </div>
  );
}