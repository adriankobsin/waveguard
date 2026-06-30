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
  Hand,
  Power,
  Unlink,
} from "lucide-react";
import {
  DEFAULT_LUTRON_CONNECTION,
  defaultPortForProtocol,
  normalizeLutronConnection,
} from "@/lib/lighting/lightingSettings";
import {
  testLutronProcessor,
  leapPairWithProcessor,
  leapGetPairingStatus,
  leapCancelPairing,
  leapTestConnection,
  leapUnpairProcessor,
} from "@/api/lightingApi";

const PROTOCOL_OPTIONS = [
  { id: "leap", label: "LEAP (HomeWorks QSX, Athena)" },
  { id: "telnet", label: "Telnet (RadioRA 3, legacy HomeWorks)" },
];

/**
 * Simplified Lutron connection modal.
 *
 * Default flow ("simple mode"):
 *   1. Enter processor IP
 *   2. Click Connect
 *   3. (LEAP only) Press the physical button on the processor when prompted
 *   4. Done — saved automatically, modal closes
 *
 * Everything else (protocol selection, port override, Telnet credentials,
 * TLS verify, manual test connection) lives under an "Advanced settings"
 * disclosure that's collapsed by default.
 */
export default function LutronConnectionModal({
  open,
  connection,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() =>
    normalizeLutronConnection(connection || DEFAULT_LUTRON_CONNECTION)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Connection lifecycle
  const [connecting, setConnecting] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | testing | waiting-button | signing | success | failed | unpaired
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const pollTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const isLeap = draft.protocol === "leap";

  // ── Lifecycle: open/close ────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setDraft(normalizeLutronConnection(connection || DEFAULT_LUTRON_CONNECTION));
      setShowAdvanced(false);
      setShowPassword(false);
      setConnecting(false);
      setStatusMessage(null);
      setErrorMessage(null);
      setElapsed(0);
      if (connection?.host && connection.protocol === "leap") {
        bootstrapStatus(connection.host);
      } else if (connection?.host) {
        setPhase("idle");
      } else {
        setPhase("idle");
      }
    }
    return () => stopTimers();
     
  }, [open, connection]);

  useEffect(() => () => stopTimers(), []);

  function stopTimers() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  async function bootstrapStatus(host) {
    const result = await leapGetPairingStatus(host);
    if (result?.status === "paired") setPhase("success");
    else setPhase("idle");
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  const portPlaceholder = useMemo(
    () => String(defaultPortForProtocol(draft.protocol)),
    [draft.protocol]
  );

  const patch = (changes) =>
    setDraft((prev) => normalizeLutronConnection({ ...prev, ...changes }));

  function handleProtocolChange(nextProtocol) {
    const currentDefault = defaultPortForProtocol(draft.protocol);
    const nextDefault = defaultPortForProtocol(nextProtocol);
    const nextPort = draft.port === currentDefault ? nextDefault : draft.port;
    const changes = { protocol: nextProtocol, port: nextPort };
    if (nextProtocol === "leap") {
      changes.username = "";
      changes.password = "";
    }
    patch(changes);
    setPhase("idle");
    setStatusMessage(null);
    setErrorMessage(null);
  }

  // ── Single unified Connect flow ──────────────────────────────────────────

  async function handleConnect() {
    if (!draft.host) {
      setErrorMessage("Enter your processor's IP address first.");
      return;
    }
    stopTimers();
    setConnecting(true);
    setErrorMessage(null);
    setElapsed(0);

    const startedAt = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      if (isLeap) {
        await runLeapConnect();
      } else {
        await runTelnetConnect();
      }
    } catch (err) {
      handleFailure(err?.message || "Connection failed");
    }
  }

  async function runLeapConnect() {
    // Step 1 — test connectivity (informational, but bail if firewalled)
    setPhase("testing");
    setStatusMessage(`Testing connection to ${draft.host}:${draft.port}...`);
    const conn = await leapTestConnection(draft.host, draft.port);
    if (!conn?.reachable) {
      handleFailure(
        `Can't reach ${draft.host}:${draft.port}. Check the IP is correct and the processor is powered on.`
      );
      return;
    }
    if (!conn?.tlsAccepted) {
      handleFailure(
        `Reached ${draft.host} but LEAP isn't responding on port ${draft.port}. ` +
          `Enable LEAP in Lutron Designer (Tools › Integration › Allow LEAP) and transfer the project.`
      );
      return;
    }

    // Step 2 — check if already paired
    const status = await leapGetPairingStatus(draft.host);
    if (status?.status === "paired") {
      await persistAndFinish("Already paired. Settings saved.");
      return;
    }

    // Step 3 — start pairing, wait for button press
    setPhase("waiting-button");
    setStatusMessage("Press the physical button on your processor now");
    const kickoff = await leapPairWithProcessor(draft.host, draft.port);
    if (!kickoff?.success && kickoff?.status !== "pairing") {
      handleFailure(kickoff?.message || "Failed to start pairing.");
      return;
    }
    if (kickoff?.status === "paired") {
      await persistAndFinish("Paired! Settings saved.");
      return;
    }

    // Step 4 — poll for completion
    pollPairing(draft.host, kickoff?.pollIntervalMs || 1500);
  }

  async function runTelnetConnect() {
    setPhase("testing");
    setStatusMessage(`Testing connection to ${draft.host}:${draft.port}...`);
    if (!draft.username) {
      handleFailure(
        "Telnet needs an integration username. Open Advanced settings to enter it."
      );
      return;
    }
    const result = await testLutronProcessor(draft);
    if (!result?.success) {
      handleFailure(
        result?.message ||
          `Could not connect to ${draft.host}:${draft.port}. ` +
            "Verify the integration username/password and that Telnet is enabled in Designer."
      );
      return;
    }
    await persistAndFinish("Connected. Settings saved.");
  }

  function pollPairing(host, intervalMs) {
    const poll = async () => {
      try {
        const result = await leapGetPairingStatus(host);
        if (!result) {
          pollTimerRef.current = setTimeout(poll, intervalMs);
          return;
        }
        if (result.state === "signing") {
          setPhase("signing");
          setStatusMessage("Button detected! Saving certificate...");
        } else if (result.state === "waiting-button") {
          setPhase("waiting-button");
          setStatusMessage("Press the physical button on your processor now");
        }
        if (result.status === "paired") {
          await persistAndFinish("Paired! Settings saved.");
          return;
        }
        if (result.status === "failed") {
          handleFailure(result.message || result.error || "Pairing failed.");
          return;
        }
        pollTimerRef.current = setTimeout(poll, intervalMs);
      } catch {
        pollTimerRef.current = setTimeout(poll, intervalMs);
      }
    };
    pollTimerRef.current = setTimeout(poll, intervalMs);
  }

  async function persistAndFinish(successMsg) {
    stopTimers();
    setPhase("success");
    setStatusMessage(successMsg);
    try {
      await onSave?.({ ...draft, enabled: true });
    } catch (err) {
      handleFailure(err?.message || "Save failed after pairing.");
      return;
    }
    setConnecting(false);
    // Brief pause so user sees success before close
    setTimeout(() => {
      onClose?.();
    }, 1200);
  }

  function handleFailure(message) {
    stopTimers();
    setPhase("failed");
    setConnecting(false);
    setStatusMessage(null);
    setErrorMessage(message);
  }

  async function handleCancel() {
    stopTimers();
    if (draft.host) {
      try { await leapCancelPairing(draft.host); } catch { /* */ }
    }
    setConnecting(false);
    setPhase("idle");
    setStatusMessage("Connection cancelled.");
  }

  async function handleDisconnect() {
    if (!draft.host) return;
    setConnecting(true);
    setErrorMessage(null);
    try {
      if (isLeap) {
        await leapUnpairProcessor(draft.host);
      }
      await onSave?.({ ...draft, enabled: false });
      setPhase("unpaired");
      setStatusMessage("Disconnected.");
    } catch (err) {
      setErrorMessage(err?.message || "Disconnect failed");
    } finally {
      setConnecting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const phaseUi = renderPhase(phase, statusMessage, errorMessage, elapsed);

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
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25 flex items-center justify-center">
                  <KeyRound size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Connect Lutron processor
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {phase === "success"
                      ? "Connected"
                      : "Enter IP, click Connect, press button."}
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
              {/* IP input — the only required field */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Network size={11} />
                  Processor IP
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={draft.host}
                  onChange={(e) => patch({ host: e.target.value })}
                  disabled={connecting}
                  placeholder="192.168.20.70"
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-base font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Find this in Lutron Designer → Activate → Processor IP address.
                </p>
              </div>

              {/* Live status area */}
              {phaseUi}

              {/* Main action button(s) */}
              <div className="space-y-2">
                {phase === "success" ? (
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={handleDisconnect}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold border border-red-500/25 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {connecting ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
                    Disconnect
                  </button>
                ) : connecting ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border text-sm font-bold text-foreground hover:bg-muted"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!draft.host}
                    onClick={handleConnect}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-amber-950 text-sm font-bold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Power size={16} />
                    Connect to processor
                  </button>
                )}
              </div>

              {/* Advanced settings (collapsed by default) */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <span>Advanced settings</span>
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
                      {/* Protocol */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                          Protocol
                        </p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {PROTOCOL_OPTIONS.map((opt) => {
                            const active = draft.protocol === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={connecting}
                                onClick={() => handleProtocolChange(opt.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left border transition-colors ${
                                  active
                                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                                    : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
                                } disabled:opacity-50`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Port */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                          Port
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={65535}
                          disabled={connecting}
                          value={draft.port}
                          onChange={(e) =>
                            patch({ port: Number(e.target.value) || draft.port })
                          }
                          placeholder={portPlaceholder}
                          className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
                        />
                      </div>

                      {/* Credentials (username/password used for Telnet; optional for LEAP) */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                            Integration username
                          </label>
                          <input
                            type="text"
                            autoComplete="off"
                            disabled={connecting}
                            value={draft.username}
                            onChange={(e) => patch({ username: e.target.value })}
                            placeholder="lutron"
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                            Integration password
                          </label>
                          <input
                            type={showPassword ? "text" : "password"}
                            autoComplete="off"
                            disabled={connecting}
                            value={draft.password}
                            onChange={(e) => patch({ password: e.target.value })}
                            placeholder="integration"
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
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

// ── Status area ──────────────────────────────────────────────────────────

function renderPhase(phase, message, errorMessage, elapsed) {
  if (phase === "waiting-button") {
    return (
      <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-4 py-5 text-center">
        <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-amber-500/20 ring-2 ring-amber-500/50 flex items-center justify-center">
          <Hand size={28} className="text-amber-400 animate-pulse" />
        </div>
        <p className="text-base font-bold text-amber-300 mb-1">
          Press the button on your processor
        </p>
        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          Use a paperclip on the small recessed button on the front of the
          processor.
        </p>
        <p className="text-[10px] text-amber-300/70 mt-2 font-mono">
          {elapsed > 0 ? `Waiting · ${elapsed}s of 60s` : "Waiting..."}
        </p>
      </div>
    );
  }

  if (phase === "testing" || phase === "signing") {
    return (
      <div className="flex items-start gap-2 px-3 py-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 text-[12px]">
        <Loader2 size={14} className="animate-spin flex-shrink-0 mt-0.5" />
        <span>{message || "Working..."}</span>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex items-start gap-2 px-3 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[12px]">
        <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
        <span className="font-semibold">{message || "Connected!"}</span>
      </div>
    );
  }

  if (phase === "failed" || errorMessage) {
    return (
      <div className="flex items-start gap-2 px-3 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[12px]">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>{errorMessage || message}</span>
      </div>
    );
  }

  if (phase === "unpaired") {
    return (
      <div className="flex items-start gap-2 px-3 py-3 rounded-xl border border-border bg-muted/30 text-muted-foreground text-[12px]">
        <span>{message}</span>
      </div>
    );
  }

  return null;
}
