import { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  Thermometer,
  Zap,
  X,
  AlertTriangle,
  Cpu,
  Wifi,
  HardDrive,
  Battery,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useRackLayout } from "@/hooks/useRackLayout";
import { useTopologyAdmin } from "@/hooks/useTopologyAdmin";
import { normalizeEquipmentRecord, placementToRackItem, computeRackSummary } from "@/lib/topology/equipmentCatalog";
import {
  RU_PX,
  buildOccupiedMap,
  ruFromClientY,
  findPlacementRu,
} from "@/lib/topology/rackPlacement";
import RackEquipmentPalette from "./RackEquipmentPalette";
import RackFormModal from "./RackFormModal";
import RackPlacementModal from "./RackPlacementModal";
import DoubleConfirmDelete from "./DoubleConfirmDelete";
import { DeviceEditModal } from "./DeviceEditModal";

const ICON_MAP = {
  Network: Wifi,
  Camera: Cpu,
  AV: Cpu,
  Server: HardDrive,
  Power: Battery,
  Lighting: Zap,
};

const TEMP_COLOR = (t) => {
  if (t >= 50) return { text: "text-red-400", bar: "#ef4444" };
  if (t >= 42) return { text: "text-amber-400", bar: "#f59e0b" };
  return { text: "text-emerald-400", bar: "#22c55e" };
};

function RuSlot({ ru }) {
  return (
    <div
      style={{ height: RU_PX }}
      className="flex items-center border-b border-border pointer-events-none"
    >
      <span className="w-8 text-right pr-2 text-[10px] font-mono text-muted-foreground select-none flex-shrink-0">{ru}U</span>
    </div>
  );
}

function DropPreview({ ruStart, ruHeight }) {
  return (
    <div
      className="absolute left-[34px] right-1 rounded-lg border-2 border-dashed border-cyan-400/80 bg-cyan-500/15 pointer-events-none z-10"
      style={{
        top: (ruStart - 1) * RU_PX + 1,
        height: ruHeight * RU_PX - 2,
      }}
    />
  );
}

function RackItem({ item, ruStart, canEdit, isDragActive, onDragStart, onDragEnd, onClick, selected, onEdit, onRemove }) {
  const Icon = ICON_MAP[item.category] || Server;
  return (
    <motion.div
      draggable={canEdit}
      onDragStart={(e) => {
        if (!canEdit) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart(item);
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onClick(item);
      }}
      style={{
        position: "absolute",
        top: (ruStart - 1) * RU_PX + 1,
        left: 34,
        right: 4,
        height: item.ruHeight * RU_PX - 2,
        borderColor: selected ? "#ffffff" : item.color + "99",
        background: `linear-gradient(135deg, ${item.color}18, ${item.color}08)`,
        pointerEvents: isDragActive ? "none" : "auto",
        zIndex: selected ? 5 : 2,
      }}
      className={`rounded-lg border select-none overflow-hidden group transition-all ${canEdit ? "cursor-grab active:cursor-grabbing hover:brightness-110" : "cursor-pointer"}`}
    >
      <div className="flex items-center gap-2 px-2.5 h-full">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: item.color + "22" }}>
          <Icon size={11} style={{ color: item.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
          {item.ruHeight > 1 && <p className="text-[9px] text-muted-foreground truncate">{item.model}</p>}
        </div>
        <span className="text-[9px] font-mono text-amber-400/70">{item.watts}W</span>
        {canEdit && (
          <div className="hidden group-hover:flex items-center gap-0.5 ml-1 flex-shrink-0">
            <button
              type="button"
              title="Edit placement"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="p-0.5 rounded hover:bg-muted/305 text-muted-foreground hover:text-foreground"
            >
              <Pencil size={10} />
            </button>
            <button
              type="button"
              title="Remove from rack"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
              className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function RackColumn({
  rack,
  items,
  canEdit,
  activeDrag,
  onRackDragStart,
  onRackDragEnd,
  onDropAt,
  onItemClick,
  onItemEdit,
  onItemRemove,
  selectedId,
}) {
  const rackBodyRef = useRef(null);
  const [previewRu, setPreviewRu] = useState(null);
  const isDragging = Boolean(activeDrag);
  const totalUnits = rack.units;
  const excludeId = activeDrag?.type === "rack" ? activeDrag.item.id : activeDrag?.item?.id;
  const dragHeight = activeDrag?.item?.ruHeight || 1;

  const occupied = useMemo(
    () => buildOccupiedMap(items, excludeId),
    [items, excludeId]
  );

  const resolveDrop = useCallback(
    (clientY) => {
      if (!rackBodyRef.current || !activeDrag) return null;
      const rect = rackBodyRef.current.getBoundingClientRect();
      const targetRu = ruFromClientY(clientY, rect.top, totalUnits);
      const ruStart = findPlacementRu(targetRu, dragHeight, occupied, totalUnits);
      return ruStart ? { ruStart, targetRu } : null;
    },
    [activeDrag, dragHeight, occupied, totalUnits]
  );

  const handleDragOver = useCallback(
    (e) => {
      if (!canEdit || !activeDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const resolved = resolveDrop(e.clientY);
      setPreviewRu(resolved?.ruStart ?? null);
    },
    [canEdit, activeDrag, resolveDrop]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setPreviewRu(null);
      if (!canEdit || !activeDrag) return;
      const resolved = resolveDrop(e.clientY);
      if (!resolved) {
        toast.error("No free space in this rack for that equipment");
        return;
      }
      onDropAt(rack.id, resolved.ruStart);
      onRackDragEnd();
    },
    [canEdit, activeDrag, resolveDrop, rack.id, onDropAt, onRackDragEnd]
  );

  const usedW = items.reduce((s, i) => s + i.watts, 0);
  const wPct = Math.min(100, Math.round((usedW / Math.max(rack.watts, 1)) * 100));
  const tPct = Math.min(100, Math.round(((rack.tempC - 20) / 50) * 100));
  const tc = TEMP_COLOR(rack.tempC);

  return (
    <div className="flex flex-col w-56 flex-shrink-0">
      <div className="rounded-t-xl border border-b-0 border-border bg-card px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-foreground">{rack.name}</p>
          <span className="text-[10px] text-muted-foreground font-mono">{totalUnits}U</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">{rack.location}</p>
        <div className="mb-1.5">
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="flex items-center gap-1 text-amber-400/80"><Zap size={8} />{usedW}W</span>
            <span className="text-muted-foreground">{wPct}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${wPct}%`, background: wPct > 85 ? "#ef4444" : "#22c55e" }} />
          </div>
        </div>
        <div>
          <div className={`flex justify-between text-[10px] mb-0.5 ${tc.text}`}>
            <span className="flex items-center gap-1"><Thermometer size={8} />{rack.tempC}°C</span>
            {rack.tempC >= 50 && <AlertTriangle size={9} className="text-red-400" />}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${tPct}%`, background: tc.bar }} />
          </div>
        </div>
      </div>
      <div
        ref={rackBodyRef}
        onDragOver={handleDragOver}
        onDragLeave={() => setPreviewRu(null)}
        onDrop={handleDrop}
        className={`relative border border-border bg-secondary rounded-b-xl overflow-hidden ${isDragging && canEdit ? "ring-1 ring-cyan-500/30" : ""}`}
        style={{ height: totalUnits * RU_PX }}
      >
        {Array.from({ length: totalUnits }, (_, i) => i + 1).map((ru) => (
          <RuSlot key={ru} ru={ru} />
        ))}
        {previewRu != null && isDragging && <DropPreview ruStart={previewRu} ruHeight={dragHeight} />}
        {items.map((item) => (
          <RackItem
            key={item.id}
            item={item}
            ruStart={item.ruStart}
            canEdit={canEdit}
            isDragActive={isDragging}
            onDragStart={(it) => onRackDragStart({ type: "rack", item: it, sourceRackId: rack.id })}
            onDragEnd={onRackDragEnd}
            onClick={onItemClick}
            onEdit={onItemEdit}
            onRemove={onItemRemove}
            selected={selectedId === item.id}
          />
        ))}
      </div>
    </div>
  );
}

function ItemPanel({ item, canEdit, onClose, onEditPlacement, onEditDevice, onRemove }) {
  const Icon = ICON_MAP[item.category] || Server;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-96 pointer-events-auto"
    >
      <div className="rounded-2xl border border-border bg-secondary/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: item.color + "22" }}>
              <Icon size={13} style={{ color: item.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.model}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X size={12} />
          </button>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
          <Row label="IP" value={item.ip || "—"} />
          <Row label="LAN" value={item.lanStatus || "—"} />
          <Row label="Power" value={`${item.watts}W`} />
          <Row label="Temp" value={`${item.tempC}°C`} />
          <Row label="Category" value={item.category} />
          <Row label="Height" value={`${item.ruHeight}U @ ${item.ruStart}U`} />
        </div>
        {canEdit && (
          <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onEditPlacement(item)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-secondary-foreground hover:text-foreground"
            >
              <Pencil size={11} /> Edit placement
            </button>
            <button
              type="button"
              onClick={() => onEditDevice(item)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-secondary-foreground hover:text-foreground"
            >
              <Server size={11} /> Edit device
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 ml-auto"
            >
              <Trash2 size={11} /> Remove from rack
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Row({ label, value }) {
  return (
    <div className="p-2 rounded-lg bg-muted border border-border">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className="text-foreground font-medium">{value}</p>
    </div>
  );
}

export default function RackDesigner({ topologyDevices = [], onRefresh }) {
  const { canEdit } = useTopologyAdmin();
  const { layout, loading, saving, loadError, catalog, updateLayout, save, reload } = useRackLayout(topologyDevices);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [rackModal, setRackModal] = useState({ open: false, rack: null });
  const [deleteRack, setDeleteRack] = useState(null);
  const [placementEdit, setPlacementEdit] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);

  const devices = topologyDevices?.length ? topologyDevices : Object.values(catalog);

  const placedIds = useMemo(
    () => new Set((layout?.placements || []).map((p) => p.equipmentId)),
    [layout]
  );

  const racksDisplay = useMemo(() => {
    if (!layout?.racks) return [];
    const byRack = {};
    layout.racks.forEach((r) => { byRack[r.id] = []; });
    (layout.placements || []).forEach((p) => {
      const item = placementToRackItem(p, catalog);
      if (item && byRack[p.rackId]) {
        byRack[p.rackId].push({ ...item, placement: { rackId: p.rackId, ruStart: p.ruStart, ruHeight: p.ruHeight } });
      }
    });
    return layout.racks.map((rack) => {
      const items = byRack[rack.id] || [];
      const { watts, tempC } = computeRackSummary(items);
      return { ...rack, items, watts, tempC };
    });
  }, [layout, catalog]);

  const rackItemsById = useMemo(() => {
    const map = {};
    racksDisplay.forEach((r) => { map[r.id] = r.items; });
    return map;
  }, [racksDisplay]);

  const clearDrag = useCallback(() => setActiveDrag(null), []);

  const handlePlaceAt = useCallback(
    (rackId, equipment, ruStart) => {
      const eq = normalizeEquipmentRecord(equipment.equipmentId ? catalog[equipment.equipmentId] || equipment : equipment);
      const equipmentId = eq.id || equipment.equipmentId || equipment.id;
      updateLayout((prev) => {
        const placements = (prev.placements || []).filter((p) => p.equipmentId !== equipmentId);
        placements.push({
          rackId,
          equipmentId,
          ruStart,
          ruHeight: eq.ruHeight || equipment.ruHeight || 1,
        });
        return { ...prev, placements };
      });
      clearDrag();
    },
    [catalog, updateLayout, clearDrag]
  );

  const handleDropAt = useCallback(
    (targetRackId, ruStart) => {
      if (!activeDrag) return;
      if (activeDrag.type === "palette") {
        handlePlaceAt(targetRackId, activeDrag.item, ruStart);
        return;
      }
      const equipmentId = activeDrag.item.id;
      const fromRackId = activeDrag.sourceRackId;
      updateLayout((prev) => ({
        ...prev,
        placements: (prev.placements || []).map((p) =>
          p.equipmentId === equipmentId
            ? { ...p, rackId: targetRackId, ruStart, ruHeight: activeDrag.item.ruHeight }
            : p
        ),
      }));
      if (fromRackId !== targetRackId) {
        toast.success("Equipment moved to another rack");
      }
      clearDrag();
    },
    [activeDrag, handlePlaceAt, updateLayout, clearDrag]
  );

  const handleRemoveFromRack = useCallback(
    (equipmentId) => {
      updateLayout((prev) => ({
        ...prev,
        placements: (prev.placements || []).filter((p) => p.equipmentId !== equipmentId),
      }));
      setSelectedItem(null);
      setPlacementEdit(null);
      toast.success("Removed from rack");
    },
    [updateLayout]
  );

  const handlePlacementSave = useCallback(
    ({ rackId, ruStart, ruHeight }) => {
      if (!placementEdit) return;
      updateLayout((prev) => ({
        ...prev,
        placements: (prev.placements || []).map((p) =>
          p.equipmentId === placementEdit.id
            ? { ...p, rackId, ruStart, ruHeight }
            : p
        ),
      }));
      setPlacementEdit(null);
      toast.success("Placement updated");
    },
    [placementEdit, updateLayout]
  );

  const handleUpdateDevice = useCallback(
    async (deviceData) => {
      if (!editingDevice) return;
      try {
        const response = await base44.functions.invoke("updateDevice", {
          deviceId: editingDevice.id,
          deviceData,
        });
        if (response.data?.success) {
          setEditingDevice(null);
          onRefresh?.();
        }
      } catch (error) {
        console.error("Failed to update device:", error);
        toast.error("Failed to update device");
      }
    },
    [editingDevice, onRefresh]
  );

  const handleSave = async () => {
    await save(layout);
    reload();
  };

  const handleAddRack = (data) => {
    const id = `rack-${Date.now()}`;
    updateLayout((prev) => ({
      ...prev,
      racks: [...(prev.racks || []), { id, ...data }],
    }));
  };

  const handleEditRack = (data) => {
    updateLayout((prev) => ({
      ...prev,
      racks: (prev.racks || []).map((r) => (r.id === rackModal.rack.id ? { ...r, ...data } : r)),
    }));
  };

  const handleDeleteRackConfirm = () => {
    if (!deleteRack) return;
    updateLayout((prev) => ({
      ...prev,
      racks: (prev.racks || []).filter((r) => r.id !== deleteRack.id),
      placements: (prev.placements || []).filter((p) => p.rackId !== deleteRack.id),
    }));
    setDeleteRack(null);
    toast.success("Rack deleted");
  };

  const openDeviceEdit = (item) => {
    const device = catalog[item.id] || devices.find((d) => d.id === item.id);
    if (device) setEditingDevice(device);
    else toast.error("Device not found in catalog");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">Loading rack layout…</span>
      </div>
    );
  }

  const totalWatts = racksDisplay.reduce((s, r) => s + (r.usedWatts || r.items?.reduce((a, i) => a + i.watts, 0) || 0), 0);

  return (
    <div className="flex h-full bg-background overflow-hidden" onDragEnd={clearDrag}>
      <RackEquipmentPalette
        devices={devices}
        placedIds={placedIds}
        canEdit={canEdit}
        onDragStart={(item) => setActiveDrag({ type: "palette", item })}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border flex-shrink-0 flex-wrap">
          {loadError && (
            <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              <span>{loadError}</span>
              <button type="button" onClick={reload} className="underline hover:text-foreground">Retry</button>
            </div>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Server size={11} className="text-cyan-400" />{racksDisplay.length} racks</span>
          <span className="text-xs text-amber-400 flex items-center gap-1"><Zap size={11} />{totalWatts}W</span>
          {!canEdit && <span className="text-[10px] text-muted-foreground ml-auto">Read-only</span>}
          {canEdit && (
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setRackModal({ open: true, rack: null })} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-secondary-foreground hover:text-foreground">
                <Plus size={12} /> Add rack
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-300">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save layout
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5 relative">
          <div className="flex gap-6 items-start min-w-max">
            {racksDisplay.map((rack) => (
              <div key={rack.id} className="relative">
                {canEdit && (
                  <div className="flex gap-1 mb-1 justify-end">
                    <button type="button" onClick={() => setRackModal({ open: true, rack })} className="p-1 rounded text-muted-foreground hover:text-foreground"><Pencil size={11} /></button>
                    <button type="button" onClick={() => setDeleteRack(rack)} className="p-1 rounded text-muted-foreground hover:text-red-400"><Trash2 size={11} /></button>
                  </div>
                )}
                <RackColumn
                  rack={rack}
                  items={rack.items}
                  canEdit={canEdit}
                  activeDrag={activeDrag}
                  onRackDragStart={setActiveDrag}
                  onRackDragEnd={clearDrag}
                  onDropAt={handleDropAt}
                  onItemClick={(item) => setSelectedItem((prev) => (prev?.id === item.id ? null : item))}
                  onItemEdit={setPlacementEdit}
                  onItemRemove={handleRemoveFromRack}
                  selectedId={selectedItem?.id}
                />
              </div>
            ))}
          </div>
          <AnimatePresence>
            {selectedItem && (
              <ItemPanel
                item={selectedItem}
                canEdit={canEdit}
                onClose={() => setSelectedItem(null)}
                onEditPlacement={setPlacementEdit}
                onEditDevice={openDeviceEdit}
                onRemove={handleRemoveFromRack}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <RackFormModal
        open={rackModal.open}
        onOpenChange={(open) => setRackModal({ open, rack: null })}
        rack={rackModal.rack}
        onSubmit={rackModal.rack ? handleEditRack : handleAddRack}
      />

      <RackPlacementModal
        open={Boolean(placementEdit)}
        onOpenChange={(open) => !open && setPlacementEdit(null)}
        item={placementEdit}
        racks={layout?.racks || []}
        rackItemsById={rackItemsById}
        onSave={handlePlacementSave}
        onRemove={handleRemoveFromRack}
      />

      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          onSubmit={handleUpdateDevice}
          onClose={() => setEditingDevice(null)}
        />
      )}

      <DoubleConfirmDelete
        open={Boolean(deleteRack)}
        onOpenChange={(open) => !open && setDeleteRack(null)}
        title={`Delete ${deleteRack?.name}?`}
        step1Description="Equipment in this rack will be unassigned from the layout."
        step2Description="Confirm permanent delete of this rack. This cannot be undone."
        onConfirm={handleDeleteRackConfirm}
      />
    </div>
  );
}
