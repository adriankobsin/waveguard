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
  StickyNote,
  ScrollText,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { listEquipment, createEquipment, updateEquipment } from "@/api/equipmentApi";
import {
  listCables,
  upsertPatchPortCable,
  backfillCablesBatch,
  schedulePatchPanelBackup,
  createPatchPanelBackupNow,
} from "@/api/cableApi";
import { loadRackLayoutLocal } from "@/lib/rackLayoutStorage";
import {
  buildSchedule,
  filterSchedule,
  collectFilterOptions,
  TEST_RESULTS,
} from "@/lib/patchPanelSchedule/buildSchedule";
import {
  listPatchPanelEventLogs,
  recordPatchPanelEvent,
} from "@/lib/patchPanelSchedule/patchPanelEventLog";
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

const EDITABLE_PORT_FIELDS = [
  "label",
  "type",
  "system_category",
  "deck",
  "room",
  "location",
  "to_equipment",
  "end_device_port",
  "length",
  "test_result",
  "last_tested_at",
  "notes",
  "status",
];

function portDraftDirty(draft, port) {
  return EDITABLE_PORT_FIELDS.some(
    (key) => String(draft[key] ?? "") !== String(port[key] ?? "")
  );
}

function PortRow({ port, panelName, onSave, saving, onDraftChange }) {
  const [draft, setDraft] = useState({ ...port });
  useEffect(() => {
    setDraft({ ...port });
  }, [port]);

  const setField = (field, value) => {
    setDraft((d) => {
      const next = { ...d, [field]: value };
      onDraftChange?.(port.port, next, portDraftDirty(next, port));
      return next;
    });
  };

  const handleBlur = async (field) => {
    if (String(draft[field] ?? "") === String(port[field] ?? "")) return;
    try {
      await onSave(panelName, port.port, draft);
      onDraftChange?.(port.port, draft, false);
    } catch {
      setDraft({ ...port });
      onDraftChange?.(port.port, port, false);
    }
  };

  const dirty = portDraftDirty(draft, port);

  return (
    <tr
      className={`border-b border-border/40 hover:bg-secondary/20 ${
        port.isSpare && !dirty ? "opacity-80" : ""
      } ${dirty ? "bg-amber-500/5" : ""}`}
    >
      <td className="px-2 py-1.5 font-mono text-xs text-cyan-400">{port.port}</td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.label}
          placeholder="Cable tag"
          onChange={(e) => setField("label", e.target.value)}
          onBlur={() => handleBlur("label")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.type}
          onChange={(e) => setField("type", e.target.value)}
          onBlur={() => handleBlur("type")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.system_category}
          onChange={(e) => setField("system_category", e.target.value)}
          onBlur={() => handleBlur("system_category")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.deck}
          placeholder="Deck"
          onChange={(e) => setField("deck", e.target.value)}
          onBlur={() => handleBlur("deck")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.room}
          placeholder="Room"
          onChange={(e) => setField("room", e.target.value)}
          onBlur={() => handleBlur("room")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.location}
          placeholder="Location"
          onChange={(e) => setField("location", e.target.value)}
          onBlur={() => handleBlur("location")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.to_equipment}
          placeholder="End device"
          onChange={(e) => setField("to_equipment", e.target.value)}
          onBlur={() => handleBlur("to_equipment")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.end_device_port}
          onChange={(e) => setField("end_device_port", e.target.value)}
          onBlur={() => handleBlur("end_device_port")}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.length}
          onChange={(e) => setField("length", e.target.value)}
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
            onDraftChange?.(port.port, next, portDraftDirty(next, port));
            await onSave(panelName, port.port, next);
            onDraftChange?.(port.port, next, false);
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
            onDraftChange?.(port.port, next, portDraftDirty(next, port));
            await onSave(panelName, port.port, next);
            onDraftChange?.(port.port, next, false);
          }}
          disabled={saving}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={INPUT}
          value={draft.notes}
          onChange={(e) => setField("notes", e.target.value)}
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

function PanelCard({ panel, onSavePort, onUpdatePanel, onReload, saving }) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("ports");
  const [editMeta, setEditMeta] = useState(false);
  const [portCount, setPortCount] = useState(panel.port_count);
  const [rackName, setRackName] = useState(panel.rack_name);
  const [panelNotes, setPanelNotes] = useState(panel.notes || "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [dirtyPorts, setDirtyPorts] = useState(() => new Map());
  const [savingAll, setSavingAll] = useState(false);
  const [eventLogs, setEventLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    setPortCount(panel.port_count);
    setRackName(panel.rack_name);
    setPanelNotes(panel.notes || "");
    setNotesDirty(false);
    setDirtyPorts(new Map());
  }, [panel.id, panel.name, panel.port_count, panel.rack_name, panel.notes, panel.ports]);

  const dirtyCount = dirtyPorts.size;

  const refreshLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const rows = await listPatchPanelEventLogs({ panel: panel.name, limit: 80 });
      setEventLogs(rows);
    } catch {
      setEventLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [panel.name]);

  useEffect(() => {
    if (activeTab === "log") refreshLogs();
  }, [activeTab, refreshLogs]);

  const handleDraftChange = useCallback((portNum, draft, dirty) => {
    setDirtyPorts((prev) => {
      const next = new Map(prev);
      if (dirty) next.set(portNum, draft);
      else next.delete(portNum);
      return next;
    });
  }, []);

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
    schedulePatchPanelBackup("patch_panel_settings");
    toast.success("Panel settings updated");
  };

  const savePanelNotes = async () => {
    if (!notesDirty) return;
    if (!panel.id) {
      toast.error("Panel equipment record missing — re-import spreadsheet");
      return;
    }
    setSavingNotes(true);
    try {
      await onUpdatePanel(panel.id, { notes: panelNotes.trim() });
      await recordPatchPanelEvent({
        action: "notes_update",
        panel: panel.name,
        summary: `Updated notes on ${panel.name}`,
        details: panelNotes.trim().slice(0, 240) || "(cleared)",
      });
      schedulePatchPanelBackup("patch_panel_notes");
      setNotesDirty(false);
      toast.success("Panel notes saved");
      if (activeTab === "log") refreshLogs();
    } catch (err) {
      toast.error(err?.message || "Failed to save panel notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const saveAllDirty = async () => {
    if (!dirtyPorts.size) return;
    setSavingAll(true);
    let ok = 0;
    let fail = 0;
    for (const [portNum, draft] of dirtyPorts.entries()) {
      try {
        await onSavePort(panel.name, portNum, draft, { reload: false });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setDirtyPorts(new Map());
    setSavingAll(false);
    await onReload?.();
    if (fail === 0) toast.success(`Saved ${ok} port${ok === 1 ? "" : "s"}`);
    else toast.error(`Saved ${ok}, failed ${fail}`);
    if (activeTab === "log") refreshLogs();
  };

  const runManualBackup = async () => {
    setBackingUp(true);
    try {
      await createPatchPanelBackupNow(`patch_panel:${panel.name}`);
      await recordPatchPanelEvent({
        action: "backup",
        panel: panel.name,
        summary: `Server backup created for ${panel.name}`,
        details: "Cables, equipment, and logs included in server backup snapshot",
      });
      toast.success("Server backup created");
      refreshLogs();
    } catch (err) {
      toast.error(err?.message || "Backup failed");
    } finally {
      setBackingUp(false);
    }
  };

  const tabs = [
    { id: "ports", label: "Ports", icon: LayoutGrid },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "log", label: "Log", icon: ScrollText },
  ];

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
          {dirtyCount > 0 && (
            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              {dirtyCount} unsaved
            </span>
          )}
          {notesDirty && (
            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              notes unsaved
            </span>
          )}
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
        <div>
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-border/50 bg-secondary/20">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-card text-cyan-300 border border-border shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-1.5">
              {activeTab === "ports" && dirtyCount > 0 && (
                <button
                  type="button"
                  onClick={saveAllDirty}
                  disabled={savingAll || saving}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {savingAll ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save all ({dirtyCount})
                </button>
              )}
              {activeTab === "notes" && notesDirty && (
                <button
                  type="button"
                  onClick={savePanelNotes}
                  disabled={savingNotes}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {savingNotes ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save notes
                </button>
              )}
            </div>
          </div>

          {activeTab === "ports" && (
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
                    <PortRow
                      key={port.port}
                      port={port}
                      panelName={panel.name}
                      onSave={onSavePort}
                      saving={saving || savingAll}
                      onDraftChange={handleDraftChange}
                    />
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/40">
                Edit any cell, then blur or use Save all. Changes are stored on the server, written to the activity log, and backed up automatically.
              </p>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="p-3 space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Panel notes
                <textarea
                  value={panelNotes}
                  onChange={(e) => {
                    setPanelNotes(e.target.value);
                    setNotesDirty(e.target.value !== (panel.notes || ""));
                  }}
                  rows={6}
                  placeholder="Free-form notes for this patch panel (rack position, feed, VLAN, service labels…)"
                  className={`${INPUT} mt-1.5 min-h-[120px] resize-y py-2`}
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={savePanelNotes}
                  disabled={!notesDirty || savingNotes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40"
                >
                  {savingNotes ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save notes
                </button>
                {notesDirty && <span className="text-[10px] text-amber-400">Unsaved changes</span>}
              </div>
            </div>
          )}

          {activeTab === "log" && (
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshLogs}
                  disabled={loadingLogs}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {loadingLogs ? <Loader2 size={12} className="animate-spin" /> : null}
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={runManualBackup}
                  disabled={backingUp}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {backingUp ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Backup now
                </button>
              </div>
              {loadingLogs ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                  <Loader2 size={12} className="animate-spin" /> Loading activity…
                </div>
              ) : eventLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No patch panel activity logged yet for this panel.</p>
              ) : (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {eventLogs.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-border/50 bg-secondary/30 px-2.5 py-2 text-[11px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-foreground">{entry.summary || entry.action}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {entry.at ? new Date(entry.at).toLocaleString() : "—"}
                        </span>
                      </div>
                      {entry.port && (
                        <p className="text-muted-foreground mt-0.5">Port {entry.port}</p>
                      )}
                      {entry.details && (
                        <p className="text-muted-foreground mt-0.5 truncate">{entry.details}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
            /.-PP\d+$/i.test(String(e.name || "").trim())
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

  const handleSavePort = async (panelName, port, data, options = {}) => {
    const { reload = true } = options;
    setSaving(true);
    try {
      const status =
        data.label || data.to_equipment ? data.status === "spare" ? "installed" : data.status || "installed" : "spare";
      await upsertPatchPortCable(panelName, port, { ...data, status });
      if (reload) {
        await load();
        onRefresh?.();
      }
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
                      onReload={async () => {
                        await load();
                        onRefresh?.();
                      }}
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
