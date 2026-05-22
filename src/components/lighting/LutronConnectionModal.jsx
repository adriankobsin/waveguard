import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Network,
  Save,
} from "lucide-react";
import {
  DEFAULT_LUTRON_CONNECTION,
  defaultPortForProtocol,
  normalizeLutronConnection,
} from "@/lib/lighting/lightingSettings";
import { testLutronProcessor } from "@/api/lightingApi";

const PROTOCOL_OPTIONS = [
  {
    id: "telnet",
    label: "Telnet (port 23)",
    helper:
      "HomeWorks QSX, RadioRA 3 and legacy processors. Enable Telnet support in Lutron Designer → Tools → Integration.",
  },
  {
    id: "leap",
    label: "LEAP / HTTPS (port 8081)",
    helper:
      "HomeWorks Athena and newer firmware. The integration username + password is still required when LEAP is paired to a 3rd-party account.",
  },
];

/**
 * Modal for editing the Lutron processor connection. The integration
 * username / password configured here must match the credentials saved
 * in Lutron Designer (Integration tab) — without them the processor
 * refuses commands from 3rd-party platforms like Wave Guard.
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
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft(normalizeLutronConnection(connection || DEFAULT_LUTRON_CONNECTION));
      setTestResult(null);
      setError(null);
      setShowPassword(false);
    }
  }, [open, connection]);

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
    patch({ protocol: nextProtocol, port: nextPort });
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await testLutronProcessor(draft);
      setTestResult(result);
    } catch (err) {
      setError(err?.message || "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!draft.host) {
      setError("Host is required before saving.");
      return;
    }
    if (!draft.username) {
      setError("Integration username is required.");
      return;
    }
    if (draft.enabled && !draft.password) {
      setError("Integration password is required when the integration is enabled.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave?.(draft);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
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
          onClick={() => {
            if (!testing && !saving) onClose?.();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25 flex items-center justify-center">
                  <KeyRound size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Lutron processor connection
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Integration credentials configured in Lutron Designer.
                    Required for 3rd-party control of the processor.
                  </p>
                </div>
              </div>
              <button
                disabled={testing || saving}
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-[11px] text-amber-300/90 leading-relaxed">
                <p className="font-semibold text-amber-300 mb-1">
                  Enable integration access on the processor first
                </p>
                <p>
                  In Lutron Designer, open the processor properties →{" "}
                  <span className="font-mono text-amber-200">
                    Tools › Integration
                  </span>
                  , enable Telnet / LEAP support, set an integration login and
                  send the program to the processor. Then enter the same
                  credentials below.
                </p>
              </div>

              {/* Enable + protocol */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      Live control
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Route commands to the processor
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => patch({ enabled: !draft.enabled })}
                    className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
                      draft.enabled ? "bg-amber-500" : "bg-muted"
                    }`}
                    style={{ height: 22 }}
                    title={draft.enabled ? "Disable" : "Enable"}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        draft.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>

                <div className="sm:col-span-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Protocol
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PROTOCOL_OPTIONS.map((opt) => {
                      const active = draft.protocol === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleProtocolChange(opt.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left border transition-colors ${
                            active
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                              : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                    {PROTOCOL_OPTIONS.find((p) => p.id === draft.protocol)?.helper}
                  </p>
                </div>
              </div>

              {/* Host / port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Network size={11} />
                    Processor host / IP
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={draft.host}
                    onChange={(e) => patch({ host: e.target.value })}
                    placeholder="192.168.40.2"
                    className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                    Port
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={draft.port}
                    onChange={(e) =>
                      patch({ port: Number(e.target.value) || draft.port })
                    }
                    placeholder={portPlaceholder}
                    className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>

              {/* Username / password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                    Integration username
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={draft.username}
                    onChange={(e) => patch({ username: e.target.value })}
                    placeholder="lutron"
                    className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                    Integration password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={draft.password}
                      onChange={(e) => patch({ password: e.target.value })}
                      placeholder="integration"
                      className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 pr-9 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* TLS verify (LEAP only) */}
              {draft.protocol === "leap" && (
                <label className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => patch({ tlsVerify: !draft.tlsVerify })}
                    className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${
                      draft.tlsVerify ? "bg-emerald-500" : "bg-muted"
                    }`}
                    style={{ height: 22 }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        draft.tlsVerify ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-400" />
                      Verify TLS certificate
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Disable only for self-signed LEAP processor certificates.
                    </p>
                  </div>
                </label>
              )}

              {/* Errors */}
              {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className="space-y-2">
                  <div
                    className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${
                      testResult.success
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/30 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">
                        {testResult.success
                          ? "Processor reachable"
                          : "Processor unreachable"}
                        <span className="font-normal opacity-80 ml-1">
                          · {testResult.processor} · {testResult.api || draft.protocol}
                        </span>
                      </p>
                      {testResult.message && (
                        <p className="opacity-80 mt-0.5">{testResult.message}</p>
                      )}
                      {testResult.authenticatedAs && (
                        <p className="opacity-80 mt-0.5">
                          Authenticated as{" "}
                          <span className="font-mono">{testResult.authenticatedAs}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {Array.isArray(testResult.availablePorts) &&
                    testResult.availablePorts.length > 0 && (
                      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                          Detected integration ports on {testResult.processor?.split(":")[0]}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {testResult.availablePorts.map((p) => (
                            <span
                              key={p.port}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                p.open
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                  : "border-border bg-secondary text-muted-foreground"
                              }`}
                              title={p.label}
                            >
                              <span className="font-mono">{p.port}</span>
                              <span className="opacity-80">{p.label}</span>
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  p.open ? "bg-emerald-400" : "bg-muted-foreground"
                                }`}
                              />
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {testResult.recommendation && !testResult.success && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/8 text-[11px] text-amber-300/95 leading-relaxed">
                      <KeyRound size={12} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-300 mb-0.5">
                          Suggested next step
                        </p>
                        <p>{testResult.recommendation}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-muted/30">
              <button
                disabled={testing || saving}
                onClick={handleTest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Activity size={12} />
                )}
                Test connection
              </button>

              <div className="flex items-center gap-2">
                <button
                  disabled={testing || saving}
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-amber-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Save credentials
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
