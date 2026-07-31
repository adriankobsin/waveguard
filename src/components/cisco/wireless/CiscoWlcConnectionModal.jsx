import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  Radio,
  Trash2,
} from "lucide-react";
import {
  DEFAULT_CISCO_WLC_CONTROLLER,
  normalizeCiscoWlcController,
  isValidHost,
} from "@/lib/network/ciscoWlcSettings";
import { testCiscoWlcController } from "@/api/ciscoWlcApi";

export default function CiscoWlcConnectionModal({
  open,
  controllerRecord,
  onClose,
  onSave,
  onDelete,
}) {
  const [draft, setDraft] = useState(() =>
    normalizeCiscoWlcController(controllerRecord || DEFAULT_CISCO_WLC_CONTROLLER)
  );
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [apCount, setApCount] = useState(null);
  const elapsedTimerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  const isEdit = useMemo(
    () => Boolean(controllerRecord?.host && controllerRecord?.id),
    [controllerRecord]
  );

  useEffect(() => {
    if (open) {
      setDraft(normalizeCiscoWlcController(controllerRecord || DEFAULT_CISCO_WLC_CONTROLLER));
      setShowPassword(false);
      setConnecting(false);
      setPhase("idle");
      setStatusMessage(null);
      setErrorMessage(null);
      setApCount(null);
      setElapsed(0);
    }
    return () => stopTimers();
  }, [open, controllerRecord]);

  function stopTimers() {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  const patch = (changes) =>
    setDraft((prev) => normalizeCiscoWlcController({ ...prev, ...changes }));

  async function handleConnect() {
    if (!isValidHost(draft.host)) {
      setErrorMessage("Enter a valid IP address (e.g. 192.168.10.1).");
      return;
    }
    if (!draft.password && !isEdit) {
      setErrorMessage("Enter the RESTCONF password.");
      return;
    }
    stopTimers();
    setConnecting(true);
    setErrorMessage(null);
    setStatusMessage(`Testing RESTCONF on ${draft.host}…`);
    setPhase("testing");
    setElapsed(0);
    const startedAt = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      const result = await testCiscoWlcController(draft);
      stopTimers();
      if (result?.success) {
        setPhase("success");
        setApCount(result.apCount ?? null);
        setStatusMessage(result.message || "RESTCONF connection successful.");
        const merged = {
          ...draft,
          enabled: true,
          controller: result.controller || draft.controller,
          lastConnectedAt: new Date().toISOString(),
          lastError: null,
        };
        try {
          await onSave?.(merged);
        } catch (saveErr) {
          setErrorMessage(saveErr?.message || "Failed to save WLC.");
          setPhase("failed");
        } finally {
          setConnecting(false);
        }
      } else {
        setPhase("failed");
        setErrorMessage(result?.message || result?.error || "Connection failed.");
        setStatusMessage(null);
        setConnecting(false);
      }
    } catch (err) {
      stopTimers();
      setPhase("failed");
      setErrorMessage(err?.message || String(err));
      setConnecting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/12 flex items-center justify-center ring-1 ring-violet-500/20">
                  <Radio size={16} className="text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    {isEdit ? "Edit WLC" : "Add Catalyst 9800 WLC"}
                  </h2>
                  <p className="text-xs text-muted-foreground">HTTPS RESTCONF · port 443</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Controller IP</label>
                <input
                  value={draft.host}
                  onChange={(e) => patch({ host: e.target.value })}
                  placeholder="192.168.10.1"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Username</label>
                  <input
                    value={draft.username}
                    onChange={(e) => patch({ username: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">HTTPS port</label>
                  <input
                    type="number"
                    value={draft.httpsPort}
                    onChange={(e) => patch({ httpsPort: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={draft.password}
                    onChange={(e) => patch({ password: e.target.value })}
                    placeholder={isEdit ? "Leave blank to keep current" : "Required"}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-secondary text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.allowInsecure}
                  onChange={(e) => patch({ allowInsecure: e.target.checked })}
                  className="rounded"
                />
                Accept self-signed certificate (common on yacht WLCs)
              </label>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Label (optional)</label>
                <input
                  value={draft.label}
                  onChange={(e) => patch({ label: e.target.value })}
                  placeholder="Main Deck WLC"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
                />
              </div>

              {phase === "testing" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  {statusMessage} ({elapsed}s)
                </div>
              )}
              {phase === "success" && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-300">
                  <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p>{statusMessage}</p>
                    {apCount != null && (
                      <p className="mt-1 text-emerald-400/80">{apCount} access points registered</p>
                    )}
                  </div>
                </div>
              )}
              {phase === "failed" && errorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Requires RESTCONF on the WLC:{" "}
                <code className="font-mono">ip http secure server</code>,{" "}
                <code className="font-mono">restconf</code>, privilege-15 user.
              </p>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/30">
              {isEdit && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete?.(draft)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/40 text-xs font-semibold text-violet-300 hover:bg-violet-500/30 disabled:opacity-50"
                >
                  {connecting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <KeyRound size={12} />
                  )}
                  Test &amp; save
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
