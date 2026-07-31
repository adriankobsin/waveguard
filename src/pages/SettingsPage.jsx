import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Mail, Brain, Database, Bell,
  ChevronRight, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff, Plus, X, Upload, ImageIcon,
  Anchor, LayoutDashboard, Puzzle, Key, BookOpen, Users, HardDrive, Wifi, MapPin,
  Save, RotateCcw, Activity, FlaskConical, HelpCircle,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useBranding, DEFAULT_BRANDING } from "@/contexts/BrandingContext";
import { usePlatformMode } from "@/contexts/PlatformModeContext";
import { PLATFORM_MODES } from "@/lib/platformMode";
import { useAuth } from "@/lib/AuthContext";
import { filterSettingsSections, canAccessSettingsSection } from "@/lib/permissions";
import {
  DashboardWidgetsPanel,
  IntegrationsPanel,
  DocumentationPanel,
  AIPanel,
  UsersPanel,
  BackupPanel,
} from "@/pages/settings/SettingsPanels";
import DecksRoomsPanel from "@/pages/settings/DecksRoomsPanel";
import DiscoverySettingsPanel from "@/pages/settings/DiscoverySettingsPanel";
import PlatformResetPanel from "@/pages/settings/PlatformResetPanel";
import CredentialsVaultPanel from "@/components/credentials/CredentialsVaultPanel";
import { HelpPanel } from "@/pages/HelpPage";
import { uploadLogoFile } from "@/lib/uploadLogo";
import { toast } from "sonner";

// ─── Sections list (profile → users → connectivity → AI/docs → alerts → data) ───
const SECTIONS = [
  { key: "general",            label: "General",             icon: Anchor,          desc: "Vessel / property profile" },
  { key: "platform-mode",      label: "Platform mode",       icon: Activity,        desc: "Switch between Live and Demo operation" },
  { key: "site-locations",     label: "Decks & rooms",       icon: MapPin,          desc: "Decks and rooms for equipment placement" },
  { key: "users",              label: "Users & roles",       icon: Users,           desc: "Invite and manage operator accounts" },
  { key: "dashboard",          label: "Dashboard widgets",   icon: LayoutDashboard, desc: "Add and arrange dashboard widgets" },
  { key: "discovery",          label: "Network discovery",   icon: Wifi,            desc: "Scan subnets, SNMP, and agent URL" },
  { key: "integrations",       label: "Integrations",        icon: Puzzle,          desc: "Vendor drivers and external services" },
  { key: "credentials",        label: "Login credentials",   icon: Key,             desc: "Import or manage device logins; auto-filled from spreadsheet imports" },
  { key: "ai",                 label: "AI & OpenAI",         icon: Brain,           desc: "OpenAI API key, chat model, embeddings" },
  { key: "documentation",      label: "Documentation",       icon: BookOpen,        desc: "Storage path and AI re-indexing" },
  { key: "help",               label: "Help",                icon: HelpCircle,      desc: "Platform guides, deployment, and integration APIs" },
  { key: "notifications",      label: "Notifications",       icon: Bell,            desc: "Bell retention, email, WhatsApp" },
  { key: "email",              label: "Email alerts",        icon: Mail,            desc: "SMTP config, recipients, alerts" },
  { key: "backup",             label: "Backup & restore",    icon: HardDrive,       desc: "Export and restore platform configuration" },
  { key: "retention",          label: "Data Retention",      icon: Database,        desc: "Auto-purge old records" },
  { key: "platform-reset",     label: "Factory reset",       icon: RotateCcw,       desc: "Clear all data for a new deployment" },
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
  const { applyBranding } = useBranding();
  const { value: cfg, setValue: setCfg, save, saving, saved } = useSettings(
    "general",
    DEFAULT_BRANDING,
    {
      onSaved: (savedCfg) => {
        applyBranding(savedCfg);
      },
    }
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const handleLogoFile = async (file) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const logoUrl = await uploadLogoFile(file);
      const nextCfg = { ...cfgRef.current, logoUrl };
      setCfg(nextCfg);
      applyBranding(nextCfg);
      await save(nextCfg);
      toast.success("Logo saved and applied to the sidebar.");
    } catch (err) {
      console.error("[GeneralPanel] logo upload failed:", err);
      toast.error(err.message || "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Vessel profile and sidebar branding. Logo updates apply to the sidebar immediately.
      </p>

      <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Sidebar branding</p>
        <Field label="App title">
          <input
            value={cfg.appTitle || ""}
            onChange={(e) => setCfg((c) => ({ ...c, appTitle: e.target.value }))}
            placeholder="Wave Guard"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="App subtitle">
          <input
            value={cfg.appSubtitle || ""}
            onChange={(e) => setCfg((c) => ({ ...c, appSubtitle: e.target.value }))}
            placeholder=""
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Custom logo">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {cfg.logoUrl ? (
                <img src={cfg.logoUrl} alt="" className="max-w-full max-h-full object-contain p-1" />
              ) : (
                <ImageIcon size={24} className="text-cyan-400/50" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                className="sr-only"
                disabled={logoUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) handleLogoFile(f);
                }}
              />
              <button
                type="button"
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {logoUploading ? "Processing…" : "Choose logo image"}
              </button>
              {cfg.logoUrl && (
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={async () => {
                    const nextCfg = { ...cfgRef.current, logoUrl: null };
                    setCfg(nextCfg);
                    applyBranding(nextCfg);
                    await save(nextCfg);
                    toast.success("Logo removed.");
                  }}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove logo
                </button>
              )}
              <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP, or SVG. Resized to fit 128×128 before upload.</p>
            </div>
          </div>
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Vessel / property</p>
        {[
          { key: "name", label: "Vessel name (sidebar badge)" },
          { key: "displayName", label: "Dashboard display name" },
          { key: "homePort", label: "Home port" },
          { key: "timezone", label: "Time zone" },
        ].map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              value={cfg[f.key] || ""}
              onChange={(e) => setCfg((c) => ({ ...c, [f.key]: e.target.value }))}
              className={INPUT_CLS}
            />
          </Field>
        ))}
        <Field label="Notes">
          <textarea
            value={cfg.notes || ""}
            onChange={(e) => setCfg((c) => ({ ...c, notes: e.target.value }))}
            rows={3}
            placeholder="Optional vessel or property notes"
            className={`${INPUT_CLS} resize-none`}
          />
        </Field>
      </div>

      <SaveBar saving={saving} saved={saved} onSave={() => save(cfg)} />
    </div>
  );
}

function PlatformModePanel() {
  const { mode, setMode, saving } = usePlatformMode();
  const [pending, setPending] = useState(null);

  const choose = async (next) => {
    if (next === mode) return;
    setPending(next);
    try {
      await setMode(next);
      toast.success(next === PLATFORM_MODES.DEMO
        ? "Demo mode enabled — using sample data"
        : "Live mode enabled — real equipment and polls");
    } catch (err) {
      toast.error(err.message || "Failed to switch mode");
    } finally {
      setPending(null);
    }
  };

  const cards = [
    {
      value: PLATFORM_MODES.LIVE,
      label: "Live system",
      desc: "Real equipment, polls, and saved configuration",
      sub: "Default operating mode for production deployments. Uses your saved Equipment, attempts real SNMP/API polls, and never synthesizes WAN data.",
      Icon: Activity,
      tone: "text-emerald-400",
    },
    {
      value: PLATFORM_MODES.DEMO,
      label: "Demo system",
      desc: "Showcase mode with sample data and simulated telemetry",
      sub: "Read-only overlay for demonstrations and training. Replaces telemetry with sample vessel data and forces mock polls. Your saved Equipment is never modified.",
      Icon: FlaskConical,
      tone: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Toggle between live operation and a safe demo showcase. Switching modes does not modify your saved Equipment or settings.
      </p>

      {mode === PLATFORM_MODES.DEMO && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-sm">
          <AlertTriangle size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
          <span className="text-foreground">
            <span className="font-medium">Demo mode is active.</span>{" "}
            <span className="text-muted-foreground">
              Telemetry, polls, and WAN data are simulated. Switch back to Live for real monitoring.
            </span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(({ value, label, desc, sub, Icon, tone }) => {
          const active = mode === value;
          const isPending = pending === value && saving;
          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              disabled={saving}
              className={`flex flex-col gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-secondary hover:border-primary/30"
              } disabled:opacity-60`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    active ? "bg-primary text-primary-foreground" : `bg-muted ${tone}`
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {isPending ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : active ? (
                  <CheckCircle2 size={16} className="text-primary" />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{sub}</p>
            </button>
          );
        })}
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
  general:       GeneralPanel,
  "platform-mode": PlatformModePanel,
  "site-locations": DecksRoomsPanel,
  discovery:     DiscoverySettingsPanel,
  dashboard:     DashboardWidgetsPanel,
  integrations:  IntegrationsPanel,
  credentials:   CredentialsVaultPanel,
  ai:            AIPanel,
  documentation: DocumentationPanel,
  help:          HelpPanel,
  notifications: NotificationsPanel,
  email:         EmailPanel,
  users:         UsersPanel,
  backup:        BackupPanel,
  retention:     RetentionPanel,
  "platform-reset": PlatformResetPanel,
};

// ─── Page ────────────────────────────────────────────────────────────────────────
const SECTION_KEYS = new Set(SECTIONS.map((s) => s.key));

export default function SettingsPage() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleSections = filterSettingsSections(SECTIONS, user);
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    if (!authChecked || isLoadingAuth) return;
    const requested = searchParams.get("section");
    if (!requested || !SECTION_KEYS.has(requested)) return;
    if (!canAccessSettingsSection(user, requested)) {
      toast.error("You do not have permission to change this setting.");
      return;
    }
    setActiveSection(requested);
  }, [authChecked, isLoadingAuth, searchParams, user]);

  const openSection = (key) => {
    if (!canAccessSettingsSection(user, key)) {
      toast.error("You do not have permission to change this setting.");
      return;
    }
    const next = key === activeSection ? null : key;
    setActiveSection(next);
    if (next) {
      setSearchParams({ section: next }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const ActivePanel = activeSection && canAccessSettingsSection(user, activeSection)
    ? PANEL_COMPONENTS[activeSection]
    : null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings size={22} className="text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure vessel profile, monitoring, integrations, and operator experience — settings are saved to the database.</p>
        {user?.role === "user" && visibleSections.length < SECTIONS.length && (
          <p className="text-xs text-amber-400/90 mt-2">
            Signed in as a standard user — only dashboard layout and help guides are available. Log in as an administrator (e.g. WaveAdmin) for full settings access.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sidebar */}
        <div className="space-y-2 md:max-h-[calc(100vh-10rem)] md:overflow-y-auto md:pr-1 md:sticky md:top-4">
          {isLoadingAuth && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Loading settings…
            </div>
          )}
          {visibleSections.map((s, i) => (
            <motion.button
              key={s.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => openSection(s.key)}
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
