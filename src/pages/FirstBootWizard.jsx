import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Wifi, Ship, Search, CheckCircle2, ChevronRight, ChevronLeft,
  Network, Camera, Monitor, Zap, Server, Loader2, Globe
} from "lucide-react";

const STEPS = ["Network", "Vessel Info", "Discovery", "Ready"];

const MOCK_SUBNETS = ["192.168.10.0/24", "192.168.20.0/24"];
const MOCK_DISCOVERY = [
  { type: "switch", label: "Switches", count: 3, vendor: "Cisco", icon: Network, color: "text-cyan-400 bg-cyan-500/15" },
  { type: "camera", label: "Cameras", count: 12, vendor: "Dahua", icon: Camera, color: "text-purple-400 bg-purple-500/15" },
  { type: "av", label: "AV Processors", count: 2, vendor: "Q-SYS", icon: Monitor, color: "text-blue-400 bg-blue-500/15" },
  { type: "power", label: "UPS Units", count: 2, vendor: "APC", icon: Zap, color: "text-yellow-400 bg-yellow-500/15" },
  { type: "server", label: "NAS / Servers", count: 1, vendor: "Synology", icon: Server, color: "text-green-400 bg-green-500/15" },
];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-300 ${
            i < currentStep ? "bg-green-500 text-white" :
            i === currentStep ? "bg-primary text-primary-foreground" :
            "bg-secondary text-muted-foreground"
          }`}>
            {i < currentStep ? <CheckCircle2 size={14} /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 rounded transition-all duration-500 ${i < currentStep ? "bg-green-500" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Step1Network({ subnets }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 flex items-center justify-center mx-auto">
          <Wifi size={32} className="text-cyan-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Network Detected</h2>
        <p className="text-sm text-muted-foreground">Wave Guard found the following subnets on this vessel's network.</p>
      </div>
      <div className="space-y-2">
        {subnets.map(s => (
          <div key={s} className="flex items-center gap-3 bg-secondary/50 border border-border/50 rounded-xl p-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-mono text-sm text-foreground">{s}</span>
            <span className="ml-auto text-xs text-muted-foreground">Active</span>
          </div>
        ))}
      </div>
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-sm text-cyan-300">
        <strong>Passive scan complete.</strong> No network traffic was generated during detection. Click Continue to begin full discovery.
      </div>
    </div>
  );
}

function Step2Vessel({ vesselInfo, onChange }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto">
          <Ship size={32} className="text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Vessel Information</h2>
        <p className="text-sm text-muted-foreground">This information helps Wave Guard personalise alerts and reports.</p>
      </div>
      <div className="space-y-3">
        {[
          { key: "name", label: "Vessel Name", placeholder: "M/Y Horizon" },
          { key: "owner", label: "Owner / Manager", placeholder: "Optional" },
          { key: "homePort", label: "Home Port", placeholder: "Monaco, MC" },
          { key: "mmsi", label: "MMSI Number", placeholder: "Optional" },
        ].map(field => (
          <div key={field.key}>
            <label className="text-xs text-muted-foreground font-medium block mb-1">{field.label}</label>
            <input
              type="text"
              value={vesselInfo[field.key] || ""}
              onChange={e => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Step3Discovery({ scanning, results, onScan: _onScan, importAll, setImportAll }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className={`w-16 h-16 rounded-2xl ${scanning ? "bg-yellow-500/15" : "bg-green-500/15"} flex items-center justify-center mx-auto`}>
          {scanning ? <Loader2 size={32} className="text-yellow-400 animate-spin" /> : <Search size={32} className="text-green-400" />}
        </div>
        <h2 className="text-xl font-bold text-foreground">{scanning ? "Scanning Network…" : "Discovery Complete"}</h2>
        <p className="text-sm text-muted-foreground">
          {scanning ? "Running ICMP sweep, ARP scan, mDNS browse, and port checks." : `Found ${results.reduce((a, r) => a + r.count, 0)} devices across ${results.length} categories.`}
        </p>
      </div>

      {!scanning && (
        <>
          <div className="space-y-2">
            {results.map(r => (
              <div key={r.type} className="flex items-center gap-3 bg-secondary/50 border border-border/50 rounded-xl p-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${r.color}`}>
                  <r.icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.vendor}</p>
                </div>
                <span className="text-lg font-bold text-foreground">{r.count}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setImportAll(true)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${importAll ? "border-primary bg-primary" : "border-border"}`}
              >
                {importAll && <span className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Import all with high confidence</p>
                <p className="text-xs text-muted-foreground">Recommended — auto-start monitoring immediately</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setImportAll(false)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${!importAll ? "border-primary bg-primary" : "border-border"}`}
              >
                {!importAll && <span className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Review individually</p>
                <p className="text-xs text-muted-foreground">Choose which devices to import one by one</p>
              </div>
            </label>
          </div>
        </>
      )}

      {scanning && (
        <div className="space-y-2">
          {["Passive ARP table scan…", "mDNS service browse…", "ICMP ping sweep…", "Port scan (top 20)…", "MAC OUI lookup…"].map((phase) => (
            <div key={phase} className="flex items-center gap-3 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin text-cyan-400 flex-shrink-0" />
              {phase}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step4Done({ vesselName }) {
  const localIp = "192.168.10.1";
  const mobileUrl = `http://${localIp}:5173/mobile`;

  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto">
        <CheckCircle2 size={32} className="text-green-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Wave Guard is Ready</h2>
        <p className="text-sm text-muted-foreground mt-1">{vesselName || "Your vessel"} is now being monitored.</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Devices Monitored", value: "20" },
          { label: "Alerts Configured", value: "8" },
          { label: "Uptime", value: "100%" },
        ].map(s => (
          <div key={s.label} className="bg-secondary/50 border border-border/50 rounded-xl p-3">
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-secondary/50 border border-border/50 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
          <Globe size={14} />
          <span>Mobile Access URL</span>
        </div>
        <p className="font-mono text-xs text-cyan-400 break-all">{mobileUrl}</p>
        <div className="w-28 h-28 mx-auto bg-white rounded-xl flex items-center justify-center">
          <div className="grid grid-cols-5 gap-0.5">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className={`w-3 h-3 ${Math.random() > 0.5 ? "bg-black" : "bg-white"}`} />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Scan QR code on phone or tablet</p>
      </div>
    </div>
  );
}

export default function FirstBootWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [vesselInfo, setVesselInfo] = useState({ name: "M/Y Horizon", owner: "", homePort: "Monaco, MC", mmsi: "" });
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [importAll, setImportAll] = useState(true);

  const handleVesselChange = (key, val) => setVesselInfo(v => ({ ...v, [key]: val }));

  const handleNext = async () => {
    if (step === 2 && !scanComplete) {
      setScanning(true);
      await new Promise(r => setTimeout(r, 3000));
      setScanning(false);
      setScanComplete(true);
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      navigate("/");
    }
  };

  const canNext = () => {
    if (step === 2 && scanning) return false;
    return true;
  };

  const nextLabel = () => {
    if (step === 2 && !scanComplete) return "Start Discovery";
    if (step === STEPS.length - 1) return "Go to Dashboard";
    return "Continue";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-primary font-bold text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Wifi size={16} className="text-primary" />
            </div>
            Wave Guard
          </div>
          <p className="text-xs text-muted-foreground mt-1">Appliance setup</p>
        </div>

        <StepIndicator currentStep={step} />

        <div className="glass rounded-2xl p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && <Step1Network subnets={MOCK_SUBNETS} />}
              {step === 1 && <Step2Vessel vesselInfo={vesselInfo} onChange={handleVesselChange} />}
              {step === 2 && (
                <Step3Discovery
                  scanning={scanning}
                  results={MOCK_DISCOVERY}
                  onScan={() => {}}
                  importAll={importAll}
                  setImportAll={setImportAll}
                />
              )}
              {step === 3 && <Step4Done vesselName={vesselInfo.name} />}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-8">
            {step > 0 && step < STEPS.length - 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canNext()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning && <Loader2 size={14} className="animate-spin" />}
              {nextLabel()}
              {!scanning && step < STEPS.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}