import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench, Plus, ChevronLeft, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, X, Play, RotateCcw, Pencil, Search, CalendarDays, Loader2
} from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function getCalendarCells(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const padStart = (first.getDay() + 6) % 7; // Mon=0
  const cells = Array.from({ length: padStart }, () => null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

function calendarDateKey(task) {
  return task.planned_due_at || task.next_due_at || null;
}

function statusLabel(status) {
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "not_completed") return "Not Completed";
  return "Pending";
}

function statusBadgeClass(status) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
  if (status === "in_progress") return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
  if (status === "not_completed") return "bg-red-500/15 text-red-300 border border-red-500/30";
  return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
}

function calendarPillClass(status) {
  if (status === "completed") return "bg-emerald-500/30 text-emerald-100";
  if (status === "in_progress") return "bg-sky-500/30 text-sky-100";
  if (status === "not_completed") return "bg-red-500/30 text-red-100";
  return "bg-amber-500/30 text-amber-100";
}

const EMPTY_FORM = {
  title: "", description: "", equipment: "", interval_days: 90,
  next_due_at: todayKey(), planned_due_at: "", assigned_to: "", status: "pending"
};

function TaskFormModal({ open, onClose, onSave, task }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || "",
        description: task.description || "",
        equipment: task.equipment || "",
        interval_days: task.interval_days || 90,
        next_due_at: task.next_due_at || task.planned_due_at || todayKey(),
        planned_due_at: task.planned_due_at || task.next_due_at || todayKey(),
        assigned_to: task.assigned_to || "",
        status: task.status || "pending",
      });
    } else {
      setForm({ ...EMPTY_FORM, next_due_at: todayKey(), planned_due_at: todayKey() });
    }
    setError(null);
  }, [task, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.next_due_at) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        interval_days: Math.max(1, Number(form.interval_days) || 90),
        planned_due_at: form.planned_due_at || form.next_due_at,
      };
      if (task) {
        const wasCompleted = task.status !== "completed" && form.status === "completed";
        await base44.entities.MaintenanceTask.update(task.id, {
          ...payload,
          ...(wasCompleted ? { last_performed_at: todayKey() } : {}),
        });
      } else {
        await base44.entities.MaintenanceTask.create(payload);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{task ? "Edit Task" : "New Maintenance Task"}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Task title *"
            value={form.title}
            onChange={e => set("title", e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => set("description", e.target.value)}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Equipment</label>
              <input
                placeholder="Equipment name"
                value={form.equipment}
                onChange={e => set("equipment", e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Assigned to</label>
              <input
                placeholder="Person name"
                value={form.assigned_to}
                onChange={e => set("assigned_to", e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Due date *</label>
              <input
                required
                type="date"
                value={form.next_due_at}
                onChange={e => set("next_due_at", e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Interval (days)</label>
              <input
                type="number"
                min={1}
                value={form.interval_days}
                onChange={e => set("interval_days", e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Status</label>
            <select
              value={form.status}
              onChange={e => set("status", e.target.value)}
              className="w-full bg-[#0d1424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="not_completed">Not Completed</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {task ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TaskCard({ task, onEdit, onStart, onComplete, onReopen }) {
  const due = calendarDateKey(task);
  const isOverdue = due && due < todayKey() && task.status !== "completed";

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${isOverdue ? "border-red-500/30 bg-red-500/5" : "border-white/8 bg-white/3"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{task.title}</p>
          {task.equipment && <p className="text-xs text-slate-500 mt-0.5">{task.equipment}</p>}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadgeClass(task.status)}`}>
          {statusLabel(task.status)}
        </span>
      </div>
      {task.description && <p className="text-xs text-slate-400">{task.description}</p>}
      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
        <span>Every {task.interval_days}d</span>
        <span>·</span>
        <span className={isOverdue ? "text-red-400 font-medium" : ""}>Due: {due || "—"}</span>
        {task.assigned_to && <><span>·</span><span>{task.assigned_to}</span></>}
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <button onClick={() => onEdit(task)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <Pencil size={11} /> Edit
        </button>
        {(task.status === "pending" || task.status === "not_completed") && (
          <button onClick={() => onStart(task.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-sky-400 hover:bg-sky-500/15 transition-colors">
            <Play size={11} /> Start
          </button>
        )}
        {task.status !== "completed" && (
          <button onClick={() => onComplete(task.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/15 transition-colors">
            <CheckCircle2 size={11} /> Complete
          </button>
        )}
        {task.status === "completed" && (
          <button onClick={() => onReopen(task.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-400 hover:bg-amber-500/15 transition-colors">
            <RotateCcw size={11} /> Reopen
          </button>
        )}
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [view, setView] = useState("calendar");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [search, setSearch] = useState("");
  const [searchDate, setSearchDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.MaintenanceTask.list("-next_due_at", 200);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tasksByDate = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      const key = calendarDateKey(task);
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const calendarCells = getCalendarCells(viewMonth.year, viewMonth.month);

  const selectedDayTasks = tasksByDate.get(selectedDate) || [];

  const overdue = tasks.filter(t => {
    const due = calendarDateKey(t);
    return due && due < todayKey() && t.status !== "completed";
  });

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      const due = calendarDateKey(t);
      if (searchDate && due !== searchDate) return false;
      if (!q) return true;
      return [t.title, t.description, t.assigned_to, t.equipment, due].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [tasks, search, searchDate]);

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const shiftMonth = (delta) => setViewMonth(cur => {
    const next = new Date(cur.year, cur.month + delta, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  });

  const openCreate = (date = selectedDate) => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleStart = async (id) => {
    await base44.entities.MaintenanceTask.update(id, { status: "in_progress" });
    load();
  };

  const handleComplete = async (id) => {
    await base44.entities.MaintenanceTask.update(id, { status: "completed", last_performed_at: todayKey() });
    load();
  };

  const handleReopen = async (id) => {
    await base44.entities.MaintenanceTask.update(id, { status: "not_completed" });
    load();
  };

  const displayedTasks = view === "search" ? searchResults : (view === "calendar" ? selectedDayTasks : tasks);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-5 animate-fade-in">
      <AnimatePresence>
        {formOpen && (
          <TaskFormModal
            open={formOpen}
            onClose={() => { setFormOpen(false); setEditingTask(null); }}
            onSave={load}
            task={editingTask}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench size={22} className="text-primary" />
            Maintenance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading..." : overdue.length > 0
              ? <span className="text-red-400 font-medium">{overdue.length} overdue task{overdue.length !== 1 ? "s" : ""}</span>
              : "All tasks on schedule"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary rounded-xl p-1 gap-1">
            {[["calendar", "Calendar"], ["list", "List"], ["search", "Search"]].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => openCreate()} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">
            <Plus size={14} /> Add Task
          </button>
        </div>
      </div>

      {/* Overdue Banner */}
      {overdue.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-400" />
            <p className="text-sm font-semibold text-red-400">Overdue Tasks</p>
          </div>
          <div className="space-y-1">
            {overdue.slice(0, 5).map(t => (
              <button key={t.id} onClick={() => openEdit(t)} className="w-full flex items-center justify-between text-left hover:bg-red-500/10 rounded-lg px-2 py-1.5 transition-colors">
                <span className="text-sm text-foreground">{t.title}</span>
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <Clock size={10} />{calendarDateKey(t)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search view */}
      {view === "search" && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2 flex-1">
              <Search size={14} className="text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none" />
          </div>
          <div className="space-y-2">
            {searchResults.length === 0 && <p className="text-sm text-muted-foreground p-4">No results found.</p>}
            {searchResults.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onStart={handleStart} onComplete={handleComplete} onReopen={handleReopen} />)}
          </div>
        </div>
      )}

      {/* Calendar view */}
      {view === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Calendar */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => shiftMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground"><ChevronLeft size={16} /></button>
              <h2 className="text-sm font-semibold text-foreground">{monthLabel}</h2>
              <button onClick={() => shiftMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {calendarCells.map((dateKey, i) => {
                if (!dateKey) return <div key={`blank-${i}`} />;
                const dayTasks = tasksByDate.get(dateKey) || [];
                const isToday = dateKey === todayKey();
                const isSelected = dateKey === selectedDate;
                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`aspect-square relative p-1 rounded-lg transition-colors text-left ${isSelected ? "bg-cyan-500/20 ring-1 ring-cyan-500/50" : isToday ? "ring-1 ring-primary/60" : "hover:bg-secondary/80"}`}
                  >
                    <span className={`text-[11px] font-medium ${isToday ? "text-primary" : isSelected ? "text-cyan-300" : "text-foreground"}`}>{parseInt(dateKey.slice(-2), 10)}</span>
                    {dayTasks.length > 0 && (
                      <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-px flex-wrap px-0.5">
                        {dayTasks.slice(0, 3).map(t => (
                          <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${
                            t.status === "completed" ? "bg-emerald-400" :
                            t.status === "in_progress" ? "bg-sky-400" :
                            t.status === "not_completed" ? "bg-red-400" : "bg-amber-400"
                          }`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
              {[["bg-amber-400", "Pending"], ["bg-sky-400", "In Progress"], ["bg-emerald-400", "Completed"], ["bg-red-400", "Not Completed"]].map(([cls, label]) => (
                <div key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${cls}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Day panel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CalendarDays size={14} className="text-primary" />
                {selectedDate === todayKey() ? "Today" : selectedDate}
              </p>
              <button onClick={() => openCreate(selectedDate)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/15 text-primary rounded-lg text-xs font-medium hover:bg-primary/25 transition-colors">
                <Plus size={12} /> Add
              </button>
            </div>
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
            {!loading && selectedDayTasks.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 text-center border border-border/30 rounded-xl">No tasks on this date</div>
            )}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {selectedDayTasks.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onStart={handleStart} onComplete={handleComplete} onReopen={handleReopen} />)}
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
          {!loading && tasks.length === 0 && <p className="text-sm text-muted-foreground p-4">No maintenance tasks yet.</p>}
          {tasks.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onStart={handleStart} onComplete={handleComplete} onReopen={handleReopen} />)}
        </div>
      )}
    </div>
  );
}