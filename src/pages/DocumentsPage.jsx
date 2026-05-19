import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Search, Loader2,
  FileSpreadsheet, File, X, BookOpen, Download
} from "lucide-react";

const FILE_ICONS = {
  pdf: { icon: FileText, color: "text-red-400", bg: "bg-red-500/10" },
  docx: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
  xlsx: { icon: FileSpreadsheet, color: "text-green-400", bg: "bg-green-500/10" },
  csv: { icon: FileSpreadsheet, color: "text-green-300", bg: "bg-green-500/10" },
};

function FileIcon({ ext }) {
  const cfg = FILE_ICONS[ext?.toLowerCase()] || { icon: File, color: "text-muted-foreground", bg: "bg-secondary" };
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
      <cfg.icon size={16} className={cfg.color} />
    </div>
  );
}

const MOCK_DOCS = [
  { id: "1", name: "Dahua IP Camera PoE Guide.pdf", ext: "pdf", size: "2.1 MB", uploaded: "3 days ago", pages: 42 },
  { id: "2", name: "Crestron NVX Configuration.docx", ext: "docx", size: "850 KB", uploaded: "1 week ago", pages: 18 },
  { id: "3", name: "Equipment Inventory - M_Y Horizon.xlsx", ext: "xlsx", size: "340 KB", uploaded: "2 weeks ago", pages: null },
  { id: "4", name: "Wiring Schedule v3.csv", ext: "csv", size: "120 KB", uploaded: "1 month ago", pages: null },
  { id: "5", name: "VSAT Installation Manual.pdf", ext: "pdf", size: "5.6 MB", uploaded: "1 month ago", pages: 88 },
];

export default function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [docs, setDocs] = useState(MOCK_DOCS);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults(null);
    // Simulate semantic/keyword search
    await new Promise(r => setTimeout(r, 900));
    const filtered = docs.filter(d =>
      d.name.toLowerCase().includes(query.toLowerCase())
    );
    setResults(filtered.length > 0 ? filtered : []);
    setSearching(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    setDocs(prev => [{
      id: Date.now().toString(),
      name: file.name,
      ext,
      size: `${(file.size / 1024).toFixed(0)} KB`,
      uploaded: "just now",
      pages: null,
    }, ...prev]);
  };

  const displayDocs = results !== null ? results : docs;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <BookOpen size={22} className="text-cyan-400" />
          Documents
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload, search and reference technical documents with AI-assisted citations</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="glass rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documents… (semantic + keyword)"
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

      {/* Upload Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
      >
        <Upload size={20} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Drag & drop PDF, DOCX, XLSX, or CSV files here</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Text is extracted and indexed for search</p>
      </div>

      {/* Search results notice */}
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

      {/* Document List */}
      <div className="glass rounded-xl divide-y divide-border/50">
        {displayDocs.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <FileText size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents found.</p>
          </div>
        )}
        <AnimatePresence>
          {displayDocs.map((doc, i) => (
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
                  {doc.size} · Uploaded {doc.uploaded}
                  {doc.pages && ` · ${doc.pages} pages`}
                </p>
              </div>
              <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                <Download size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}