import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Cable, Plus, Search, Pencil, Trash2, X, Check, Network, ChevronDown, ChevronRight, Upload, Loader2, AlertTriangle, CheckCircle2, GitBranch, Sparkles, Filter } from "lucide-react";
import SnmpPortMapPanel from "../components/snmp/SnmpPortMapPanel";
import PatchPanelSchedulePanel from "../components/cables/PatchPanelSchedulePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import BulkActionBar from "@/components/shared/BulkActionBar";
import BulkEditModal from "@/components/shared/BulkEditModal";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const CABLE_TYPES = ["Cat6", "Cat6A", "Cat7", "Fibre OM3", "Fibre OM4", "HDMI 2.0", "HDMI 2.1", "SDI", "DMX", "Power IEC", "Power CEE", "Coax RG6", "USB-C", "RS232"];
const SYSTEM_CATEGORIES = ["Network", "AV", "CCTV", "Power", "Comms", "Lighting", "Other"];
const STATUS_OPTIONS = ["installed", "planned", "spare", "removed"];

const EMPTY_FORM = { label: "", type: "Cat6", system_category: "", from_equipment: "", to_equipment: "", length: "", deck: "", status: "installed", notes: "" };

function statusColor(status) {
  if (status === "installed") return "text-emerald-400 bg-emerald-500/10";
  if (status === "planned") return "text-sky-400 bg-sky-500/10";
  if (status === "spare") return "text-amber-400 bg-amber-500/10";
  if (status === "removed") return "text-red-400 bg-red-500/10";
  return "text-slate-400 bg-slate-500/10";
}

function CableFormPanel({ form, setForm, onSave, onCancel, isEditing }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass rounded-xl p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-foreground">{isEditing ? "Edit Cable" : "New Cable"}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Label (C-006) *" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={form.from_equipment} onChange={e => setForm(f => ({ ...f, from_equipment: e.target.value }))} placeholder="From device" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={form.to_equipment} onChange={e => setForm(f => ({ ...f, to_equipment: e.target.value }))} placeholder="To device" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          {CABLE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={form.system_category} onChange={e => setForm(f => ({ ...f, system_category: e.target.value }))} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">System category…</option>
          {SYSTEM_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <input value={form.length} onChange={e => setForm(f => ({ ...f, length: e.target.value }))} placeholder="Length (e.g. 12m)" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={form.deck} onChange={e => setForm(f => ({ ...f, deck: e.target.value }))} placeholder="Deck / location" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary md:col-span-4" />
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"><Check size={13} /> Save</button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-muted-foreground rounded-lg text-sm hover:text-foreground"><X size={13} /> Cancel</button>
      </div>
    </motion.div>
  );
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, "_"));
  return lines.slice(1).map((line, i) => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
    return {
      rowIndex: i + 2,
      label: row.label || row.cable_label || row.id || "",
      type: row.type || row.cable_type || "",
      system_category: row.system_category || row.system || row.category || "",
      from_equipment: row.from_equipment || row.from || row.source || "",
      to_equipment: row.to_equipment || row.to || row.destination || "",
      length: row.length || "",
      deck: row.deck || row.location || "",
      status: row.status || "installed",
      notes: row.notes || row.note || "",
      include: true,
      warnings: !row.label && !row.cable_label ? ["Missing label"] : [],
    };
  }).filter(r => r.label);
}

function ImportModal({ onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const downloadTemplate = () => {
    const csv = "label,type,system_category,from_equipment,to_equipment,length,deck,status,notes\nC-001,Cat6A,Network,Router-WAN,SW-Bridge,12m,Bridge Deck,installed,Primary uplink\n";
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "cable_template.csv";
    a.click();
  };

  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    setParseErrors([]);
    setRows(null);
    try {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      if (isExcel) {
        // Upload then extract via AI
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              cables: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    type: { type: "string" },
                    system_category: { type: "string" },
                    from_equipment: { type: "string" },
                    to_equipment: { type: "string" },
                    length: { type: "string" },
                    deck: { type: "string" },
                    status: { type: "string" },
                    notes: { type: "string" }
                  }
                }
              }
            }
          }
        });
        if (result.status !== "success") throw new Error(result.details || "Extraction failed");
        const extracted = (result.output?.cables || result.output || []);
        const parsed = extracted.filter(r => r.label).map((r, i) => ({
          rowIndex: i + 2,
          label: r.label || "",
          type: r.type || "",
          system_category: r.system_category || "",
          from_equipment: r.from_equipment || "",
          to_equipment: r.to_equipment || "",
          length: r.length || "",
          deck: r.deck || "",
          status: r.status || "installed",
          notes: r.notes || "",
          include: true,
          warnings: [],
        }));
        if (parsed.length === 0) { setParseErrors(["No cable rows found in the Excel file."]); }
        else setRows(parsed);
      } else {
        const text = await file.text();
        const parsed = parseCSV(text);
        if (parsed.length === 0) { setParseErrors(["No valid rows found. Check the CSV format."]); }
        else setRows(parsed);
      }
    } catch (err) {
      setParseErrors([err.message]);
    } finally {
      setBusy(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!rows) return;
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const cableList = rows.filter(r => r.include).slice(0, 30).map(r =>
        `${r.label}: ${r.from_equipment} → ${r.to_equipment} (${r.type}, ${r.deck || "unknown deck"})`
      ).join("\n");

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a network/AV infrastructure engineer reviewing a cable schedule. 
For each cable below, suggest the likely intermediate path through switches and patch panels based on the device names and deck locations. 
Use typical marine/commercial vessel AV infrastructure topology assumptions.
Return a JSON object where each key is the cable label and the value is an object with:
- "path": array of device names in order from source to destination (include likely patch panels/switches in between)
- "confidence": "high" | "medium" | "low"  
- "notes": brief note about the path assumption

Cables:
${cableList}`,
        response_json_schema: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              path: { type: "array", items: { type: "string" } },
              confidence: { type: "string" },
              notes: { type: "string" }
            }
          }
        }
      });
      setAiSuggestions(typeof result === "object" && result !== null && !Array.isArray(result) ? result : {});
    } catch (e) {
      setAiSuggestions({ error: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!rows) return;
    setCommitBusy(true);
    const included = rows.filter(r => r.include && r.label.trim());
    let imported = 0;
    const errors = [];
    for (const r of included) {
      try {
        await base44.entities.Cable.create({
          label: r.label.trim(),
          type: r.type || null,
          system_category: r.system_category || null,
          from_equipment: r.from_equipment || null,
          to_equipment: r.to_equipment || null,
          length: r.length || null,
          deck: r.deck || null,
          status: r.status || "installed",
          notes: r.notes || null,
        });
        imported++;
      } catch (err) {
        errors.push(`Row ${r.rowIndex}: ${err.message}`);
      }
    }
    setResult({ imported, errors });
    setCommitBusy(false);
    if (imported > 0) {
      setTimeout(() => { onComplete(); }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Import Cable Schedule</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {!rows && !result && (
          <div className="space-y-4">
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-cyan-400 hover:bg-white/5 transition-colors">
              Download CSV Template (also accepts .xlsx)
            </button>
            <div className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center">
              <Upload size={24} className="mx-auto text-slate-500 mb-2" />
              <p className="text-sm text-slate-400 mb-3">Select a CSV or Excel file</p>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} className="block mx-auto text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-cyan-500/15 file:text-cyan-400 hover:file:bg-cyan-500/25" />
            </div>
            {parseErrors.map((e, i) => <p key={i} className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12} />{e}</p>)}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handlePreview} disabled={!file || busy} className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Preview
              </button>
            </div>
          </div>
        )}

        {rows && !result && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">{rows.length} rows found — review before importing:</p>
            <div className="overflow-x-auto max-h-60 rounded-lg border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0d1424]">
                  <tr className="text-left text-slate-500 border-b border-white/10">
                    <th className="px-3 py-2">✓</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2">Deck</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-white/5 ${r.warnings.length ? "bg-amber-500/5" : ""}`}>
                      <td className="px-3 py-1.5"><input type="checkbox" checked={r.include} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))} /></td>
                      <td className="px-3 py-1.5 text-cyan-400 font-mono">{r.label}</td>
                      <td className="px-3 py-1.5 text-slate-300">{r.type || "—"}</td>
                      <td className="px-3 py-1.5 text-slate-300">{r.from_equipment || "—"}</td>
                      <td className="px-3 py-1.5 text-slate-300">{r.to_equipment || "—"}</td>
                      <td className="px-3 py-1.5 text-slate-400">{r.deck || "—"}</td>
                      <td className="px-3 py-1.5 text-slate-400">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AI Path Suggestions */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-purple-400" />
                  <span className="text-xs font-semibold text-purple-300">AI Path Suggestions</span>
                  <span className="text-[10px] text-slate-500">Suggests intermediate hops (switches, patch panels)</span>
                </div>
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-xs font-medium transition-all disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  {aiLoading ? "Analysing…" : "Analyse Paths"}
                </button>
              </div>

              {aiSuggestions && !aiSuggestions.error && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(aiSuggestions).map(([label, suggestion]) => {
                    const confidenceColor = suggestion.confidence === "high" ? "text-emerald-400" : suggestion.confidence === "medium" ? "text-amber-400" : "text-red-400";
                    return (
                      <div key={label} className="bg-[#0d1424] rounded-lg p-2.5 border border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-cyan-400">{label}</span>
                          <span className={`text-[10px] font-medium ${confidenceColor}`}>{suggestion.confidence}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mb-1">
                          {(suggestion.path || []).map((node, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${idx === 0 || idx === suggestion.path.length - 1 ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-white/4 text-slate-400"}`}>
                                {node}
                              </span>
                              {idx < suggestion.path.length - 1 && <span className="text-slate-600 text-[10px]">→</span>}
                            </div>
                          ))}
                        </div>
                        {suggestion.notes && <p className="text-[10px] text-slate-500 italic">{suggestion.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {aiSuggestions?.error && (
                <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> {aiSuggestions.error}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setRows(null); setAiSuggestions(null); }} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-slate-400 hover:text-white transition-colors">Back</button>
              <button onClick={handleCommit} disabled={commitBusy || rows.filter(r => r.include).length === 0} className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {commitBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                Import {rows.filter(r => r.include).length} cables
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
            <p className="text-white font-semibold">Imported {result.imported} cables</p>
            {result.errors.length > 0 && <div className="text-xs text-red-400 text-left space-y-1">{result.errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function CablesPage() {
  const navigate = useNavigate();
  const [cables, setCables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [snmpOpen, setSnmpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [systemFilter, setSystemFilter] = useState("All");
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("register");
  const bulk = useBulkSelection();

  const viewOnTopology = (cable) => {
    const params = new URLSearchParams({
      cableLabel: cable.label,
      from: cable.from_equipment || "",
      to: cable.to_equipment || "",
    });
    navigate(`/topology?${params.toString()}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Cable.list("label", 500);
      setCables(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cables.filter(c => {
    const matchSearch = !search.trim() || [c.label, c.from_equipment, c.to_equipment, c.type, c.deck, c.notes, c.system_category]
      .filter(Boolean).some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    const matchSystem = systemFilter === "All" || c.system_category === systemFilter;
    return matchSearch && matchStatus && matchSystem;
  });

  const filteredIds = filtered.map((c) => c.id);

  const CABLE_BULK_FIELDS = [
    { key: "type", label: "Cable type", type: "select", options: CABLE_TYPES },
    { key: "system_category", label: "System category", type: "select", options: SYSTEM_CATEGORIES },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { key: "deck", label: "Deck / location", type: "text" },
    { key: "notes", label: "Notes", type: "text" },
  ];

  const handleBulkEdit = async (patch) => {
    const items = cables.filter((c) => bulk.selectedIds.has(c.id));
    for (const item of items) {
      await base44.entities.Cable.update(item.id, { ...item, ...patch });
    }
    bulk.clear();
    setBulkEditOpen(false);
    load();
    toast.success(`Updated ${items.length} cable${items.length !== 1 ? "s" : ""}`);
  };

  const handleBulkDelete = async () => {
    const ids = [...bulk.selectedIds];
    for (const id of ids) {
      await base44.entities.Cable.delete(id);
    }
    bulk.clear();
    setBulkDeleteOpen(false);
    load();
    toast.success(`Deleted ${ids.length} cable${ids.length !== 1 ? "s" : ""}`);
  };

  const openNew = () => { setForm({ ...EMPTY_FORM }); setEditing("new"); };
  const openEdit = (c) => {
    setForm({ label: c.label, type: c.type || "Cat6", system_category: c.system_category || "", from_equipment: c.from_equipment || "", to_equipment: c.to_equipment || "", length: c.length || "", deck: c.deck || "", status: c.status || "installed", notes: c.notes || "" });
    setEditing(c.id);
  };
  const cancel = () => { setEditing(null); setForm({ ...EMPTY_FORM }); };

  const save = async () => {
    if (!form.label.trim()) return;
    const payload = { ...form, label: form.label.trim() };
    if (editing === "new") {
      await base44.entities.Cable.create(payload);
    } else {
      await base44.entities.Cable.update(editing, payload);
    }
    cancel();
    load();
  };

  const remove = async (id) => {
    await base44.entities.Cable.delete(id);
    setDeleteId(null);
    load();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      <AnimatePresence>
        {importOpen && <ImportModal onClose={() => setImportOpen(false)} onComplete={() => { setImportOpen(false); load(); }} />}
      </AnimatePresence>

      {/* Confirm delete (single) */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0d1424] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-white mb-1">Delete cable?</p>
              <p className="text-xs text-slate-400 mb-4">This will permanently remove &quot;{cables.find(c => c.id === deleteId)?.label}&quot;.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-slate-400 hover:text-white">Cancel</button>
                <button onClick={() => remove(deleteId)} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setBulkDeleteOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-foreground mb-1">Delete {bulk.count} cables?</p>
            <p className="text-xs text-muted-foreground mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkDeleteOpen(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleBulkDelete} className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}

      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        count={bulk.count}
        fields={CABLE_BULK_FIELDS}
        onApply={handleBulkEdit}
        title="Bulk edit cables"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Cable size={22} className="text-cyan-400" />
            Cables
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTab === "register"
              ? "Physical links between equipment — type, deck, status tracking"
              : "Patch panel port schedules by rack — cable tags, devices, and test records"}
          </p>
        </div>
        {activeTab === "register" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-secondary border border-border text-muted-foreground rounded-lg text-sm hover:text-foreground transition-colors">
              <Upload size={14} /> Import CSV / Excel
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus size={14} /> Add Cable
            </button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="register">Cable Register</TabsTrigger>
          <TabsTrigger value="patchPanels">Patch Panel Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="space-y-6 mt-0">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5 flex-1 max-w-md">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cables…" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
          {search && <button onClick={() => setSearch("")}><X size={12} className="text-muted-foreground" /></button>}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={13} className="text-muted-foreground mr-1" />
          <span className="text-[10px] text-muted-foreground uppercase mr-1">Status</span>
          {["All", ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase mr-1">System</span>
          {["All", ...SYSTEM_CATEGORIES].map(s => (
            <button key={s} onClick={() => setSystemFilter(s)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${systemFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>

      <BulkActionBar
        count={bulk.count}
        onEdit={() => setBulkEditOpen(true)}
        onDelete={() => setBulkDeleteOpen(true)}
        onClear={bulk.clear}
      />

      {/* Form */}
      <AnimatePresence>
        {editing && !bulk.count && (
          <CableFormPanel form={form} setForm={setForm} onSave={save} onCancel={cancel} isEditing={editing !== "new"} />
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        {loading && <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
        {!loading && (
          <>
            <div className="hidden md:grid grid-cols-[32px_80px_1fr_1fr_90px_100px_80px_80px_80px_100px] text-xs text-muted-foreground uppercase tracking-wide px-4 py-2.5 border-b border-border/50 items-center">
              <Checkbox checked={bulk.allSelected(filteredIds)} onCheckedChange={() => bulk.toggleAll(filteredIds)} aria-label="Select all" />
              <span>Label</span><span>From</span><span>To</span><span>Type</span><span>System</span><span>Length</span><span>Deck</span><span>Status</span><span />
            </div>
            <div className="divide-y divide-border/50">
              {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No cables found.</div>}
              {filtered.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`grid grid-cols-1 md:grid-cols-[32px_80px_1fr_1fr_90px_100px_80px_80px_80px_100px] items-center gap-2 px-4 py-3 hover:bg-secondary/30 transition-colors ${bulk.isSelected(c.id) ? "bg-primary/5" : ""}`}
                >
                  <Checkbox checked={bulk.isSelected(c.id)} onCheckedChange={() => bulk.toggle(c.id)} />
                  <span className="font-mono text-xs text-cyan-400 font-semibold">{c.label}</span>
                  <span className="text-sm text-foreground truncate">{c.from_equipment || "—"}</span>
                  <span className="text-sm text-foreground truncate">{c.to_equipment || "—"}</span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground w-fit">{c.type || "—"}</span>
                  <span className="text-xs text-slate-400">{c.system_category || "—"}</span>
                  <span className="text-xs text-slate-400">{c.length || "—"}</span>
                  <span className="text-xs text-slate-400">{c.deck || "—"}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${statusColor(c.status)}`}>{c.status || "—"}</span>
                  <div className="flex gap-1">
                    {(c.from_equipment || c.to_equipment) && (
                      <button
                        onClick={() => viewOnTopology(c)}
                        title="View path on topology map"
                        className="p-1.5 rounded hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-400 transition-colors"
                      >
                        <GitBranch size={13} />
                      </button>
                    )}
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {cables.length} cable{cables.length !== 1 ? "s" : ""} registered · {filtered.length} shown
      </p>

      {/* SNMP Port Map */}
      <div className="glass rounded-xl overflow-hidden">
        <button onClick={() => setSnmpOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors">
          <div className="flex items-center gap-2">
            <Network size={14} className="text-cyan-400" />
            <p className="text-sm font-semibold text-white">SNMP Port Map &amp; Cable Fault Detection</p>
            <span className="text-xs text-slate-500 border border-white/8 px-2 py-0.5 rounded-full">Live</span>
          </div>
          {snmpOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
        </button>
        <AnimatePresence>
          {snmpOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-border/50">
              <div className="p-4"><SnmpPortMapPanel /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
        </TabsContent>

        <TabsContent value="patchPanels" className="mt-0">
          <PatchPanelSchedulePanel onRefresh={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}