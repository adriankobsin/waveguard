import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Search, Loader2,
  FileSpreadsheet, File, X, BookOpen, Download,
  FolderOpen, Brain, Globe, Trash2
} from "lucide-react";

const API_BASE = "/api/apps/mock-app";

const FILE_ICONS = {
  pdf: { icon: FileText, color: "text-red-400", bg: "bg-red-500/10" },
  docx: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
  xlsx: { icon: FileSpreadsheet, color: "text-green-400", bg: "bg-green-500/10" },
  csv: { icon: FileSpreadsheet, color: "text-green-300", bg: "bg-green-500/10" },
};

const CATEGORIES = [
  "Manuals",
  "Schematics",
  "Configuration",
  "Reports",
  "Cable Schedules",
  "Inventory",
  "Compliance",
  "Other",
];

function FileIcon({ ext }) {
  const cfg = FILE_ICONS[ext?.toLowerCase()] || { icon: File, color: "text-muted-foreground", bg: "bg-secondary" };
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
      <cfg.icon size={16} className={cfg.color} />
    </div>
  );
}

export default function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [uploadMeta, setUploadMeta] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(null);
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/entities/Document`);
      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults(null);
    await new Promise(r => setTimeout(r, 900));
    const filtered = docs.filter(d =>
      d.name.toLowerCase().includes(query.toLowerCase()) &&
      (categoryFilter === "all" || d.category === categoryFilter)
    );
    setResults(filtered.length > 0 ? filtered : []);
    setSearching(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    promptUploadMeta(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    promptUploadMeta(file);
    e.target.value = "";
  };

  const promptUploadMeta = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    setUploadMeta({
      file,
      ext,
      name: file.name,
      category: "Other",
      platformAccess: true,
      aiAgentAccess: true,
    });
  };

  const confirmUpload = async () => {
    if (!uploadMeta) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadMeta.file);
      fd.append("category", uploadMeta.category);
      fd.append("platformAccess", String(uploadMeta.platformAccess));
      fd.append("aiAgentAccess", String(uploadMeta.aiAgentAccess));
      const res = await fetch(`${API_BASE}/functions/documentUpload`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.document) {
          setDocs(prev => [data.document, ...prev]);
        }
      }
      setUploadMeta(null);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const updateDoc = async (id, updates) => {
    setSaving(id);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    try {
      const res = await fetch(`${API_BASE}/entities/Document/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    } catch (err) {
      console.error("Failed to update document:", err);
      loadDocuments();
    } finally {
      setSaving(null);
    }
  };

  const deleteDoc = async (id) => {
    setDocs(prev => prev.filter(d => d.id !== id));
    try {
      const res = await fetch(`${API_BASE}/entities/Document/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    } catch (err) {
      console.error("Failed to delete document:", err);
      loadDocuments();
    }
  };

  const categories = ["all", ...new Set(docs.map(d => d.category).filter(Boolean))];
  const filteredDocs = results !== null ? results : docs.filter(
    d => categoryFilter === "all" || d.category === categoryFilter
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <BookOpen size={22} className="text-cyan-400" />
          Documents
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload, categorise and manage documents for platform and AI agent access</p>
      </div>

      <form onSubmit={handleSearch} className="glass rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setResults(null); }}>
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {["hybrid", "keyword", "semantic"].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </form>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.csv" onChange={handleFileSelect} className="hidden" />
        <Upload size={20} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Click or drag & drop PDF, DOCX, XLSX, or CSV files here</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Files are saved permanently and accessible until deleted</p>
      </div>

      {results !== null && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {results.length === 0
              ? "No documents matched your query."
              : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}" (${mode})`}
          </p>
          <button onClick={() => setResults(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear search
          </button>
        </div>
      )}

      {docs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                categoryFilter === c
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "all" ? `All (${docs.length})` : c}
            </button>
          ))}
        </div>
      )}

      <div className="glass rounded-xl divide-y divide-border/50">
        {docs.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <FolderOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs mt-1 opacity-70">Upload PDFs, DOCX, XLSX or CSV files to get started</p>
          </div>
        )}
        <AnimatePresence>
          {filteredDocs.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors"
            >
              <FileIcon ext={doc.ext} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.size} · Uploaded {doc.uploaded ? new Date(doc.uploaded).toLocaleDateString() : "unknown"}
                  {doc.pages && ` · ${doc.pages} pages`}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <select
                    value={doc.category}
                    onChange={e => updateDoc(doc.id, { category: e.target.value })}
                    className="text-[11px] bg-secondary border border-border rounded-lg px-2 py-0.5 text-muted-foreground focus:outline-none cursor-pointer"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => updateDoc(doc.id, { platformAccess: !doc.platformAccess })}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                      doc.platformAccess
                        ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-400"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Globe size={10} />
                    Platform
                  </button>
                  <button
                    onClick={() => updateDoc(doc.id, { aiAgentAccess: !doc.aiAgentAccess })}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                      doc.aiAgentAccess
                        ? "border-violet-500/40 bg-violet-500/12 text-violet-400"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Brain size={10} />
                    AI Agent
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    download={doc.name}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Download size={14} />
                  </a>
                )}
                <button
                  onClick={() => deleteDoc(doc.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {docs.length > 0 && filteredDocs.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <FileText size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents match the current filter.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {uploadMeta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-sm font-bold text-foreground mb-4">Document settings</h3>
              <p className="text-xs text-muted-foreground mb-4 truncate">{uploadMeta.name}</p>

              <label className="text-xs font-medium text-foreground block mb-1.5">Category</label>
              <select
                value={uploadMeta.category}
                onChange={e => setUploadMeta(m => ({ ...m, category: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40 mb-4"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div className="space-y-3 mb-6">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-emerald-400" />
                    <span className="text-sm text-foreground">Platform access</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadMeta(m => ({ ...m, platformAccess: !m.platformAccess }))}
                    className={`relative w-9 h-5 rounded-full transition-colors ${uploadMeta.platformAccess ? "bg-emerald-500" : "bg-secondary"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${uploadMeta.platformAccess ? "translate-x-4" : ""}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-violet-400" />
                    <span className="text-sm text-foreground">AI Agent access</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadMeta(m => ({ ...m, aiAgentAccess: !m.aiAgentAccess }))}
                    className={`relative w-9 h-5 rounded-full transition-colors ${uploadMeta.aiAgentAccess ? "bg-violet-500" : "bg-secondary"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${uploadMeta.aiAgentAccess ? "translate-x-4" : ""}`} />
                  </button>
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setUploadMeta(null)}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold hover:bg-cyan-400 transition-colors disabled:opacity-60"
                >
                  {uploading && <Loader2 size={12} className="animate-spin" />}
                  {uploading ? "Uploading…" : "Add document"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
