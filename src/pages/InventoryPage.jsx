import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Search, X, Filter, Pencil, Trash2,
  Wifi, Camera, Monitor, Zap, Server, HardDrive, Check
} from "lucide-react";

const CATEGORIES = ["All", "Network", "Camera", "AV", "Power", "Control", "Other"];
const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Decommissioned"];

const TYPE_ICONS = {
  Network: { icon: Wifi, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  Camera: { icon: Camera, color: "text-purple-400", bg: "bg-purple-500/10" },
  AV: { icon: Monitor, color: "text-blue-400", bg: "bg-blue-500/10" },
  Power: { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  Control: { icon: Server, color: "text-green-400", bg: "bg-green-500/10" },
  Other: { icon: HardDrive, color: "text-muted-foreground", bg: "bg-secondary" },
};

const INITIAL_EQUIPMENT = [
  { id: "1", name: "SW-Bridge", model: "Cisco CBS350-24T", category: "Network", ip: "192.168.10.1", condition: "Good", location: "Bridge Rack", serial: "FOC2241X0AB", notes: "Primary distribution switch" },
  { id: "2", name: "SW-Saloon", model: "Cisco CBS350-16T", category: "Network", ip: "192.168.10.2", condition: "Good", location: "Saloon Cabinet", serial: "FOC2241X0CD", notes: "" },
  { id: "3", name: "Cam-Bridge-01", model: "Dahua IPC-HDW3849H", category: "Camera", ip: "192.168.10.51", condition: "Fair", location: "Bridge Exterior", serial: "DH2023051201", notes: "PoE — requires port bounce" },
  { id: "4", name: "AV-Proc-Saloon", model: "Crestron NVX-350", category: "AV", ip: "192.168.10.22", condition: "Good", location: "Saloon AV Rack", serial: "CRE7462183", notes: "4K HDR matrix" },
  { id: "5", name: "UPS-Main", model: "APC Smart-UPS 3000VA", category: "Power", ip: "192.168.10.80", condition: "Good", location: "Engine Room", serial: "AS1720140893", notes: "Battery at 42%" },
  { id: "6", name: "Router-WAN", model: "MikroTik CCR2004-1G", category: "Network", ip: "192.168.1.1", condition: "Excellent", location: "Bridge Rack", serial: "MT220B0041", notes: "BGP + failover configured" },
];

const EMPTY = { name: "", model: "", category: "Network", ip: "", condition: "Good", location: "", serial: "", notes: "" };

function EquipmentIcon({ category }) {
  const cfg = TYPE_ICONS[category] || TYPE_ICONS.Other;
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
      <cfg.icon size={16} className={cfg.color} />
    </div>
  );
}

const CONDITION_COLORS = {
  Excellent: "text-green-400 bg-green-500/10",
  Good: "text-cyan-400 bg-cyan-500/10",
  Fair: "text-yellow-400 bg-yellow-500/10",
  Poor: "text-red-400 bg-red-500/10",
  Decommissioned: "text-muted-foreground bg-secondary",
};

export default function InventoryPage() {
  const [equipment, setEquipment] = useState(INITIAL_EQUIPMENT);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = equipment.filter(e => {
    const matchCat = category === "All" || e.category === category;
    const matchSearch = !search || [e.name, e.model, e.ip, e.location, e.serial].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    );
    return matchCat && matchSearch;
  });

  const openNew = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit = (e) => { setForm({ ...e }); setEditing(e.id); };
  const cancel = () => { setEditing(null); };

  const save = () => {
    if (!form.name || !form.model) return;
    if (editing === "new") {
      setEquipment(prev => [...prev, { ...form, id: Date.now().toString() }]);
    } else {
      setEquipment(prev => prev.map(e => e.id === editing ? { ...form, id: editing } : e));
    }
    cancel();
  };

  const remove = (id) => setEquipment(prev => prev.filter(e => e.id !== id));

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Package size={22} className="text-cyan-400" />
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Equipment CRUD, condition tracking, and spare-parts reference</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Add Equipment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5 flex-1 max-w-sm">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search equipment…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {search && <button onClick={() => setSearch("")}><X size={12} className="text-muted-foreground" /></button>}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={13} className="text-muted-foreground mr-1" />
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inline form */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-foreground">{editing === "new" ? "New Equipment" : "Edit Equipment"}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { key: "name", placeholder: "Name (e.g. SW-Bridge)" },
                { key: "model", placeholder: "Model / Make" },
                { key: "ip", placeholder: "IP Address" },
                { key: "location", placeholder: "Location" },
                { key: "serial", placeholder: "Serial Number" },
              ].map(f => (
                <input
                  key={f.key}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ))}
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
              <input
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Notes"
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary col-span-2"
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <AnimatePresence>
          {filtered.map((eq, i) => (
            <motion.div
              key={eq.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-xl p-4 flex gap-3"
            >
              <EquipmentIcon category={eq.category} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{eq.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{eq.model}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${CONDITION_COLORS[eq.condition]}`}>
                    {eq.condition}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {eq.ip && <p className="text-xs text-muted-foreground font-mono">{eq.ip}</p>}
                  {eq.location && <p className="text-xs text-muted-foreground">{eq.location}</p>}
                  {eq.notes && <p className="text-xs text-muted-foreground/70 truncate">{eq.notes}</p>}
                </div>
                <div className="flex gap-1 mt-3">
                  <button onClick={() => openEdit(eq)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => remove(eq.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
          No equipment found.
        </div>
      )}
      <p className="text-xs text-muted-foreground">{equipment.length} items · {filtered.length} shown</p>
    </div>
  );
}