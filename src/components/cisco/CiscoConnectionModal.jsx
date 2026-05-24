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
  Network,
  ChevronDown,
  ChevronUp,
  Power,
  Trash2,
  Cpu,
} from "lucide-react";
import {
  DEFAULT_CISCO_SWITCH,
  normalizeCiscoSwitch,
  isValidHost,
} from "@/lib/network/ciscoSwitchSettings";
import { testCiscoSwitch } from "@/api/ciscoApi";

/**
 * Cisco Catalyst 1300 / CBS350 credentials modal.
 *
 * Mirrors `LutronConnectionModal.jsx` — single Host IP at the top, Connect
 * button, advanced disclosure for SSH/SNMP credentials. The connection
 * flow:
 *
 *   1. Probe ports 22/161 (server-side).
 *   2. If SSH is open: SSH login + `show version` for a system snapshot.
 *   3. Show a chip with the resolved model + firmware.
 *   4. Save the switch via `onSave` (the parent persists it).
 */
export default function CiscoConnectionModal({
  open,
  switchRecord,
  onClose,
  onSave,
  onDelete,
}) {
  const [draft, setDraft] = useState(() =>
    normalizeCiscoSwitch(switchRecord || DEFAULT_CISCO_SWITCH)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [showSnmpPassword, setShowSnmpPassword] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | testing | success | failed
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [resolvedSystem, setResolvedSystem] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const elapsedTimerRef = useRef(null);
  const isEdit = useMemo(
    () => Boolean(switchRecord?.host && switchRecord?.id),
    [switchRecord]
  );

  useEffect(() => {
    if (open) {
      setDraft(normalizeCiscoSwitch(switchRecord || DEFAULT_CISCO_SWITCH));
      setShowAdvanced(false);
      setShowSshPassword(false);
      setShowSnmpPassword(false);
      setConnecting(false);
      setPhase("idle");
      setStatusMessage(null);
      setErrorMessage(null);
      setRecommendation(null);
      setResolvedSystem(switchRecord?.system || null);
      setElapsed(0);
    }
    return () => stopTimers();
  }, [open, switchRecord]);

  useEffect(() => () => stopTimers(), []);

  function stopTimers() {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  const patch = (changes) =>
    setDraft((prev) => normalizeCiscoSwitch({ ...prev, ...changes }));

  async function handleConnect() {
    if (!isValidHost(draft.host)) {
      setErrorMessage("Enter a valid IP address (e.g. 192.168.10.250).");
      return;
    }
    if (!draft.sshPassword && !isEdit) {
      setErrorMessage("Enter the SSH password — required for first connection.");
      return;
    }
    stopTimers();
    setConnecting(true);
    setErrorMessage(null);
    setRecommendation(null);
    setStatusMessage(`Testing connection to ${draft.host}…`);
    setPhase("testing");
    setElapsed(0);
    const startedAt = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      const result = await testCiscoSwitch(draft);
      stopTimers();
      if (result?.success) {
        setPhase("success");
        setRecommendation(result.recommendation || null);
        setResolvedSystem(result.system || null);
        setStatusMessage(
          result.message ||
            (result.system?.model
              ? `Connected to ${result.system.hostname || result.system.model}.`
              : "Connection successful.")
        );
        const merged = {
          ...draft,
          enabled: true,
          system: result.system || draft.system,
          lastConnectedAt: new Date().toISOString(),
          lastError: null,
        };
        try {
          await onSave?.(merged);
        } catch (saveErr) {
          setErrorMessage(saveErr?.message || "Failed to save switch.");
          setPhase("failed");
        } finally {
          setConnecting(false);
        }
      } else {
        setPhase("failed");
        setRecommendation(result?.recommendation || null);
        setErrorMessage(result?.message || result?.error || "Connection failed.");
        setStatusMessage(null);
        setConnecting(false);
      }
    } catch (err) {
      stopTimers();
      setPhase("failed");
      setErrorMessage(err?.message || "Connection failed.");
      setStatusMessage(null);
      setConnecting(false);
    }
  }

  async function handleSaveDisabled() {
    setConnecting(true);
    try {
      await onSave?.({ ...draft, enabled: false });
      onClose?.();
    } catch (err) {
      setErrorMessage(err?.message || "Save failed.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDelete() {
    if (!switchRecord?.id) return;
    if (!confirm(`Remove ${switchRecord.host} from this site?`)) return;
    setConnecting(true);
    try {
      await onDelete?.(switchRecord);
      onClose?.();
    } catch (err) {
      setErrorMessage(err?.message || "Delete failed.");
    } finally {
      setConnecting(false);
    }
  }

  const phaseUi = renderPhase({
    phase,
    statusMessage,
    errorMessage,
    elapsed,
    recommendation,
    resolvedSystem,
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!connecting) onClose?.(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 ring-1 ring-sky-500/25 flex items-center justify-center">
                  <Cpu size={16} className="text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {isEdit ? "Edit Cisco switch" : "Connect Cisco switch"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {phase === "success"
                      ? "Connected"
                      : "Catalyst 1300 / CBS350 — SSH + SNMP"}
                  </p>
                </div>
              </div>
              <button
                disabled={connecting}
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Network size={11} />
                  Switch IP address
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={draft.host}
                  onChange={(e) => patch({ host: e.target.value })}
                  disabled={connecting}
                  placeholder="192.168.10.250"
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-base font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Find this on the switch under <span className="font-mono">Administration → Management Interface</span>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    SSH user
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={draft.sshUsername}
                    onChange={(e) => patch({ sshUsername: e.target.value })}
                    disabled={connecting}
                    placeholder="cisco"
                    className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                  />
                </div>
                <div className="relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    SSH password
                  </label>
                  <input
                    type={showSshPassword ? "text" : "password"}
                    autoComplete="off"
                    value={draft.sshPassword}
                    onChange={(e) => patch({ sshPassword: e.target.value })}
                    disabled={connecting}
                    placeholder={isEdit ? "(saved)" : "Required"}
                    className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 pr-9 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSshPassword((v) => !v)}
                    className="absolute right-2.5 bottom-2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showSshPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {phaseUi}

              <div className="space-y-2">
                {connecting ? (
                  <button
                    type="button"
                    disabled
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border text-sm font-bold text-muted-foreground"
                  >
                    <Loader2 size={16} className="animate-spin" />
                    Working…
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!isValidHost(draft.host)}
                    onClick={handleConnect}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500 text-sky-950 text-sm font-bold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Power size={16} />
                    {phase === "success" ? "Test connection again" : "Connect to switch"}
                  </button>
                )}
                {isEdit && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={handleSaveDisabled}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {draft.enabled ? "Disable polling" : "Save (disabled)"}
                    </button>
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={handleDelete}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      Remove switch
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound size={11} />
                  Advanced settings
                </span>
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                            SSH port
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            disabled={connecting}
                            value={draft.sshPort}
                            onChange={(e) =>
                              patch({ sshPort: Number(e.target.value) || 22 })
                            }
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                            SNMP port
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            disabled={connecting}
                            value={draft.snmpPort}
                            onChange={(e) =>
                              patch({ snmpPort: Number(e.target.value) || 161 })
                            }
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                          Enable password (privilege 15)
                        </label>
                        <input
                          type="password"
                          autoComplete="off"
                          disabled={connecting}
                          value={draft.enablePassword}
                          onChange={(e) => patch({ enablePassword: e.target.value })}
                          placeholder="Optional — set if your switch requires enable"
                          className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                          SNMP version
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {["2c", "3"].map((v) => {
                            const active = draft.snmpVersion === v;
                            return (
                              <button
                                key={v}
                                type="button"
                                disabled={connecting}
                                onClick={() => patch({ snmpVersion: v })}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  active
                                    ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                                    : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
                                } disabled:opacity-50`}
                              >
                                SNMP v{v}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {draft.snmpVersion === "2c" ? (
                        <div className="relative">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                            SNMP community (read-only)
                          </label>
                          <input
                            type={showSnmpPassword ? "text" : "password"}
                            autoComplete="off"
                            disabled={connecting}
                            value={draft.snmpCommunity}
                            onChange={(e) => patch({ snmpCommunity: e.target.value })}
                            placeholder="public"
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 pr-9 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSnmpPassword((v) => !v)}
                            className="absolute right-2.5 bottom-2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showSnmpPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                                SNMPv3 user
                              </label>
                              <input
                                type="text"
                                autoComplete="off"
                                disabled={connecting}
                                value={draft.snmpv3User}
                                onChange={(e) => patch({ snmpv3User: e.target.value })}
                                placeholder="snmpadmin"
                                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                                Auth proto
                              </label>
                              <input
                                type="text"
                                disabled={connecting}
                                value={draft.snmpv3AuthProto}
                                onChange={(e) => patch({ snmpv3AuthProto: e.target.value })}
                                placeholder="SHA"
                                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                              />
                            </div>
                          </div>
                          <input
                            type="password"
                            autoComplete="off"
                            disabled={connecting}
                            value={draft.snmpv3AuthPass}
                            onChange={(e) => patch({ snmpv3AuthPass: e.target.value })}
                            placeholder="Auth passphrase"
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              disabled={connecting}
                              value={draft.snmpv3PrivProto}
                              onChange={(e) => patch({ snmpv3PrivProto: e.target.value })}
                              placeholder="AES"
                              className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                            />
                            <input
                              type="password"
                              autoComplete="off"
                              disabled={connecting}
                              value={draft.snmpv3PrivPass}
                              onChange={(e) => patch({ snmpv3PrivPass: e.target.value })}
                              placeholder="Privacy passphrase"
                              className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                          Friendly label (optional)
                        </label>
                        <input
                          type="text"
                          disabled={connecting}
                          value={draft.label}
                          onChange={(e) => patch({ label: e.target.value })}
                          placeholder="Engine room access switch"
                          className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function renderPhase({ phase, statusMessage, errorMessage, elapsed, recommendation, resolvedSystem }) {
  if (phase === "testing") {
    return (
      <div className="flex items-start gap-2 px-3 py-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 text-[12px]">
        <Loader2 size={14} className="animate-spin flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p>{statusMessage || "Working…"}</p>
          {elapsed > 0 && (
            <p className="text-[10px] text-sky-300/70 mt-1 font-mono">
              Elapsed · {elapsed}s
            </p>
          )}
        </div>
      </div>
    );
  }
  if (phase === "success") {
    return (
      <div className="flex flex-col gap-2 px-3 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[12px]">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
          <span className="font-semibold">{statusMessage || "Connected!"}</span>
        </div>
        {resolvedSystem && (
          <div className="ml-6 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-emerald-200/80 font-mono">
            {resolvedSystem.model && (
              <>
                <span className="text-emerald-200/50">Model</span>
                <span>{resolvedSystem.model}</span>
              </>
            )}
            {resolvedSystem.firmware && (
              <>
                <span className="text-emerald-200/50">Firmware</span>
                <span>{resolvedSystem.firmware}</span>
              </>
            )}
            {resolvedSystem.serial && (
              <>
                <span className="text-emerald-200/50">Serial</span>
                <span>{resolvedSystem.serial}</span>
              </>
            )}
            {resolvedSystem.uptime && (
              <>
                <span className="text-emerald-200/50">Uptime</span>
                <span>{resolvedSystem.uptime}</span>
              </>
            )}
            {resolvedSystem.poeBudgetW != null && (
              <>
                <span className="text-emerald-200/50">PoE budget</span>
                <span>{resolvedSystem.poeBudgetW}W</span>
              </>
            )}
          </div>
        )}
        {recommendation && (
          <p className="ml-6 text-[10px] text-amber-300/80">{recommendation}</p>
        )}
      </div>
    );
  }
  if (phase === "failed" || errorMessage) {
    return (
      <div className="flex flex-col gap-1.5 px-3 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[12px]">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{errorMessage || statusMessage}</span>
        </div>
        {recommendation && (
          <p className="ml-6 text-[10px] text-red-300/80">{recommendation}</p>
        )}
      </div>
    );
  }
  return null;
}
