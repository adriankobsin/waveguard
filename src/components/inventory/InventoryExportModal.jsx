import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, FileSpreadsheet, Filter, Check } from "lucide-react";
import jsPDF from "jspdf";

const CATEGORIES = ["All", "Network", "Camera", "AV", "Power", "Control", "Other"];
const CONDITIONS = ["All", "Excellent", "Good", "Fair", "Poor", "Decommissioned"];

function exportCSV(items, label) {
  const headers = ["Name", "Model", "Category", "IP Address", "Location", "Serial", "Condition", "Notes"];
  const rows = items.map(e => [
    e.name, e.model, e.category, e.ip, e.location, e.serial, e.condition,
    (e.notes || "").replace(/,/g, ";"),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventory-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(items, label) {
  const doc = new jsPDF({ orientation: "landscape" });

  // Header
  doc.setFillColor(6, 182, 212); // cyan
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Wave Guard — Inventory Report", 10, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Filter: ${label}  |  Items: ${items.length}`, 10, 17);

  // Table header
  const cols = [
    { header: "Name",      x: 10,  w: 38 },
    { header: "Model",     x: 48,  w: 44 },
    { header: "Category",  x: 92,  w: 26 },
    { header: "IP",        x: 118, w: 34 },
    { header: "Location",  x: 152, w: 36 },
    { header: "Serial",    x: 188, w: 38 },
    { header: "Condition", x: 226, w: 26 },
    { header: "Notes",     x: 252, w: 40 },
  ];

  let y = 26;
  doc.setFillColor(20, 30, 50);
  doc.rect(8, y - 5, 281, 8, "F");
  doc.setTextColor(6, 182, 212);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  cols.forEach(c => doc.text(c.header, c.x, y));

  // Rows
  doc.setFont("helvetica", "normal");
  items.forEach((eq, i) => {
    y += 9;
    if (y > 190) { doc.addPage(); y = 18; }

    // Alternating row bg
    if (i % 2 === 0) {
      doc.setFillColor(12, 20, 36);
      doc.rect(8, y - 5.5, 281, 8, "F");
    }

    const condColor = {
      Excellent: [52, 211, 153],
      Good:      [6, 182, 212],
      Fair:      [251, 191, 36],
      Poor:      [239, 68, 68],
      Decommissioned: [100, 116, 139],
    }[eq.condition] || [148, 163, 184];

    doc.setTextColor(...condColor);
    doc.setFontSize(7.5);
    const vals = [eq.name, eq.model, eq.category, eq.ip, eq.location, eq.serial, eq.condition, eq.notes || "—"];
    cols.forEach((c, ci) => {
      doc.setTextColor(ci === 6 ? condColor[0] : 220, ci === 6 ? condColor[1] : 220, ci === 6 ? condColor[2] : 235);
      const text = String(vals[ci] ?? "");
      const truncated = doc.getTextWidth(text) > c.w - 2 ? text.slice(0, Math.floor((c.w - 2) / 1.9)) + "…" : text;
      doc.text(truncated, c.x, y);
    });
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${p} of ${pageCount}  ·  Wave Guard`, 10, 205);
  }

  doc.save(`inventory-${label}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function InventoryExportModal({ equipment, onClose }) {
  const [exportCat, setExportCat] = useState("All");
  const [exportCond, setExportCond] = useState("All");

  const filtered = equipment.filter(e => {
    const matchCat  = exportCat  === "All" || e.category  === exportCat;
    const matchCond = exportCond === "All" || e.condition === exportCond;
    return matchCat && matchCond;
  });

  const label = [exportCat !== "All" ? exportCat : null, exportCond !== "All" ? exportCond : null]
    .filter(Boolean).join("-") || "all";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-md bg-[#0a0f1c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/12 flex items-center justify-center">
                <Download size={14} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Export Inventory</p>
                <p className="text-xs text-slate-500">Choose filters, then download</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Category filter */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Filter size={10} /> Filter by Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setExportCat(cat)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      exportCat === cat
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                        : "bg-white/4 border-white/8 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {exportCat === cat && <Check size={10} />}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Condition filter */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Filter size={10} /> Filter by Condition
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONDITIONS.map(cond => {
                  const colors = {
                    All:            "bg-cyan-500/20 border-cyan-500/40 text-cyan-400",
                    Excellent:      "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
                    Good:           "bg-cyan-500/20 border-cyan-500/40 text-cyan-400",
                    Fair:           "bg-amber-500/20 border-amber-500/40 text-amber-400",
                    Poor:           "bg-red-500/20 border-red-500/40 text-red-400",
                    Decommissioned: "bg-slate-500/20 border-slate-500/40 text-slate-400",
                  };
                  return (
                    <button
                      key={cond}
                      onClick={() => setExportCond(cond)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                        exportCond === cond ? colors[cond] : "bg-white/4 border-white/8 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {exportCond === cond && <Check size={10} />}
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview count */}
            <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Items matching filters</span>
              <span className="text-sm font-bold text-white">{filtered.length} <span className="text-xs font-normal text-slate-500">of {equipment.length}</span></span>
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { exportCSV(filtered, label); onClose(); }}
                disabled={filtered.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet size={15} />
                Export CSV
              </button>
              <button
                onClick={() => { exportPDF(filtered, label); onClose(); }}
                disabled={filtered.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={15} />
                Export PDF
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}