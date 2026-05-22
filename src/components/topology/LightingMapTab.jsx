import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, X, Plus, SunMedium, Moon, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Sliders } from "lucide-react";

// ─── Initial light zone data ──────────────────────────────────────────────────
const INITIAL_ZONES = [
  { id: "z01", name: "Bridge Overhead",    protocol: "DALI",   deck: "Bridge",      x: 18,  y: 12,  level: 80, active: true,  status: "ok",    address: "DALI 1.001", color: "#fbbf24" },
  { id: "z02", name: "Bridge Consoles",    protocol: "DALI",   deck: "Bridge",      x: 35,  y: 25,  level: 45, active: true,  status: "ok",    address: "DALI 1.002", color: "#fbbf24" },
  { id: "z03", name: "Saloon Main",        protocol: "Lutron", deck: "Main",        x: 52,  y: 18,  level: 100,active: true,  status: "ok",    address: "Lutron R01",  color: "#a78bfa" },
  { id: "z04", name: "Saloon Ambient",     protocol: "Lutron", deck: "Main",        x: 66,  y: 30,  level: 60, active: true,  status: "ok",    address: "Lutron R02",  color: "#a78bfa" },
  { id: "z05", name: "Dining Table",       protocol: "Lutron", deck: "Main",        x: 52,  y: 44,  level: 70, active: true,  status: "ok",    address: "Lutron R03",  color: "#a78bfa" },
  { id: "z06", name: "Fore Deck Wash",     protocol: "DMX",    deck: "Upper Deck",  x: 22,  y: 58,  level: 100,active: false, status: "fault", address: "DMX U1.001",  color: "#60a5fa" },
  { id: "z07", name: "Aft Deck RGB",       protocol: "DMX",    deck: "Upper Deck",  x: 78,  y: 60,  level: 55, active: true,  status: "ok",    address: "DMX U1.002",  color: "#60a5fa" },
  { id: "z08", name: "Master Cabin",       protocol: "DALI",   deck: "Lower",       x: 30,  y: 72,  level: 20, active: true,  status: "ok",    address: "DALI 2.001", color: "#fbbf24" },
  { id: "z09", name: "Guest Cabin 1",      protocol: "DALI",   deck: "Lower",       x: 55,  y: 75,  level: 0,  active: false, status: "ok",    address: "DALI 2.002", color: "#fbbf24" },
  { id: "z10", name: "Engine Room Safety", protocol: "DMX",    deck: "Lower",       x: 75,  y: 80,  level: 100,active: true,  status: "ok",    address: "DMX L1.001",  color: "#34d399" },
];

const PROTOCOLS = ["DALI", "Lutron", "DMX"];
const DECKS     = ["All", "Bridge", "Main", "Upper Deck", "Lower"];

const PROTOCOL_COLORS = {
  DALI:   { ring: "#fbbf24", bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/30" },
  Lutron: { ring: "#a78bfa", bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
  DMX:    { ring: "#60a5fa", bg: "bg-blue-500/15",   text: "text-blue-400",   border: "border-blue-500/30" },
};

const STATUS_CONFIG = {
  ok:    { dot: "bg-emerald-400", text: "text-emerald-400", label: "OK" },
  fault: { dot: "bg-red-400",     text: "text-red-400",     label: "Fault" },
  comm:  { dot: "bg-amber-400",   text: "text-amber-400",   label: "Comm error" },
};

// ─── Zone marker on the floor plan ───────────────────────────────────────────
function ZoneMarker({ zone, selected, onClick }) {
  const pc = PROTOCOL_COLORS[zone.protocol];
  const sc = STATUS_CONFIG[zone.status] || STATUS_CONFIG.ok;
  const glowColor = zone.active ? zone.color : "#334155";

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.15 }}
      onClick={onClick}
      style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group"
      title={zone.name}
    >
      {/* Glow ring for active zones */}
      {zone.active && zone.status === "ok" && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-40"
          style={{ background: glowColor, animationDuration: "2.5s" }}
        />
      )}

      {/* Main circle */}
      <div
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all border-2 shadow-lg ${
          selected ? "scale-125" : ""
        }`}
        style={{
          background: zone.active ? `${zone.color}22` : "#0f172a",
          borderColor: selected ? "#ffffff" : zone.active ? zone.color : "#334155",
          boxShadow: zone.active && zone.status === "ok" ? `0 0 14px ${zone.color}66` : "none",
        }}
      >
        <Lightbulb
          size={15}
          style={{ color: zone.active ? zone.color : "#475569" }}
          fill={zone.active ? `${zone.color}55` : "none"}
        />
        {/* Level ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke={zone.color} strokeOpacity="0.15" strokeWidth="2" />
          <circle
            cx="18" cy="18" r="16" fill="none"
            stroke={zone.active ? zone.color : "#334155"}
            strokeOpacity={zone.active ? 0.7 : 0.3}
            strokeWidth="2"
            strokeDasharray={`${(zone.level / 100) * 100.53} 100.53`}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Status dot */}
      {zone.status !== "ok" && (
        <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${sc.dot}`} />
      )}

      {/* Label tooltip */}
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-background/90 px-1.5 py-0.5 rounded">
        {zone.name}
      </span>
    </motion.button>
  );
}

// ─── Zone detail / control panel ─────────────────────────────────────────────
function ZonePanel({ zone, onClose, onUpdate }) {
  const pc = PROTOCOL_COLORS[zone.protocol];
  const sc = STATUS_CONFIG[zone.status] || STATUS_CONFIG.ok;

  return (
    <AnimatePresence>
      <motion.div
        key={zone.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.18 }}
        className="absolute top-4 right-4 w-72 z-20 pointer-events-auto"
      >
        <div className="rounded-2xl border border-border bg-secondary/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <Lightbulb size={14} style={{ color: zone.active ? zone.color : "#475569" }} />
              <p className="text-sm font-semibold text-foreground truncate">{zone.name}</p>
            </div>
            <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} />
            </button>
          </div>

          {/* Badges */}
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${pc.bg} ${pc.text} ${pc.border}`}>
              {zone.protocol}
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-border text-muted-foreground">
              {zone.deck}
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${zone.status === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>

          {/* Address */}
          <div className="px-4 pt-2 pb-3 flex justify-between text-xs">
            <span className="text-muted-foreground">Address</span>
            <span className="font-mono text-secondary-foreground">{zone.address}</span>
          </div>

          {/* Power toggle */}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">{zone.active ? "On" : "Off"}</p>
              <p className="text-xs text-muted-foreground">Quick toggle</p>
            </div>
            <button
              onClick={() => onUpdate(zone.id, { active: !zone.active })}
              className={`relative w-12 h-6 rounded-full transition-all ${zone.active ? "bg-amber-500" : "bg-secondary border border-border"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${zone.active ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Level slider */}
          <div className="px-4 pb-4 border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Sliders size={10} /> Dim level</p>
              <p className="text-xs font-bold" style={{ color: zone.active ? zone.color : "#475569" }}>{zone.level}%</p>
            </div>
            <input
              type="range"
              min={0} max={100}
              value={zone.level}
              disabled={!zone.active}
              onChange={e => onUpdate(zone.id, { level: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40"
              style={{ accentColor: zone.color }}
            />
            <div className="flex justify-between mt-2 gap-1">
              {[0, 25, 50, 75, 100].map(v => (
                <button
                  key={v}
                  onClick={() => onUpdate(zone.id, { level: v })}
                  disabled={!zone.active}
                  className={`flex-1 text-[10px] py-1 rounded-lg border transition-colors disabled:opacity-30 ${
                    zone.level === v
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                      : "border-border text-muted-foreground hover:border-border hover:text-secondary-foreground"
                  }`}
                >
                  {v === 0 ? "Off" : v === 100 ? "Full" : `${v}%`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Zone list row ────────────────────────────────────────────────────────────
function ZoneRow({ zone, selected, onClick, onToggle, onLevel }) {
  const pc = PROTOCOL_COLORS[zone.protocol];
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
        selected ? "bg-muted border border-border" : "hover:bg-muted border border-transparent"
      }`}
      onClick={onClick}
    >
      {/* Indicator */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: zone.active ? `${zone.color}22` : "#1e293b" }}>
        <Lightbulb size={13} style={{ color: zone.active ? zone.color : "#475569" }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{zone.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] ${pc.text}`}>{zone.protocol}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">{zone.deck}</span>
          {zone.status !== "ok" && <span className="text-[10px] text-red-400">⚠ Fault</span>}
        </div>
      </div>

      {/* Level bar */}
      <div className="w-10 flex flex-col items-end gap-0.5">
        <span className="text-[10px] font-mono" style={{ color: zone.active ? zone.color : "#475569" }}>{zone.level}%</span>
        <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${zone.level}%`, background: zone.active ? zone.color : "#334155" }} />
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(zone.id); }}
        className="flex-shrink-0"
      >
        {zone.active
          ? <ToggleRight size={18} style={{ color: zone.color }} />
          : <ToggleLeft size={18} className="text-muted-foreground" />}
      </button>
    </div>
  );
}

// ─── Main Lighting Map ────────────────────────────────────────────────────────
export default function LightingMapTab() {
  const [zones, setZones] = useState(INITIAL_ZONES);
  const [selectedId, setSelectedId] = useState(null);
  const [deckFilter, setDeckFilter] = useState("All");
  const [protoFilter, setProtoFilter] = useState("All");
  const [addMode, setAddMode] = useState(false);
  const [listExpanded, setListExpanded] = useState(true);
  const floorRef = useRef();

  const selectedZone = zones.find(z => z.id === selectedId);

  const updateZone = useCallback((id, patch) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));
  }, []);

  const handleFloorClick = useCallback((e) => {
    if (!addMode) return;
    const rect = floorRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = `z${Date.now()}`;
    const newZone = {
      id, name: `Zone ${zones.length + 1}`,
      protocol: "DALI", deck: "Main",
      x, y,
      level: 100, active: true, status: "ok",
      address: `DALI 1.${String(zones.length + 1).padStart(3, "0")}`,
      color: "#fbbf24",
    };
    setZones(prev => [...prev, newZone]);
    setSelectedId(id);
    setAddMode(false);
  }, [addMode, zones.length]);

  const allOn  = () => setZones(prev => prev.map(z => ({ ...z, active: true })));
  const allOff = () => setZones(prev => prev.map(z => ({ ...z, active: false })));

  const filteredZones = zones.filter(z => {
    const deckOk  = deckFilter  === "All" || z.deck     === deckFilter;
    const protoOk = protoFilter === "All" || z.protocol === protoFilter;
    return deckOk && protoOk;
  });

  const activeCt = zones.filter(z => z.active).length;
  const faultCt  = zones.filter(z => z.status !== "ok").length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: floor plan ─────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-background overflow-hidden">

        {/* Toolbar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 flex-wrap">
          {/* Deck filter */}
          <div className="flex items-center gap-1 bg-secondary/90 border border-border rounded-xl px-2 py-1.5 backdrop-blur">
            {DECKS.map(d => (
              <button
                key={d}
                onClick={() => setDeckFilter(d)}
                className={`text-[10px] px-2 py-0.5 rounded-lg transition-colors ${deckFilter === d ? "bg-amber-500/25 text-amber-400" : "text-muted-foreground hover:text-secondary-foreground"}`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Protocol filter */}
          <div className="flex items-center gap-1 bg-secondary/90 border border-border rounded-xl px-2 py-1.5 backdrop-blur">
            {["All", ...PROTOCOLS].map(p => {
              const pc = PROTOCOL_COLORS[p];
              return (
                <button
                  key={p}
                  onClick={() => setProtoFilter(p)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg transition-colors ${protoFilter === p ? (pc ? `${pc.bg} ${pc.text}` : "bg-muted text-foreground") : "text-muted-foreground hover:text-secondary-foreground"}`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={allOn}  className="text-[10px] px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1"><SunMedium size={10} />All on</button>
            <button onClick={allOff} className="text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-600/40 bg-slate-500/10 text-muted-foreground hover:bg-slate-500/20 transition-colors flex items-center gap-1"><Moon size={10} />All off</button>
            <button
              onClick={() => setAddMode(m => !m)}
              className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${addMode ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <Plus size={10} /> {addMode ? "Click to place…" : "Add zone"}
            </button>
          </div>
        </div>

        {/* Floor plan canvas */}
        <div
          ref={floorRef}
          onClick={handleFloorClick}
          className={`absolute inset-0 mt-12 ${addMode ? "cursor-crosshair" : "cursor-default"}`}
        >
          {/* Deck plan SVG — simplified yacht outline */}
          <svg
            className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Hull outline */}
            <ellipse cx="50" cy="50" rx="44" ry="32" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
            {/* Deck dividers */}
            <line x1="6" y1="38" x2="94" y2="38" stroke="#475569" strokeWidth="0.3" strokeDasharray="2,2" />
            <line x1="6" y1="55" x2="94" y2="55" stroke="#475569" strokeWidth="0.3" strokeDasharray="2,2" />
            <line x1="6" y1="68" x2="94" y2="68" stroke="#475569" strokeWidth="0.3" strokeDasharray="2,2" />
            {/* Bow */}
            <path d="M50,18 Q56,18 60,22 Q64,27 64,34" fill="none" stroke="#475569" strokeWidth="0.3" />
            <path d="M50,18 Q44,18 40,22 Q36,27 36,34" fill="none" stroke="#475569" strokeWidth="0.3" />
            {/* Stern */}
            <path d="M20,68 Q15,72 15,80 Q18,85 50,85 Q82,85 85,80 Q85,72 80,68" fill="none" stroke="#475569" strokeWidth="0.3" />
            {/* Room boxes */}
            <rect x="25" y="20" width="50" height="16" rx="1" fill="none" stroke="#334155" strokeWidth="0.3" />
            <rect x="25" y="38" width="50" height="16" rx="1" fill="none" stroke="#334155" strokeWidth="0.3" />
            <rect x="25" y="55" width="50" height="12" rx="1" fill="none" stroke="#334155" strokeWidth="0.3" />
            <rect x="25" y="68" width="50" height="12" rx="1" fill="none" stroke="#334155" strokeWidth="0.3" />
            {/* Deck labels */}
            <text x="8" y="30" fontSize="2.5" fill="#475569" fontFamily="monospace">BRIDGE</text>
            <text x="8" y="48" fontSize="2.5" fill="#475569" fontFamily="monospace">MAIN</text>
            <text x="8" y="63" fontSize="2.5" fill="#475569" fontFamily="monospace">UPPER</text>
            <text x="8" y="76" fontSize="2.5" fill="#475569" fontFamily="monospace">LOWER</text>
          </svg>

          {/* Zone markers */}
          {filteredZones.map(zone => (
            <ZoneMarker
              key={zone.id}
              zone={zone}
              selected={selectedId === zone.id}
              onClick={() => setSelectedId(prev => prev === zone.id ? null : zone.id)}
            />
          ))}

          {/* Add-mode hint */}
          {addMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 pointer-events-none">
              Click anywhere on the floor plan to place a zone
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-secondary/90 border border-border rounded-xl px-3 py-2 backdrop-blur text-xs">
          <span className="flex items-center gap-1.5 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{activeCt} on</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />{zones.length - activeCt} off</span>
          {faultCt > 0 && <span className="flex items-center gap-1.5 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{faultCt} fault</span>}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{zones.length} zones</span>
        </div>

        {/* Selected zone detail panel */}
        {selectedZone && (
          <ZonePanel
            zone={selectedZone}
            onClose={() => setSelectedId(null)}
            onUpdate={updateZone}
          />
        )}
      </div>

      {/* ── Right: zone list ──────────────────────────────────────────────── */}
      <div className="w-64 flex flex-col border-l border-border bg-card/80 overflow-hidden flex-shrink-0">
        {/* List header */}
        <button
          onClick={() => setListExpanded(e => !e)}
          className="flex items-center justify-between px-4 py-3 border-b border-border text-xs font-semibold text-secondary-foreground hover:bg-muted transition-colors"
        >
          <span className="flex items-center gap-2">
            <Lightbulb size={12} className="text-amber-400" />
            Zones ({filteredZones.length})
          </span>
          {listExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Protocol legend */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
          {PROTOCOLS.map(p => {
            const pc = PROTOCOL_COLORS[p];
            return (
              <span key={p} className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: pc.ring }} />
                <span className={pc.text}>{p}</span>
              </span>
            );
          })}
        </div>

        {/* Zone list */}
        {listExpanded && (
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {filteredZones.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No zones match filters</div>
            ) : (
              filteredZones.map(zone => (
                <ZoneRow
                  key={zone.id}
                  zone={zone}
                  selected={selectedId === zone.id}
                  onClick={() => setSelectedId(prev => prev === zone.id ? null : zone.id)}
                  onToggle={id => updateZone(id, { active: !zones.find(z => z.id === id)?.active })}
                  onLevel={(id, v) => updateZone(id, { level: v })}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
