import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  ChevronDown,
  ChevronUp,
  Network,
  Save,
  KeyRound,
} from "lucide-react";
import {
  LIGHTING_SYSTEM_TYPES,
  SYSTEM_TYPE_LABELS,
  SYSTEM_TYPE_DESCRIPTIONS,
  SYSTEM_TYPE_PROTOCOLS,
  defaultPortForProtocol,
  normalizeLightingSystemsConfig,
  normalizeLightingConnection,
} from "@/lib/lighting/lightingSettings";
import {
  saveLightingSystemsConfig,
  testLightingProcessor,
} from "@/api/lightingApi";
import LutronConnectionModal from "@/components/lighting/LutronConnectionModal";

const PROTOCOL_LABELS = {
  leap: "LEAP",
  telnet: "Telnet",
  "knx-ip": "KNX IP",
  "knx-tunnelling": "KNX tunnelling",
  "dali-usb": "DALI USB",
  "dali-ip": "DALI IP",
  "art-net": "Art-Net",
  sacn: "sACN",
  "enttec-usb": "ENTTEC USB",
  cip: "CIP (41794)",
  rest: "REST (HTTPS)",
  "yachtica-tcp": "Yachtica TCP",
};

/**
 * Choose which lighting/shade systems are present on site and configure
 * each processor/gateway. Supports mixed deployments (e.g. Lutron + KNX + Pharos).
 */
export default function LightingSystemsModal({ open, config, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => normalizeLightingSystemsConfig(config));
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [lutronModalOpen, setLutronModalOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft(normalizeLightingSystemsConfig(config));
      setExpanded({});
      setTesting({});
      setTestResults({});
      setError(null);
    }
  }, [open, config]);

  const enabledSet = useMemo(() => new Set(draft.enabled || []), [draft.enabled]);

  const toggleSystem = (type) => {
    setDraft((prev) => {
      const normalized = normalizeLightingSystemsConfig(prev);
      const enabled = new Set(normalized.enabled);
      if (enabled.has(type)) {
        if (enabled.size <= 1) return normalized;
        enabled.delete(type);
      } else {
        enabled.add(type);
      }
      return { ...normalized, enabled: [...enabled] };
    });
    setExpanded((prev) => ({ ...prev, [type]: true }));
  };

  const patchConnection = (type, changes) => {
    setDraft((prev) => {
      const normalized = normalizeLightingSystemsConfig(prev);
      const conn = normalizeLightingConnection({
        ...normalized.connections[type],
        ...changes,
        systemType: type,
      });
      return {
        ...normalized,
        connections: { ...normalized.connections, [type]: conn },
      };
    });
  };

  const handleProtocolChange = (type, protocol) => {
    const conn = draft.connections[type];
    const currentDefault = defaultPortForProtocol(conn.protocol, type);
    const nextDefault = defaultPortForProtocol(protocol, type);
    const nextPort = conn.port === currentDefault ? nextDefault : conn.port;
    patchConnection(type, { protocol, port: nextPort });
  };

  const handleTest = async (type) => {
    setTesting((prev) => ({ ...prev, [type]: true }));
    setTestResults((prev) => ({ ...prev, [type]: null }));
    try {
      const conn = draft.connections[type];
      const result = await testLightingProcessor(conn, type);
      setTestResults((prev) => ({ ...prev, [type]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [type]: { success: false, message: err?.message || "Test failed" },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveLightingSystemsConfig(draft);
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not save lighting systems.");
    } finally {
      setSaving(false);
    }
  };

  const handleLutronSave = useCallback(
    async (lutronConn) => {
      setDraft((prev) => {
        const normalized = normalizeLightingSystemsConfig(prev);
        const enabled = new Set(normalized.enabled);
        enabled.add("lutron");
        return {
          ...normalized,
          enabled: [...enabled],
          connections: {
            ...normalized.connections,
            lutron: normalizeLightingConnection({
              ...lutronConn,
              systemType: "lutron",
            }),
          },
        };
      });
      return lutronConn;
    },
    []
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !saving && onClose?.()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25 flex items-center justify-center">
                    <Layers size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Lighting &amp; shade systems</p>
                    <p className="text-[11px] text-muted-foreground">
                      Select every system type installed on this site
                    </p>
                  </div>
                </div>
                <button
                  disabled={saving}
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {LIGHTING_SYSTEM_TYPES.map((type) => {
                  const active = enabledSet.has(type);
                  const conn = draft.connections[type];
                  const isOpen = expanded[type];
                  const protocols = SYSTEM_TYPE_PROTOCOLS[type] || [];
                  const testResult = testResults[type];
                  const isTesting = testing[type];

                  return (
                    <div
                      key={type}
                      className={`rounded-xl border transition-colors ${
                        active
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleSystem(type)}
                          className="rounded border-border text-amber-500 focus:ring-amber-500/40"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">
                            {SYSTEM_TYPE_LABELS[type]}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {SYSTEM_TYPE_DESCRIPTIONS[type]}
                          </p>
                        </div>
                        {active && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))
                            }
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                          >
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>

                      {active && isOpen && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                          {type === "lutron" && (
                            <button
                              type="button"
                              onClick={() => setLutronModalOpen(true)}
                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25"
                            >
                              <KeyRound size={12} />
                              LEAP pairing / advanced Lutron setup
                            </button>
                          )}

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                              <Network size={10} />
                              Host / IP
                            </label>
                            <input
                              type="text"
                              value={conn.host}
                              onChange={(e) => patchConnection(type, { host: e.target.value })}
                              placeholder="192.168.1.50"
                              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                            />
                          </div>

                          {protocols.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                                Protocol
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {protocols.map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => handleProtocolChange(type, p)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${
                                      conn.protocol === p
                                        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                                        : "border-border bg-secondary text-muted-foreground"
                                    }`}
                                  >
                                    {PROTOCOL_LABELS[p] || p}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                                Port
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={65535}
                                value={conn.port}
                                onChange={(e) =>
                                  patchConnection(type, {
                                    port: Number(e.target.value) || conn.port,
                                  })
                                }
                                className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-sm font-mono"
                              />
                            </div>
                            <div className="flex items-end">
                              <label className="flex items-center gap-2 text-[11px] text-muted-foreground pb-2">
                                <input
                                  type="checkbox"
                                  checked={!!conn.enabled}
                                  onChange={(e) =>
                                    patchConnection(type, { enabled: e.target.checked })
                                  }
                                  className="rounded border-border text-amber-500"
                                />
                                Live control
                              </label>
                            </div>
                          </div>

                          {(type === "lutron" || type === "crestron") && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={conn.username}
                                onChange={(e) =>
                                  patchConnection(type, { username: e.target.value })
                                }
                                placeholder="Username"
                                className="rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs font-mono"
                              />
                              <input
                                type="password"
                                value={conn.password}
                                onChange={(e) =>
                                  patchConnection(type, { password: e.target.value })
                                }
                                placeholder="Password"
                                className="rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs font-mono"
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={isTesting}
                            onClick={() => handleTest(type)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            {isTesting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            Test connection
                          </button>

                          {testResult && (
                            <div
                              className={`flex items-start gap-2 px-2.5 py-2 rounded-lg text-[11px] border ${
                                testResult.success
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                  : "border-red-500/30 bg-red-500/10 text-red-400"
                              }`}
                            >
                              {testResult.success ? (
                                <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                              )}
                              <span>{testResult.message || (testResult.success ? "OK" : "Failed")}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[12px]">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-border flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-amber-950 text-sm font-bold hover:bg-amber-400 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save systems
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LutronConnectionModal
        open={lutronModalOpen}
        connection={draft.connections?.lutron}
        onClose={() => setLutronModalOpen(false)}
        onSave={handleLutronSave}
      />
    </>
  );
}
