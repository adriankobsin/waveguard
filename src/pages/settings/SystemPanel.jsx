import { useEffect, useRef, useState } from "react";
import { Cpu, HardDrive, Thermometer, MemoryStick, RefreshCw, Download, Upload, Loader2, ArrowUpCircle, CheckCircle2, AlertTriangle, Server } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/permissions";
import {
  systemHealth,
  updateStatus,
  requestUpdate,
  importBackup,
  exportBackupUrl,
  toolInventory,
  formatBytes,
  formatDuration,
} from "@/api/standaloneApi";

function Meter({ label, icon: Icon, value, detail }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const color = pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="px-3 py-3 rounded-xl bg-secondary border border-border">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Icon size={12} /> {label}
        </p>
        <p className="text-sm font-semibold text-foreground tabular-nums">{value != null ? `${value}%` : "—"}</p>
      </div>
      <div className="h-1.5 mt-2 rounded-full bg-background overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {detail && <p className="text-[11px] text-muted-foreground mt-1.5">{detail}</p>}
    </div>
  );
}

export default function SystemPanel() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [health, setHealth] = useState(null);
  const [tools, setTools] = useState([]);
  const [update, setUpdate] = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const loadHealth = () => systemHealth().then(setHealth).catch((e) => toast.error(e.message));

  useEffect(() => {
    loadHealth();
    toolInventory().then((r) => setTools(r.tools || [])).catch(() => {});
    const t = setInterval(loadHealth, 10000);
    return () => clearInterval(t);
  }, []);

  const checkUpdate = async () => {
    setChecking(true);
    try {
      setUpdate(await updateStatus());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  const doUpdate = async () => {
    if (!window.confirm("Download the latest WaveGuard from GitHub and restart? The console will be unavailable for a minute or two.")) return;
    try {
      const r = await requestUpdate();
      toast.success(r.message);
      setUpdate((u) => ({ ...(u || {}), pending: true }));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.confirm(`Restore data from "${file.name}"? This replaces equipment, cables, settings, monitors and alert channels on this server.`)) return;
    setImporting(true);
    try {
      const payload = JSON.parse(await file.text());
      const r = await importBackup(payload);
      toast.success(`Restored: ${r.restored.join(", ")}`);
    } catch (err) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const mem = health?.memory;
  const disk = health?.disks?.[0];
  const hottest = health?.temperatures?.length ? Math.max(...health.temperatures.map((t) => t.celsius)) : null;
  const missing = tools.filter((t) => !t.installed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Server size={16} className="text-primary" /> WaveGuard server
        </h2>
        <button type="button" onClick={loadHealth} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {!health ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Reading server health…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              ["Host", health.hostname],
              ["OS", health.os],
              ["CPU", `${health.cpu.model || "—"} (${health.cpu.cores} cores)`],
              ["Up for", formatDuration(health.uptimeSec)],
              ["Service", health.service],
              ["Version", `${health.waveguard.branch || "—"} @ ${(health.waveguard.commit || "").slice(0, 7) || "—"}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-3 py-2 rounded-lg bg-secondary/60 border border-border">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-foreground text-right truncate" title={v}>{v}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Meter label="CPU" icon={Cpu} value={health.cpu.usagePct} detail={`Load ${health.cpu.load.join(" / ")}`} />
            <Meter label="Memory" icon={MemoryStick} value={mem?.usedPct} detail={mem ? `${formatBytes(mem.totalBytes - mem.freeBytes)} of ${formatBytes(mem.totalBytes)}` : null} />
            <Meter label="Disk" icon={HardDrive} value={disk?.usedPct} detail={disk ? `${formatBytes(disk.freeBytes)} free of ${formatBytes(disk.totalBytes)}` : null} />
            <div className="px-3 py-3 rounded-xl bg-secondary border border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Thermometer size={12} /> Temperature</p>
              <p className="text-sm font-semibold text-foreground mt-1">{hottest != null ? `${hottest} °C` : "No sensor"}</p>
              {health.temperatures.length > 1 && (
                <p className="text-[11px] text-muted-foreground mt-1 truncate">{health.temperatures.map((t) => `${t.sensor} ${t.celsius}°`).join(" · ")}</p>
              )}
            </div>
          </div>

          {health.warnings.length > 0 && (
            <div className="space-y-1.5">
              {health.warnings.map((w) => (
                <p key={w.message} className={`text-xs flex items-center gap-1.5 ${w.severity === "critical" ? "text-red-400" : "text-amber-400"}`}>
                  <AlertTriangle size={12} /> {w.message}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {tools.length > 0 && (
        <div className="border-t border-border pt-5">
          <p className="text-sm font-medium text-foreground">Network tools on this server</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tools.map((t) => (
              <span key={t.cmd} className={`text-[11px] px-2 py-0.5 rounded-full border ${t.installed ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" : "border-border text-muted-foreground"}`}>
                {t.cmd}
              </span>
            ))}
          </div>
          {missing.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Missing tools can be added with: <code className="px-1 rounded bg-secondary">sudo apt install {missing.map((t) => t.pkg).join(" ")}</code>
            </p>
          )}
        </div>
      )}

      {admin && (
        <div className="border-t border-border pt-5 space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2"><ArrowUpCircle size={14} className="text-primary" /> Software update</p>
          <p className="text-xs text-muted-foreground">Checks GitHub for a newer version of WaveGuard. Installing keeps all your data; a backup is taken automatically first.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={checkUpdate} disabled={checking} className="px-3 py-2 rounded-xl text-sm border border-border text-foreground hover:border-primary/40 flex items-center gap-2 disabled:opacity-50">
              {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check for updates
            </button>
            {update?.updateAvailable && !update.pending && (
              <button type="button" onClick={doUpdate} className="px-3 py-2 rounded-xl text-sm bg-primary text-primary-foreground flex items-center gap-2">
                <ArrowUpCircle size={13} /> Install update now
              </button>
            )}
          </div>
          {update && (
            <div className="text-xs space-y-1">
              {update.error && <p className="text-amber-400">Could not reach GitHub: {update.error}</p>}
              {!update.error && !update.updateAvailable && (
                <p className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={12} /> Up to date ({(update.current || "").slice(0, 7)} on {update.branch})</p>
              )}
              {update.updateAvailable && (
                <p className="text-foreground">New version available: {(update.current || "").slice(0, 7)} → {(update.remote || "").slice(0, 7)}</p>
              )}
              {update.pending && <p className="text-primary">Update in progress — refresh this page in a couple of minutes.</p>}
              {update.log && (
                <pre className="mt-2 max-h-48 overflow-auto text-[10px] leading-relaxed p-2 rounded-lg bg-background border border-border text-muted-foreground whitespace-pre-wrap">{update.log}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {admin && (
        <div className="border-t border-border pt-5 space-y-3">
          <p className="text-sm font-medium text-foreground">Full data backup</p>
          <p className="text-xs text-muted-foreground">
            Download everything on this server (equipment, cables, settings, monitors, alert channels, users) as one file — keep a copy off the boat. The file contains device passwords in readable form, so store it somewhere safe.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={exportBackupUrl} className="px-3 py-2 rounded-xl text-sm bg-primary text-primary-foreground flex items-center gap-2">
              <Download size={13} /> Download backup
            </a>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={importing} className="px-3 py-2 rounded-xl text-sm border border-border text-foreground hover:border-primary/40 flex items-center gap-2 disabled:opacity-50">
              {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Restore from file…
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
          </div>
        </div>
      )}
    </div>
  );
}
