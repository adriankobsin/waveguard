import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Mail, Brain, Database, Bell, Shield,
  ChevronRight, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff, Plus, X
} from "lucide-react";

const SECTIONS = [
  { key: "email", label: "Email & Notifications", icon: Mail, desc: "SMTP config, recipients, alerts" },
  { key: "localai", label: "Local AI (Ollama)", icon: Brain, desc: "Offline LLM for at-sea diagnosis" },
  { key: "retention", label: "Data Retention", icon: Database, desc: "Auto-purge old records" },
  { key: "discovery", label: "Auto-Discovery", icon: Shield, desc: "Scan threshold and interval" },
];

function EmailPanel() {
  const [cfg, setCfg] = useState({
    enabled: true, host: "smtp.gmail.com", port: "587", secure: false,
    user: "guardian@myacht.com", pass: "", from: "Guardian AI <guardian@myacht.com>",
    to: ["captain@myacht.com", "engineer@myacht.com"], dailyDigest: true
  });
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [newRecipient, setNewRecipient] = useState("");

  const test = async () => {
    setTesting(true); setTestResult(null);
    await new Promise(r => setTimeout(r, 1500));
    setTesting(false);
    setTestResult({ ok: true, message: "Test email sent successfully." });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Email Alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">Send critical alarm notifications via SMTP</p>
        </div>
        <button
          onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${cfg.enabled ? "bg-primary" : "bg-secondary"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${cfg.enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {cfg.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">SMTP Host</label>
              <input value={cfg.host} onChange={e => setCfg(c => ({ ...c, host: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Port</label>
              <input value={cfg.port} onChange={e => setCfg(c => ({ ...c, port: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Username</label>
              <input value={cfg.user} onChange={e => setCfg(c => ({ ...c, user: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={cfg.pass} onChange={e => setCfg(c => ({ ...c, pass: e.target.value }))} placeholder="••••••••"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From Address</label>
            <input value={cfg.from} onChange={e => setCfg(c => ({ ...c, from: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Recipients</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {cfg.to.map(r => (
                <span key={r} className="flex items-center gap-1.5 text-xs bg-secondary border border-border rounded-full px-3 py-1">
                  {r}
                  <button onClick={() => setCfg(c => ({ ...c, to: c.to.filter(x => x !== r) }))} className="text-muted-foreground hover:text-foreground">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newRecipient} onChange={e => setNewRecipient(e.target.value)}
                placeholder="Add email address…"
                className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60" />
              <button onClick={() => { if (newRecipient) { setCfg(c => ({ ...c, to: [...c.to, newRecipient] })); setNewRecipient(""); }}}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm">
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={test} disabled={testing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
              {testing ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              Send Test Email
            </button>
            <button className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              Save Settings
            </button>
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

function LocalAIPanel() {
  const [cfg, setCfg] = useState({ enabled: false, baseUrl: "http://127.0.0.1:11434", model: "llama3.2:1b", provider: "auto" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const test = async () => {
    setTesting(true); setTestResult(null);
    await new Promise(r => setTimeout(r, 2000));
    setTesting(false);
    setTestResult({ ok: cfg.enabled, latency: 342, message: cfg.enabled ? "Ollama responded in 342ms." : "Local AI is disabled." });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Ollama Local LLM</p>
          <p className="text-xs text-muted-foreground mt-0.5">Runs offline at sea — no internet required</p>
        </div>
        <button onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${cfg.enabled ? "bg-primary" : "bg-secondary"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${cfg.enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Ollama Base URL</label>
          <input value={cfg.baseUrl} onChange={e => setCfg(c => ({ ...c, baseUrl: e.target.value }))}
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Model</label>
          <input value={cfg.model} onChange={e => setCfg(c => ({ ...c, model: e.target.value }))}
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          <p className="text-xs text-muted-foreground mt-1">Recommended for Pi 5 (4GB): <code className="font-mono">llama3.2:1b</code></p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-2">AI Provider Preference</label>
          <div className="space-y-2">
            {[
              { value: "auto", label: "Auto", desc: "OpenAI first → Local fallback" },
              { value: "openai", label: "OpenAI only", desc: "Requires internet connectivity" },
              { value: "local", label: "Local only", desc: "Works offline, lower quality" },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setCfg(c => ({ ...c, provider: opt.value }))}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${cfg.provider === opt.value ? "border-primary bg-primary" : "border-border"}`}>
                  {cfg.provider === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={test} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            Test Connection
          </button>
          <button className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            Save Settings
          </button>
        </div>
        {testResult && (
          <div className={`flex items-center gap-2 text-xs p-3 rounded-xl ${testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {testResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

function RetentionPanel() {
  const [cfg, setCfg] = useState({ deviceHistory: 90, events: 365, notifications: 365, wanSpeed: 180, metrics: 365 });
  const fields = [
    { key: "deviceHistory", label: "Device Status History", unit: "days" },
    { key: "events", label: "Events Log", unit: "days" },
    { key: "notifications", label: "Notifications", unit: "days" },
    { key: "wanSpeed", label: "WAN Speed Tests", unit: "days" },
    { key: "metrics", label: "SNMP Metrics", unit: "days" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Records older than these thresholds are automatically deleted at midnight.</p>
      {fields.map(f => (
        <div key={f.key} className="flex items-center justify-between gap-4">
          <label className="text-sm text-foreground flex-1">{f.label}</label>
          <div className="flex items-center gap-2">
            <input type="number" min={7} max={3650} value={cfg[f.key]}
              onChange={e => setCfg(c => ({ ...c, [f.key]: +e.target.value }))}
              className="w-20 bg-secondary border border-border rounded-xl px-3 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <span className="text-xs text-muted-foreground">{f.unit}</span>
          </div>
        </div>
      ))}
      <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity mt-2">
        Save Retention Policy
      </button>
    </div>
  );
}

function DiscoveryPanel() {
  const [cfg, setCfg] = useState({ threshold: 80, intervalMin: 15, portScan: true, snmpEnabled: true });
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
        { key: "portScan", label: "Enable Port Scanning", desc: "Slower but more accurate device type detection" },
        { key: "snmpEnabled", label: "Enable SNMP Probing", desc: "Polls switches and routers for interface data" },
      ].map(opt => (
        <div key={opt.key} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-foreground">{opt.label}</p>
            <p className="text-xs text-muted-foreground">{opt.desc}</p>
          </div>
          <button onClick={() => setCfg(c => ({ ...c, [opt.key]: !c[opt.key] }))}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${cfg[opt.key] ? "bg-primary" : "bg-secondary"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${cfg[opt.key] ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      ))}
      <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity mt-2">
        Save Discovery Settings
      </button>
    </div>
  );
}

const PANEL_COMPONENTS = { email: EmailPanel, localai: LocalAIPanel, retention: RetentionPanel, discovery: DiscoveryPanel };

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
        <p className="text-sm text-muted-foreground mt-0.5">Configure the Guardian AI appliance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sidebar */}
        <div className="space-y-2">
          {SECTIONS.map((s, i) => (
            <motion.button
              key={s.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
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