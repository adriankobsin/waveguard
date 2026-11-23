import { useEffect, useMemo, useState } from "react";
import {
  Terminal, Loader2, Play, Activity, Route, Globe, DoorOpen, ScanSearch, Network, Cable, Radio, Power, Gauge, ShieldCheck,
  AudioLines, FileCode2, HeartPulse, RefreshCw, GitCompare, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { isTechnician } from "@/lib/permissions";
import {
  runTool, getTool, toolInventory, createMonitor, listConfigBackups, runConfigBackup, getConfigBackup, diffConfigBackup, formatBytes,
} from "@/api/standaloneApi";

const INPUT = "bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50";
const TH = "text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-3 py-2";
const TD = "px-3 py-2 text-sm text-foreground";

function Table({ cols, rows, empty = "Nothing found." }) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground py-4">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full">
        <thead className="bg-secondary/60">
          <tr>{cols.map((c) => <th key={c.key} className={TH}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={r.key || i} className="hover:bg-secondary/30">
              {cols.map((c) => <td key={c.key} className={`${TD} ${c.mono ? "font-mono text-xs" : ""}`}>{c.render ? c.render(r) : r[c.key] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Raw({ text }) {
  if (!text) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw output</summary>
      <pre className="mt-2 p-3 rounded-lg bg-background border border-border overflow-x-auto text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{text}</pre>
    </details>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-secondary border border-border">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone || "text-foreground"}`}>{value ?? "—"}</p>
    </div>
  );
}

function MonitorButton({ host, name, type = "ping", port }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={done}
      onClick={async () => {
        try {
          await createMonitor({ name: name || host, type, target: host, port });
          setDone(true);
          toast.success(`Now monitoring ${name || host}`);
        } catch (e) {
          toast.error(e.message);
        }
      }}
      className="text-[11px] px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary/40 inline-flex items-center gap-1 disabled:opacity-50"
    >
      <HeartPulse size={10} /> {done ? "Monitoring" : "Monitor"}
    </button>
  );
}

// ------------------------------------------------------------------------- result renderers
const RENDER = {
  ping: (r) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Status" value={r.alive ? "Reachable" : "No reply"} tone={r.alive ? "text-emerald-400" : "text-red-400"} />
        <Stat label="Loss" value={`${r.lossPct}%`} tone={r.lossPct > 0 ? "text-amber-400" : undefined} />
        <Stat label="Min" value={r.min != null ? `${r.min} ms` : null} />
        <Stat label="Avg" value={r.avg != null ? `${r.avg} ms` : null} />
        <Stat label="Max / jitter" value={r.max != null ? `${r.max} / ${r.jitter}` : null} />
      </div>
      <Raw text={r.raw} />
    </div>
  ),
  traceroute: (r) => (
    <div className="space-y-3">
      <Table cols={[{ key: "hop", label: "Hop" }, { key: "ip", label: "Address", mono: true, render: (h) => h.ip || "* (no reply)" }, { key: "ms", label: "Time", render: (h) => (h.ms != null ? `${h.ms} ms` : "—") }]} rows={r.hops} />
      <Raw text={r.raw} />
    </div>
  ),
  mtr: (r) => (
    <Table
      cols={[
        { key: "hop", label: "Hop" },
        { key: "ip", label: "Address", mono: true, render: (h) => h.ip || "???" },
        { key: "lossPct", label: "Loss", render: (h) => <span className={h.lossPct > 0 ? "text-amber-400" : ""}>{h.lossPct}%</span> },
        { key: "avg", label: "Avg ms" },
        { key: "best", label: "Best" },
        { key: "worst", label: "Worst" },
        { key: "stdev", label: "Jitter" },
      ]}
      rows={r.hops}
    />
  ),
  dns: (r) => (
    <div className="space-y-2">
      {r.error ? <p className="text-sm text-red-400">Lookup failed: {r.error}</p> : <Table cols={[{ key: "v", label: `${r.type} records`, mono: true }]} rows={r.answers.map((a) => ({ v: typeof a === "string" ? a : JSON.stringify(a) }))} />}
      <p className="text-xs text-muted-foreground">Answered in {r.ms} ms by {r.servers?.join(", ")}</p>
    </div>
  ),
  ports: (r) => (
    <div className="space-y-2">
      <p className="text-sm text-foreground">{r.open.length} open of {r.results.length} checked on {r.host}</p>
      <Table
        cols={[
          { key: "port", label: "Port" },
          { key: "state", label: "State", render: (p) => <span className={p.state === "open" ? "text-emerald-400" : p.state === "closed" ? "text-muted-foreground" : "text-amber-400"}>{p.state}</span> },
          { key: "service", label: "Typical use" },
          { key: "ms", label: "Time", render: (p) => `${p.ms} ms` },
          { key: "m", label: "", render: (p) => (p.state === "open" ? <MonitorButton host={r.host} type="tcp" port={p.port} name={`${r.host}:${p.port}${p.service ? ` (${p.service})` : ""}`} /> : null) },
        ]}
        rows={[...r.results].sort((a, b) => (a.state === "open" ? -1 : 1) - (b.state === "open" ? -1 : 1) || a.port - b.port)}
      />
    </div>
  ),
  nmap: (r) => (
    <div className="space-y-2">
      <p className="text-sm text-foreground">{r.hosts.length} host{r.hosts.length === 1 ? "" : "s"} up · {(r.ms / 1000).toFixed(1)} s</p>
      <Table
        cols={[
          { key: "ip", label: "IP", mono: true },
          { key: "hostname", label: "Name" },
          { key: "mac", label: "MAC", mono: true },
          { key: "vendor", label: "Vendor" },
          { key: "ports", label: "Open ports", render: (h) => (h.ports.length ? h.ports.map((p) => `${p.port}${p.service ? `/${p.service}` : ""}${p.product ? ` (${p.product}${p.version ? ` ${p.version}` : ""})` : ""}`).join(", ") : "—") },
          { key: "m", label: "", render: (h) => <MonitorButton host={h.ip} name={h.hostname || h.vendor ? `${h.hostname || h.vendor} (${h.ip})` : h.ip} /> },
        ]}
        rows={r.hosts}
        empty="No hosts responded."
      />
    </div>
  ),
  "arp-scan": (r) => (
    <Table
      cols={[{ key: "ip", label: "IP", mono: true }, { key: "mac", label: "MAC", mono: true }, { key: "vendor", label: "Manufacturer" }, { key: "m", label: "", render: (h) => <MonitorButton host={h.ip} name={h.vendor ? `${h.vendor} (${h.ip})` : h.ip} /> }]}
      rows={r.hosts}
    />
  ),
  neighbours: (r) => (
    <Table cols={[{ key: "ip", label: "IP", mono: true }, { key: "mac", label: "MAC", mono: true }, { key: "vendor", label: "Manufacturer" }, { key: "iface", label: "Interface" }, { key: "state", label: "State" }]} rows={r.neighbours} empty="The ARP table is empty." />
  ),
  lldp: (r) => (
    <Table
      cols={[{ key: "localPort", label: "Our port" }, { key: "systemName", label: "Switch" }, { key: "remotePort", label: "Switch port" }, { key: "remotePortDescr", label: "Port description" }, { key: "mgmtIp", label: "Mgmt IP", mono: true }, { key: "vlan", label: "VLAN" }]}
      rows={r.neighbours}
      empty="No LLDP neighbours yet. lldpd needs ~30 s after start, and the switch must have LLDP enabled."
    />
  ),
  interfaces: (r) => (
    <div className="space-y-4">
      <Table
        cols={[
          { key: "name", label: "Interface" },
          { key: "state", label: "State", render: (i) => <span className={i.state === "UP" ? "text-emerald-400" : "text-muted-foreground"}>{i.state}</span> },
          { key: "addresses", label: "Addresses", mono: true, render: (i) => i.addresses.join(", ") || "—" },
          { key: "speedMbps", label: "Link", render: (i) => (i.speedMbps ? `${i.speedMbps >= 1000 ? i.speedMbps / 1000 + " Gb/s" : i.speedMbps + " Mb/s"} ${i.duplex || ""}` : "—") },
          { key: "mac", label: "MAC", mono: true },
          { key: "traffic", label: "RX / TX", render: (i) => `${formatBytes(i.rxBytes)} / ${formatBytes(i.txBytes)}` },
          { key: "errors", label: "Errors", render: (i) => <span className={i.rxErrors + i.txErrors > 0 ? "text-amber-400" : ""}>{i.rxErrors + i.txErrors}</span> },
        ]}
        rows={r.interfaces.filter((i) => i.name !== "lo")}
      />
      <Table cols={[{ key: "dst", label: "Destination", mono: true }, { key: "gateway", label: "Gateway", mono: true }, { key: "dev", label: "Interface" }, { key: "metric", label: "Metric" }]} rows={r.routes} />
    </div>
  ),
  mdns: (r) => (
    <Table
      cols={[{ key: "name", label: "Name" }, { key: "type", label: "Service" }, { key: "ip", label: "IP", mono: true }, { key: "port", label: "Port" }, { key: "host", label: "Host" }]}
      rows={r.services}
      empty="No Bonjour / mDNS services answered (Apple TVs, Sonos, printers and many AV devices normally do)."
    />
  ),
  wol: (r) => <p className="text-sm text-emerald-400">Magic packet sent to {r.mac} via {r.broadcast}.</p>,
  iperf: (r) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label={r.reverse ? "Download" : "Upload"} value={r.mbps != null ? `${r.mbps} Mb/s` : null} tone="text-primary" />
      <Stat label="Duration" value={`${r.seconds} s`} />
      {r.udp ? <Stat label="Jitter / loss" value={`${r.jitterMs?.toFixed?.(2) ?? "—"} ms / ${r.lostPct ?? "—"}%`} /> : <Stat label="Retransmits" value={r.retransmits} tone={r.retransmits > 0 ? "text-amber-400" : undefined} />}
    </div>
  ),
  tls: (r) => (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Days left" value={r.daysLeft} tone={r.daysLeft < 21 ? "text-red-400" : "text-emerald-400"} />
        <Stat label="Expires" value={r.validTo.slice(0, 10)} />
        <Stat label="Issuer" value={r.issuer} />
        <Stat label="Trusted" value={r.trusted ? "Yes" : r.selfSigned ? "Self-signed" : "No"} tone={r.trusted ? "text-emerald-400" : "text-amber-400"} />
      </div>
      <p className="text-xs text-muted-foreground font-mono break-all">{r.subject} · SHA-256 {r.fingerprint256}</p>
      <MonitorButton host={r.host} type="cert" port={r.port} name={`Certificate ${r.host}`} />
    </div>
  ),
  "av-network": (r) => (
    <div className="space-y-4">
      {r.errors?.map((e) => <p key={e} className="text-xs text-amber-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {e}</p>)}
      {r.findings.map((f) => (
        <p key={f.message} className={`text-sm flex items-start gap-2 ${f.severity === "warning" ? "text-amber-400" : "text-muted-foreground"}`}>
          {f.severity === "warning" ? <AlertTriangle size={14} className="mt-0.5" /> : <CheckCircle2 size={14} className="mt-0.5" />} {f.message}
        </p>
      ))}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">PTP clock leaders (grandmasters)</p>
        <Table
          cols={[{ key: "ip", label: "IP", mono: true }, { key: "domain", label: "Domain" }, { key: "priority1", label: "Priority 1" }, { key: "clockClass", label: "Class" }, { key: "grandmasterMac", label: "GM MAC", mono: true }, { key: "vendor", label: "Vendor" }]}
          rows={r.grandmasters}
          empty="No PTPv2 Announce messages (Dante uses PTPv1 by default — see below)."
        />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-2">PTP traffic seen</p>
        <Table
          cols={[{ key: "ip", label: "Source", mono: true }, { key: "version", label: "PTP", render: (p) => `v${p.version}` }, { key: "domain", label: "Domain / subdomain", render: (p) => p.domain ?? p.subdomain ?? "—" }, { key: "sendsSync", label: "Leader?", render: (p) => (p.sendsSync ? <span className="text-primary">sends Sync</span> : "follower") }, { key: "packets", label: "Packets" }, { key: "vendor", label: "Vendor" }]}
          rows={r.ptp}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-2">AES67 streams announced (SAP)</p>
        <Table cols={[{ key: "sessionName", label: "Stream" }, { key: "source", label: "From", mono: true }, { key: "connection", label: "Multicast", mono: true }, { key: "rtpmap", label: "Format" }, { key: "ptime", label: "Packet time" }]} rows={r.streams} empty="No SAP announcements. AES67 must be enabled on the Dante devices (Dante Controller → Device View → AES67 Config)." />
      </div>
    </div>
  ),
};

// ------------------------------------------------------------------------- tool definitions
const TOOLS = [
  { id: "ping", label: "Ping", icon: Activity, desc: "Is the device answering, and how fast?", fields: [{ k: "host", ph: "192.168.1.1", required: true }, { k: "count", ph: "Count", type: "number", def: 5, w: "w-24" }] },
  { id: "traceroute", label: "Traceroute", icon: Route, desc: "Every router hop between this server and the target.", fields: [{ k: "host", ph: "8.8.8.8 or starlink.com", required: true }] },
  { id: "mtr", label: "MTR (path quality)", icon: Route, desc: "Packet loss and latency at every hop — the best test for an unreliable internet link.", fields: [{ k: "host", ph: "1.1.1.1", required: true }, { k: "cycles", ph: "Cycles", type: "number", def: 10, w: "w-24" }] },
  { id: "dns", label: "DNS lookup", icon: Globe, desc: "Resolve names, or reverse-lookup an IP.", fields: [{ k: "name", ph: "waveavi.com or 192.168.1.5", required: true }, { k: "type", type: "select", options: ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "PTR"], def: "A", w: "w-28" }, { k: "server", ph: "DNS server (optional)", w: "w-48" }] },
  { id: "ports", label: "Port check", icon: DoorOpen, desc: "Test TCP ports — leave ports empty to check the common AV/control ports (Crestron, Lutron, Q-SYS, SSH, HTTP…).", fields: [{ k: "host", ph: "192.168.1.20", required: true }, { k: "ports", ph: "e.g. 22,80,443,41794 or 1-1024", w: "w-64" }] },
  { id: "nmap", label: "Network scan", icon: ScanSearch, desc: "nmap discovery of a host or subnet — open ports, services and manufacturers.", tech: true, fields: [{ k: "target", ph: "192.168.1.0/24 or 192.168.1.20", required: true }, { k: "profile", type: "select", options: [["sweep", "Find live hosts"], ["quick", "Top 100 ports"], ["av", "AV / control ports"], ["services", "Top 1000 + versions (slow)"]], def: "sweep", w: "w-56" }] },
  { id: "arp-scan", label: "ARP scan", icon: Network, desc: "Finds every device on the local subnet, even ones that block ping, with the manufacturer.", tech: true, fields: [{ k: "subnet", ph: "Subnet (blank = this server's LAN)" }] },
  { id: "neighbours", label: "ARP table", icon: Network, desc: "Devices this server has talked to recently.", get: true },
  { id: "lldp", label: "LLDP neighbours", icon: Cable, desc: "Which switch and port this server is plugged into.", get: true },
  { id: "interfaces", label: "Interfaces & routes", icon: Cable, desc: "This server's network ports, link speed, errors and routing table.", get: true },
  { id: "mdns", label: "Bonjour / mDNS", icon: Radio, desc: "AirPlay, Sonos, printers and other devices advertising services.", fields: [{ k: "seconds", ph: "Seconds", type: "number", def: 5, w: "w-24" }] },
  { id: "av-network", label: "Dante / AES67 clock", icon: AudioLines, desc: "Listens for PTP clock and SAP stream announcements — who is clock leader, which domains, which AES67 streams exist.", fields: [{ k: "seconds", ph: "Seconds", type: "number", def: 8, w: "w-24" }, { k: "iface", ph: "Interface (optional)", w: "w-40" }] },
  { id: "wol", label: "Wake-on-LAN", icon: Power, desc: "Power on a PC, media server or NAS that supports Wake-on-LAN.", tech: true, fields: [{ k: "mac", ph: "00:11:22:33:44:55", required: true }, { k: "broadcast", ph: "Broadcast (e.g. 192.168.1.255)", def: "255.255.255.255", w: "w-56" }] },
  { id: "iperf", label: "Throughput (iperf3)", icon: Gauge, desc: "Measure real bandwidth to a device running iperf3 -s.", tech: true, fields: [{ k: "host", ph: "192.168.1.50", required: true }, { k: "seconds", type: "number", def: 5, w: "w-24", ph: "Seconds" }, { k: "reverse", type: "checkbox", label: "Download" }, { k: "udp", type: "checkbox", label: "UDP" }] },
  { id: "tls", label: "Certificate check", icon: ShieldCheck, desc: "Who issued a device's HTTPS certificate and when it expires.", fields: [{ k: "host", ph: "192.168.1.1", required: true }, { k: "port", ph: "443", type: "number", def: 443, w: "w-24" }] },
  { id: "config-backups", label: "Switch config backups", icon: FileCode2, desc: "Daily copies of every Cisco switch configuration, with a diff of what changed.", special: true },
];

function ToolRunner({ tool, allowed }) {
  const [values, setValues] = useState({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setValues(Object.fromEntries((tool.fields || []).filter((f) => f.def !== undefined).map((f) => [f.k, f.def])));
    setResult(null);
    setError(null);
    if (tool.get) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.id]);

  async function run(e) {
    e?.preventDefault?.();
    setRunning(true);
    setError(null);
    try {
      const params = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
      setResult(tool.get ? await getTool(tool.id) : await runTool(tool.id, params));
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  const Render = RENDER[tool.id];
  const slow = ["nmap", "mtr", "av-network", "arp-scan", "iperf", "mdns", "traceroute"].includes(tool.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><tool.icon size={18} className="text-primary" /> {tool.label}</h2>
        <p className="text-sm text-muted-foreground">{tool.desc}</p>
      </div>
      {!allowed ? (
        <p className="text-sm text-amber-400">This tool is available to technicians and administrators.</p>
      ) : (
        <form onSubmit={run} className="flex flex-wrap items-center gap-2">
          {(tool.fields || []).map((f) =>
            f.type === "select" ? (
              <select key={f.k} aria-label={f.k} className={`${INPUT} ${f.w || ""}`} value={values[f.k] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.k]: e.target.value }))}>
                {f.options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
              </select>
            ) : f.type === "checkbox" ? (
              <label key={f.k} className="flex items-center gap-1.5 text-sm text-muted-foreground px-2">
                <input type="checkbox" checked={!!values[f.k]} onChange={(e) => setValues((v) => ({ ...v, [f.k]: e.target.checked }))} /> {f.label}
              </label>
            ) : (
              <input
                key={f.k}
                aria-label={f.ph}
                type={f.type || "text"}
                required={f.required}
                placeholder={f.ph}
                className={`${INPUT} ${f.w || "flex-1 min-w-[220px]"}`}
                value={values[f.k] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.k]: f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))}
              />
            )
          )}
          <button type="submit" disabled={running} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-50">
            {running ? <Loader2 size={13} className="animate-spin" /> : tool.get ? <RefreshCw size={13} /> : <Play size={13} />} {tool.get ? "Refresh" : "Run"}
          </button>
        </form>
      )}
      {running && slow && <p className="text-xs text-muted-foreground">This can take a while — results appear when the scan finishes.</p>}
      {error && <p className="text-sm text-red-400 p-3 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}
      {result && Render && <Render {...{ r: result }} />}
    </div>
  );
}

// Wrap renderers so they can be used as components.
Object.keys(RENDER).forEach((k) => {
  const fn = RENDER[k];
  RENDER[k] = ({ r }) => fn(r);
});

function ConfigBackups({ allowed }) {
  const [data, setData] = useState(null);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState(null);
  const load = () => listConfigBackups().then(setData).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  const backupNow = async () => {
    setRunning(true);
    try {
      const r = await runConfigBackup();
      const ok = r.results.filter((x) => x.ok);
      const changed = ok.filter((x) => x.changed);
      const failed = r.results.filter((x) => !x.ok);
      toast[failed.length ? "warning" : "success"](`${ok.length} backed up, ${changed.length} changed${failed.length ? `, ${failed.length} failed: ${failed.map((f) => `${f.host} (${f.error})`).join("; ")}` : ""}`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  const open = async (b, mode) => {
    try {
      if (mode === "diff") {
        const d = await diffConfigBackup(b.id);
        setView({ title: `${b.name} — changes`, text: d.patch || d.note, diff: true });
      } else {
        const full = await getConfigBackup(b.id);
        setView({ title: `${b.name} — ${new Date(b.ts).toLocaleString()}`, text: full.content });
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const byHost = useMemo(() => {
    const m = new Map();
    (data?.backups || []).forEach((b) => {
      if (!m.has(b.host)) m.set(b.host, []);
      m.get(b.host).push(b);
    });
    return [...m.entries()];
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><FileCode2 size={18} className="text-primary" /> Switch config backups</h2>
          <p className="text-sm text-muted-foreground">Runs every night at 03:00 for each switch under Core Network → Cisco Switches. A change raises an alert.</p>
        </div>
        {allowed && (
          <button type="button" onClick={backupNow} disabled={running || !data?.devices?.length} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-50">
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Back up now
          </button>
        )}
      </div>
      {data && !data.devices.length && <p className="text-sm text-muted-foreground glass rounded-xl p-6">No Cisco switches are configured yet. Add them under Core Network → Cisco Switches with SSH credentials.</p>}
      {byHost.map(([host, list]) => (
        <div key={host} className="glass rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{list[0].name} <span className="text-muted-foreground font-mono text-xs">{host}</span></p>
            <p className="text-[11px] text-muted-foreground">last verified {new Date(list[0].lastVerifiedAt).toLocaleString()}</p>
          </div>
          <div className="divide-y divide-border">
            {list.slice(0, 10).map((b) => (
              <div key={b.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="text-foreground tabular-nums">{new Date(b.ts).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">{b.lines} lines · {b.trigger}</span>
                {b.previousId && <span className="text-xs"><span className="text-emerald-400">+{b.added}</span> <span className="text-red-400">-{b.removed}</span></span>}
                <span className="ml-auto flex gap-1.5">
                  {b.previousId && <button type="button" onClick={() => open(b, "diff")} className="text-[11px] px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-primary inline-flex items-center gap-1"><GitCompare size={10} /> Changes</button>}
                  <button type="button" onClick={() => open(b)} className="text-[11px] px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-primary">View</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {view && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setView(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex justify-between items-center">
              <p className="text-sm font-medium text-foreground">{view.title}</p>
              <button type="button" onClick={() => setView(null)} className="text-muted-foreground hover:text-foreground text-sm">Close</button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed font-mono">
              {view.text.split("\n").map((l, i) => (
                <div key={i} className={view.diff ? (l.startsWith("+") && !l.startsWith("+++") ? "text-emerald-400" : l.startsWith("-") && !l.startsWith("---") ? "text-red-400" : l.startsWith("@@") ? "text-primary" : "text-muted-foreground") : "text-foreground"}>{l || " "}</div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NetworkToolsPage() {
  const { user } = useAuth();
  const tech = isTechnician(user);
  const [active, setActive] = useState("ping");
  const [inventory, setInventory] = useState([]);
  useEffect(() => {
    toolInventory().then((r) => setInventory(r.tools || [])).catch(() => {});
  }, []);
  const tool = TOOLS.find((t) => t.id === active);
  const missing = inventory.filter((t) => !t.installed);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Terminal size={22} className="text-primary" /> Network Tools</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Troubleshoot from the WaveGuard server in the rack — results show the network exactly as the vessel's devices see it.</p>
        {missing.length > 0 && (
          <p className="text-xs text-amber-400 mt-2">Not installed on this server: {missing.map((t) => t.cmd).join(", ")}. Re-run the installer or <code className="px-1 rounded bg-secondary">sudo apt install {missing.map((t) => t.pkg).join(" ")}</code>.</p>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap text-left border transition-colors ${active === t.id ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent"}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="glass rounded-2xl p-5 min-w-0">
          {tool.special ? <ConfigBackups allowed={tech} /> : <ToolRunner key={tool.id} tool={tool} allowed={!tool.tech || tech} />}
        </div>
      </div>
    </div>
  );
}
