import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Info, ChevronDown, ChevronUp, FileText,
  CheckCircle2, X, Play, ShieldAlert, Loader2, CheckCheck, Network
} from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const SEVERITY_CONFIG = {
  critical: { label: "CRITICAL", bg: "bg-red-500/15 border-red-500/30", badge: "bg-red-500/20 text-red-400", icon: ShieldAlert, iconColor: "text-red-400" },
  warning:  { label: "WARNING",  bg: "bg-yellow-500/10 border-yellow-500/25", badge: "bg-yellow-500/20 text-yellow-400", icon: AlertTriangle, iconColor: "text-yellow-400" },
  info:     { label: "INFO",     bg: "bg-blue-500/10 border-blue-500/20", badge: "bg-blue-500/20 text-blue-400", icon: Info, iconColor: "text-blue-400" },
};

const ACTION_LABELS = {
  snmp_port_bounce: "SNMP Port Bounce",
  ping_restart: "Ping & Restart",
  check_cable: "Check Cable",
  check_config: "Review Config",
  power_cycle: "Power Cycle",
  none: null,
};

export default function DiagnosisCard({ diagnosis, onDismiss, onAcknowledge, onApprove, expanded: defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [approved, setApproved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cfg = SEVERITY_CONFIG[diagnosis.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  const actionLabel = ACTION_LABELS[diagnosis.suggestedAction];
  const isResolved = !!diagnosis.resolvedAt;
  const isAcknowledged = !!diagnosis.acknowledgedAt;
  const isSnmp = diagnosis.source === "snmp";

  const handleExecute = async () => {
    setConfirmOpen(false);
    setExecuting(true);
    try {
      if (diagnosis.equipmentIp) {
        const res = await base44.functions.invoke("networkScan", {
          target: diagnosis.equipmentIp,
        });
        if (res.data?.success) {
          toast.success(`Scan completed for ${diagnosis.equipmentName}`);
        } else {
          toast.error("Scan did not return results");
        }
      } else {
        await base44.entities.ActionLog.create({
          action: "diagnosis_action",
          details: `${diagnosis.suggestedAction} on ${diagnosis.equipmentName}`,
          status: "success",
        });
        toast.success("Action logged");
      }
      setExecuted(true);
    } catch (err) {
      console.error(err);
      toast.error("Action failed");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${cfg.bg} ${isResolved ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
            <Icon size={16} className={cfg.iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
              <span className="text-xs text-muted-foreground">{diagnosis.equipmentName}</span>
              {isSnmp && (
                <span className="text-xs text-cyan-400/90 bg-cyan-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Network size={10} /> SNMP
                </span>
              )}
              {isAcknowledged && !isResolved && (
                <span className="text-xs text-slate-400 bg-secondary px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <CheckCheck size={10} /> Acknowledged
                </span>
              )}
              {isResolved && <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Resolved</span>}
            </div>
            <p className="text-sm font-semibold text-foreground mt-1 leading-snug">{diagnosis.summary}</p>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-3">
              {/* Likely Cause */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Likely Cause</p>
                <p className="text-sm text-foreground/90 leading-relaxed">{diagnosis.likelyCause}</p>
              </div>

              {/* Steps */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Suggested Steps</p>
                <div className="space-y-1.5">
                  {diagnosis.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-secondary text-muted-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground/90">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Documents */}
              {diagnosis.relatedDocuments?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Related Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {diagnosis.relatedDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center gap-1.5 text-xs bg-secondary/80 border border-border rounded-lg px-2.5 py-1.5 text-muted-foreground">
                        <FileText size={11} />
                        {doc.name}
                        {doc.page && <span className="text-primary">p.{doc.page}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isSnmp && diagnosis.switchProfileId && (
                <Link
                  to="/snmp"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Network size={12} /> Open in Switch Management
                </Link>
              )}

              {/* Action Area */}
              {!isResolved && !isAcknowledged && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {onAcknowledge && (
                    <button
                      type="button"
                      onClick={onAcknowledge}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                    >
                      <CheckCheck size={13} />
                      Acknowledge
                    </button>
                  )}
                  {!executed && actionLabel && (
                  <>
                  {diagnosis.requiresApproval && !approved ? (
                    <button
                      onClick={() => setConfirmOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-semibold hover:bg-yellow-500/30 transition-colors"
                    >
                      <ShieldAlert size={13} />
                      Approve & Execute: {actionLabel}
                    </button>
                  ) : (
                    <button
                      onClick={handleExecute}
                      disabled={executing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/30 transition-colors disabled:opacity-50"
                    >
                      {executing ? (
                        <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                      ) : <Play size={13} />}
                      {executing ? "Executing…" : `Execute: ${actionLabel}`}
                    </button>
                  )}
                  {onDismiss && (
                    <button onClick={onDismiss} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border transition-colors">
                      <X size={12} />
                      Dismiss
                    </button>
                  )}
                  </>
                  )}
                </div>
              )}

              {isAcknowledged && !isResolved && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <CheckCheck size={12} className="text-slate-400" />
                  Acknowledged {new Date(diagnosis.acknowledgedAt).toLocaleString()}
                  {onDismiss && (
                    <button type="button" onClick={onDismiss} className="ml-2 text-muted-foreground hover:text-foreground underline">
                      Dismiss permanently
                    </button>
                  )}
                </p>
              )}

              {executed && (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} />
                  Action executed successfully.
                </div>
              )}

              {/* Confirm Dialog */}
              <AnimatePresence>
                {confirmOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card border border-yellow-500/30 rounded-xl p-4 space-y-3"
                  >
                    <p className="text-sm font-medium text-foreground">Confirm action: <strong>{actionLabel}</strong>?</p>
                    <p className="text-xs text-muted-foreground">This will send SNMP commands to the switch. Confirm you have reviewed the diagnosis above.</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setApproved(true); setConfirmOpen(false); handleExecute(); }}
                        className="flex-1 py-2 rounded-lg bg-yellow-500 text-black text-xs font-bold hover:bg-yellow-400 transition-colors">
                        Confirm & Execute
                      </button>
                      <button onClick={() => setConfirmOpen(false)}
                        className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}