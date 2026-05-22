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
} from "lucide-react";
import { extractLutronPdfText } from "@/lib/lighting/extractLutronPdfText";
import { parseLutronIntegrationReport } from "@/lib/lighting/parseLutronIntegrationReport";

const COUNT_TILES = [
  { key: "areas", label: "Areas", icon: Layers3, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "zones", label: "Loads", icon: Lightbulb, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "scenes", label: "Scenes", icon: Boxes, color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  { key: "devices", label: "Keypads", icon: Cpu, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
];

export default function LutronImportModal({ open, onClose, onImport }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setFile(null);
    setTextInput("");
    setParsing(false);
    setError(null);
    setParsed(null);
    setSaving(false);
  }

  async function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setParsed(null);
    setParsing(true);
    try {
      const text = await extractLutronPdfText(f);
      const data = parseLutronIntegrationReport(text, { fileName: f.name });
      setParsed(data);
      setTextInput(text);
    } catch (err) {
      console.error("[LutronImport] PDF parse failed:", err);
      setError(
        err?.message ||
          "Unable to read this PDF. Try pasting the report text instead."
      );
    } finally {
      setParsing(false);
    }
  }

  async function handleParseText() {
    setError(null);
    setParsed(null);
    setParsing(true);
    try {
      const data = parseLutronIntegrationReport(textInput, {
        fileName: file?.name || "Pasted text",
      });
      setParsed(data);
    } catch (err) {
      setError(err?.message || "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    setSaving(true);
    try {
      await onImport?.(parsed);
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
            if (!parsing && !saving) {
              reset();
              onClose?.();
            }
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
                    Import Lutron Integration Report
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Parse the report PDF exported by Lutron Designer to load
                    areas, zones, scenes and keypads.
                  </p>
                </div>
              </div>
              <button
                disabled={parsing || saving}
                onClick={() => {
                  reset();
                  onClose?.();
                }}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* File picker */}
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload size={22} className="mx-auto text-amber-400 mb-2" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  Drop or pick the Integration Report PDF
                </p>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Exported from Lutron Designer (works for HomeWorks QSX, Athena,
                  RadioRA 3).
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors"
                >
                  <FileText size={12} />
                  Choose file
                </button>
                {file && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    <FileText size={10} className="inline -mt-0.5 mr-1" />
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
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
                  rows={8}
                  placeholder={
                    "Paste the integration report content here, e.g.\nDevice name Model href Component...\nZone Name href..."
                  }
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

              {parsed && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 size={14} />
                    <span className="font-semibold">
                      Parsed {parsed.house.fileName}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COUNT_TILES.map((tile) => {
                      const Icon = tile.icon;
                      const value = parsed.house.counts?.[tile.key] ?? 0;
                      return (
                        <div
                          key={tile.key}
                          className={`rounded-lg border px-2.5 py-2 text-center ${tile.color}`}
                        >
                          <Icon size={14} className="mx-auto mb-1" />
                          <p className="text-base font-bold">{value}</p>
                          <p className="text-[9px] uppercase tracking-widest opacity-80">
                            {tile.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Buttons: {parsed.house.counts?.buttons || 0} · LEDs:{" "}
                    {parsed.house.counts?.leds || 0}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/30">
              <button
                disabled={parsing || saving}
                onClick={() => {
                  reset();
                  onClose?.();
                }}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={!parsed || saving}
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-amber-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                Import &amp; replace
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
