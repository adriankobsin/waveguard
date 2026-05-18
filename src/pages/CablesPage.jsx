import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cable, Plus, Search, Pencil, Trash2, X, Check, Network, ChevronDown, ChevronRight } from "lucide-react";
import SnmpPortMapPanel from "../components/snmp/SnmpPortMapPanel";

const CABLE_TYPES = ["Cat6", "Cat6A", "Cat7", "Fibre OM3", "Fibre OM4", "HDMI 2.0", "HDMI 2.1", "SDI", "DMX", "Power IEC", "Power CEE", "Coax RG6", "USB-C", "RS232"];

const INITIAL_CABLES = [
  { id: "c01", label: "C-001", from: "Router-WAN",      to: "SW-Bridge",         type: "Cat6A",     notes: "Primary WAN uplink" },
  { id: "c02", label: "C-002", from: "SW-Bridge",       to: "SW-Saloon",         type: "Cat6A",     notes: "Trunk" },
  { id: "c03", label: "C-003", from: "SW-Bridge",       to: "SW-Deck-Lower",     type: "Cat6A",     notes: "Trunk" },
  { id: "c04", label: "C-004", from: "SW-Bridge",       to: "SW-Engine",         type: "Cat6A",     notes: "Trunk" },
  { id: "c05", label: "C-005", from: "SW-Bridge",       to: "AP-Bridge",         type: "Cat6",      notes: "PoE" },
  { id: "c06", label: "C-006", from: "SW-Bridge",       to: "Cam-Bridge-01",     type: "Cat6",      notes: "PoE camera" },
  { id: "c07", label: "C-007", from: "SW-Bridge",       to: "Q-SYS Core",        type: "Cat6A",     notes: "" },
  { id: "c08", label: "C-008", from: "SW-Bridge",       to: "NAS-Synology",      type: "Cat6A",     notes: "" },
  { id: "c09", label: "C-009", from: "SW-Saloon",       to: "AP-Deck-Aft",       type: "Cat6",      notes: "PoE" },
  { id: "c10", label: "C-010", from: "SW-Saloon",       to: "Cam-Saloon-01",     type: "Cat6",      notes: "PoE camera" },
  { id: "c11", label: "C-011", from: "SW-Saloon",       to: "AV-Proc-Saloon",    type: "Cat6A",     notes: "" },
  { id: "c12", label: "C-012", from: "SW-Saloon",       to: "AV-Matrix-Saloon",  type: "Cat6A",     notes: "" },
  { id: "c13", label: "C-013", from: "SW-Saloon",       to: "UPS-AV",            type: "Cat6",      notes: "SNMP monitoring" },
  { id: "c14", label: "C-014", from: "SW-Deck-Lower",   to: "Cam-Deck-01",       type: "Cat6",      notes: "PoE camera" },
  { id: "c15", label: "C-015", from: "SW-Deck-Lower",   to: "Cam-Deck-02",       type: "Cat6",      notes: "PoE camera" },
  { id: "c16", label: "C-016", from: "UPS-Main",        to: "SW-Bridge",         type: "Power IEC", notes: "Protected feed" },
  { id: "c17", label: "C-017", from: "UPS-Main",        to: "Router-WAN",        type: "Power IEC", notes: "Protected feed" },
];

const EMPTY_CABLE = { label: "", from: "", to: "", type: "Cat6", notes: "" };

// SNMP-derived port status (keyed by "from" device name for quick lookup)
const SNMP_CABLE_STATUS = {
  "Cam-Bridge-01": "down",  // Port 6 on SW-Bridge is down
};

export default function CablesPage() {
  const [cables, setCables] = useState(INITIAL_CABLES);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | cable.id
  const [form, setForm] = useState(EMPTY_CABLE);
  const [snmpOpen, setSnmpOpen] = useState(false);

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
        <div className="hidden md:grid grid-cols-[16px_80px_1fr_1fr_100px_1fr_64px] text-xs text-muted-foreground uppercase tracking-wide px-4 py-2.5 border-b border-border/50">
          <span />
          <span>Label</span><span>From</span><span>To</span><span>Type</span><span>Notes</span><span />
        </div>
        <div className="divide-y divide-border/50">
          <AnimatePresence>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No cables found.</div>
            )}
            {filtered.map((c, i) => {
              // Check SNMP status for this cable's "to" device
              const toDevice = c.to.split(" ")[0];
              const fromDevice = c.from.split(" ")[0];
              const snmpStatus = SNMP_CABLE_STATUS[toDevice] || SNMP_CABLE_STATUS[fromDevice];
              const hasFault = snmpStatus === "down";
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`grid grid-cols-1 md:grid-cols-[16px_80px_1fr_1fr_100px_1fr_64px] items-center gap-2 px-4 py-3 hover:bg-secondary/30 transition-colors ${hasFault ? "bg-red-500/5" : ""}`}
                >
                  <span
                    title={hasFault ? "SNMP: port DOWN — cable fault detected" : "SNMP: OK"}
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${hasFault ? "bg-red-400 animate-pulse" : "bg-emerald-500/40"}`}
                  />
                  <span className="font-mono text-xs text-cyan-400 font-semibold">{c.label}</span>
                  <span className={`text-sm ${hasFault ? "text-red-300" : "text-foreground"}`}>{c.from}</span>
                  <span className={`text-sm ${hasFault ? "text-red-300" : "text-foreground"}`}>{c.to}</span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground w-fit">{c.type}</span>
                  <span className="text-xs text-muted-foreground">{hasFault ? "⚠ SNMP port DOWN" : c.notes || "—"}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(c.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {cables.length} cable{cables.length !== 1 ? "s" : ""} registered · {filtered.length} shown
      </p>

      {/* SNMP Port Map section */}
      <div className="glass rounded-xl overflow-hidden">
        <button
          onClick={() => setSnmpOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Network size={14} className="text-cyan-400" />
            <p className="text-sm font-semibold text-white">SNMP Port Map &amp; Cable Fault Detection</p>
            <span className="text-xs text-slate-500 border border-white/8 px-2 py-0.5 rounded-full">Live</span>
          </div>
          {snmpOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
        </button>
        <AnimatePresence>
          {snmpOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border/50"
            >
              <div className="p-4">
                <SnmpPortMapPanel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}