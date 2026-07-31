import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_DISCOVERY_SETTINGS,
  saveDiscoverySettingsLocal,
  normalizeSubnetList,
} from "@/lib/discoverySettings";
import { discoverSubnets, networkScan, checkScannerHealth, loadScanHistory, saveScanHistory, deleteScanHistory } from "@/lib/discoveryApi";
import { registerDiscoveredDevice, registerDiscoveredDevices } from "@/lib/discoveryRegistration";

const DiscoveryContext = createContext(null);

export function DiscoveryProvider({ children }) {
  const [subnets, setSubnets] = useState(DEFAULT_DISCOVERY_SETTINGS.subnets);
  const [scanType, setScanType] = useState("ping");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [progress, setProgress] = useState(0);
  const [scannerHealth, setScannerHealth] = useState(null);
  const [registeringId, setRegisteringId] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeScanId, setActiveScanId] = useState(null);
  const [discoverySettings, setDiscoverySettings] = useState(null);

  const progressIntervalRef = useRef(null);
  const mountedRef = useRef(true);

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    setProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) {
          return 88;
        }
        return p + Math.random() * 8;
      });
    }, 400);
  }, [stopProgress]);

  useEffect(() => {
    loadScanHistory().then((list) => {
      setScanHistory(list);
      setHistoryLoading(false);
    }).catch(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const health = await checkScannerHealth(discoverySettings?.agentUrl);
      if (!cancelled) setScannerHealth(health);
    })();
    return () => { cancelled = true; };
  }, [discoverySettings?.agentUrl]);

  useEffect(() => {
    return () => {
      stopProgress();
    };
  }, [stopProgress]);

  const runScan = useCallback(async (scanSubnets, scanTypeOption, cfg) => {
    let subnetsToScan = normalizeSubnetList(scanSubnets);
    if (subnetsToScan.length === 0) {
      try {
        const detected = await discoverSubnets(cfg?.agentUrl);
        subnetsToScan = detected.subnets || [];
        if (subnetsToScan.length) setSubnets(subnetsToScan);
      } catch {
        /* handled below */
      }
    }
    if (subnetsToScan.length === 0) {
      setError("Add at least one subnet (CIDR), or use Detect local subnets.");
      return;
    }

    setScanning(true);
    setError(null);
    setScanResult(null);
    setDevices([]);
    startProgress();

    saveDiscoverySettingsLocal({ ...cfg, subnets: subnetsToScan, scanType: scanTypeOption });

    try {
      const isFullScan = scanTypeOption === "full";
      const data = await networkScan({
        subnets: subnetsToScan,
        scanType: scanTypeOption,
        snmpEnabled: cfg?.snmpEnabled,
        snmpCommunity: cfg?.snmpCommunity,
        snmpVersion: cfg?.snmpVersion,
        maxConcurrent: isFullScan
          ? Math.min(32, cfg?.maxConcurrent || 64)
          : cfg?.maxConcurrent,
        timeoutMs: isFullScan
          ? Math.max(2000, cfg?.timeoutMs || 1500)
          : cfg?.timeoutMs,
        autoDetectLocalSubnets: cfg?.autoDetectLocalSubnets,
        knownHosts: cfg?.knownHosts || [],
      }, cfg?.agentUrl);
      stopProgress();
      setProgress(100);
      if (data?.success === false && data?.error) {
        throw new Error(data.error);
      }
      setScanResult(data);
      setDevices(data.devices || []);
      const saved = await saveScanHistory(data).catch(() => null);
      if (saved?.scanHistory) {
        setScanHistory((prev) => {
          const updated = [saved.scanHistory, ...prev];
          if (updated.length > 50) updated.length = 50;
          return updated;
        });
        setActiveScanId(saved.scanHistory.id);
      }
    } catch (e) {
      stopProgress();
      const msg = e.message || "Scan failed";
      setError(
        /reading 'map'/.test(msg)
          ? `${msg} — restart the scanner: stop npm run mock, then run it again (npm run dev:all).`
          : msg
      );
    } finally {
      setScanning(false);
    }
  }, [startProgress, stopProgress]);

  const handleDetectSubnets = useCallback(async (agentUrl) => {
    const data = await discoverSubnets(agentUrl);
    const list = data?.subnets || [];
    if (list.length) {
      setSubnets((prev) => [...new Set([...normalizeSubnetList(prev), ...normalizeSubnetList(list)])]);
    }
    if (data?.scanInterface) {
      setScannerHealth((h) => ({ ...h, ok: true, scanInterface: data.scanInterface, localSubnets: list }));
    }
    return list;
  }, []);

  const classifyDevice = useCallback(async (id, classification) => {
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
  }, [devices]);

  const classifyDevices = useCallback(async (ids, classification) => {
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
  }, [devices]);

  const selectScan = useCallback((entry) => {
    setActiveScanId(entry.id);
    setScanResult(entry);
    setDevices(entry.devices || []);
    setError(null);
    if (entry.subnets) setSubnets(normalizeSubnetList(entry.subnets));
  }, []);

  const deleteScan = useCallback(async (id) => {
    try {
      await deleteScanHistory(id);
      setScanHistory((prev) => prev.filter((s) => s.id !== id));
      if (activeScanId === id) {
        setActiveScanId(null);
        setScanResult(null);
        setDevices([]);
      }
      toast.success("Scan removed");
    } catch (e) {
      toast.error(e.message || "Failed to delete scan");
    }
  }, [activeScanId]);

  const clearScan = useCallback(() => {
    setActiveScanId(null);
    setScanResult(null);
    setDevices([]);
    setError(null);
    setProgress(0);
  }, []);

  const resetScanning = useCallback(() => {
    setScanning(false);
    setProgress(0);
    stopProgress();
  }, [stopProgress]);

  const value = {
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
    discoverySettings, setDiscoverySettings,
    runScan,
    handleDetectSubnets,
    classify: classifyDevice,
    classifyAll: classifyDevices,
    selectScan,
    deleteScan,
    clearScan,
    resetScanning,
  };

  return (
    <DiscoveryContext.Provider value={value}>
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery() {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) {
    throw new Error("useDiscovery must be used within a DiscoveryProvider");
  }
  return ctx;
}
