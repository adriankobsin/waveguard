import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lightbulb,
  Layers3,
  Boxes,
  Cpu,
  Table2,
} from "lucide-react";
import { extractLutronPdfText } from "@/lib/lighting/extractLutronPdfText";
import { parseLutronIntegrationReport } from "@/lib/lighting/parseLutronIntegrationReport";
import { parseLoadScheduleCsv } from "@/lib/lighting/parseLoadScheduleCsv";
import { normalizeLightingHouse } from "@/lib/lighting/lightingSettings";

const REPORT_TILES = [
  { key: "areas", label: "Areas", icon: Layers3, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "zones", label: "Loads", icon: Lightbulb, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "scenes", labels: "Scenes", icon: Boxes, color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  { key: "devices", label: "Keypads", icon: Cpu, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
];

const SCHEDULE_TILES = [
  { key: "total", label: "Scheduled loads", icon: Table2, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  { key: "panels", label: "Panels", icon: Layers3, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
];

export default function LutronImportModal({ open, onClose, onImport }) {
  const pdfInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const [reportFile, setReportFile] = useState(null);
  const [scheduleFile, setScheduleFile] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [parsedReport, setParsedReport] = useState(null);
  const [parsedSchedule, setParsedSchedule] = useState(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setReportFile(null);
    setScheduleFile(null);
    setTextInput("");
    setParsing(false);
    setError(null);
    setParsedReport(null);
    setParsedSchedule(null);
    setSaving(false);
  }

  async function handleReportFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReportFile(f);
    setError(null);
    setParsedReport(null);
    setParsing(true);
    try {
      const text = await extractLutronPdfText(f);
      const data = parseLutronIntegrationReport(text, { fileName: f.name });
      setParsedReport(data);
      setTextInput(text);
    } catch (err) {
      setError(err?.message || "Unable to read this PDF.");
    } finally {
      setParsing(false);
    }
  }

  function handleScheduleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setScheduleFile(f);
    setParsedSchedule(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const entries = parseLoadScheduleCsv(reader.result);
        const panels = new Set(entries.map((e) => e.panel).filter(Boolean));
        setParsedSchedule({ entries, panelCount: panels.size });
      } catch (err) {
        setError("Failed to parse load schedule: " + (err?.message || ""));
      }
    };
    reader.onerror = () => setError("Failed to read load schedule file.");
    reader.readAsText(f);
  }

  async function handleParseText() {
    setError(null);
    setParsedReport(null);
    setParsing(true);
    try {
      const data = parseLutronIntegrationReport(textInput, {
        fileName: reportFile?.name || "Pasted text",
      });
      setParsedReport(data);
    } catch (err) {
      setError(err?.message || "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!parsedReport && !parsedSchedule) return;
    setSaving(true);
    try {
      const merged = normalizeLightingHouse({
        ...(parsedReport || {}),
        loadSchedule: parsedSchedule?.entries || [],
        house: {
          ...((parsedReport || {}).house || {}),
          counts: {
            ...((parsedReport || {}).house?.counts || {}),
            scheduledLoads: parsedSchedule?.entries?.length || 0,
            panels: parsedSchedule?.panelCount || 0,
          },
        },
      });
      await onImport?.(merged);
      reset();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (!parsing && !saving) { reset(); onClose?.(); }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25 flex items-center justify-center">
                  <Lightbulb size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Import lighting data
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Import the Integration Report (PDF) and optionally the Load
                    Schedule (CSV) exported from Lutron Designer.
                  </p>
                </div>
              </div>
              <button
                disabled={parsing || saving}
                onClick={() => { reset(); onClose?.(); }}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Integration Report file picker */}
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-center">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf,.txt"
                  className="hidden"
                  onChange={handleReportFile}
                />
                <Upload size={18} className="mx-auto text-amber-400 mb-1.5" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  1. Integration Report
                </p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  PDF exported from Lutron Designer (zones, scenes, keypads).
                </p>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors"
                >
                  <FileText size={12} />
                  Choose report
                </button>
                {reportFile && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    <FileText size={10} className="inline -mt-0.5 mr-1" />
                    {reportFile.name} · {(reportFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>

              {/* Load Schedule CSV file picker */}
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-center">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleScheduleFile}
                />
                <Table2 size={18} className="mx-auto text-cyan-400 mb-1.5" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  2. Load Schedule (optional)
                </p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  CSV exported from Lutron Designer (panel assignments, load types, wattages).
                </p>
                <button
                  onClick={() => csvInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/25 transition-colors"
                >
                  <Table2 size={12} />
                  Choose schedule
                </button>
                {scheduleFile && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    <FileText size={10} className="inline -mt-0.5 mr-1" />
                    {scheduleFile.name} · {(scheduleFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>

              {/* Manual paste fallback */}
              <details className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
                <summary className="cursor-pointer text-foreground font-semibold py-1">
                  Or paste the report text manually
                </summary>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={6}
                  placeholder="Paste the integration report content here..."
                  className="mt-2 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-[11px] font-mono text-foreground"
                />
                <button
                  onClick={handleParseText}
                  disabled={!textInput.trim() || parsing}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {parsing ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                  Parse pasted text
                </button>
              </details>

              {parsing && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <Loader2 size={12} className="animate-spin" />
                  Parsing integration report…
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Integration report parse result */}
              {parsedReport && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 size={14} />
                    <span className="font-semibold">Integration report: {parsedReport.house.fileName}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {REPORT_TILES.map((tile) => {
                      const Icon = tile.icon;
                      const value = parsedReport.house.counts?.[tile.key] ?? 0;
                      return (
                        <div key={tile.key} className={`rounded-lg border px-2 py-1.5 text-center ${tile.color}`}>
                          <Icon size={13} className="mx-auto mb-0.5" />
                          <p className="text-sm font-bold">{value}</p>
                          <p className="text-[8px] uppercase tracking-widest opacity-80">{tile.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Load schedule parse result */}
              {parsedSchedule && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/8 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-cyan-400">
                    <CheckCircle2 size={14} />
                    <span className="font-semibold">Load schedule: {scheduleFile?.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SCHEDULE_TILES.map((tile) => {
                      const Icon = tile.icon;
                      const value = tile.key === "total" ? parsedSchedule.entries.length : parsedSchedule.panelCount;
                      return (
                        <div key={tile.key} className={`rounded-lg border px-2 py-1.5 text-center ${tile.color}`}>
                          <Icon size={13} className="mx-auto mb-0.5" />
                          <p className="text-sm font-bold">{value}</p>
                          <p className="text-[8px] uppercase tracking-widest opacity-80">{tile.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/30">
              <button
                disabled={parsing || saving}
                onClick={() => { reset(); onClose?.(); }}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={(!parsedReport && !parsedSchedule) || saving}
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-amber-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Import &amp; replace
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
