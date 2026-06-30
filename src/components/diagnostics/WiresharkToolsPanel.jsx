import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Filter,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  analyzeCapture,
  captureTraffic,
  checkWiresharkStatus,
  downloadCapture,
  getCaptureDownloadUrl,
  uploadAndAnalyze,
} from "@/api/wiresharkApi";

const CAPTURE_EVENT = "waveguard-wireshark-capture";

function PacketTable({ packets, expandedNum, onToggle }) {
  if (!packets?.length) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">No packets to display.</p>
    );
  }
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-border">
      <table className="w-full text-[10px]">
        <thead className="bg-muted/60 sticky top-0">
          <tr className="text-left text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">Time</th>
            <th className="px-2 py-1.5 font-medium">Source</th>
            <th className="px-2 py-1.5 font-medium">Destination</th>
            <th className="px-2 py-1.5 font-medium">Proto</th>
            <th className="px-2 py-1.5 font-medium">Len</th>
            <th className="px-2 py-1.5 font-medium">Info</th>
          </tr>
        </thead>
        <tbody>
          {packets.map((p) => (
            <Fragment key={p.num}>
              <tr
                className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                onClick={() => onToggle(p.num === expandedNum ? null : p.num)}
              >
                <td className="px-2 py-1 font-mono">{p.num}</td>
                <td className="px-2 py-1 font-mono truncate max-w-[100px]">
                  {p.time ? String(p.time).slice(11, 23) : "—"}
                </td>
                <td className="px-2 py-1 font-mono">{p.src}</td>
                <td className="px-2 py-1 font-mono">{p.dst}</td>
                <td className="px-2 py-1">{p.protocol}</td>
                <td className="px-2 py-1 font-mono">{p.length}</td>
                <td className="px-2 py-1 truncate max-w-[180px]">{p.info}</td>
              </tr>
              {expandedNum === p.num && p.raw && (
                <tr className="border-t border-border/40 bg-muted/20">
                  <td colSpan={7} className="px-2 py-2">
                    <pre className="text-[9px] font-mono overflow-x-auto max-h-32 text-muted-foreground">
                      {JSON.stringify(p.raw, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsBlock({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
      <div className="rounded-lg border border-border p-2">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">Protocols</p>
        <div className="space-y-0.5 max-h-24 overflow-y-auto">
          {(stats.protocolHierarchy || []).slice(0, 8).map((row) => (
            <div key={row.protocol} className="flex justify-between text-[10px]">
              <span>{row.protocol}</span>
              <span className="font-mono text-muted-foreground">{row.frames} fr</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border p-2">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">Conversations</p>
        <div className="space-y-0.5 max-h-24 overflow-y-auto">
          {(stats.conversations || []).slice(0, 6).map((row, i) => (
            <div key={i} className="text-[10px] truncate">
              <span className="font-mono">{row.addrA}</span>
              <span className="text-muted-foreground"> ↔ </span>
              <span className="font-mono">{row.addrB}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border p-2">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">Endpoints</p>
        <div className="space-y-0.5 max-h-24 overflow-y-auto">
          {(stats.endpoints || []).slice(0, 6).map((row) => (
            <div key={row.address} className="flex justify-between text-[10px]">
              <span className="font-mono truncate">{row.address}</span>
              <span className="text-muted-foreground">{row.frames} fr</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WiresharkToolsPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState("capture");
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [expandedNum, setExpandedNum] = useState(null);
  const [recentCaptures, setRecentCaptures] = useState([]);

  const [iface, setIface] = useState("");
  const [durationSec, setDurationSec] = useState(10);
  const [hostIp, setHostIp] = useState("");
  const [bpfFilter, setBpfFilter] = useState("");
  const [displayFilter, setDisplayFilter] = useState("");
  const fileInputRef = useRef(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s = await checkWiresharkStatus();
      setStatus(s);
      if (s?.interfaces?.length && !iface) {
        setIface(s.interfaces[0].name);
      }
    } catch (err) {
      toast.error(err.message || "Could not load Wireshark status");
    } finally {
      setStatusLoading(false);
    }
  }, [iface]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const rememberCapture = useCallback((captureId, label) => {
    if (!captureId) return;
    setRecentCaptures((prev) => {
      const next = [{ id: captureId, label: label || captureId, at: Date.now() }, ...prev.filter((c) => c.id !== captureId)];
      return next.slice(0, 8);
    });
  }, []);

  const applyResult = useCallback((data, label) => {
    setResult(data);
    if (data?.captureId) rememberCapture(data.captureId, label);
    if (data?.source === "mock") {
      toast.info("Using mock packet data — install Wireshark/tshark on the scanner host for live capture.");
    }
  }, [rememberCapture]);

  const runCapture = useCallback(async (opts = {}) => {
    const ip = opts.hostIp ?? hostIp;
    const dur = opts.durationSec ?? durationSec;
    const selectedIface = opts.interface ?? iface;
    if (!selectedIface && status?.available) {
      toast.error("Select a network interface");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const data = await captureTraffic({
        interface: selectedIface,
        durationSec: dur,
        bpfFilter: opts.bpfFilter ?? bpfFilter,
        hostIp: ip,
      });
      if (!data?.success) {
        toast.error(data?.error || "Capture failed");
        return;
      }
      applyResult(data, ip ? `host ${ip}` : "live capture");
      toast.success(`Captured ${data.packetCount ?? 0} packets`);
    } catch (err) {
      toast.error(err.message || "Capture failed");
    } finally {
      setBusy(false);
    }
  }, [hostIp, durationSec, iface, bpfFilter, status, applyResult]);

  useEffect(() => {
    const onCaptureRequest = (e) => {
      const { hostIp: ip, durationSec: dur } = e.detail || {};
      if (ip) setHostIp(ip);
      setTab("capture");
      setCollapsed(false);
      runCapture({ hostIp: ip, durationSec: dur || 15 });
    };
    window.addEventListener(CAPTURE_EVENT, onCaptureRequest);
    return () => window.removeEventListener(CAPTURE_EVENT, onCaptureRequest);
  }, [runCapture]);

  const runAnalyze = async (captureId) => {
    setBusy(true);
    try {
      const data = await analyzeCapture({ captureId, displayFilter });
      if (!data?.success) {
        toast.error(data?.error || "Analysis failed");
        return;
      }
      applyResult(data, "filtered analysis");
      toast.success(`Showing ${data.packetCount ?? 0} packets`);
    } catch (err) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const data = await uploadAndAnalyze(file, { displayFilter });
      if (!data?.success) {
        toast.error(data?.error || "Upload analysis failed");
        return;
      }
      applyResult(data, file.name);
      toast.success(`Analyzed ${file.name}`);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleDownload = async () => {
    const id = result?.captureId;
    if (!id) {
      toast.error("No capture file available");
      return;
    }
    try {
      const blob = await downloadCapture(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waveguard-capture-${id}.pcapng`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const url = getCaptureDownloadUrl(id);
      if (url) window.open(url, "_blank");
    }
  };

  const copyFilter = () => {
    const f = displayFilter || bpfFilter;
    if (!f) return;
    navigator.clipboard.writeText(f);
    toast.success("Filter copied");
  };

  return (
    <Card className="glass border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wifi size={16} className="text-cyan-400" />
            Packet Analysis (Wireshark / tshark)
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadStatus}
              disabled={statusLoading}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <RefreshCw size={11} className={statusLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
            {statusLoading ? (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Checking tshark…
              </span>
            ) : status?.available ? (
              <span className="text-emerald-400 inline-flex items-center gap-1">
                <Radio size={10} /> tshark {status.version} · {status.interfaces?.length ?? 0} interfaces
              </span>
            ) : (
              <span className="text-amber-400">Mock mode — {status?.npcapHint || "tshark not available"}</span>
            )}
            <a
              href="https://www.wireshark.org/download.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5 ml-auto"
            >
              Install Wireshark <ExternalLink size={9} />
            </a>
          </div>
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4 pt-0">
          <div className="flex bg-secondary rounded-xl p-1 w-fit gap-1">
            {[
              { key: "capture", label: "Capture", icon: Activity },
              { key: "analyze", label: "Analyze", icon: Search },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
                  tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {tab === "capture" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-[10px] text-muted-foreground">
                Interface
                <select
                  value={iface}
                  onChange={(e) => setIface(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  disabled={!status?.interfaces?.length}
                >
                  {(status?.interfaces || []).map((i) => (
                    <option key={i.index} value={i.name}>
                      {i.label}
                    </option>
                  ))}
                  {!status?.interfaces?.length && <option value="">No interfaces (mock)</option>}
                </select>
              </label>
              <label className="text-[10px] text-muted-foreground">
                Duration ({durationSec}s)
                <input
                  type="range"
                  min={5}
                  max={60}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
              <label className="text-[10px] text-muted-foreground">
                Target IP (optional)
                <input
                  type="text"
                  value={hostIp}
                  onChange={(e) => setHostIp(e.target.value)}
                  placeholder="192.168.10.42"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono"
                />
              </label>
              <label className="text-[10px] text-muted-foreground">
                BPF capture filter (optional)
                <input
                  type="text"
                  value={bpfFilter}
                  onChange={(e) => setBpfFilter(e.target.value)}
                  placeholder="tcp port 443"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono"
                />
              </label>
            </div>
          )}

          {tab === "analyze" && (
            <div className="space-y-3">
              <label className="text-[10px] text-muted-foreground block">
                Display filter (Wireshark syntax)
                <input
                  type="text"
                  value={displayFilter}
                  onChange={(e) => setDisplayFilter(e.target.value)}
                  placeholder="dns or tcp.port == 443"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <input ref={fileInputRef} type="file" accept=".pcap,.pcapng,.cap" className="hidden" onChange={handleUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 disabled:opacity-50"
                >
                  <FileUp size={12} /> Upload pcap/pcapng
                </button>
                {recentCaptures.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => runAnalyze(c.id)}
                    disabled={busy}
                    className="text-[10px] border border-border rounded-lg px-2 py-1 hover:bg-muted/50 disabled:opacity-50 truncate max-w-[140px]"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {tab === "capture" && (
              <button
                type="button"
                onClick={() => runCapture()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                Start capture
              </button>
            )}
            {tab === "analyze" && result?.captureId && (
              <button
                type="button"
                onClick={() => runAnalyze(result.captureId)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 disabled:opacity-50"
              >
                <Filter size={12} /> Re-analyze with filter
              </button>
            )}
            {result?.captureId && result?.source === "live" && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50"
              >
                <Download size={12} /> Download pcap
              </button>
            )}
            {(displayFilter || bpfFilter) && (
              <button
                type="button"
                onClick={copyFilter}
                className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50"
              >
                <Copy size={12} /> Copy filter
              </button>
            )}
          </div>

          {busy && !result && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-xs">
              <Loader2 size={14} className="animate-spin text-cyan-400" />
              Running tshark…
            </div>
          )}

          {result?.packets && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">
                {result.packetCount ?? result.packets.length} packets
                {result.source === "mock" ? " (mock)" : ""}
                {result.bpfFilter ? ` · BPF: ${result.bpfFilter}` : ""}
                {result.displayFilter ? ` · Filter: ${result.displayFilter}` : ""}
              </p>
              <PacketTable packets={result.packets} expandedNum={expandedNum} onToggle={setExpandedNum} />
              <StatsBlock stats={result.stats} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** Trigger capture from diagnosis cards or topology actions. */
export function requestWiresharkCapture({ hostIp, durationSec = 15 } = {}) {
  window.dispatchEvent(
    new CustomEvent(CAPTURE_EVENT, { detail: { hostIp, durationSec } })
  );
}
