import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench, Plus, ChevronLeft, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, Calendar, X, Server, Camera, Monitor, Zap
} from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const MOCK_TASKS = [
  { id: "t1", title: "Camera lens cleaning — Bridge deck", equipment: "Cam-Bridge-01", equipmentType: "camera", dueDate: "2026-05-18", priority: "normal", status: "pending", intervalDays: 30 },
  { id: "t2", title: "Q-SYS Core firmware update", equipment: "AV-Proc-Main", equipmentType: "av", dueDate: "2026-05-20", priority: "high", status: "pending", intervalDays: 90 },
  { id: "t3", title: "Switch port audit — all decks", equipment: "SW-Bridge", equipmentType: "switch", dueDate: "2026-05-15", priority: "normal", status: "overdue", intervalDays: 60 },
  { id: "t4", title: "UPS battery capacity test", equipment: "UPS-Main", equipmentType: "power", dueDate: "2026-05-15", priority: "high", status: "overdue", intervalDays: 180 },
  { id: "t5", title: "Starlink terminal check", equipment: "Starlink-01", equipmentType: "network", dueDate: "2026-05-25", priority: "normal", status: "pending", intervalDays: 30 },
  { id: "t6", title: "AV rack cable management", equipment: "AV-Rack-1", equipmentType: "av", dueDate: "2026-05-28", priority: "low", status: "pending", intervalDays: 365 },
  { id: "t7", title: "NVR storage health check", equipment: "NVR-Main", equipmentType: "camera", dueDate: "2026-06-01", priority: "normal", status: "pending", intervalDays: 30 },
];

const EQUIPMENT_ICONS = { camera: Camera, av: Monitor, switch: Server, power: Zap, network: Server };
const PRIORITY_COLORS = { low: "text-blue-400", normal: "text-green-400", high: "text-yellow-400", critical: "text-red-400" };
const STATUS_COLORS = { pending: "bg-blue-500/20 text-blue-400", overdue: "bg-red-500/20 text-red-400", completed: "bg-green-500/20 text-green-400" };

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function TaskModal({ task, onClose, onComplete }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="glass rounded-2xl p-6 w-full max-w-md space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
              {task.status.toUpperCase()}
            </span>
            <h3 className="font-semibold text-foreground mt-2">{task.title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Equipment</span>
            <span className="text-foreground font-medium">{task.equipment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Due</span>
            <span className={`font-medium ${task.status === "overdue" ? "text-red-400" : "text-foreground"}`}>
              {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Priority</span>
            <span className={`font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interval</span>
            <span className="text-foreground">Every {task.intervalDays} days</span>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Dismiss
          </button>
          <button
            onClick={() => onComplete(task.id)}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={14} />
            Mark Complete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MaintenancePage() {
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [selectedTask, setSelectedTask] = useState(null);
  const [view, setView] = useState("calendar"); // "calendar" | "list"

  const prevMonth = () => setViewDate(d => {
    const m = d.month === 0 ? 11 : d.month - 1;
    const y = d.month === 0 ? d.year - 1 : d.year;
    return { year: y, month: m };
  });
  const nextMonth = () => setViewDate(d => {
    const m = d.month === 11 ? 0 : d.month + 1;
    const y = d.month === 11 ? d.year + 1 : d.year;
    return { year: y, month: m };
  });

  const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
  const firstDay = getFirstDayOfMonth(viewDate.year, viewDate.month);

  const getTasksForDay = (day) => {
    const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return tasks.filter(t => t.dueDate === dateStr);
  };

  const handleComplete = (id) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: "completed" } : t));
    setSelectedTask(null);
  };

  const overdue = tasks.filter(t => t.status === "overdue");
  const upcoming = tasks.filter(t => t.status === "pending").slice(0, 5);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 animate-fade-in">
      <AnimatePresence>
        {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} onComplete={handleComplete} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench size={22} className="text-primary" />
            Maintenance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {overdue.length > 0 ? (
              <span className="text-red-400 font-medium">{overdue.length} overdue task{overdue.length > 1 ? "s" : ""}</span>
            ) : "All tasks on schedule"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary rounded-xl p-1 gap-1">
            {["calendar", "list"].map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">
            <Plus size={14} />
            Add Task
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
          <div className="space-y-1.5">
            {overdue.map(t => (
              <button key={t.id} onClick={() => setSelectedTask(t)} className="w-full flex items-center justify-between text-left hover:bg-red-500/10 rounded-lg px-2 py-1.5 transition-colors">
                <span className="text-sm text-foreground">{t.title}</span>
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(t.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "calendar" ? (
        <div className="glass rounded-2xl p-5">
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-semibold text-foreground">{MONTHS[viewDate.month]} {viewDate.year}</h2>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`blank-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTasks = getTasksForDay(day);
              const isToday = today.getDate() === day && today.getMonth() === viewDate.month && today.getFullYear() === viewDate.year;
              const hasOverdue = dayTasks.some(t => t.status === "overdue");

              return (
                <div
                  key={day}
                  className={`aspect-square relative p-1 rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors ${isToday ? "ring-1 ring-primary" : ""}`}
                >
                  <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-foreground"}`}>{day}</span>
                  {dayTasks.length > 0 && (
                    <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                      {dayTasks.slice(0, 3).map(t => (
                        <span
                          key={t.id}
                          onClick={() => setSelectedTask(t)}
                          className={`w-1.5 h-1.5 rounded-full ${t.status === "overdue" ? "bg-red-500" : t.priority === "high" ? "bg-yellow-500" : "bg-cyan-500"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            {[
              { color: "bg-red-500", label: "Overdue" },
              { color: "bg-yellow-500", label: "High priority" },
              { color: "bg-cyan-500", label: "Normal" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${l.color}`} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/50">
            {tasks.map(task => {
              const Icon = EQUIPMENT_ICONS[task.equipmentType] || Wrench;
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <Icon size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.equipment}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
                      {task.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}