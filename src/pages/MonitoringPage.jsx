import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HeartPulse, Plus, RefreshCw, Loader2, Trash2, Pencil, Play, Pause, Download, BellRing, Wrench, Send,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Mail, MessageCircle, Webhook, Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceDot } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin, isTechnician } from "@/lib/permissions";
import {
  listMonitors, createMonitor, updateMonitor, deleteMonitor, checkMonitor, monitorHistory, importMonitorsFromEquipment,
  listAlerts, clearAlerts, getMaintenanceWindow, setMaintenanceWindow,
  listChannels, createChannel, updateChannel, deleteChannel, testChannel, timeAgo,
} from "@/api/standaloneApi";

const INPUT = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50";
const LABEL = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide";

const STATUS_STYLE = {
  up: { dot: "bg-emerald-500", text: "text-emerald-400", label: "Up" },
  down: { dot: "bg-red-500", text: "text-red-400", label: "Down" },
  pending: { dot: "bg-amber-500", text: "text-amber-400", label: "Pending" },
  paused: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Paused" },
};
const SEV_STYLE = { critical: "text-red-400 bg-red-500/10 border-red-500/30", warning: "text-amber-400 bg-amber-500/10 border-amber-500/30", info: "text-sky-400 bg-sky-500/10 border-sky-500/30" };

function StatusDot({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {status === "down" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500/60" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${s.dot}`} />
    </span>
  );
}

function pct(v) {
  return v == null ? "—" : `${v}%`;
}

// ---------------------------------------------------------------------------- monitor form
const EMPTY_MONITOR = { name: "", type: "ping", target: "", port: "", intervalSec: 60, retries: 2, severity: "warning", keyword: "", expectStatus: "200-399", dnsType: "A", dnsExpect: "", certWarnDays: 21, group: "", channelIds: [], enabled: true, ignoreTls: true };

function MonitorDialog({ open, onClose, initial, types, channels, onSaved }) {
  const [form, setForm] = useState(EMPTY_MONITOR);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm({ ...EMPTY_MONITOR, ...(initial || {}), port: initial?.port ?? "" });
  }, [open, initial]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, port: form.port ? Number(form.port) : null, intervalSec: Number(form.intervalSec), retries: Number(form.retries), certWarnDays: Number(form.certWarnDays) };
      if (initial?.id) await updateMonitor(initial.id, payload);
      else await createMonitor(payload);
      toast.success(initial?.id ? "Monitor updated" : "Monitor added — first check in a few seconds");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const t = form.type;
  const targetHint = { ping: "IP or hostname, e.g. 192.168.1.10", tcp: "IP or hostname", http: "Full URL, e.g. http://192.168.1.20/", dns: "Name to resolve, e.g. starlink.com", cert: "Host with HTTPS, e.g. 192.168.1.1" }[t];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit monitor" : "Add monitor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className={LABEL} htmlFor="m-name">Name</label>
              <input id="m-name" className={INPUT} value={form.name} onChange={set("name")} placeholder="Core switch – bridge rack" required />
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="m-type">Check type</label>
              <select id="m-type" className={INPUT} value={form.type} onChange={set("type")}>
                {Object.entries(types || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="m-sev">Alert severity</label>
              <select id="m-sev" className={INPUT} value={form.severity} onChange={set("severity")}>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className={`${t === "tcp" || t === "cert" ? "" : "col-span-2"} space-y-1`}>
              <label className={LABEL} htmlFor="m-target">Target</label>
              <input id="m-target" className={INPUT} value={form.target} onChange={set("target")} placeholder={targetHint} required />
            </div>
            {(t === "tcp" || t === "cert") && (
              <div className="space-y-1">
                <label className={LABEL} htmlFor="m-port">Port</label>
                <input id="m-port" type="number" className={INPUT} value={form.port} onChange={set("port")} placeholder={t === "cert" ? "443" : "e.g. 41794"} required={t === "tcp"} />
              </div>
            )}
            {t === "http" && (
              <>
                <div className="space-y-1">
                  <label className={LABEL} htmlFor="m-status">Expected HTTP status</label>
                  <input id="m-status" className={INPUT} value={form.expectStatus} onChange={set("expectStatus")} placeholder="200-399" />
                </div>
                <div className="space-y-1">
                  <label className={LABEL} htmlFor="m-kw">Page must contain (optional)</label>
                  <input id="m-kw" className={INPUT} value={form.keyword} onChange={set("keyword")} placeholder="e.g. Online" />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={form.ignoreTls} onChange={set("ignoreTls")} /> Accept self-signed certificates (most AV/IT devices)
                </label>
              </>
            )}
            {t === "dns" && (
              <>
                <div className="space-y-1">
                  <label className={LABEL} htmlFor="m-dnst">Record type</label>
                  <select id="m-dnst" className={INPUT} value={form.dnsType} onChange={set("dnsType")}>
                    {["A", "AAAA", "CNAME", "MX", "TXT"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={LABEL} htmlFor="m-dnse">Answer must contain (optional)</label>
                  <input id="m-dnse" className={INPUT} value={form.dnsExpect} onChange={set("dnsExpect")} />
                </div>
              </>
            )}
            {t === "cert" && (
              <div className="col-span-2 space-y-1">
                <label className={LABEL} htmlFor="m-cert">Alert when fewer than this many days remain</label>
                <input id="m-cert" type="number" className={INPUT} value={form.certWarnDays} onChange={set("certWarnDays")} />
              </div>
            )}
            <div className="space-y-1">
              <label className={LABEL} htmlFor="m-int">Check every (seconds)</label>
              <input id="m-int" type="number" min={15} className={INPUT} value={form.intervalSec} onChange={set("intervalSec")} />
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="m-ret">Failures before alert</label>
              <input id="m-ret" type="number" min={0} max={10} className={INPUT} value={Number(form.retries) + 1} onChange={(e) => setForm((f) => ({ ...f, retries: Math.max(0, Number(e.target.value) - 1) }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className={LABEL} htmlFor="m-group">Group (optional)</label>
              <input id="m-group" className={INPUT} value={form.group} onChange={set("group")} placeholder="Network, AV, CCTV, Internet…" />
            </div>
          </div>
          {channels.length > 0 && (
            <div className="space-y-1.5">
              <p className={LABEL}>Send alerts to</p>
              <p className="text-[11px] text-muted-foreground">Leave all unticked to use every channel.</p>
              <div className="flex flex-wrap gap-2">
                {channels.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-border">
                    <input
                      type="checkbox"
                      checked={form.channelIds.includes(c.id)}
                      onChange={(e) => setForm((f) => ({ ...f, channelIds: e.target.checked ? [...f.channelIds, c.id] : f.channelIds.filter((x) => x !== c.id) }))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------- history chart
function MonitorDetail({ monitor }) {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    monitorHistory(monitor.id, hours).then((r) => alive && setData(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [monitor.id, monitor.lastCheck, hours]);

  const points = useMemo(() => {
    const h = data?.history || [];
    // Down-sample to ~240 points for the chart.
    const step = Math.max(1, Math.ceil(h.length / 240));
    const out = [];
    for (let i = 0; i < h.length; i += step) {
      const slice = h.slice(i, i + step);
      const ups = slice.filter((x) => x.up);
      out.push({
        ts: slice[0].ts,
        ms: ups.length ? Math.round(ups.reduce((a, b) => a + (b.ms || 0), 0) / ups.length) : null,
        down: ups.length < slice.length,
      });
    }
    return out;
  }, [data]);

  const u = data?.uptime;
  return (
    <div className="px-4 pb-4 pt-1 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[["24 hours", u?.h24], ["7 days", u?.d7], ["30 days", u?.d30]].map(([label, s]) => (
          <div key={label} className="px-3 py-2 rounded-lg bg-background/60 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">{pct(s?.uptimePct)}</p>
            <p className="text-[10px] text-muted-foreground">{s?.avgMs != null ? `avg ${s.avgMs} ms` : "—"} · {s?.checks || 0} checks</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {[1, 6, 24, 168].map((h) => (
          <button key={h} type="button" onClick={() => setHours(h)} className={`text-[11px] px-2 py-0.5 rounded-md border ${hours === h ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>
            {h < 24 ? `${h}h` : h === 24 ? "24h" : "7d"}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground ml-2">Response time (ms) · red dots = failed checks</span>
      </div>
      <div className="h-40">
        {points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`g-${monitor.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={45} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(t) => new Date(t).toLocaleString()}
                formatter={(v) => [v != null ? `${v} ms` : "down", "Response"]}
              />
              <Area type="monotone" dataKey="ms" stroke="hsl(var(--primary))" fill={`url(#g-${monitor.id})`} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
              {points.filter((p) => p.down).map((p) => (
                <ReferenceDot key={p.ts} x={p.ts} y={0} r={3} fill="#ef4444" stroke="none" />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground pt-6 text-center">No checks recorded yet.</p>
        )}
      </div>
      {monitor.lastMessage && <p className="text-xs text-muted-foreground">Last result: <span className="text-foreground">{monitor.lastMessage}</span></p>}
    </div>
  );
}

// ---------------------------------------------------------------------------- channels
const CHANNEL_ICON = { email: Mail, telegram: MessageCircle, ntfy: Megaphone, webhook: Webhook };
const CHANNEL_FIELDS = {
  email: [
    ["smtpHost", "SMTP server", "smtp.office365.com"],
    ["smtpPort", "Port", "587"],
    ["smtpUser", "Username", "alerts@waveavi.com"],
    ["smtpPassword", "Password", "", "password"],
    ["from", "From address", "WaveGuard <alerts@waveavi.com>"],
    ["to", "Send to (comma separated)", "captain@yacht.com, support@waveavi.com"],
  ],
  telegram: [
    ["botToken", "Bot token (from @BotFather)", "123456:ABC…", "password"],
    ["chatId", "Chat ID", "-1001234567890"],
  ],
  ntfy: [
    ["serverUrl", "Server", "https://ntfy.sh"],
    ["topic", "Topic", "albatross-alerts-7f3k"],
    ["accessToken", "Access token (optional)", "", "password"],
  ],
  webhook: [
    ["url", "Webhook URL", "https://…"],
    ["webhookSecret", "Signing secret (optional)", "", "password"],
  ],
};

function ChannelDialog({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState({ type: "email", name: "", minSeverity: "warning", sendRecovery: true, remindMinutes: 0, format: "generic" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : { type: "email", name: "", minSeverity: "warning", sendRecovery: true, remindMinutes: 0, format: "generic", smtpPort: 587 });
  }, [open, initial]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (initial?.id) await updateChannel(initial.id, form);
      else await createChannel(form);
      toast.success("Alert channel saved — use Test to check it");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit alert channel" : "Add alert channel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={LABEL} htmlFor="c-type">Type</label>
              <select id="c-type" className={INPUT} value={form.type} onChange={set("type")} disabled={!!initial?.id}>
                <option value="email">Email (SMTP)</option>
                <option value="telegram">Telegram</option>
                <option value="ntfy">ntfy push (phone app)</option>
                <option value="webhook">Webhook / Slack / Teams / Discord</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="c-name">Name</label>
              <input id="c-name" className={INPUT} value={form.name} onChange={set("name")} placeholder="Wave support team" required />
            </div>
            {form.type === "webhook" && (
              <div className="col-span-2 space-y-1">
                <label className={LABEL} htmlFor="c-format">Format</label>
                <select id="c-format" className={INPUT} value={form.format} onChange={set("format")}>
                  <option value="generic">Generic JSON</option>
                  <option value="slack">Slack incoming webhook</option>
                  <option value="teams">Microsoft Teams workflow</option>
                  <option value="discord">Discord</option>
                </select>
              </div>
            )}
            {CHANNEL_FIELDS[form.type].map(([k, label, ph, type]) => (
              <div key={k} className={`${k === "smtpPort" ? "" : k === "smtpHost" ? "" : "col-span-2"} space-y-1`}>
                <label className={LABEL} htmlFor={`c-${k}`}>{label}</label>
                <input id={`c-${k}`} type={type || "text"} autoComplete="off" className={INPUT} value={form[k] ?? ""} onChange={set(k)} placeholder={ph} />
              </div>
            ))}
            <div className="space-y-1">
              <label className={LABEL} htmlFor="c-sev">Send alerts of</label>
              <select id="c-sev" className={INPUT} value={form.minSeverity} onChange={set("minSeverity")}>
                <option value="critical">Critical only</option>
                <option value="warning">Warning and critical</option>
                <option value="info">Everything</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="c-remind">Repeat while down (minutes)</label>
              <input id="c-remind" type="number" min={0} className={INPUT} value={form.remindMinutes} onChange={set("remindMinutes")} placeholder="0 = never" />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={form.sendRecovery} onChange={set("sendRecovery")} /> Also notify when things recover
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChannelsTab({ admin }) {
  const [channels, setChannels] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [testing, setTesting] = useState(null);
  const load = () => listChannels().then((r) => setChannels(r.channels || [])).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Where alerts are sent when a monitor goes down, recovers, or a switch configuration changes.</p>
        {admin && (
          <button type="button" onClick={() => setDialog({})} className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground flex items-center gap-2 flex-shrink-0">
            <Plus size={13} /> Add channel
          </button>
        )}
      </div>
      {!channels.length && (
        <div className="glass rounded-xl p-8 text-center">
          <BellRing size={24} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-foreground">No alert channels yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add email, Telegram or a phone push channel so the crew and Wave support hear about problems straight away.</p>
        </div>
      )}
      {channels.map((c) => {
        const Icon = CHANNEL_ICON[c.type] || Webhook;
        return (
          <div key={c.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Icon size={16} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{c.name} {!c.enabled && <span className="text-[10px] text-muted-foreground">(disabled)</span>}</p>
              <p className="text-xs text-muted-foreground truncate">
                {c.type === "email" ? c.to : c.type === "telegram" ? `chat ${c.chatId}` : c.type === "ntfy" ? `${c.serverUrl}/${c.topic}` : `${c.format} · ${c.url}`}
                {" · "}{c.minSeverity === "critical" ? "critical only" : c.minSeverity === "warning" ? "warning + critical" : "all alerts"}
              </p>
            </div>
            {admin && (
              <>
                <button
                  type="button"
                  disabled={testing === c.id}
                  onClick={async () => {
                    setTesting(c.id);
                    try {
                      await testChannel(c.id);
                      toast.success(`Test sent via ${c.name}`);
                    } catch (e) {
                      toast.error(`Test failed: ${e.message}`);
                    } finally {
                      setTesting(null);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                >
                  {testing === c.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Test
                </button>
                <button type="button" aria-label="Edit channel" onClick={() => setDialog(c)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"><Pencil size={14} /></button>
                <button
                  type="button"
                  aria-label="Delete channel"
                  onClick={async () => {
                    if (!window.confirm(`Delete alert channel "${c.name}"?`)) return;
                    await deleteChannel(c.id).catch((e) => toast.error(e.message));
                    load();
                  }}
                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        );
      })}
      <ChannelDialog open={!!dialog} initial={dialog?.id ? dialog : null} onClose={() => setDialog(null)} onSaved={load} />
    </div>
  );
}

// ---------------------------------------------------------------------------- alerts
function AlertsTab({ admin }) {
  const [events, setEvents] = useState(null);
  const load = () => listAlerts(300).then((r) => setEvents(r.events || [])).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  if (!events) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{events.length} event{events.length === 1 ? "" : "s"}</p>
        {admin && events.length > 0 && (
          <button type="button" onClick={async () => { if (window.confirm("Clear the alert history?")) { await clearAlerts(); load(); } }} className="text-xs text-muted-foreground hover:text-red-400">Clear history</button>
        )}
      </div>
      {!events.length && <p className="text-sm text-muted-foreground glass rounded-xl p-6 text-center">No alerts yet. Nothing has gone down since monitoring started.</p>}
      {events.map((e) => (
        <div key={e.id} className="glass rounded-xl px-4 py-2.5 flex items-start gap-3">
          {e.recovery ? <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle size={16} className={`${e.severity === "critical" ? "text-red-400" : "text-amber-400"} mt-0.5 flex-shrink-0`} />}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{e.message}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {new Date(e.ts).toLocaleString()} · {e.source === "config" ? "config change" : e.target}
              {e.maintenance && " · during maintenance (not sent)"}
              {e.deliveries?.length > 0 && ` · sent to ${e.deliveries.filter((d) => d.ok).map((d) => d.name).join(", ") || "none"}`}
              {e.deliveries?.some((d) => !d.ok) && <span className="text-red-400"> · failed: {e.deliveries.filter((d) => !d.ok).map((d) => d.name).join(", ")}</span>}
            </p>
          </div>
          {!e.recovery && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEV_STYLE[e.severity] || SEV_STYLE.info}`}>{e.severity}</span>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------- page
export default function MonitoringPage() {
  const { user } = useAuth();
  const tech = isTechnician(user);
  const admin = isAdmin(user);
  const [tab, setTab] = useState("monitors");
  const [monitors, setMonitors] = useState(null);
  const [types, setTypes] = useState({});
  const [channels, setChannels] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [filter, setFilter] = useState("all");
  const [maintenance, setMaintenance] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    listMonitors()
      .then((r) => {
        setMonitors(r.monitors || []);
        setTypes(r.types || {});
      })
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    load();
    listChannels().then((r) => setChannels(r.channels || [])).catch(() => {});
    getMaintenanceWindow().then((r) => setMaintenance(r.window)).catch(() => {});
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const counts = useMemo(() => {
    const c = { up: 0, down: 0, pending: 0, paused: 0 };
    (monitors || []).forEach((m) => (c[m.status] = (c[m.status] || 0) + 1));
    return c;
  }, [monitors]);

  const groups = useMemo(() => {
    const list = (monitors || []).filter((m) => filter === "all" || m.status === filter);
    const order = { down: 0, pending: 1, up: 2, paused: 3 };
    list.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name));
    const map = new Map();
    for (const m of list) {
      const g = m.group || "Ungrouped";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(m);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "Ungrouped") - (b === "Ungrouped") || a.localeCompare(b));
  }, [monitors, filter]);

  const maintenanceActive = maintenance?.until && new Date(maintenance.until) > new Date();

  const doImport = async () => {
    try {
      const r = await importMonitorsFromEquipment();
      toast.success(r.created.length ? `Added ${r.created.length} ping monitors from the equipment list` : "Every device with an IP is already monitored");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleMaintenance = async () => {
    try {
      if (maintenanceActive) {
        const r = await setMaintenanceWindow(0);
        setMaintenance(r.window);
        toast.success("Maintenance mode ended — alerts are being sent again");
      } else {
        const hours = window.prompt("Silence alert notifications for how many hours? (e.g. while working on the rack)", "2");
        if (!hours) return;
        const r = await setMaintenanceWindow(Math.round(Number(hours) * 60), "Maintenance");
        setMaintenance(r.window);
        toast.success(`Alerts silenced until ${new Date(r.window.until).toLocaleTimeString()}`);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-5 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HeartPulse size={22} className="text-primary" /> Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Round-the-clock checks on every critical device, with alerts by email, Telegram or push.</p>
        </div>
        {tech && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={toggleMaintenance} className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${maintenanceActive ? "border-amber-500/40 text-amber-400 bg-amber-500/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <Wrench size={13} /> {maintenanceActive ? `Maintenance until ${new Date(maintenance.until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Maintenance mode"}
            </button>
            <button type="button" onClick={doImport} className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground flex items-center gap-2">
              <Download size={13} /> Import from equipment
            </button>
            <button type="button" onClick={() => setDialog({})} className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground flex items-center gap-2">
              <Plus size={13} /> Add monitor
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["down", "up", "pending", "paused"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`glass rounded-xl px-4 py-3 text-left border transition-colors ${filter === s ? "border-primary/40" : "border-transparent"}`}
          >
            <p className={`text-2xl font-bold tabular-nums ${STATUS_STYLE[s].text}`}>{counts[s] || 0}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><StatusDot status={s} /> {STATUS_STYLE[s].label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border">
        {[["monitors", "Monitors"], ["alerts", "Alert history"], ["channels", "Alert channels"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "monitors" && (
        <div className="space-y-5">
          {monitors === null && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading monitors…</div>}
          {monitors?.length === 0 && (
            <div className="glass rounded-xl p-10 text-center space-y-3">
              <HeartPulse size={28} className="mx-auto text-muted-foreground" />
              <p className="text-sm text-foreground">Nothing is being monitored yet</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">Start by importing every device from the equipment list (one click), then add extra checks for things like the Crestron processor port, Starlink, or web interfaces.</p>
              {tech && (
                <button type="button" onClick={doImport} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground inline-flex items-center gap-2">
                  <Download size={13} /> Import from equipment
                </button>
              )}
            </div>
          )}
          {groups.map(([group, items]) => (
            <div key={group} className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{group} · {items.length}</p>
              <div className="glass rounded-xl divide-y divide-border overflow-hidden">
                {items.map((m) => {
                  const open = expanded === m.id;
                  return (
                    <div key={m.id}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button type="button" onClick={() => setExpanded(open ? null : m.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left" aria-expanded={open}>
                          {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                          <StatusDot status={m.status} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {types[m.type] || m.type} · {m.target}{m.port ? `:${m.port}` : ""}
                              {m.status === "down" && m.lastChange && <span className="text-red-400"> · down {timeAgo(m.lastChange)}</span>}
                            </p>
                          </div>
                        </button>
                        <div className="hidden sm:block text-right w-20">
                          <p className="text-sm tabular-nums text-foreground">{m.lastMs != null ? `${m.lastMs} ms` : "—"}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1"><Clock size={9} /> {timeAgo(m.lastCheck)}</p>
                        </div>
                        <div className="hidden md:block text-right w-20">
                          <p className={`text-sm tabular-nums ${m.uptime?.h24?.uptimePct != null && m.uptime.h24.uptimePct < 99 ? "text-amber-400" : "text-foreground"}`}>{pct(m.uptime?.h24?.uptimePct)}</p>
                          <p className="text-[10px] text-muted-foreground">24h uptime</p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            title="Check now"
                            aria-label="Check now"
                            disabled={busy === m.id}
                            onClick={async () => {
                              setBusy(m.id);
                              try {
                                await checkMonitor(m.id);
                                load();
                              } catch (e) {
                                toast.error(e.message);
                              } finally {
                                setBusy(null);
                              }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary rounded-lg"
                          >
                            {busy === m.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          </button>
                          {tech && (
                            <>
                              <button type="button" title={m.enabled ? "Pause" : "Resume"} aria-label={m.enabled ? "Pause" : "Resume"} onClick={async () => { await updateMonitor(m.id, { enabled: !m.enabled }).catch((e) => toast.error(e.message)); load(); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg">
                                {m.enabled ? <Pause size={14} /> : <Play size={14} />}
                              </button>
                              <button type="button" title="Edit" aria-label="Edit" onClick={() => setDialog(m)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"><Pencil size={14} /></button>
                              <button type="button" title="Delete" aria-label="Delete" onClick={async () => { if (window.confirm(`Delete monitor "${m.name}" and its history?`)) { await deleteMonitor(m.id).catch((e) => toast.error(e.message)); load(); } }} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </div>
                      {open && <MonitorDetail monitor={m} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "alerts" && <AlertsTab admin={admin} />}
      {tab === "channels" && <ChannelsTab admin={admin} />}

      <MonitorDialog open={!!dialog} initial={dialog?.id ? dialog : null} types={types} channels={channels} onClose={() => setDialog(null)} onSaved={load} />
    </div>
  );
}
