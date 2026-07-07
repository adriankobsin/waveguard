import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
  Save,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { listEquipment, createEquipment, updateEquipment } from "@/api/equipmentApi";
import { listCables, upsertPatchPortCable, backfillCablesBatch } from "@/api/cableApi";
import { loadRackLayoutLocal } from "@/lib/rackLayoutStorage";
import {
  buildSchedule,
  filterSchedule,
  collectFilterOptions,
  TEST_RESULTS,
} from "@/lib/patchPanelSchedule/buildSchedule";
import { inferRackNameFromPanel } from "@/lib/spreadsheet/normalize";
import PatchPanelImportModal from "./PatchPanelImportModal";
import VesselSpreadsheetImportModal from "../inventory/VesselSpreadsheetImportModal";

const INPUT =
  "w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

function testResultColor(result) {
  if (result === "pass") return "text-emerald-400 bg-emerald-500/10";
  if (result === "fail") return "text-red-400 bg-red-500/10";
  if (result === "pending") return "text-amber-400 bg-amber-500/10";
  return "text-slate-400 bg-slate-500/10";
}

function PortRow({ port, panelName, onSave, saving }) {
  const [draft, setDraft] = useState({ ...port });
  useEffect(() => {
    setDraft({ ...port });
  }, [port]);

  const handleBlur = async (field) => {
    if (draft[field] === port[field]) return;
    try {
      await onSave(panelName, port.port, draft);
    } catch {
      setDraft({ ...port });
    }
  };

  return (
    <tr className={`border-b border-border/40 hover:bg-secondary/20 ${port.isSpare ? "opacity-80" : ""}`}>
      <td className="px-2 py-1.5 font-mono text-xs text-cyan-400">{port.port}</td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.label}
          placeholder="Cable tag"
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          onBlur={() => handleBlur("label")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.type}
          onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
          onBlur={() => handleBlur("type")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.system_category}
          onChange={(e) => setDraft((d) => ({ ...d, system_category: e.target.value }))}
          onBlur={() => handleBlur("system_category")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.deck}
          placeholder="Deck"
          onChange={(e) => setDraft((d) => ({ ...d, deck: e.target.value }))}
          onBlur={() => handleBlur("deck")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.room}
          placeholder="Room"
          onChange={(e) => setDraft((d) => ({ ...d, room: e.target.value }))}
          onBlur={() => handleBlur("room")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.location}
          placeholder="Location"
          onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
          onBlur={() => handleBlur("location")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.to_equipment}
          placeholder="End device"
          onChange={(e) => setDraft((d) => ({ ...d, to_equipment: e.target.value }))}
          onBlur={() => handleBlur("to_equipment")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.end_device_port}
          onChange={(e) => setDraft((d) => ({ ...d, end_device_port: e.target.value }))}
          onBlur={() => handleBlur("end_device_port")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.length}
          onChange={(e) => setDraft((d) => ({ ...d, length: e.target.value }))}
          onBlur={() => handleBlur("length")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <select
          className={INPUT}
          value={draft.test_result}
          onChange={async (e) => {
            const next = { ...draft, test_result: e.target.value };
            setDraft(next);
            await onSave(panelName, port.port, next);
          }}
          disabled={saving}
        >
          {TEST_RESULTS.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1 py-1">
        <input
          type="date"
          className={INPUT}
          value={draft.last_tested_at ? draft.last_tested_at.slice(0, 10) : ""}
          onChange={async (e) => {
            const val = e.target.value ? new Date(e.target.value).toISOString() : "";
            const next = { ...draft, last_tested_at: val };
            setDraft(next);
            await onSave(panelName, port.port, next);
          }}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          onBlur={() => handleBlur("notes")}
          disabled={saving}
        />
      </td>
      <td className="px-2 py-1.5">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${testResultColor(draft.test_result)}`}>
          {draft.status}
        </span>
      </td>
    </tr>
  );
}

function PanelCard({ panel, onSavePort, onUpdatePanel, saving }) {
  const [open, setOpen] = useState(true);
  const [editMeta, setEditMeta] = useState(false);
  const [portCount, setPortCount] = useState(panel.port_count);
  const [rackName, setRackName] = useState(panel.rack_name);

  const saveMeta = async () => {
    if (!panel.id) {
      toast.error("Panel equipment record missing — re-import spreadsheet");
      return;
    }
    await onUpdatePanel(panel.id, {
      port_count: parseInt(portCount, 10) || 24,
      rack_name: rackName.trim() || panel.rack_name,
    });
    setEditMeta(false);
    toast.success("Panel settings updated");
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/50">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/40 border-b border-border/50">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {panel.name}
          <span className="text-xs font-normal text-muted-foreground">
            {panel.port_count} ports
            {panel.rack_u != null ? ` · U${panel.rack_u}` : ""}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditMeta((e) => !e)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
        >
          Settings
        </button>
      </div>
      {editMeta && (
        <div className="px-3 py-2 flex flex-wrap gap-2 border-b border-border/50 bg-secondary/20">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            Port count
            <input type="number" min={1} max={96} className={`${INPUT} w-16`} value={portCount} onChange={(e) => setPortCount(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            Rack
            <input className={`${INPUT} w-40`} value={rackName} onChange={(e) => setRackName(e.target.value)} />
          </label>
          <button type="button" onClick={saveMeta} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">
            <Save size={11} className="inline mr-1" />
            Save
          </button>
        </div>
      )}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1280px]">
            <thead>
              <tr className="text-[10px] uppercase text-muted-foreground border-b border-border/50">
                <th className="px-2 py-2 w-12">Port</th>
                <th className="px-1 py-2">Cable No.</th>
                <th className="px-1 py-2">Type</th>
                <th className="px-1 py-2">System</th>
                <th className="px-1 py-2">Deck</th>
                <th className="px-1 py-2">Room</th>
                <th className="px-1 py-2">Location</th>
                <th className="px-1 py-2">End Device</th>
                <th className="px-1 py-2">End Device Port</th>
                <th className="px-1 py-2">Tested/Length</th>
                <th className="px-1 py-2">Test</th>
                <th className="px-1 py-2">Last tested</th>
                <th className="px-1 py-2">Notes</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {panel.ports.map((port) => (
                <PortRow key={port.port} port={port} panelName={panel.name} onSave={onSavePort} saving={saving} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PatchPanelSchedulePanel({ onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cables, setCables] = useState([]);
  const [panels, setPanels] = useState([]);
  const [rackLayout, setRackLayout] = useState(null);
  const [search, setSearch] = useState("");
  const [rackFilter, setRackFilter] = useState("All");
  const [panelFilter, setPanelFilter] = useState("All");
  const [deckFilter, setDeckFilter] = useState("All");
  const [systemFilter, setSystemFilter] = useState("All");
  const [testFilter, setTestFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [importOpen, setImportOpen] = useState(false);
  const [vesselImportOpen, setVesselImportOpen] = useState(false);
  const [collapsedRacks, setCollapsedRacks] = useState(new Set());
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [newPanel, setNewPanel] = useState({ name: "", rack_name: "", port_count: 24 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cableRows, equipRows] = await Promise.all([listCables(), listEquipment()]);
      await backfillCablesBatch(cableRows);
      const refreshed = await listCables();
      setCables(refreshed);
      setPanels(
        equipRows.filter(
          (e) =>
            e.equipment_subtype === "patch_panel" ||
            /patch/i.test(e.model || "") ||
            /-PP\d/i.test(e.name || "")
        )
      );
      let layout = loadRackLayoutLocal();
      try {
        const remote = await base44.entities.RackLayout.list();
        if (Array.isArray(remote) && remote.length) layout = remote[remote.length - 1];
      } catch {
        /* local only */
      }
      setRackLayout(layout);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const schedule = useMemo(
    () => buildSchedule({ cables, panels, rackLayout }),
    [cables, panels, rackLayout]
  );

  const filtered = useMemo(
    () =>
      filterSchedule(schedule, {
        search,
        rack: rackFilter,
        panel: panelFilter,
        deck: deckFilter,
        system: systemFilter,
        testResult: testFilter,
        status: statusFilter,
      }),
    [schedule, search, rackFilter, panelFilter, deckFilter, systemFilter, testFilter, statusFilter]
  );

  const filterOptions = useMemo(() => collectFilterOptions(schedule), [schedule]);

  const handleSavePort = async (panelName, port, data) => {
    setSaving(true);
    try {
      const status =
        data.label || data.to_equipment ? data.status === "spare" ? "installed" : data.status || "installed" : "spare";
      await upsertPatchPortCable(panelName, port, { ...data, status });
      await load();
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || "Save failed");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePanel = async (id, patch) => {
    const all = await listEquipment();
    const existing = all.find((e) => e.id === id);
    if (existing) await updateEquipment(id, { ...existing, ...patch });
    await load();
  };

  const handleAddPanel = async () => {
    const name = newPanel.name.trim();
    if (!name) return;
    await createEquipment({
      name,
      model: "Patch Panel",
      category: "Network",
      inventoryOnly: true,
      waveguardClassification: "inventory",
      equipment_subtype: "patch_panel",
      rack_name: newPanel.rack_name.trim() || inferRackNameFromPanel(name),
      port_count: parseInt(newPanel.port_count, 10) || 24,
    });
    setAddPanelOpen(false);
    setNewPanel({ name: "", rack_name: "", port_count: 24 });
    await load();
    toast.success("Patch panel added");
  };

  return (
    <div className="space-y-4">
      <PatchPanelImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => {
          setImportOpen(false);
          load();
          onRefresh?.();
        }}
      />
      {vesselImportOpen && (
        <VesselSpreadsheetImportModal
          isOpen={vesselImportOpen}
          onClose={() => setVesselImportOpen(false)}
          onComplete={() => {
            setVesselImportOpen(false);
            load();
            onRefresh?.();
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {schedule.totalPanels} panels · {schedule.totalPorts} ports total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-secondary border border-border text-muted-foreground rounded-lg text-sm hover:text-foreground"
          >
            <Upload size={14} />
            Import patch schedule
          </button>
          <button
            type="button"
            onClick={() => setVesselImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-secondary border border-border text-muted-foreground rounded-lg text-sm hover:text-foreground"
          >
            <LayoutGrid size={14} />
            Full vessel import
          </button>
          <button
            type="button"
            onClick={() => setAddPanelOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            <Plus size={14} />
            Add panel
          </button>
        </div>
      </div>

      {addPanelOpen && (
        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold">New patch panel</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className={INPUT}
              placeholder="Panel name (e.g. MEC552-R1-PP1)"
              value={newPanel.name}
              onChange={(e) => setNewPanel((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className={INPUT}
              placeholder="Rack name"
              value={newPanel.rack_name}
              onChange={(e) => setNewPanel((p) => ({ ...p, rack_name: e.target.value }))}
            />
            <input
              type="number"
              min={1}
              max={96}
              className={INPUT}
              placeholder="Port count"
              value={newPanel.port_count}
              onChange={(e) => setNewPanel((p) => ({ ...p, port_count: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAddPanel} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm">
              Save panel
            </button>
            <button type="button" onClick={() => setAddPanelOpen(false)} className="px-3 py-1.5 text-muted-foreground text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5 max-w-lg">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cable, device, notes…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}>
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={13} className="text-muted-foreground" />
          {[
            ["Rack", rackFilter, setRackFilter, filterOptions.racks],
            ["Panel", panelFilter, setPanelFilter, filterOptions.panels],
            ["Deck", deckFilter, setDeckFilter, filterOptions.decks],
            ["System", systemFilter, setSystemFilter, filterOptions.systems],
            ["Test", testFilter, setTestFilter, filterOptions.testResults],
            ["Status", statusFilter, setStatusFilter, filterOptions.statuses],
          ].map(([label, val, setVal, opts]) => (
            <div key={label} className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
              {(opts || []).slice(0, 8).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setVal(o)}
                  className={`px-2 py-0.5 rounded-full text-xs ${val === o ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  {o}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 size={14} className="animate-spin" />
          Loading patch panel schedules…
        </div>
      )}

      {!loading && filtered.racks.length === 0 && (
        <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
          No patch panels found. Import a vessel spreadsheet or add a panel manually.
        </div>
      )}

      {!loading &&
        filtered.racks.map((rack) => {
          const collapsed = collapsedRacks.has(rack.name);
          return (
            <div key={rack.name} className="glass rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setCollapsedRacks((prev) => {
                    const next = new Set(prev);
                    if (next.has(rack.name)) next.delete(rack.name);
                    else next.add(rack.name);
                    return next;
                  })
                }
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 text-left"
              >
                <span className="font-semibold text-foreground flex items-center gap-2">
                  {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  Rack: {rack.name}
                </span>
                <span className="text-xs text-muted-foreground">{rack.panels.length} panels</span>
              </button>
              {!collapsed && (
                <div className="p-3 space-y-3 border-t border-border/50">
                  {rack.panels.map((panel) => (
                    <PanelCard
                      key={panel.name}
                      panel={panel}
                      onSavePort={handleSavePort}
                      onUpdatePanel={handleUpdatePanel}
                      saving={saving}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
