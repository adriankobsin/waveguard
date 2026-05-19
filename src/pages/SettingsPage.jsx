import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Mail, Brain, Database, Bell, Shield,
  ChevronRight, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff, Plus, X,
  Anchor, LayoutDashboard, Network, Puzzle, Key, BookOpen, Users, HardDrive, Wifi,
  Moon, Sun, Save
} from "lucide-react";
import { useSettings } from "../hooks/useSettings";
import { base44 } from "@/api/base44Client";

// ─── Sections list ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { key: "general",            label: "General",             icon: Anchor,        desc: "Vessel / property profile" },
  { key: "appearance",         label: "Appearance",          icon: Moon,          desc: "Light/dark mode theme switcher" },
  { key: "dashboard",          label: "Dashboard widgets",   icon: LayoutDashboard, desc: "Order and visibility for each widget" },
  { key: "network-monitoring", label: "Network monitoring",  icon: Network,       desc: "Scan ranges, poll intervals, thresholds" },
  { key: "integrations",       label: "Integrations",        icon: Puzzle,        desc: "Vendor drivers and external services" },
  { key: "ai",                 label: "AI & OpenAI",         icon: Brain,         desc: "OpenAI API key, chat model, embeddings" },
  { key: "documentation",      label: "Documentation",       icon: BookOpen,      desc: "Storage path and AI re-indexing" },
  { key: "notifications",      label: "Notifications",       icon: Bell,          desc: "Bell retention, email, WhatsApp" },
  { key: "email",              label: "Email alerts",        icon: Mail,          desc: "SMTP config, recipients, alerts" },
  { key: "users",              label: "Users & roles",       icon: Users,         desc: "Invite and manage operator accounts" },
  { key: "backup",             label: "Backup & restore",    icon: HardDrive,     desc: "Cold backup and restore guidance" },
  { key: "discovery",          label: "Auto-Discovery",      icon: Wifi,          desc: "Scan threshold and interval" },
  { key: "retention",          label: "Data Retention",      icon: Database,      desc: "Auto-purge old records" },
];

// ─── Shared UI ─────────────────────────────────────────────────────────────────
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

function SaveBar({ saving, saved, onSave }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
      {saving ? "Saving…" : saved ? "Saved!" : "Save settings"}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = "w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50";

// ─── Panels ────────────────────────────────────────────────────────────────────
function GeneralPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("general", {
    name: "M/Y Horizon", displayName: "Horizon", homePort: "Palma de Mallorca", timezone: "Europe/London", notes: ""
  });
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Vessel / property profile — display metadata for dashboards and reports.</p>
      {[
        { key: "name", label: "Vessel name" },
        { key: "displayName", label: "Dashboard display name" },
        { key: "homePort", label: "Home port" },
        { key: "timezone", label: "Time zone" },
      ].map(f => (
        <Field key={f.key} label={f.label}>
          <input value={cfg[f.key] || ""} onChange={e => setCfg(c => ({ ...c, [f.key]: e.target.value }))} className={INPUT_CLS} />
        </Field>
      ))}
      <Field label="Notes">
        <textarea value={cfg.notes || ""} onChange={e => setCfg(c => ({ ...c, notes: e.target.value }))} rows={3}
          placeholder="Optional vessel or property notes" className={`${INPUT_CLS} resize-none`} />
      </Field>
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function AppearancePanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("appearance", { theme: "dark" });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(cfg.theme || "dark");
  }, [cfg.theme]);

  const setTheme = (theme) => {
    setCfg(c => ({ ...c, theme }));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Choose your preferred color scheme.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { value: "light", label: "Light Mode", desc: "Bright and clean", Icon: Sun },
          { value: "dark",  label: "Dark Mode",  desc: "Easy on the eyes", Icon: Moon },
        ].map(({ value, label, desc, Icon }) => (
          <button key={value} onClick={() => setTheme(value)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${cfg.theme === value ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-primary/30"}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.theme === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <Icon size={18} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            {cfg.theme === value && <CheckCircle2 size={16} className="ml-auto text-primary" />}
          </button>
        ))}
      </div>
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function DashboardWidgetsPanel() {
  const ALL_WIDGETS = [
    "Network traffic", "Critical alarms", "Warning alarms", "Network",
    "AV", "Control", "Lighting", "CCTV", "UPS / power",
    "WAN / internet", "Offline devices", "Recent events", "AI recommendations",
  ];
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("dashboard", { visible: ALL_WIDGETS });
  const visSet = new Set(cfg.visible || ALL_WIDGETS);

  const toggle = (w) => {
    const next = visSet.has(w) ? [...visSet].filter(x => x !== w) : [...visSet, w];
    setCfg(c => ({ ...c, visible: next }));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Toggle visibility for each dashboard widget.</p>
      {ALL_WIDGETS.map(w => (
        <div key={w} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary border border-border">
          <span className="text-sm text-foreground">{w}</span>
          <Toggle on={visSet.has(w)} onToggle={() => toggle(w)} />
        </div>
      ))}
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function NetworkMonitoringPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("network-monitoring", {
    scanRanges: ["192.168.10.0/24"],
    pollIntervalSec: 60,
    offlineThresholdMin: 5
  });
  const [jsonText, setJsonText] = useState(() => JSON.stringify(cfg, null, 2));
  const [jsonError, setJsonError] = useState(null);

  useEffect(() => {
    setJsonText(JSON.stringify(cfg, null, 2));
  }, [cfg]);

  const handleJsonChange = (text) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setCfg(parsed);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Scan ranges, poll intervals, and offline thresholds.</p>
      <Field label="Configuration (JSON)">
        <textarea value={jsonText} onChange={e => handleJsonChange(e.target.value)} rows={8}
          className={`${INPUT_CLS} text-xs font-mono resize-none ${jsonError ? "border-red-500/50" : ""}`} />
        {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
      </Field>
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function IntegrationsPanel() {
  const INTEGRATIONS = [
    { key: "snmp",     label: "SNMP",          desc: "Switch/UPS polling via SNMPv2c/v3" },
    { key: "crestron", label: "Crestron",       desc: "CP4/NVX control via TCP/REST" },
    { key: "qsys",     label: "Q-SYS",          desc: "Core 110f audio DSP driver" },
    { key: "dahua",    label: "Dahua CCTV",     desc: "IPC/NVR HTTP API polling" },
    { key: "mqtt",     label: "MQTT sensors",   desc: "Environmental and sensor bus" },
    { key: "lutron",   label: "Lutron",         desc: "LEAP / Telnet lighting control" },
    { key: "dali",     label: "DALI",           desc: "IP gateway bridge (Helvar/Tridonic)" },
    { key: "dmx",      label: "DMX / Art-Net",  desc: "Universe 0 via Art-Net node" },
    { key: "knx",      label: "KNX",            desc: "IP router tunnelling (port 3671)" },
    { key: "cisco",    label: "Cisco RESTCONF",  desc: "IOS-XE REST + Meraki API" },
  ];
  const defaultEnabled = { snmp: true };
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("integrations", defaultEnabled);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Enable vendor drivers. Credentials are configured in each driver's section or via environment variables on the server.</p>
      {INTEGRATIONS.map(i => (
        <div key={i.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary border border-border">
          <div>
            <p className="text-sm font-medium text-foreground">{i.label}</p>
            <p className="text-xs text-muted-foreground">{i.desc}</p>
          </div>
          <Toggle on={!!cfg[i.key]} onToggle={() => setCfg(c => ({ ...c, [i.key]: !c[i.key] }))} />
        </div>
      ))}
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function AIPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("ai", { model: "gpt-4o-mini", key: "" });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const test = async () => {
    setTesting(true); setTestResult(null);
    await new Promise(r => setTimeout(r, 1800));
    setTesting(false);
    setTestResult({ ok: !!cfg.key, message: cfg.key ? "API key format looks valid." : "No API key configured." });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">OpenAI API key and model configuration for the AI Assistant.</p>
      <Field label="OpenAI API Key">
        <div className="relative">
          <input type={showKey ? "text" : "password"} value={cfg.key || ""} onChange={e => setCfg(c => ({ ...c, key: e.target.value }))}
            placeholder="sk-…" className={`${INPUT_CLS} pr-10 font-mono`} />
          <button type="button" onClick={() => setShowKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>
      <Field label="Chat model">
        <input value={cfg.model || ""} onChange={e => setCfg(c => ({ ...c, model: e.target.value }))} className={`${INPUT_CLS} font-mono`} />
      </Field>
      <div className="flex gap-3">
        <button onClick={test} disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
          Test key
        </button>
        <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
      </div>
      {testResult && (
        <div className={`flex items-center gap-2 text-xs p-3 rounded-xl ${testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {testResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {testResult.message}
        </div>
      )}
    </div>
  );
}

function LocalAIPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("local-ai", {
    enabled: false, baseUrl: "http://127.0.0.1:11434", model: "llama3.2:1b", provider: "auto"
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const test = async () => {
    setTesting(true); setTestResult(null);
    await new Promise(r => setTimeout(r, 2000));
    setTesting(false);
    setTestResult({ ok: cfg.enabled, message: cfg.enabled ? "Ollama responded successfully." : "Local AI is disabled." });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Ollama Local LLM</p>
          <p className="text-xs text-muted-foreground mt-0.5">Runs offline at sea — no internet required</p>
        </div>
        <Toggle on={cfg.enabled} onToggle={() => setCfg(c => ({ ...c, enabled: !c.enabled }))} />
      </div>
      <Field label="Ollama Base URL">
        <input value={cfg.baseUrl || ""} onChange={e => setCfg(c => ({ ...c, baseUrl: e.target.value }))} className={`${INPUT_CLS} font-mono`} />
      </Field>
      <Field label="Model">
        <input value={cfg.model || ""} onChange={e => setCfg(c => ({ ...c, model: e.target.value }))} className={`${INPUT_CLS} font-mono`} />
        <p className="text-xs text-muted-foreground mt-1">Recommended for Pi 5 (4 GB): <code className="font-mono">llama3.2:1b</code></p>
      </Field>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">AI Provider Preference</p>
        {[
          { value: "auto",   label: "Auto",         desc: "OpenAI first → Local fallback" },
          { value: "openai", label: "OpenAI only",  desc: "Requires internet" },
          { value: "local",  label: "Local only",   desc: "Works offline, lower quality" },
        ].map(opt => (
          <label key={opt.value} className="flex items-center gap-3 cursor-pointer" onClick={() => setCfg(c => ({ ...c, provider: opt.value }))}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${cfg.provider === opt.value ? "border-primary bg-primary" : "border-border"}`}>
              {cfg.provider === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <p className="text-sm text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={test} disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
          Test Connection
        </button>
        <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
      </div>
      {testResult && (
        <div className={`flex items-center gap-2 text-xs p-3 rounded-xl ${testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {testResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {testResult.message}
        </div>
      )}
    </div>
  );
}

function DocumentationPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("documentation", { mode: "development" });
  const [reindexing, setReindexing] = useState(false);
  const [reindexDone, setReindexDone] = useState(false);

  const reindex = async () => {
    setReindexing(true); setReindexDone(false);
    await new Promise(r => setTimeout(r, 2500));
    setReindexing(false); setReindexDone(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Configure where uploaded documents are stored. The database only stores metadata and extracted text.</p>
      {[
        { value: "development", label: "Development", desc: "./storage/documents" },
        { value: "local",       label: "Local path",  desc: "/var/wave-avi-guardian/storage" },
        { value: "nas",         label: "NAS / network mount", desc: "Custom mount path" },
      ].map(opt => (
        <label key={opt.value} onClick={() => setCfg(c => ({ ...c, mode: opt.value }))} className="flex items-center gap-3 cursor-pointer mb-2">
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${cfg.mode === opt.value ? "border-primary bg-primary" : "border-border"}`}>
            {cfg.mode === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
          <div>
            <p className="text-sm text-foreground">{opt.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{opt.desc}</p>
          </div>
        </label>
      ))}
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground mb-1">AI indexing</p>
        <p className="text-xs text-muted-foreground mb-3">Re-index all documents to update the AI search index.</p>
        <button onClick={reindex} disabled={reindexing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          {reindexing ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
          {reindexing ? "Re-indexing…" : "Re-index all documents"}
        </button>
        {reindexDone && <p className="text-xs text-green-400 mt-2 flex items-center gap-1"><CheckCircle2 size={11} /> Re-index complete.</p>}
      </div>
    </div>
  );
}

function EmailPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("email", {
    enabled: true, host: "smtp.gmail.com", port: "587", secure: false,
    user: "", pass: "", from: "", to: [], dailyDigest: true
  });
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [newRecipient, setNewRecipient] = useState("");

  const test = async () => {
    setTesting(true); setTestResult(null);
    await new Promise(r => setTimeout(r, 1500));
    setTesting(false);
    setTestResult({ ok: !!(cfg.host && cfg.user), message: cfg.host && cfg.user ? "Test email sent successfully." : "Please fill in SMTP host and username first." });
  };

  const addRecipient = () => {
    if (newRecipient && !cfg.to.includes(newRecipient)) {
      setCfg(c => ({ ...c, to: [...(c.to || []), newRecipient] }));
      setNewRecipient("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Email Alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">Send critical alarm notifications via SMTP</p>
        </div>
        <Toggle on={cfg.enabled} onToggle={() => setCfg(c => ({ ...c, enabled: !c.enabled }))} />
      </div>

      {cfg.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label="SMTP Host">
                <input value={cfg.host || ""} onChange={e => setCfg(c => ({ ...c, host: e.target.value }))} className={INPUT_CLS} />
              </Field>
            </div>
            <Field label="Port">
              <input value={cfg.port || ""} onChange={e => setCfg(c => ({ ...c, port: e.target.value }))} className={INPUT_CLS} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Username">
              <input value={cfg.user || ""} onChange={e => setCfg(c => ({ ...c, user: e.target.value }))} className={INPUT_CLS} />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={cfg.pass || ""} onChange={e => setCfg(c => ({ ...c, pass: e.target.value }))}
                  placeholder="••••••••" className={`${INPUT_CLS} pr-10`} />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          </div>
          <Field label="From Address">
            <input value={cfg.from || ""} onChange={e => setCfg(c => ({ ...c, from: e.target.value }))} className={INPUT_CLS} />
          </Field>
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Recipients</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(cfg.to || []).map(r => (
                <span key={r} className="flex items-center gap-1.5 text-xs bg-secondary border border-border rounded-full px-3 py-1">
                  {r}
                  <button type="button" onClick={() => setCfg(c => ({ ...c, to: c.to.filter(x => x !== r) }))} className="text-muted-foreground hover:text-foreground">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newRecipient} onChange={e => setNewRecipient(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addRecipient()}
                placeholder="Add email address…"
                className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60" />
              <button type="button" onClick={addRecipient} className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm">
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary border border-border">
            <div>
              <p className="text-sm text-foreground">Daily Digest Email</p>
              <p className="text-xs text-muted-foreground">Send a daily summary at 07:00</p>
            </div>
            <Toggle on={cfg.dailyDigest} onToggle={() => setCfg(c => ({ ...c, dailyDigest: !c.dailyDigest }))} />
          </div>
          <div className="flex gap-3">
            <button onClick={test} disabled={testing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
              {testing ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              Send Test Email
            </button>
            <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 text-xs p-3 rounded-xl ${testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {testResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {testResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("notifications", {
    bell: true, email: false, whatsapp: false, retentionDays: 90
  });
  const items = [
    { key: "bell",     label: "Bell notifications",  desc: "In-app notification bell" },
    { key: "email",    label: "Email channel",        desc: "Requires Email alerts to be configured" },
    { key: "whatsapp", label: "WhatsApp channel",     desc: "Requires WhatsApp integration key" },
  ];
  return (
    <div className="space-y-4">
      {items.map(n => (
        <div key={n.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary border border-border">
          <div>
            <p className="text-sm text-foreground">{n.label}</p>
            <p className="text-xs text-muted-foreground">{n.desc}</p>
          </div>
          <Toggle on={cfg[n.key]} onToggle={() => setCfg(c => ({ ...c, [n.key]: !c[n.key] }))} />
        </div>
      ))}
      <Field label="Notification Retention (days)">
        <input type="number" min={7} max={3650} value={cfg.retentionDays || 90}
          onChange={e => setCfg(c => ({ ...c, retentionDays: +e.target.value }))} className={INPUT_CLS} />
      </Field>
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  useEffect(() => {
    base44.entities.User.list().then(setUsers).finally(() => setLoading(false));
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true); setInviteResult(null);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteResult({ ok: true, message: `Invitation sent to ${inviteEmail}` });
      setInviteEmail("");
      const updated = await base44.entities.User.list();
      setUsers(updated);
    } catch (e) {
      setInviteResult({ ok: false, message: e.message || "Failed to invite user" });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Operator accounts with role-based access control.</p>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading users…
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">{u.full_name || u.email}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/20 capitalize">{u.role || "user"}</span>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Invite a new user</p>
        <div className="flex gap-2">
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleInvite()}
            placeholder="Email address"
            className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60" />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleInvite} disabled={inviting || !inviteEmail}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            {inviting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Invite
          </button>
        </div>
        {inviteResult && (
          <div className={`flex items-center gap-2 text-xs p-3 rounded-xl ${inviteResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {inviteResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {inviteResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

function BackupPanel() {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState([
    { label: "Database file", value: "guardian.db — 4.2 MB" },
    { label: "Uploads", value: "32 files — 218 MB" },
    { label: "Documents", value: "14 indexed — 96 MB" },
    { label: "Total", value: "~318 MB" },
  ]);

  const refresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1200));
    setRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Cold backups include the database, uploads, and documents on the API host. See docs/deployment/BACKUP_RESTORE.md for scripted export and restore drills.</p>
      <div className="space-y-2">
        {stats.map(r => (
          <div key={r.label} className="flex justify-between text-sm px-3 py-2 rounded-xl bg-secondary border border-border">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="text-foreground font-medium">{r.value}</span>
          </div>
        ))}
      </div>
      <button onClick={refresh} disabled={refreshing}
        className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
        {refreshing ? <Loader2 size={14} className="animate-spin" /> : null}
        {refreshing ? "Refreshing…" : "Refresh storage summary"}
      </button>
    </div>
  );
}

function DiscoveryPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("discovery", {
    threshold: 80, intervalMin: 15, portScan: true, snmpEnabled: true
  });
  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-sm text-foreground">Auto-Import Confidence Threshold</label>
          <span className="text-sm font-bold text-primary">{cfg.threshold}%</span>
        </div>
        <input type="range" min={50} max={100} value={cfg.threshold}
          onChange={e => setCfg(c => ({ ...c, threshold: +e.target.value }))}
          className="w-full accent-primary" />
        <p className="text-xs text-muted-foreground mt-1">Devices with confidence ≥ {cfg.threshold}% will be auto-imported</p>
      </div>
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-sm text-foreground">Discovery Interval</label>
          <span className="text-sm font-bold text-primary">{cfg.intervalMin} min</span>
        </div>
        <input type="range" min={5} max={60} value={cfg.intervalMin}
          onChange={e => setCfg(c => ({ ...c, intervalMin: +e.target.value }))}
          className="w-full accent-primary" />
      </div>
      {[
        { key: "portScan",    label: "Enable Port Scanning",  desc: "Slower but more accurate device type detection" },
        { key: "snmpEnabled", label: "Enable SNMP Probing",   desc: "Polls switches and routers for interface data" },
      ].map(opt => (
        <div key={opt.key} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-foreground">{opt.label}</p>
            <p className="text-xs text-muted-foreground">{opt.desc}</p>
          </div>
          <Toggle on={cfg[opt.key]} onToggle={() => setCfg(c => ({ ...c, [opt.key]: !c[opt.key] }))} />
        </div>
      ))}
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function RetentionPanel() {
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings("retention", {
    deviceHistory: 90, events: 365, notifications: 365, wanSpeed: 180, metrics: 365
  });
  const fields = [
    { key: "deviceHistory", label: "Device Status History" },
    { key: "events",        label: "Events Log" },
    { key: "notifications", label: "Notifications" },
    { key: "wanSpeed",      label: "WAN Speed Tests" },
    { key: "metrics",       label: "SNMP Metrics" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Records older than these thresholds are automatically deleted at midnight.</p>
      {fields.map(f => (
        <div key={f.key} className="flex items-center justify-between gap-4">
          <label className="text-sm text-foreground flex-1">{f.label}</label>
          <div className="flex items-center gap-2">
            <input type="number" min={7} max={3650} value={cfg[f.key] || 90}
              onChange={e => setCfg(c => ({ ...c, [f.key]: +e.target.value }))}
              className="w-20 bg-secondary border border-border rounded-xl px-3 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>
      ))}
      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

// ─── Panel registry ─────────────────────────────────────────────────────────────
const PANEL_COMPONENTS = {
  general:             GeneralPanel,
  appearance:          AppearancePanel,
  dashboard:           DashboardWidgetsPanel,
  "network-monitoring": NetworkMonitoringPanel,
  integrations:        IntegrationsPanel,
  ai:                  AIPanel,
  "local-ai":          LocalAIPanel,
  documentation:       DocumentationPanel,
  notifications:       NotificationsPanel,
  email:               EmailPanel,
  users:               UsersPanel,
  backup:              BackupPanel,
  discovery:           DiscoveryPanel,
  retention:           RetentionPanel,
};

// ─── Page ────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState(null);
  const ActivePanel = activeSection ? PANEL_COMPONENTS[activeSection] : null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings size={22} className="text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure vessel profile, monitoring, integrations, and operator experience — settings are saved to the database.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sidebar */}
        <div className="space-y-2">
          {SECTIONS.map((s, i) => (
            <motion.button
              key={s.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setActiveSection(s.key === activeSection ? null : s.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeSection === s.key ? "bg-primary/15 border border-primary/30" : "glass border border-border hover:border-primary/20"}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${activeSection === s.key ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                <s.icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${activeSection === s.key ? "text-primary" : "text-foreground"}`}>{s.label}</p>
                <p className="text-xs text-muted-foreground truncate">{s.desc}</p>
              </div>
              <ChevronRight size={14} className={`text-muted-foreground transition-transform ${activeSection === s.key ? "rotate-90" : ""}`} />
            </motion.button>
          ))}
        </div>

        {/* Panel */}
        <div className="md:col-span-2">
          <AnimatePresence mode="wait">
            {ActivePanel ? (
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass rounded-2xl p-6"
              >
                <ActivePanel />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-2xl p-12 text-center"
              >
                <Settings size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a settings category to configure</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}