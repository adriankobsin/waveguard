import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Cable, Plus, Search, Pencil, Trash2, X, Check, Network, ChevronDown, ChevronRight, Upload, Loader2, GitBranch, Filter } from "lucide-react";
import SnmpPortMapPanel from "../components/snmp/SnmpPortMapPanel";
import PatchPanelSchedulePanel from "../components/cables/PatchPanelSchedulePanel";
import VesselSpreadsheetImportModal from "../components/inventory/VesselSpreadsheetImportModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import BulkActionBar from "@/components/shared/BulkActionBar";
import BulkEditModal from "@/components/shared/BulkEditModal";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";

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
      const data = await base44.entities.Cable.list("label", 5000);
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
      <VesselSpreadsheetImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => {
          setImportOpen(false);
          load();
          window.dispatchEvent(new CustomEvent(EQUIPMENT_CHANGED_EVENT));
        }}
      />

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
              <Upload size={14} /> Import spreadsheet
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