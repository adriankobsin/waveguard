import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, Search, X, Pencil, Trash2,
  Wifi, Camera, Monitor, Zap, Server, HardDrive,
  LayoutGrid, List, Download, FileSpreadsheet, Lightbulb,
} from "lucide-react";
import InventoryExportModal from "../components/inventory/InventoryExportModal";
import VesselSpreadsheetImportModal from "../components/inventory/VesselSpreadsheetImportModal";
import InventoryFilters from "../components/inventory/InventoryFilters";
import EquipmentEditModal from "../components/inventory/EquipmentEditModal";
import {
  EMPTY_INVENTORY_FILTERS,
  buildInventoryFilterOptions,
  applyInventoryFilters,
  getEquipmentArea,
  getEquipmentRoom,
} from "@/lib/inventory/inventoryFilters";
import { listEquipment, upsertEquipment, updateEquipment, deleteEquipment } from "@/api/equipmentApi";
import { EQUIPMENT_CHANGED_EVENT } from "@/lib/discoveryRegistration";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import BulkActionBar from "@/components/shared/BulkActionBar";
import BulkEditModal from "@/components/shared/BulkEditModal";
import { Checkbox } from "@/components/ui/checkbox";
import { DEVICE_CATEGORIES } from "@/lib/equipment/deviceFormConstants";

const CATEGORIES = DEVICE_CATEGORIES;
const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Decommissioned"];

const TYPE_ICONS = {
  Network: { icon: Wifi, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  Camera: { icon: Camera, color: "text-purple-400", bg: "bg-purple-500/10" },
  AV: { icon: Monitor, color: "text-blue-400", bg: "bg-blue-500/10" },
  Power: { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  Control: { icon: Server, color: "text-green-400", bg: "bg-green-500/10" },
  Server: { icon: Server, color: "text-slate-300", bg: "bg-slate-500/10" },
  Lighting: { icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-500/10" },
  Other: { icon: HardDrive, color: "text-muted-foreground", bg: "bg-secondary" },
};

const EMPTY = {
  name: "",
  make: "",
  model: "",
  category: "Network",
  ip: "",
  mac: "",
  condition: "Good",
  area: "",
  room: "",
  location: "",
  serial: "",
  notes: "",
};

function buildLocationFromForm(form) {
  const override = form.location?.trim();
  if (override) return override;
  const area = form.area?.trim() || "";
  const room = form.room?.trim() || "";
  if (area && room) return `${area} · Room ${room}`;
  return area;
}

function isInventoryItem(e) {
  return e.waveguardClassification === "inventory" || e.inventoryOnly === true;
}

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => ({ ...EMPTY_INVENTORY_FILTERS }));

  const applyFilterPatch = useCallback((patch) => {
    setFilters((prev) => ({ ...EMPTY_INVENTORY_FILTERS, ...prev, ...patch }));
  }, []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [viewMode, setViewMode] = useState("grid");
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const listRef = useRef(null);
  const bulk = useBulkSelection();

  const { data: allEquipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: listEquipment,
  });

  const equipment = useMemo(
    () => allEquipment.filter(isInventoryItem),
    [allEquipment]
  );

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["equipment"] });
    window.addEventListener(EQUIPMENT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(EQUIPMENT_CHANGED_EVENT, refresh);
  }, [queryClient]);

  const filterOptions = useMemo(
    () => buildInventoryFilterOptions(equipment),
    [equipment]
  );

  const filtered = useMemo(
    () => applyInventoryFilters(equipment, filters, search),
    [equipment, filters, search]
  );

  const filterSignature = useMemo(
    () => JSON.stringify({ filters, search }),
    [filters, search]
  );

  useEffect(() => {
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [filterSignature]);

  const openNew = () => {
    setForm({ ...EMPTY });
    setEditing("new");
  };
  const openEdit = (e) => {
    setForm({
      ...e,
      area: getEquipmentArea(e),
      room: getEquipmentRoom(e),
    });
    setEditing(e.id);
  };
  const cancel = () => {
    setEditing(null);
    setForm({ ...EMPTY });
  };

  const save = async () => {
    if (!form.name || !form.model) return;
    setSaving(true);
    try {
      const { area, room, ...rest } = form;
      const payload = {
        ...rest,
        room: room?.trim() || "",
        location: buildLocationFromForm(form),
        waveguardClassification: "inventory",
        inventoryOnly: true,
        monitoringEnabled: false,
      };
      if (editing === "new") {
        await upsertEquipment({ ...payload, id: `eq-manual-${Date.now()}` });
        toast.success("Equipment added");
      } else {
        await upsertEquipment({ ...payload, id: editing });
        toast.success("Equipment updated");
      }
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["deviceGroups"] });
      cancel();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteEquipment(id);
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["deviceGroups"] });
      toast.success("Equipment removed");
    } catch (e) {
      toast.error(e.message || "Delete failed");
    }
  };

  const filteredIds = filtered.map((e) => e.id);

  const handleBulkEdit = async (patch) => {
    const items = equipment.filter((e) => bulk.selectedIds.has(e.id));
    let ok = 0;
    for (const item of items) {
      await updateEquipment(item.id, { ...item, ...patch });
      ok++;
    }
    queryClient.invalidateQueries({ queryKey: ["equipment"] });
    bulk.clear();
    toast.success(`Updated ${ok} item${ok !== 1 ? "s" : ""}`);
  };

  const handleBulkDelete = async () => {
    const ids = [...bulk.selectedIds];
    for (const id of ids) {
      await deleteEquipment(id);
    }
    queryClient.invalidateQueries({ queryKey: ["equipment"] });
    queryClient.invalidateQueries({ queryKey: ["deviceGroups"] });
    bulk.clear();
    setBulkDeleteOpen(false);
    toast.success(`Deleted ${ids.length} item${ids.length !== 1 ? "s" : ""}`);
  };

  const INVENTORY_BULK_FIELDS = [
    {
      key: "category",
      label: "Category",
      type: "select",
      options: [...new Set([...CATEGORIES, ...filterOptions.categories])],
    },
    { key: "condition", label: "Condition", type: "select", options: CONDITIONS },
    { key: "location", label: "Location", type: "text", placeholder: "e.g. Main Deck · Room 344" },
    { key: "notes", label: "Notes", type: "text" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Package size={22} className="text-cyan-400" />
            Equipment
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading…" : `${equipment.length} items from discovery and manual entry`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <FileSpreadsheet size={14} /> Import spreadsheet
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Add Equipment
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5 flex-1 max-w-lg">
            <Search size={14} className="text-muted-foreground flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, IP, model, location, system…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X size={12} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 self-start">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        <InventoryFilters
          filters={filters}
          onChange={applyFilterPatch}
          options={filterOptions}
          disabled={isLoading}
          resultCount={filtered.length}
          totalCount={equipment.length}
        />
      </div>

      <BulkActionBar
        count={bulk.count}
        onEdit={() => setBulkEditOpen(true)}
        onDelete={() => setBulkDeleteOpen(true)}
        onClear={bulk.clear}
      />

      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        count={bulk.count}
        fields={INVENTORY_BULK_FIELDS}
        onApply={handleBulkEdit}
        title="Bulk edit equipment"
      />

      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setBulkDeleteOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-foreground mb-1">Delete {bulk.count} items?</p>
            <p className="text-xs text-muted-foreground mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkDeleteOpen(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={handleBulkDelete} className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <EquipmentEditModal
        open={Boolean(editing) && !bulk.count}
        onClose={cancel}
        isNew={editing === "new"}
        form={form}
        onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        onSave={save}
        saving={saving}
        categoryOptions={filterOptions.categories}
        areaOptions={filterOptions.areas}
        roomOptions={filterOptions.rooms}
      />

      {/* Equipment list — directly under filters; scrolls into view when filters change */}
      <div ref={listRef} className="scroll-mt-4">
      {viewMode === "grid" && (
        <div key={filterSignature} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((eq) => (
              <motion.div
                key={eq.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-xl p-4 flex gap-3 ${bulk.isSelected(eq.id) ? "ring-2 ring-primary/50" : ""}`}
              >
                <div className="flex flex-col items-start gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={bulk.isSelected(eq.id)}
                    onCheckedChange={() => bulk.toggle(eq.id)}
                  />
                  <EquipmentIcon category={eq.category} />
                </div>
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
                    {eq.systemCategory && (
                      <p className="text-xs text-cyan-400/80 font-mono uppercase">{eq.systemCategory}</p>
                    )}
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
        </div>
      )}

      {viewMode === "list" && (
        <div key={filterSignature} className="glass rounded-xl overflow-hidden">
          <div className="grid grid-cols-[auto_auto_1fr_1fr_1fr_auto_auto] items-center gap-3 px-4 py-2 border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-widest">
            <Checkbox
              checked={bulk.allSelected(filteredIds)}
              onCheckedChange={() => bulk.toggleAll(filteredIds)}
              aria-label="Select all"
            />
            <div className="w-7" />
            <div>Device</div>
            <div className="hidden sm:block">IP / Location</div>
            <div className="hidden md:block">Serial</div>
            <div>Condition</div>
            <div />
          </div>
            {filtered.map((eq) => (
              <motion.div
                key={eq.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`grid grid-cols-[auto_auto_1fr_1fr_auto_auto] sm:grid-cols-[auto_auto_1fr_1fr_1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-white/[0.02] transition-colors ${bulk.isSelected(eq.id) ? "bg-primary/5" : ""}`}
              >
                <Checkbox
                  checked={bulk.isSelected(eq.id)}
                  onCheckedChange={() => bulk.toggle(eq.id)}
                />
                <EquipmentIcon category={eq.category} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{eq.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{eq.model}</p>
                </div>
                <div className="hidden sm:block min-w-0">
                  {eq.ip && <p className="text-xs font-mono text-muted-foreground">{eq.ip}</p>}
                  {eq.location && <p className="text-xs text-muted-foreground truncate">{eq.location}</p>}
                  {eq.systemCategory && (
                    <p className="text-[10px] text-cyan-400/70 font-mono uppercase">{eq.systemCategory}</p>
                  )}
                </div>
                <div className="hidden md:block min-w-0">
                  <p className="text-xs font-mono text-muted-foreground truncate">{eq.serial || "—"}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${CONDITION_COLORS[eq.condition]}`}>
                  {eq.condition}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(eq)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => remove(eq.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
          No equipment found.
        </div>
      )}
      </div>

      {showExport && (
        <InventoryExportModal equipment={equipment} onClose={() => setShowExport(false)} />
      )}
      {showImport && (
        <VesselSpreadsheetImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["equipment"] });
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}