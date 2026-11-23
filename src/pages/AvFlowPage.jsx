import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Workflow, RefreshCw, Loader2, Settings2, AlertTriangle, XCircle, Info, CheckCircle2, MonitorPlay, Tv,
  AudioLines, Clock, ShieldCheck, ShieldAlert, Power, ArrowRight, Search, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import { isTechnician } from "@/lib/permissions";
import { scanAvFlow, routeNvx, getAvFlowSettings, saveAvFlowSettings } from "@/api/avFlowApi";
import { listCiscoSwitches, ciscoPortAction } from "@/api/ciscoApi";
import { STREAM_TYPES } from "@/lib/av/avFlowModel";

const INPUT = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50";
const LABEL = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide";

const SEV = {
  critical: { icon: XCircle, cls: "border-red-500/30 bg-red-500/10", text: "text-red-400", label: "Fix now" },
  warning: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/10", text: "text-amber-400", label: "Check" },
  info: { icon: Info, cls: "border-sky-500/30 bg-sky-500/5", text: "text-sky-400", label: "Note" },
};

const KIND = {
  "nvx-tx": { label: "NVX encoder", icon: MonitorPlay, color: STREAM_TYPES.nvx.color },
  "nvx-rx": { label: "NVX decoder", icon: Tv, color: STREAM_TYPES.nvx.color },
  dante: { label: "Dante", icon: AudioLines, color: STREAM_TYPES.dante.color },
};

function Tile({ icon: Icon, label, value, tone = "text-foreground", sub }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground"><Icon size={12} /> {label}</div>
      <div className={`text-xl font-bold mt-1 ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function speed(mbps) {
  if (!mbps) return "—";
  return mbps >= 1000 ? `${mbps / 1000}G` : `${mbps}M`;
}

/** Sources on the left, receivers on the right, one coloured line per subscription. */
function FlowDiagram({ streams, onSelect, selected }) {
  const rows = streams.filter((s) => s.type !== "ptp");
  const sources = [];
  const sinks = [];
  const links = [];
  const idx = (arr, item) => {
    const key = item.id || item.name;
    let i = arr.findIndex((x) => (x.id || x.name) === key);
    if (i < 0) { arr.push(item); i = arr.length - 1; }
    return i;
  };
  for (const s of rows) {
    const si = idx(sources, s.source ? { ...s.source, type: s.type } : { name: s.name, type: s.type });
    for (const r of s.receivers) links.push({ s: si, r: idx(sinks, r), type: s.type, stream: s.id, ok: r.ok !== false && s.status !== "stopped" && s.status !== "offline" });
  }
  const rowH = 26;
  const h = Math.max(sources.length, sinks.length, 1) * rowH + 20;
  const W = 980;
  const y = (i, n) => 10 + (i + 0.5) * ((h - 20) / Math.max(n, 1));
  if (!rows.length) return <div className="text-sm text-muted-foreground p-6 text-center">No streams found yet.</div>;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full max-w-5xl mx-auto" style={{ minHeight: 140 }} role="img" aria-label="AV signal flow">
      {links.map((l, i) => {
        const y1 = y(l.s, sources.length);
        const y2 = y(l.r, sinks.length);
        const color = STREAM_TYPES[l.type]?.color || "#94a3b8";
        const dim = selected && selected !== l.stream;
        return (
          <path key={i} d={`M 330 ${y1} C 490 ${y1}, 490 ${y2}, 650 ${y2}`} fill="none" stroke={l.ok ? color : "#ef4444"}
            strokeWidth={selected === l.stream ? 3 : 1.6} strokeDasharray={l.ok ? undefined : "5 4"} opacity={dim ? 0.15 : 0.9}
            className="cursor-pointer" onClick={() => onSelect(l.stream)} />
        );
      })}
      {sources.map((s, i) => (
        <g key={`s${i}`} transform={`translate(0 ${y(i, sources.length)})`}>
          <circle cx={330} cy={0} r={4} fill={STREAM_TYPES[s.type]?.color || "#94a3b8"} />
          <text x={320} y={4} textAnchor="end" className="fill-foreground" fontSize="11">{s.name}</text>
        </g>
      ))}
      {sinks.map((s, i) => (
        <g key={`r${i}`} transform={`translate(0 ${y(i, sinks.length)})`}>
          <circle cx={650} cy={0} r={4} fill={s.ok === false ? "#ef4444" : "#94a3b8"} />
          <text x={660} y={4} className="fill-foreground" fontSize="11">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}

function SettingsDialog({ open, onClose }) {
  const [form, setForm] = useState({ nvxUsername: "admin", nvxPassword: "", extraNvxIps: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    getAvFlowSettings()
      .then(({ settings }) => setForm({ ...settings, extraNvxIps: (settings.extraNvxIps || []).join(", ") }))
      .catch(() => {});
  }, [open]);
  const save = async () => {
    setSaving(true);
    try {
      await saveAvFlowSettings(form);
      toast.success("AV Flow settings saved");
      onClose(true);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>AV Flow settings</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">WaveGuard reads each NVX endpoint&apos;s REST API with the same login as its web page. Dante devices are found automatically (mDNS) and switches come from Core Network → Cisco Switches.</p>
          <div><label className={LABEL}>NVX username</label><input className={INPUT} value={form.nvxUsername || ""} onChange={(e) => setForm({ ...form, nvxUsername: e.target.value })} /></div>
          <div><label className={LABEL}>NVX password</label><input type="password" className={INPUT} value={form.nvxPassword || ""} placeholder="Unchanged" onChange={(e) => setForm({ ...form, nvxPassword: e.target.value })} /></div>
          <div>
            <label className={LABEL}>Extra NVX IP addresses (optional)</label>
            <textarea className={`${INPUT} h-20 font-mono text-xs`} value={form.extraNvxIps || ""} placeholder="192.168.40.21, 192.168.40.22" onChange={(e) => setForm({ ...form, extraNvxIps: e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">NVX devices in Equipment (model containing &quot;NVX&quot;) are included automatically.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onClose(false)} className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground">Cancel</button>
            <button type="button" disabled={saving} onClick={save} className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AvFlowPage() {
  const { user } = useAuth();
  const tech = isTechnician(user);
  const [flow, setFlow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [switches, setSwitches] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFlow(await scanAvFlow({ seconds: 4 }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    listCiscoSwitches().then((r) => setSwitches(r?.switches || [])).catch(() => {});
  }, [load]);

  const streams = useMemo(() => (flow?.streams || []).filter((s) => filter === "all" || s.type === filter), [flow, filter]);
  const encoders = useMemo(() => (flow?.devices || []).filter((d) => d.kind === "nvx-tx"), [flow]);
  const devices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (flow?.devices || []).filter((d) => !q || `${d.name} ${d.ip} ${d.model} ${d.port?.port || ""} ${d.location || ""}`.toLowerCase().includes(q));
  }, [flow, query]);
  const sourceOf = (rx) => (flow?.streams || []).find((s) => s.type === "nvx" && s.receivers.some((r) => r.id === rx.id));

  const doRoute = async (rx, txIp) => {
    if (!txIp) return;
    setBusy(rx.id);
    try {
      await routeNvx({ rxIp: rx.ip, txIp });
      toast.success(`${rx.name} → ${encoders.find((e) => e.ip === txIp)?.name || txIp}`);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const doPowerCycle = async (d) => {
    const sw = switches.find((s) => s.host === d.port?.switchHost);
    if (!sw) return toast.error("That switch isn't saved under Cisco Switches");
    if (!window.confirm(`Power-cycle ${d.name}? PoE on ${d.port.switchName} ${d.port.port} will be off for about 5 seconds.`)) return;
    setBusy(d.id);
    const r = await ciscoPortAction(sw, { action: "poeCycle", port: d.port.port });
    setBusy(null);
    if (r?.success) toast.success(`${d.name} power-cycled. It takes about a minute to boot.`);
    else toast.error(r?.error || "Power-cycle failed");
  };

  const s = flow?.summary;
  const findings = flow?.findings || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-5 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Workflow size={22} className="text-primary" /> AV Flow
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Crestron NVX video and Dante audio as the network actually carries them: who sends, who receives, which switch port, and what&apos;s wrong.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tech && (
            <button type="button" onClick={() => setSettingsOpen(true)} className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground flex items-center gap-2">
              <Settings2 size={13} /> Settings
            </button>
          )}
          <button type="button" onClick={load} disabled={loading} className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold flex items-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {loading ? "Scanning…" : "Scan now"}
          </button>
        </div>
      </div>

      {flow?.demo && <div className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">Demo data — switch to Live mode in Settings to scan the vessel.</div>}
      {error && <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
      {!flow && loading && <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Reading NVX endpoints, listening for Dante clock and checking switches…</div>}

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <Tile icon={MonitorPlay} label="Encoders" value={s.nvxTx} />
          <Tile icon={Tv} label="Decoders" value={s.nvxRx} tone={s.offline ? "text-amber-400" : "text-foreground"} sub={s.offline ? `${s.offline} not responding` : null} />
          <Tile icon={AudioLines} label="Dante devices" value={s.dante} />
          <Tile icon={Workflow} label="Live streams" value={s.streams} />
          <Tile icon={s.igmp === "off" ? ShieldAlert : ShieldCheck} label="IGMP snooping" value={s.igmp === "on" ? "On" : s.igmp === "off" ? "Off" : "Unknown"} tone={s.igmp === "on" ? "text-emerald-400" : s.igmp === "off" ? "text-red-400" : "text-muted-foreground"} />
          <Tile icon={Clock} label="Dante clock leader" value={s.clockLeader ? s.clockLeader.name : "—"} tone="text-foreground !text-sm truncate" sub={s.clockLeader ? `${s.clockLeader.ip} · PTPv${s.clockLeader.version}` : "No PTP heard"} />
        </div>
      )}

      {flow && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {findings.some((f) => f.severity !== "info") ? <AlertTriangle size={14} className="text-amber-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
            {findings.some((f) => f.severity !== "info") ? `Needs attention (${s.critical + s.warnings})` : "No problems found"}
          </h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {findings.map((f, i) => {
              const st = SEV[f.severity] || SEV.info;
              const Icon = st.icon;
              return (
                <div key={i} className={`rounded-xl border p-3 ${st.cls}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={15} className={`${st.text} mt-0.5 flex-shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{f.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{f.detail}</div>
                      {f.fix && <div className="text-xs mt-1.5"><span className={`font-semibold ${st.text}`}>Fix: </span><span className="text-foreground/90">{f.fix}</span></div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {flow && (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground mr-2">Signal flow</h2>
            {["all", "nvx", "dante", "aes67", "ptp", "other"].map((t) => (
              <button key={t} type="button" onClick={() => setFilter(t)} className={`px-2.5 py-1 rounded-full text-xs border ${filter === t ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {t === "all" ? "All" : STREAM_TYPES[t].label} ({t === "all" ? flow.streams.length : flow.streams.filter((x) => x.type === t).length})
              </button>
            ))}
            {selected && <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground underline ml-auto">Clear selection</button>}
          </div>
          <FlowDiagram streams={streams} selected={selected} onSelect={(id) => setSelected(selected === id ? null : id)} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Stream</th><th className="py-2 pr-3">Multicast</th><th className="py-2 pr-3">From</th><th className="py-2 pr-3">To</th><th className="py-2 pr-3">Switch ports joined</th><th className="py-2">Status</th>
              </tr></thead>
              <tbody>
                {streams.map((st) => (
                  <tr key={st.id} onClick={() => setSelected(selected === st.id ? null : st.id)} className={`border-b border-border/60 cursor-pointer ${selected === st.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                    <td className="py-2 pr-3"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: STREAM_TYPES[st.type]?.color }} />{st.name}<div className="text-[11px] text-muted-foreground ml-4">{STREAM_TYPES[st.type]?.label}{st.detail ? ` · ${st.detail}` : ""}</div></td>
                    <td className="py-2 pr-3 font-mono text-xs">{st.address || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{st.source?.name || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{st.receivers.length ? st.receivers.map((r) => <span key={r.id || r.name} className={`inline-block mr-1 mb-1 px-1.5 py-0.5 rounded border ${r.ok === false ? "border-red-500/40 text-red-400" : "border-border"}`}>{r.name}</span>) : <span className="text-muted-foreground">nobody</span>}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{st.joinedPorts?.length ? st.joinedPorts.map((j) => j.port).join(", ") : "—"}</td>
                    <td className={`py-2 text-xs font-semibold ${st.status === "active" ? "text-emerald-400" : st.status === "idle" || st.status === "advertised" ? "text-sky-400" : "text-red-400"}`}>{st.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {flow && (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Devices</h2>
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary min-w-[220px]">
              <Search size={12} className="text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, IP, port…" className="bg-transparent text-xs flex-1 focus:outline-none" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Device</th><th className="py-2 pr-3">IP</th><th className="py-2 pr-3">Switch / port</th><th className="py-2 pr-3">Link</th><th className="py-2 pr-3">Watching / signal</th><th className="py-2 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {devices.map((d) => {
                  const k = KIND[d.kind];
                  const Icon = k.icon;
                  const src = d.kind === "nvx-rx" ? sourceOf(d) : null;
                  return (
                    <tr key={d.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2"><Icon size={14} style={{ color: k.color }} /><span className={`font-medium ${d.online ? "text-foreground" : "text-red-400"}`}>{d.name}</span></div>
                        <div className="text-[11px] text-muted-foreground ml-6">{k.label} · {d.model}{d.firmware ? ` · fw ${d.firmware}` : ""}{d.location ? ` · ${d.location}` : ""}</div>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{d.ip}</td>
                      <td className="py-2 pr-3 text-xs">{d.port ? <>{d.port.switchName}<div className="text-muted-foreground font-mono">{d.port.port} · VLAN {d.port.vlan ?? "—"}</div></> : <span className="text-muted-foreground">not found on a switch</span>}</td>
                      <td className="py-2 pr-3 text-xs font-mono">
                        <span className={d.port?.speedMbps && d.port.speedMbps < 1000 ? "text-red-400 font-semibold" : ""}>{speed(d.port?.speedMbps)}</span>
                        {d.port?.poeWatts > 0 && <span className="ml-2 text-amber-300 inline-flex items-center gap-0.5"><Zap size={10} />{d.port.poeWatts}W</span>}
                        {d.port?.errors && (d.port.errors.fcs || d.port.errors.in) > 0 && <div className="text-amber-400">{((d.port.errors.fcs || 0) + (d.port.errors.in || 0)).toLocaleString()} errors</div>}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {!d.online ? <span className="text-red-400">{d.error || "offline"}</span>
                          : d.authFailed ? <span className="text-amber-400">Login refused — set the NVX password in Settings</span>
                          : d.kind === "nvx-rx" ? (
                            tech ? (
                              <select disabled={busy === d.id} value={src?.source?.ip || ""} onChange={(e) => doRoute(d, e.target.value)} className="bg-secondary border border-border rounded-md px-2 py-1 text-xs max-w-[220px]" aria-label={`Source for ${d.name}`}>
                                <option value="">{src ? src.source.name : d.multicast || "— choose source —"}</option>
                                {encoders.filter((e) => e.online).map((e) => <option key={e.ip} value={e.ip}>{e.name}</option>)}
                              </select>
                            ) : <span>{src?.source?.name || d.multicast || "—"}</span>
                          )
                          : d.kind === "nvx-tx" ? <span className={d.inputSync === false ? "text-amber-400" : ""}>{d.inputSync === false ? "No HDMI input" : d.resolution || d.streamStatus || "—"}{d.multicast ? <span className="text-muted-foreground font-mono"> · {d.multicast}</span> : null}</span>
                          : <span className="text-muted-foreground">{d.txChannels ? `${d.txChannels} channels` : "—"}{d.sampleRate ? ` · ${d.sampleRate / 1000} kHz` : ""}</span>}
                        {d.kind === "nvx-rx" && d.streamStatus && <div className={`mt-1 ${/no stream|stop/i.test(d.streamStatus) ? "text-red-400" : "text-muted-foreground"}`}>{d.streamStatus}</div>}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {busy === d.id && <Loader2 size={13} className="inline animate-spin text-muted-foreground mr-2" />}
                        {tech && d.port && (d.port.poeWatts > 0 || !d.online) && (
                          <button type="button" onClick={() => doPowerCycle(d)} title="Power-cycle via PoE" className="px-2 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Power size={11} /> Reboot</button>
                        )}
                        <a href={`https://${d.ip}`} target="_blank" rel="noreferrer" className="ml-1 px-2 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Web <ArrowRight size={11} /></a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SettingsDialog open={settingsOpen} onClose={(saved) => { setSettingsOpen(false); if (saved) load(); }} />
    </div>
  );
}
