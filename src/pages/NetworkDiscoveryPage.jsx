import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Play, Settings, Loader2, AlertTriangle, Search, Download } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import {
  DEFAULT_DISCOVERY_SETTINGS,
  saveDiscoverySettingsLocal,
  normalizeSubnetList,
} from "@/lib/discoverySettings";
import { discoverSubnets, networkScan, checkScannerHealth } from "@/lib/discoveryApi";
import { registerDiscoveredDevice, registerDiscoveredDevices } from "@/lib/discoveryRegistration";
import { toast } from "sonner";
import DiscoveryResultsTable from "../components/discovery/DiscoveryResultsTable";
import DiscoverySubnetConfig from "../components/discovery/DiscoverySubnetConfig";
import DiscoverySummaryBar from "../components/discovery/DiscoverySummaryBar";

export default function NetworkDiscoveryPage() {
  const { value: discoveryCfg, loading: settingsLoading } = useSettings(
    "discovery",
    DEFAULT_DISCOVERY_SETTINGS
  );
  const [subnets, setSubnets] = useState(DEFAULT_DISCOVERY_SETTINGS.subnets);
  const [scanType, setScanType] = useState("ping");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [showConfig, setShowConfig] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scannerHealth, setScannerHealth] = useState(null);
  const [registeringId, setRegisteringId] = useState(null);

  useEffect(() => {
    if (!settingsLoading && discoveryCfg) {
      setSubnets(normalizeSubnetList(discoveryCfg.subnets));
      setScanType(discoveryCfg.scanType || "ping");
    }
  }, [settingsLoading, discoveryCfg]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const health = await checkScannerHealth(discoveryCfg?.agentUrl);
      if (!cancelled) setScannerHealth(health);
    })();
    return () => { cancelled = true; };
  }, [discoveryCfg?.agentUrl]);

  const runScan = async () => {
    let scanSubnets = normalizeSubnetList(subnets);
    if (scanSubnets.length === 0) {
      try {
        const detected = await discoverSubnets(discoveryCfg?.agentUrl);
        scanSubnets = detected.subnets || [];
        if (scanSubnets.length) setSubnets(scanSubnets);
      } catch {
        /* handled below */
      }
    }
    if (scanSubnets.length === 0) {
      setError("Add at least one subnet (CIDR), or use Detect local subnets.");
      setShowConfig(true);
      return;
    }

    setScanning(true);
    setError(null);
    setScanResult(null);
    setDevices([]);
    setProgress(0);

    saveDiscoverySettingsLocal({ ...discoveryCfg, subnets: scanSubnets, scanType });

    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) {
          clearInterval(progressInterval);
          return 88;
        }
        return p + Math.random() * 8;
      });
    }, 400);

    try {
      const isFullScan = scanType === "full";
      const data = await networkScan({
        subnets: scanSubnets,
        scanType,
        snmpEnabled: discoveryCfg.snmpEnabled,
        snmpCommunity: discoveryCfg.snmpCommunity,
        snmpVersion: discoveryCfg.snmpVersion,
        maxConcurrent: isFullScan
          ? Math.min(32, discoveryCfg.maxConcurrent || 64)
          : discoveryCfg.maxConcurrent,
        timeoutMs: isFullScan
          ? Math.max(2000, discoveryCfg.timeoutMs || 1500)
          : discoveryCfg.timeoutMs,
        autoDetectLocalSubnets: discoveryCfg.autoDetectLocalSubnets,
      }, discoveryCfg?.agentUrl);
      clearInterval(progressInterval);
      setProgress(100);
      if (data?.success === false && data?.error) {
        throw new Error(data.error);
      }
      setScanResult(data);
      setDevices(data.devices || []);
    } catch (e) {
      clearInterval(progressInterval);
      const msg = e.message || "Scan failed";
      setError(
        /reading 'map'/.test(msg)
          ? `${msg} — restart the scanner: stop npm run mock, then run it again (npm run dev:all).`
          : msg
      );
    } finally {
      setScanning(false);
    }
  };

  const handleDetectSubnets = useCallback(async () => {
    const data = await discoverSubnets(discoveryCfg?.agentUrl);
    const list = data?.subnets || [];
    if (list.length) {
      setSubnets((prev) => [...new Set([...normalizeSubnetList(prev), ...normalizeSubnetList(list)])]);
    }
    if (data?.scanInterface) {
      setScannerHealth((h) => ({ ...h, ok: true, scanInterface: data.scanInterface, localSubnets: list }));
    }
    return list;
  }, [discoveryCfg?.agentUrl]);

  const classify = async (id, classification) => {
    const device = devices.find((d) => d.id === id);
    if (!device) return;

    setRegisteringId(id);
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, classification } : d)));

    try {
      const result = await registerDiscoveredDevice(device, classification);
      const n = result.groupsUpdated?.length || 0;
      if (classification === "monitored") {
        toast.success(
          n > 0
            ? `${device.ip} is now monitored (${n} group${n > 1 ? "s" : ""})`
            : `${device.ip} is now monitored`
        );
      } else if (classification === "inventory") {
        toast.success(
          n > 0
            ? `${device.ip} added to inventory (${n} group${n > 1 ? "s" : ""})`
            : `${device.ip} added to inventory`
        );
      } else if (classification === "ignored") {
        toast.success(`${device.ip} ignored`);
      }
    } catch (e) {
      setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, classification: "unclassified" } : d)));
      toast.error(e.message || "Could not register device");
    } finally {
      setRegisteringId(null);
    }
  };

  const classifyAll = async (ids, classification) => {
    const targets = devices.filter((d) => ids.includes(d.id));
    if (!targets.length) return;

    setRegisteringId("bulk");
    setDevices((prev) => prev.map((d) => (ids.includes(d.id) ? { ...d, classification } : d)));

    try {
      await registerDiscoveredDevices(targets, classification);
      toast.success(
        `${targets.length} device${targets.length > 1 ? "s" : ""} marked as ${classification}`
      );
    } catch (e) {
      setDevices((prev) =>
        prev.map((d) => (ids.includes(d.id) ? { ...d, classification: "unclassified" } : d))
      );
      toast.error(e.message || "Bulk registration failed");
    } finally {
      setRegisteringId(null);
    }
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
    <div className="min-h-screen bg-[#060912] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 bg-[#070b13]/90 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/12 flex items-center justify-center ring-1 ring-cyan-500/20">
            <Radar size={16} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Network Discovery</h1>
            <p className="text-xs text-slate-500 mt-0.5">
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
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <Download size={12} /> Export CSV
            </button>
          )}
          <button
            onClick={() => setShowConfig((s) => !s)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showConfig
                ? "border-cyan-500/40 bg-cyan-500/12 text-cyan-400"
                : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <Settings size={12} /> Configure
          </button>
          <button
            onClick={runScan}
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
            className="overflow-hidden border-b border-white/6 bg-[#070b13]/60"
          >
            <DiscoverySubnetConfig
              subnets={subnets}
              onSubnetsChange={setSubnets}
              scanType={scanType}
              onScanTypeChange={(t) => {
                setScanType(t);
                setError(null);
              }}
              onDetectSubnets={handleDetectSubnets}
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
            className="px-5 py-3 border-b border-white/6 bg-[#070b13]/50"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-cyan-400 flex items-center gap-2">
                <Loader2 size={11} className="animate-spin" />
                Scanning {subnets.join(", ")} — {scanType.toUpperCase()} probe
              </span>
              <span className="text-slate-500">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
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
            <p className="text-base font-semibold text-white mb-1">Ready to scan</p>
            <p className="text-sm text-slate-500 max-w-md">
              Detect your local subnets, then run a live ping/ARP scan. Start the scanner with{" "}
              <span className="font-mono text-slate-400">npm run dev:all</span> (or{" "}
              <span className="font-mono text-slate-400">npm run mock</span>) on this PC or on your deployment server.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfig(true)}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Configure subnets
            </button>
            <button
              onClick={runScan}
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
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/6 bg-[#070b13]/40 flex-shrink-0 flex-wrap gap-y-2">
            <div className="relative flex-1 min-w-40 max-w-64">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search IP, hostname, vendor…"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
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
                      : "border-white/8 text-slate-500 hover:text-slate-300"
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
                          ? "border-slate-500/40 bg-slate-500/15 text-slate-300"
                          : c === "inventory"
                            ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                            : c === "unclassified"
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                              : "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                      : "border-white/8 text-slate-500 hover:text-slate-300"
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
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          No devices responded on {subnets.join(", ")}. Try Full scan or add another subnet.
        </div>
      )}
    </div>
  );
}
