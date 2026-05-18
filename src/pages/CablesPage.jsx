import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cable, Plus, Search, Pencil, Trash2, X, Check } from "lucide-react";

const CABLE_TYPES = ["Cat6", "Cat6A", "Cat7", "Fibre OM3", "Fibre OM4", "HDMI 2.0", "HDMI 2.1", "SDI", "DMX", "Power IEC", "Power CEE", "Coax RG6", "USB-C", "RS232"];

const INITIAL_CABLES = [
  { id: "1", label: "C-001", from: "SW-Bridge (Port 1)", to: "Router-WAN", type: "Cat6A", notes: "Primary uplink" },
  { id: "2", label: "C-002", from: "SW-Bridge (Port 12)", to: "Cam-Bridge-01", type: "Cat6", notes: "PoE camera" },
  { id: "3", label: "C-003", from: "AV-Matrix-Saloon", to: "TV-Saloon-Main", type: "HDMI 2.1", notes: "4K signal" },
  { id: "4", label: "C-004", from: "SW-Deck-Lower (Port 4)", to: "AP-Deck-Aft", type: "Cat6A", notes: "" },
  { id: "5", label: "C-005", from: "UPS-Main", to: "Rack-Comms", type: "Power IEC", notes: "Protected feed" },
];

const EMPTY_CABLE = { label: "", from: "", to: "", type: "Cat6", notes: "" };

export default function CablesPage() {
  const [cables, setCables] = useState(INITIAL_CABLES);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | cable.id
  const [form, setForm] = useState(EMPTY_CABLE);

  const filtered = cables.filter(c =>
    [c.label, c.from, c.to, c.type, c.notes].some(v =>
      v.toLowerCase().includes(search.toLowerCase())
    )
  );

  const openNew = () => { setForm(EMPTY_CABLE); setEditing("new"); };
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); };
  const cancel = () => { setEditing(null); setForm(EMPTY_CABLE); };

  const save = () => {
    if (!form.label || !form.from || !form.to) return;
    if (editing === "new") {
      setCables(prev => [...prev, { ...form, id: Date.now().toString() }]);
    } else {
      setCables(prev => prev.map(c => c.id === editing ? { ...form, id: editing } : c));
    }
    cancel();
  };

  const remove = (id) => setCables(prev => prev.filter(c => c.id !== id));

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Cable size={22} className="text-cyan-400" />
            Cable Register
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">From/to equipment, cable type and label tracking</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Add Cable
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5 max-w-md">
        <Search size={14} className="text-muted-foreground flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search cables…"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {search && <button onClick={() => setSearch("")}><X size={12} className="text-muted-foreground" /></button>}
      </div>

      {/* Form (inline) */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-foreground">{editing === "new" ? "New Cable" : "Edit Cable"}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: "label", placeholder: "Label (C-006)" },
                { key: "from", placeholder: "From (device / port)" },
                { key: "to", placeholder: "To (device / port)" },
              ].map(f => (
                <input
                  key={f.key}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ))}
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CABLE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Notes (optional)"
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary col-span-2 md:col-span-2"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <Check size={13} /> Save
              </button>
              <button onClick={cancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-muted-foreground rounded-lg text-sm hover:text-foreground">
                <X size={13} /> Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[80px_1fr_1fr_100px_1fr_64px] text-xs text-muted-foreground uppercase tracking-wide px-4 py-2.5 border-b border-border/50">
          <span>Label</span><span>From</span><span>To</span><span>Type</span><span>Notes</span><span />
        </div>
        <div className="divide-y divide-border/50">
          <AnimatePresence>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No cables found.</div>
            )}
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-1 md:grid-cols-[80px_1fr_1fr_100px_1fr_64px] items-center gap-2 px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <span className="font-mono text-xs text-cyan-400 font-semibold">{c.label}</span>
                <span className="text-sm text-foreground">{c.from}</span>
                <span className="text-sm text-foreground">{c.to}</span>
                <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground w-fit">{c.type}</span>
                <span className="text-xs text-muted-foreground">{c.notes || "—"}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {cables.length} cable{cables.length !== 1 ? "s" : ""} registered · {filtered.length} shown
      </p>
    </div>
  );
}