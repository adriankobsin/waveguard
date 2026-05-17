import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Activity, Filter, RefreshCw } from "lucide-react";
import DiagnosisCard from "../components/DiagnosisCard";

const MOCK_DIAGNOSES = [
  {
    id: "d1", equipmentName: "Cam-Bridge-01", severity: "critical",
    summary: "Camera unreachable — possible PoE failure",
    likelyCause: "The switch port supplying PoE power may have exceeded its wattage budget or the port has been disabled after a fault condition. This is a common issue with Dahua cameras drawing high power for IR illumination at night.",
    steps: ["Check PoE budget on SW-Bridge (port 12)", "Verify cable continuity with a cable tester", "Power cycle the switch port via SNMP", "If unresponsive, check camera locally"],
    suggestedAction: "snmp_port_bounce", requiresApproval: true, resolvedAt: null,
    relatedDocuments: [{ id: "doc1", name: "Dahua IP Camera PoE Guide", page: 14 }, { id: "doc2", name: "Cisco Switch SNMP Config", page: 8 }],
    createdAt: "2026-05-17T08:32:00Z"
  },
  {
    id: "d2", equipmentName: "SW-Deck-Lower", severity: "warning",
    summary: "High CPU load on deck switch (87%)",
    likelyCause: "Broadcast storm detected on VLAN 20. Possibly caused by a loop from a newly connected unmanaged switch without STP support. Check for unusual unicast flood on the port table.",
    steps: ["Check STP topology via SNMP walk", "Identify high-traffic source MAC on VLAN 20", "Isolate the offending port", "Verify STP is enabled on all VLANs"],
    suggestedAction: "check_config", requiresApproval: false, resolvedAt: null,
    relatedDocuments: [],
    createdAt: "2026-05-17T06:15:00Z"
  },
  {
    id: "d3", equipmentName: "UPS-Main", severity: "warning",
    summary: "UPS battery charge at 42% — verify AC input",
    likelyCause: "The main UPS unit shows prolonged discharging pattern. AC input power may have been interrupted for an extended period without returning to a healthy charge state. Battery may also need replacement if age >3 years.",
    steps: ["Verify AC mains input to UPS", "Check bypass panel in engine room", "Review UPS runtime log", "If AC OK, schedule battery replacement"],
    suggestedAction: "check_cable", requiresApproval: false, resolvedAt: null,
    relatedDocuments: [{ id: "doc3", name: "APC SmartUPS Manual", page: 22 }],
    createdAt: "2026-05-16T14:20:00Z"
  },
  {
    id: "d4", equipmentName: "AV-Proc-Saloon", severity: "info",
    summary: "Q-SYS Core recovered after reboot",
    likelyCause: "The AV processor rebooted unexpectedly at 02:14. Likely cause: firmware memory fault on the DSP module. System recovered automatically. No user intervention needed unless recurring.",
    steps: ["Review Q-SYS Administrator log", "Check DSP module firmware version", "Schedule firmware update during next port call"],
    suggestedAction: "none", requiresApproval: false, resolvedAt: "2026-05-17T02:20:00Z",
    relatedDocuments: [{ id: "doc4", name: "Q-SYS Core 510 Admin Guide", page: 31 }],
    createdAt: "2026-05-17T02:15:00Z"
  },
];

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

export default function DiagnosesPage() {
  const [filter, setFilter] = useState("all");
  const [diagnoses, setDiagnoses] = useState(MOCK_DIAGNOSES);

  const handleDismiss = (id) => setDiagnoses(ds => ds.filter(d => d.id !== id));
  const handleApprove = (id) => setDiagnoses(ds => ds.map(d => d.id === id ? { ...d, approved: true } : d));

  const filtered = diagnoses
    .filter(d => {
      if (filter === "active") return !d.resolvedAt;
      if (filter === "resolved") return !!d.resolvedAt;
      return true;
    })
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const counts = {
    active: diagnoses.filter(d => !d.resolvedAt).length,
    critical: diagnoses.filter(d => d.severity === "critical" && !d.resolvedAt).length,
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity size={22} className="text-primary" />
            AI Diagnoses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.active} active · {counts.critical > 0 ? (
              <span className="text-red-400">{counts.critical} critical</span>
            ) : "no critical issues"}
          </p>
        </div>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors border border-border rounded-xl px-3 py-2">
          <RefreshCw size={14} />
          Run Diagnosis
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-secondary rounded-xl p-1 w-fit gap-1">
        {[
          { key: "all", label: "All" },
          { key: "active", label: `Active (${counts.active})` },
          { key: "resolved", label: "Resolved" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Diagnosis Cards */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((d, i) => (
            <motion.div
              key={d.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.04 }}
            >
              <DiagnosisCard
                diagnosis={d}
                onDismiss={() => handleDismiss(d.id)}
                onApprove={() => handleApprove(d.id)}
                expanded
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <CheckIcon />
            <p className="text-foreground font-medium mt-4">No diagnoses</p>
            <p className="text-sm text-muted-foreground mt-1">Everything is running normally.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <div className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center mx-auto">
      <AlertTriangle size={24} className="text-green-400" />
    </div>
  );
}