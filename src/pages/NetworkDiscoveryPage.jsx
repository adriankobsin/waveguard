import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar, Play, Settings, Loader2, AlertTriangle, Search, Download,
  PanelLeft, PanelLeftClose,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import {
  DEFAULT_DISCOVERY_SETTINGS,
  normalizeSubnetList,
} from "@/lib/discoverySettings";
import { useDiscovery } from "@/contexts/DiscoveryContext";
import DiscoveryResultsTable from "../components/discovery/DiscoveryResultsTable";
import DiscoverySubnetConfig from "../components/discovery/DiscoverySubnetConfig";
import DiscoverySummaryBar from "../components/discovery/DiscoverySummaryBar";
import ScanHistoryPanel from "../components/discovery/ScanHistoryPanel";

export default function NetworkDiscoveryPage() {
  const { value: discoveryCfg, loading: settingsLoading } = useSettings(
    "discovery",
    DEFAULT_DISCOVERY_SETTINGS
  );
  const {
    subnets, setSubnets,
    scanType, setScanType,
    scanning,
    scanResult,
    progress,
    devices,
    error,
    scannerHealth,
    registeringId,
    scanHistory,
    historyLoading,
    activeScanId,
    setDiscoverySettings,
    runScan,
    handleDetectSubnets,
    classify,
    classifyAll,
    selectScan,
    deleteScan,
    clearScan,
  } = useDiscovery();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [showConfig, setShowConfig] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!settingsLoading && discoveryCfg) {
      setSubnets(normalizeSubnetList(discoveryCfg.subnets));
      setScanType(discoveryCfg.scanType || "ping");
      setDiscoverySettings(discoveryCfg);
    }
  }, [settingsLoading, discoveryCfg, setSubnets, setScanType, setDiscoverySettings]);

  const handleRunScan = () => {
    runScan(subnets, scanType, discoveryCfg);
  };

  const handleDetect = () => {
    handleDetectSubnets(discoveryCfg?.agentUrl);
  };

  const filtered = devices.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      d.ip.includes(q) ||
      (d.hostname || "").toLowerCase().includes(q) ||
      (d.vendor || "").toLowerCase().includes(q) ||
      (d.category || "").toLowerCase().includes(q);
    const matchCat = categoryFilter === "all" || d.category === categoryFilter;
    const matchClass = classFilter === "all" || d.classification === classFilter;
    return matchSearch && matchCat && matchClass;
  });

  const categories = ["all", ...new Set(devices.map((d) => d.category).filter(Boolean))];
  const unclassified = devices.filter((d) => d.classification === "unclassified").length;
  const monitored = devices.filter((d) => d.classification === "monitored").length;
  const ignored = devices.filter((d) => d.classification === "ignored").length;
  const inventory = devices.filter((d) => d.classification === "inventory").length;

  const exportCSV = () => {
    const rows = [
      ["IP", "Hostname", "Vendor", "Category", "MAC", "Ports", "Classification"],
      ...devices.map((d) => [
        d.ip,
        d.hostname,
        d.vendor,
        d.category,
        d.mac,
        (d.openPorts || []).join("|"),
        d.classification,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discovery-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Scan History Sidebar */}
      <div
        className={`flex-shrink-0 border-r border-border bg-card/50 transition-all duration-200 flex flex-col ${
          historyOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <ScanHistoryPanel
          history={scanHistory}
          activeScanId={activeScanId}
          onSelectScan={selectScan}
          onDeleteScan={deleteScan}
          onRunNew={clearScan}
          loading={historyLoading}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/90 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((s) => !s)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={historyOpen ? "Hide scan history" : "Show scan history"}
            >
              {historyOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/12 flex items-center justify-center ring-1 ring-cyan-500/20">
              <Radar size={16} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-none">Network Discovery</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {scannerHealth?.ok
                  ? `Scanner: ${scannerHealth.scanInterface || "ready"}`
                  : "Live scan via WaveGuard scanner agent"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {scanResult && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download size={12} /> Export CSV
              </button>
            )}
            <button
              onClick={() => setShowConfig((s) => !s)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showConfig
                  ? "border-cyan-500/40 bg-cyan-500/12 text-cyan-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings size={12} /> Configure
            </button>
            <button
              onClick={handleRunScan}
              disabled={scanning || settingsLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 transition-colors disabled:opacity-60"
            >
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {scanning ? "Scanning…" : "Run Scan"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-border bg-card/60"
            >
              <DiscoverySubnetConfig
                subnets={subnets}
                onSubnetsChange={setSubnets}
                scanType={scanType}
                onScanTypeChange={(t) => {
                  setScanType(t);
                }}
                onDetectSubnets={handleDetect}
                subnetLabels={discoveryCfg?.subnetLabels || {}}
                knownHosts={discoveryCfg?.knownHosts || []}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {scanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-5 py-3 border-b border-border bg-card/50"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-cyan-400 flex items-center gap-2">
                  <Loader2 size={11} className="animate-spin" />
                  Scanning {subnets.join(", ")} — {scanType.toUpperCase()} probe
                </span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mx-5 mt-4 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8 text-xs text-red-400 flex items-center gap-2">
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {!scanning && !scanResult && !error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8 py-16">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/8 border border-cyan-500/15 flex items-center justify-center">
              <Radar size={36} className="text-cyan-400/60" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground mb-1">Ready to scan</p>
              <p className="text-sm text-muted-foreground max-w-md">
                {scanHistory.length > 0
                  ? "Select a past scan from the sidebar, or run a new one."
                  : "Detect your local subnets, then run a live ping/ARP scan. Start the scanner with "}
                <span className="font-mono text-muted-foreground">npm run dev:all</span> (or{" "}
                <span className="font-mono text-muted-foreground">npm run mock</span>) on this PC or on your deployment server.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfig(true)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Configure subnets
              </button>
              <button
                onClick={handleRunScan}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 transition-colors"
              >
                <Play size={14} /> Start Scan
              </button>
            </div>
          </div>
        )}

        {scanResult && devices.length > 0 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <DiscoverySummaryBar
              result={scanResult}
              unclassified={unclassified}
              monitored={monitored}
              ignored={ignored}
              inventory={inventory}
              onClassifyAll={(cls) =>
                classifyAll(
                  devices.filter((d) => d.classification === "unclassified").map((d) => d.id),
                  cls
                )
              }
            />
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-card/40 flex-shrink-0 flex-wrap gap-y-2">
              <div className="relative flex-1 min-w-40 max-w-64">
                <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search IP, hostname, vendor…"
                  className="w-full bg-secondary border border-border rounded-xl pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                />
              </div>
              <div className="flex items-center gap-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize transition-colors ${
                      categoryFilter === c
                        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                        : "border-border text-muted-foreground hover:text-secondary-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                {["all", "unclassified", "monitored", "inventory", "ignored"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setClassFilter(c)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize transition-colors ${
                      classFilter === c
                        ? c === "monitored"
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                          : c === "ignored"
                            ? "border-slate-500/40 bg-slate-500/15 text-secondary-foreground"
                            : c === "inventory"
                              ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                              : c === "unclassified"
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                                : "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                      : "border-border text-muted-foreground hover:text-secondary-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DiscoveryResultsTable
                devices={filtered}
                onClassify={classify}
                registeringId={registeringId}
              />
            </div>
          </div>
        )}

        {scanResult && devices.length === 0 && !scanning && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No devices responded on {subnets.join(", ")}. Try Full scan or add another subnet.
          </div>
        )}
      </div>
    </div>
  );
}
