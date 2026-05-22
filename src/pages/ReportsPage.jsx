import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Download, Loader2, CheckCircle2, AlertTriangle,
  BarChart3, Wrench, Bell, Package, WifiOff, Users, Cpu, Clock, FileDown
} from "lucide-react";

const REPORT_TYPES = [
  {
    key: "daily_health",
    label: "Daily Health",
    description: "Equipment status overview with online/offline counts, health score, and alarm summary.",
    icon: BarChart3,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    key: "weekly_maintenance",
    label: "Weekly Maintenance",
    description: "Maintenance-focused view: conditions, warranty dates, service history, and faulty equipment.",
    icon: Wrench,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    key: "alarms",
    label: "Alarms",
    description: "Full alarm log with severity, status, timestamps, and resolution notes.",
    icon: Bell,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  {
    key: "inventory",
    label: "Equipment",
    description: "Complete asset register: codes, serial numbers, MAC addresses, suppliers, and locations.",
    icon: Package,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    key: "offline_devices",
    label: "Offline Devices",
    description: "Devices currently unreachable — offline duration, failure counts, and last known contact.",
    icon: WifiOff,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    key: "client_summary",
    label: "Client Summary",
    description: "High-level overview for owners and management — system health percentages per category.",
    icon: Users,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    key: "engineer_technical",
    label: "Engineer Technical",
    description: "Detailed technical data: IPs, MACs, firmware, protocols, SNMP, polling stats, and recent critical events.",
    icon: Cpu,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    key: "events_log",
    label: "Events Log",
    description: "Full event history including cleared events — severity, module, timestamps, and cleared status.",
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
];

// Mock recent reports
const MOCK_RECENT = [
  { id: 1, label: "Daily Health",       format: "PDF", generatedAt: "2026-05-18 09:00", size: "142 KB" },
  { id: 2, label: "Equipment", format: "CSV", generatedAt: "2026-05-17 18:30", size: "38 KB" },
  { id: 3, label: "Alarms",             format: "PDF", generatedAt: "2026-05-17 08:00", size: "96 KB" },
  { id: 4, label: "Client Summary",     format: "PDF", generatedAt: "2026-05-16 09:00", size: "78 KB" },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState(null); // { key, format }
  const [generated, setGenerated] = useState({}); // key -> { pdf, csv } booleans
  const [recent, setRecent] = useState(MOCK_RECENT);
  const [error, setError] = useState(null);

  const generate = async (reportKey, format) => {
    const genKey = `${reportKey}_${format}`;
    setGenerating({ key: reportKey, format });
    setError(null);

    // Simulate generation
    await new Promise(r => setTimeout(r, 2000));

    const type = REPORT_TYPES.find(r => r.key === reportKey);
    const newEntry = {
      id: Date.now(),
      label: type.label,
      format,
      generatedAt: new Date().toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }),
      size: format === "PDF" ? `${Math.floor(Math.random() * 150 + 60)} KB` : `${Math.floor(Math.random() * 50 + 20)} KB`,
    };

    setRecent(prev => [newEntry, ...prev.slice(0, 9)]);
    setGenerated(prev => ({ ...prev, [genKey]: true }));
    setGenerating(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/12 flex items-center justify-center ring-1 ring-cyan-500/20">
            <FileText size={14} className="text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-11">
          Generate and download reports with real data from your equipment, alarms, and monitoring history.
        </p>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* Report cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {REPORT_TYPES.map((report, i) => {
          const isGeneratingThis = generating?.key === report.key;
          const pdfKey = `${report.key}_PDF`;
          const csvKey = `${report.key}_CSV`;

          return (
            <motion.div
              key={report.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4"
            >
              {/* Icon + title */}
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${report.bg}`}>
                  <report.icon size={16} className={report.color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{report.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto">
                {["PDF", "CSV"].map(fmt => {
                  const genKey = `${report.key}_${fmt}`;
                  const isThisGenerating = isGeneratingThis && generating?.format === fmt;
                  const isDone = generated[genKey];

                  return (
                    <button
                      key={fmt}
                      onClick={() => !isGeneratingThis && generate(report.key, fmt)}
                      disabled={!!generating}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl border transition-all disabled:opacity-50 ${
                        isDone
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-border"
                      }`}
                    >
                      {isThisGenerating ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : isDone ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <Download size={11} />
                      )}
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recent reports */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileDown size={14} className="text-cyan-400" />
          Recent reports
        </h3>
        <div className="space-y-2">
          {recent.map(r => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 text-xs py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`px-2 py-0.5 rounded-md font-mono font-semibold text-[10px] border ${
                  r.format === "PDF"
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}>
                  {r.format}
                </span>
                <span className="text-foreground font-medium truncate">{r.label}</span>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 text-muted-foreground">
                <span>{r.size}</span>
                <span>{r.generatedAt}</span>
                <button className="text-cyan-400 hover:text-cyan-300 transition-colors">
                  <Download size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}