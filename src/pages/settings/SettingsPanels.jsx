import { useState, useEffect } from "react";
import {
  CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff, Plus, Key, BookOpen,
  HardDrive, Download, RotateCcw, Trash2, LayoutDashboard, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/permissions";
import { testLightingProcessor } from "@/api/lightingApi";
import { getIntegrationTypes, getIntegrationConfigs, createIntegrationConfig, deleteIntegrationConfig, testIntegrationConfig, getIntegrationLogs } from "@/api/integrationApi";
import { getCategoryLabel, CATEGORY_ORDER } from "@/lib/integrations/integrationRegistry";
import { WIDGET_TYPES } from "@/components/dashboard/widgets/DashboardWidgets";
import {
  testIntegration,
  testOpenAiKey,
  listBackups,
  createBackup,
  restoreBackup,
  downloadBackup,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  reindexDocumentation,
} from "@/api/settingsApi";
import { toast } from "sonner";

const INPUT_CLS = "w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50";

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? "bg-primary" : "bg-secondary border border-border"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export function SaveBar({ saving, saved, onSave, label = "Save settings" }) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : null}
      {saving ? "Saving…" : saved ? "Saved!" : label}
    </button>
  );
}

export function DashboardWidgetsPanel() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Add, remove, and arrange widgets on the main dashboard. All {Object.keys(WIDGET_TYPES).length} widget types are available in edit mode.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
      >
        <LayoutDashboard size={14} />
        Open Dashboard to edit layout
        <ExternalLink size={12} />
      </Link>
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Available widgets</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.values(WIDGET_TYPES).map((w) => (
            <li key={w.id} className="text-sm text-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {w.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const INTEGRATION_DEFS = [
  { key: "snmp", label: "SNMP", fields: [{ k: "host", l: "Host" }, { k: "community", l: "Community" }, { k: "version", l: "Version (2c/3)" }] },
  { key: "crestron", label: "Crestron", fields: [{ k: "host", l: "Host" }, { k: "user", l: "API user" }, { k: "password", l: "Password", secret: true }] },
  { key: "qsys", label: "Q-SYS", fields: [{ k: "host", l: "Host" }, { k: "port", l: "Port" }] },
  { key: "dahua", label: "Dahua CCTV", fields: [{ k: "host", l: "Host" }, { k: "user", l: "User" }, { k: "password", l: "Password", secret: true }] },
  { key: "mqtt", label: "MQTT", fields: [{ k: "brokerUrl", l: "Broker URL" }, { k: "topicPrefix", l: "Topic prefix" }] },
  { key: "dali", label: "DALI", fields: [{ k: "host", l: "Gateway host" }] },
  { key: "dmx", label: "DMX / Art-Net", fields: [{ k: "host", l: "Art-Net host" }] },
  { key: "knx", label: "KNX", fields: [{ k: "host", l: "Gateway host" }, { k: "port", l: "Port" }] },
  { key: "cisco", label: "Cisco RESTCONF", fields: [{ k: "host", l: "RESTCONF host" }, { k: "user", l: "User" }, { k: "password", l: "Password", secret: true }, { k: "merakiApiKey", l: "Meraki API key", secret: true }] },
];

const defaultIntegrations = () => {
  const cfg = {};
  INTEGRATION_DEFS.forEach((i) => {
    cfg[i.key] = { enabled: i.key === "snmp", host: "", port: i.key === "qsys" ? "1710" : i.key === "knx" ? "3671" : "" };
  });
  return cfg;
};

export function IntegrationsPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("integrations", defaultIntegrations());
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [dbTypes, setDbTypes] = useState(null);
  const [dbConfigs, setDbConfigs] = useState([]);
  const [dbShow, setDbShow] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [detailCfg, setDetailCfg] = useState(null);
  const [detailLogs, setDetailLogs] = useState([]);

  const loadDbData = async () => {
    if (dbTypes) return;
    setDbLoading(true);
    try {
      const [types, configs] = await Promise.all([getIntegrationTypes(), getIntegrationConfigs()]);
      setDbTypes(types);
      setDbConfigs(configs);
    } catch { /* DB not available */ }
    setDbLoading(false);
  };

  const openDetail = async (cfg) => {
    setDetailCfg(cfg);
    try {
      setDetailLogs(await getIntegrationLogs(cfg.id, 20));
    } catch { setDetailLogs([]); }
  };

  const addConfig = async (typeId) => {
    const label = prompt("Label for this integration:");
    if (!label) return;
    const host = prompt("Host / IP address:");
    if (!host) return;
    const cfg = await createIntegrationConfig({ type_id: typeId, label, host, port: 80 });
    setDbConfigs((prev) => [...prev, cfg]);
  };

  const removeConfig = async (id) => {
    if (!confirm("Remove this integration config?")) return;
    await deleteIntegrationConfig(id);
    setDbConfigs((prev) => prev.filter((c) => c.id !== id));
    if (detailCfg?.id === id) setDetailCfg(null);
  };

  const testConfig = async (id) => {
    try {
      const res = await testIntegrationConfig(id);
      setDbConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, health_status: res.status } : c)));
    } catch {
      setDbConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, health_status: "offline" } : c)));
    }
  };

  const updateIntegration = (key, patch) => {
    setCfg((c) => ({ ...c, [key]: { ...(c[key] || {}), ...patch } }));
  };

  const runTest = async (key) => {
    setTesting(key);
    setTestResult(null);
    try {
      if (key === "knx" || key === "dali" || key === "dmx") {
        const ic = cfg[key] || {};
        const res = await testLightingProcessor({
          host: ic.host,
          port: Number(ic.port) || undefined,
          username: ic.user,
          password: ic.password,
          systemType: key,
        });
        if (!res.success) throw new Error(res.message || `${key.toUpperCase()} processor unreachable`);
        const detail = [res.product, res.firmware ? `fw ${res.firmware}` : null, res.api]
          .filter(Boolean)
          .join(" · ");
        setTestResult({
          key,
          ok: true,
          message: `${res.processor} — ${res.message}${detail ? ` (${detail})` : ""}`,
        });
      } else {
        const res = await testIntegration(key, cfg[key]);
        setTestResult({ key, ok: true, message: res.message });
      }
    } catch (e) {
      setTestResult({ key, ok: false, message: e.message });
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Configure vendor API connections. Enable each integration and enter connection details.</p>
      {INTEGRATION_DEFS.map((integ) => {
        const ic = cfg[integ.key] || {};
        return (
          <div key={integ.key} className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{integ.label}</p>
              <Toggle on={!!ic.enabled} onToggle={() => updateIntegration(integ.key, { enabled: !ic.enabled })} />
            </div>
            {ic.enabled && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {integ.fields.map((f) => (
                    <Field key={f.k} label={f.l}>
                      <input
                        type={f.secret ? "password" : "text"}
                        value={ic[f.k] || ""}
                        onChange={(e) => updateIntegration(integ.key, { [f.k]: e.target.value })}
                        className={`${INPUT_CLS} ${f.secret ? "font-mono" : ""}`}
                      />
                    </Field>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => runTest(integ.key)}
                  disabled={testing === integ.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
                >
                  {testing === integ.key ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                  Test connection
                </button>
                {testResult?.key === integ.key && (
                  <p className={`text-xs flex items-center gap-1 ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                    {testResult.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {testResult.message}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />

      <div className="border-t border-border pt-4">
        <button
          onClick={() => { setDbShow(!dbShow); if (!dbShow) loadDbData(); }}
          className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2"
        >
          <span className={`transition-transform ${dbShow ? "rotate-90" : ""}`}>▶</span>
          API Integration Database ({dbConfigs.length} configs)
        </button>

        {dbShow && (
          <div className="space-y-3">
            {dbLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

            {!dbLoading && dbTypes && (
              <div className="flex flex-wrap gap-2 mb-3">
                {dbTypes
                  .reduce((acc, t) => {
                    const cat = acc.find((c) => c.category === t.category);
                    if (cat) cat.types.push(t);
                    else acc.push({ category: t.category, label: getCategoryLabel(t.category), types: [t] });
                    return acc;
                  }, [])
                  .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
                  .map((cat) => (
                    <div key={cat.category} className="w-full">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{cat.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.types.map((t) => (
                          <div key={t.id} className="relative group">
                            <button
                              onClick={() => addConfig(t.id)}
                              className="px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                              title={`${t.label} — ${t.description || ""}`}
                            >
                              {t.label}
                            </button>
                            {t.phase === 2 && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" title="Phase 2 (coming soon)" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {dbConfigs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Configured instances:</p>
                {dbConfigs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-secondary/30">
                    <button onClick={() => openDetail(c)} className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.health_status === "online" ? "bg-green-500" : c.health_status === "offline" ? "bg-red-500" : "bg-gray-400"}`} />
                        <span className="text-xs font-medium">{c.label}</span>
                        <span className="text-[10px] text-muted-foreground">({c.type_id})</span>
                        {c.host && <span className="text-[10px] font-mono text-muted-foreground">{c.host}</span>}
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => testConfig(c.id)} className="p-1 rounded text-xs text-muted-foreground hover:text-foreground" title="Test connection">⟳</button>
                      <button onClick={() => removeConfig(c.id)} className="p-1 rounded text-xs text-red-400 hover:text-red-300" title="Delete">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detailCfg && (
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{detailCfg.label}</p>
                  <button onClick={() => setDetailCfg(null)} className="text-xs text-muted-foreground">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">Type</span><span>{detailCfg.type_id}</span>
                  {detailCfg.host && <><span className="text-muted-foreground">Host</span><span className="font-mono">{detailCfg.host}</span></>}
                  {detailCfg.port && <><span className="text-muted-foreground">Port</span><span>{detailCfg.port}</span></>}
                  {detailCfg.api_key && <><span className="text-muted-foreground">API Key</span><span className="font-mono">••••{detailCfg.api_key.slice(-4)}</span></>}
                  <span className="text-muted-foreground">Status</span>
                  <span className={detailCfg.health_status === "online" ? "text-green-400" : detailCfg.health_status === "offline" ? "text-red-400" : "text-muted-foreground"}>
                    {detailCfg.health_status}
                  </span>
                  {detailCfg.last_polled_at && <><span className="text-muted-foreground">Last polled</span><span>{detailCfg.last_polled_at}</span></>}
                </div>
                {detailLogs.length > 0 && (
                  <div className="border-t border-border pt-2 mt-1">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Activity log</p>
                    <div className="max-h-24 overflow-y-auto space-y-0.5">
                      {detailLogs.map((l) => (
                        <p key={l.id} className="text-[10px] font-mono text-muted-foreground">
                          <span className={l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : "text-green-400"}>
                            [{l.level}]
                          </span>{" "}
                          {l.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentationPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("documentation", {
    storageType: "local",
    uploadPath: "/var/waveguard/documents/upload",
    aiIndexPath: "/var/waveguard/documents/index",
    nasMountPath: "",
    cloudEndpoint: "",
    cloudBucket: "",
    cloudAccessKey: "",
    cloudSecretKey: "",
  });
  const [reindexing, setReindexing] = useState(false);
  const [reindexDone, setReindexDone] = useState(false);

  const storageOptions = [
    { value: "local", label: "Local server", desc: "Storage on the WaveGuard host" },
    { value: "nas", label: "NAS / network mount", desc: "SMB or NFS mount path" },
    { value: "cloud", label: "Cloud backup", desc: "S3-compatible or cloud endpoint" },
  ];

  const reindex = async () => {
    setReindexing(true);
    setReindexDone(false);
    try {
      await reindexDocumentation({
        storageType: cfg.storageType,
        uploadPath: cfg.uploadPath,
        aiIndexPath: cfg.aiIndexPath,
      });
      setReindexDone(true);
      toast.success("Re-index complete.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Set where uploaded documentation is stored and where the AI searches for indexed content.</p>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Storage target</p>
        {storageOptions.map((opt) => (
          <label key={opt.value} className="flex items-center gap-3 cursor-pointer" onClick={() => setCfg((c) => ({ ...c, storageType: opt.value }))}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${cfg.storageType === opt.value ? "border-primary bg-primary" : "border-border"}`}>
              {cfg.storageType === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <p className="text-sm text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
      <Field label="Upload folder path">
        <input value={cfg.uploadPath || ""} onChange={(e) => setCfg((c) => ({ ...c, uploadPath: e.target.value }))} className={`${INPUT_CLS} font-mono`} placeholder="/var/waveguard/documents/upload" />
      </Field>
      <Field label="AI search / index folder path">
        <input value={cfg.aiIndexPath || ""} onChange={(e) => setCfg((c) => ({ ...c, aiIndexPath: e.target.value }))} className={`${INPUT_CLS} font-mono`} placeholder="/var/waveguard/documents/index" />
      </Field>
      {cfg.storageType === "nas" && (
        <Field label="NAS mount path">
          <input value={cfg.nasMountPath || ""} onChange={(e) => setCfg((c) => ({ ...c, nasMountPath: e.target.value }))} className={`${INPUT_CLS} font-mono`} placeholder="//nas.local/waveguard/docs" />
        </Field>
      )}
      {cfg.storageType === "cloud" && (
        <>
          <Field label="Cloud endpoint URL">
            <input value={cfg.cloudEndpoint || ""} onChange={(e) => setCfg((c) => ({ ...c, cloudEndpoint: e.target.value }))} className={INPUT_CLS} />
          </Field>
          <Field label="Bucket name">
            <input value={cfg.cloudBucket || ""} onChange={(e) => setCfg((c) => ({ ...c, cloudBucket: e.target.value }))} className={INPUT_CLS} />
          </Field>
          <Field label="Access key">
            <input type="password" value={cfg.cloudAccessKey || ""} onChange={(e) => setCfg((c) => ({ ...c, cloudAccessKey: e.target.value }))} className={INPUT_CLS} />
          </Field>
          <Field label="Secret key">
            <input type="password" value={cfg.cloudSecretKey || ""} onChange={(e) => setCfg((c) => ({ ...c, cloudSecretKey: e.target.value }))} className={INPUT_CLS} />
          </Field>
        </>
      )}
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground mb-1">AI indexing</p>
        <p className="text-xs text-muted-foreground mb-3">Re-index documents from the paths above.</p>
        <button type="button" onClick={reindex} disabled={reindexing} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm">
          {reindexing ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
          {reindexing ? "Re-indexing…" : "Re-index all documents"}
        </button>
        {reindexDone && <p className="text-xs text-green-400 mt-2 flex items-center gap-1"><CheckCircle2 size={11} /> Re-index complete.</p>}
      </div>
    </div>
  );
}

export function AIPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("ai", {
    connected: false,
    keyHint: "",
    model: "gpt-4o-mini",
    key: "",
  });
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const connect = async () => {
    if (!keyInput.trim()) return;
    try {
      await testOpenAiKey(keyInput.trim());
      const hint = keyInput.length > 8 ? `…${keyInput.slice(-4)}` : "••••";
      const next = { connected: true, keyHint: hint, model: cfg.model || "gpt-4o-mini", key: keyInput.trim() };
      await save(next);
      setKeyInput("");
      setTestResult({ ok: true, message: "API connected." });
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    }
  };

  const disconnect = async () => {
    const next = { connected: false, keyHint: "", model: cfg.model || "gpt-4o-mini", key: "" };
    setCfg(next);
    await save(next);
    setKeyInput("");
    setTestResult(null);
    toast.success("OpenAI disconnected.");
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (cfg.connected) {
        setTestResult({ ok: true, message: `Connected (${cfg.keyHint})` });
      } else if (keyInput) {
        await testOpenAiKey(keyInput);
        setTestResult({ ok: true, message: "API key format looks valid." });
      } else {
        setTestResult({ ok: false, message: "No API key entered." });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Connect OpenAI once for the AI Assistant. The full key is never shown again after saving.</p>
      {cfg.connected ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <CheckCircle2 size={16} /> Connected
          </div>
          <p className="text-xs text-muted-foreground font-mono">sk-{cfg.keyHint}</p>
          <Field label="Chat model">
            <input value={cfg.model || ""} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))} className={`${INPUT_CLS} font-mono`} />
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={disconnect} className="px-4 py-2 rounded-xl border border-red-500/40 text-red-400 text-sm hover:bg-red-500/10">
              Disconnect
            </button>
            <button type="button" onClick={() => save(cfg)} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm">
              Save model
            </button>
          </div>
        </div>
      ) : (
        <>
          <Field label="OpenAI API Key">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-…"
                className={`${INPUT_CLS} pr-10 font-mono`}
              />
              <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <Field label="Chat model">
            <input value={cfg.model || ""} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))} className={`${INPUT_CLS} font-mono`} />
          </Field>
          <button type="button" onClick={connect} disabled={!keyInput || saving} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            Connect API
          </button>
        </>
      )}
      <button type="button" onClick={test} disabled={testing} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm">
        {testing ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
        Test key
      </button>
      {testResult && (
        <div className={`flex items-center gap-2 text-xs p-3 rounded-xl ${testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {testResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {testResult.message}
        </div>
      )}
    </div>
  );
}

export function UsersPanel() {
  const { user: currentUser } = useAuth();
  const admin = isAdmin(currentUser);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [creating, setCreating] = useState(false);

  const load = () => {
    import("@/api/base44Client").then(({ base44 }) =>
      base44.entities.User.list().then(setUsers).finally(() => setLoading(false))
    );
  };

  useEffect(() => {
    if (admin) load();
    else setLoading(false);
  }, [admin]);

  const handleCreate = async () => {
    if (!username || !password) return;
    setCreating(true);
    try {
      await createUserAccount({ username, password, role });
      setUsername("");
      setPassword("");
      setRole("user");
      load();
      toast.success("User created.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (!admin) {
    return <p className="text-sm text-muted-foreground">Only administrators can manage users.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Create operator accounts. Default admin: WaveAdmin (configured on server).</p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary border border-border gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{u.full_name || u.username || u.email}</p>
                <p className="text-xs text-muted-foreground">{u.username ? `@${u.username}` : u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={u.role || "user"}
                  onChange={async (e) => {
                    try {
                      await updateUserAccount(u.id, { role: e.target.value });
                      load();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                  className="text-xs bg-secondary border border-border rounded-lg px-2 py-1"
                  disabled={u.id === "user-admin"}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                {u.id !== "user-admin" && (
                  <button type="button" onClick={async () => { await deleteUserAccount(u.id); load(); }} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Add user</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className={INPUT_CLS} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={INPUT_CLS} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={INPUT_CLS}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="button" onClick={handleCreate} disabled={creating || !username || !password} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2">
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Create user
        </button>
      </div>
    </div>
  );
}

export function BackupPanel() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const load = async () => {
    try {
      const list = await listBackups();
      setBackups(list);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) load();
    else setLoading(false);
  }, [admin]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const createdBy = user?.full_name || user?.username || user?.email || "Unknown";
      await createBackup(createdBy);
      await load();
      toast.success("Backup created.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (id) => {
    if (!confirm("Restore this backup? Current settings will be overwritten.")) return;
    setRestoring(id);
    try {
      await restoreBackup(id);
      toast.success("Configuration restored.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRestoring(null);
    }
  };

  const handleDownload = async (id) => {
    try {
      const data = await downloadBackup(id);
      const blob = new Blob([JSON.stringify(data.snapshot || data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waveguard-backup-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!admin) {
    return <p className="text-sm text-muted-foreground">Only administrators can create or restore backups.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Export platform configuration with timestamp and creator. Includes settings (not plaintext passwords).</p>
      <button type="button" onClick={handleCreate} disabled={creating} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
        {creating ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
        Create backup now
      </button>
      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground text-sm"><Loader2 size={14} className="animate-spin" /></div>
      ) : backups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No backups yet.</p>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-3 rounded-xl bg-secondary border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">{b.label}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.createdAt).toLocaleString()} · {b.createdBy} · {(b.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleDownload(b.id)} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Download">
                  <Download size={14} />
                </button>
                <button type="button" onClick={() => handleRestore(b.id)} disabled={restoring === b.id} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Restore">
                  {restoring === b.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
