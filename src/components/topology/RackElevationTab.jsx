import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Thermometer, Zap, X, AlertTriangle, Cpu, Wifi, HardDrive, Battery } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────
const RACKS = [
  { id: "rack-bridge",  name: "Bridge Rack",    units: 12, location: "Bridge",      watts: 420,  tempC: 38 },
  { id: "rack-saloon",  name: "Saloon AV Rack", units: 9,  location: "Saloon",      watts: 310,  tempC: 35 },
  { id: "rack-engine",  name: "Engine Room",    units: 8,  location: "Engine Room", watts: 680,  tempC: 52 },
];

const ICON_MAP = {
  Network: Wifi,
  Camera:  Cpu,
  AV:      Cpu,
  Server:  HardDrive,
  Power:   Battery,
};

// Each item: ruStart = 1-based from top, ruHeight = rack units consumed
const INITIAL_ITEMS = {
  "rack-bridge": [
    { id: "router-wan",  name: "Router-WAN",      model: "MikroTik CCR2004-1G",  category: "Network", ruStart: 1, ruHeight: 1, watts: 25,  color: "#06b6d4" },
    { id: "sw-bridge",   name: "SW-Bridge",        model: "Cisco CBS350-24T",     category: "Network", ruStart: 2, ruHeight: 1, watts: 45,  color: "#06b6d4" },
    { id: "qsys-core",   name: "Q-SYS Core",       model: "Q-SYS Core 110f",      category: "AV",      ruStart: 4, ruHeight: 2, watts: 120, color: "#60a5fa" },
    { id: "ap-bridge",   name: "AP-Bridge",         model: "Ubiquiti UAP-AC-Pro",  category: "Network", ruStart: 7, ruHeight: 1, watts: 15,  color: "#06b6d4" },
  ],
  "rack-saloon": [
    { id: "sw-saloon",   name: "SW-Saloon",         model: "Cisco CBS350-16T",     category: "Network", ruStart: 1, ruHeight: 1, watts: 35,  color: "#06b6d4" },
    { id: "av-proc",     name: "AV-Proc-Saloon",    model: "Crestron NVX-350",     category: "AV",      ruStart: 2, ruHeight: 2, watts: 85,  color: "#60a5fa" },
    { id: "av-matrix",   name: "AV-Matrix-Saloon",  model: "Kramer VS-88H",        category: "AV",      ruStart: 4, ruHeight: 1, watts: 40,  color: "#60a5fa" },
    { id: "ups-av",      name: "UPS-AV",             model: "APC Smart-UPS 750VA",  category: "Power",   ruStart: 7, ruHeight: 2, watts: 25,  color: "#fbbf24" },
  ],
  "rack-engine": [
    { id: "nas",         name: "NAS-Synology",       model: "Synology DS1522+",     category: "Server",  ruStart: 1, ruHeight: 2, watts: 65,  color: "#34d399" },
    { id: "sw-engine",   name: "SW-Engine",           model: "Cisco SG250-18",       category: "Network", ruStart: 3, ruHeight: 1, watts: 30,  color: "#06b6d4" },
    { id: "sw-deck",     name: "SW-Deck-Lower",       model: "Cisco SG250-18",       category: "Network", ruStart: 4, ruHeight: 1, watts: 30,  color: "#06b6d4" },
    { id: "ups-main",    name: "UPS-Main",             model: "APC Smart-UPS 3000VA", category: "Power",   ruStart: 5, ruHeight: 3, watts: 180, color: "#fbbf24" },
  ],
};

const TEMP_COLOR = (t) => {
  if (t >= 50) return { text: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30", bar: "#ef4444" };
  if (t >= 42) return { text: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", bar: "#f59e0b" };
  return { text: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", bar: "#22c55e" };
};

const RU_H = 32; // px per rack unit

// ─── Single rack unit slot ────────────────────────────────────────────────────
function RuSlot({ ru, isEmpty, onDrop }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(ru); }}
      style={{ height: RU_H }}
      className={`flex items-center border-b border-white/4 transition-colors ${over ? "bg-cyan-500/10" : ""}`}
    >
      <span className="w-8 text-right pr-2 text-[10px] font-mono text-slate-700 select-none flex-shrink-0">{ru}U</span>
      {isEmpty && over && (
        <div className="flex-1 mx-1 h-5 rounded border border-dashed border-cyan-500/50 bg-cyan-500/5 flex items-center justify-center">
          <span className="text-[9px] text-cyan-500/70">drop here</span>
        </div>
      )}
    </div>
  );
}

// ─── Equipment item in rack ───────────────────────────────────────────────────
function RackItem({ item, ruStart, onDragStart, onClick, selected }) {
  const Icon = ICON_MAP[item.category] || Server;
  return (
    <motion.div
      layout
      draggable
      onDragStart={() => onDragStart(item)}
      onClick={() => onClick(item)}
      style={{
        position: "absolute",
        top: (ruStart - 1) * RU_H + 1,
        left: 34,
        right: 4,
        height: item.ruHeight * RU_H - 2,
        borderColor: selected ? "#ffffff" : item.color + "99",
        boxShadow: selected ? `0 0 0 1px ${item.color}` : "none",
        background: `linear-gradient(135deg, ${item.color}18, ${item.color}08)`,
      }}
      className="rounded-lg border cursor-grab active:cursor-grabbing select-none overflow-hidden group hover:brightness-110 transition-all"
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-center gap-2 px-2.5 h-full">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: item.color + "22" }}>
          <Icon size={11} style={{ color: item.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-white truncate leading-tight">{item.name}</p>
          {item.ruHeight > 1 && (
            <p className="text-[9px] text-slate-500 truncate leading-tight">{item.model}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Zap size={9} className="text-amber-400/70" />
          <span className="text-[9px] font-mono text-amber-400/70">{item.watts}W</span>
        </div>
      </div>
      {/* heat bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60" style={{ background: item.color }} />
    </motion.div>
  );
}

// ─── Rack column ─────────────────────────────────────────────────────────────
function RackColumn({ rack, items, onItemMove, onItemClick, selectedId }) {
  const [dragging, setDragging] = useState(null);
  const tc = TEMP_COLOR(rack.tempC);
  const totalUnits = rack.units;

  // Build occupation map
  const occupied = {};
  items.forEach(item => {
    for (let u = item.ruStart; u < item.ruStart + item.ruHeight; u++) occupied[u] = item.id;
  });

  const handleDrop = useCallback((targetRu) => {
    if (!dragging) return;
    // Check if enough space
    let fits = true;
    for (let u = targetRu; u < targetRu + dragging.ruHeight; u++) {
      if (u > totalUnits || (occupied[u] && occupied[u] !== dragging.id)) { fits = false; break; }
    }
    if (!fits) return;
    onItemMove(rack.id, dragging.id, targetRu);
    setDragging(null);
  }, [dragging, occupied, totalUnits, rack.id, onItemMove]);

  const usedW = items.reduce((s, i) => s + i.watts, 0);
  const wPct  = Math.min(100, Math.round((usedW / (rack.watts)) * 100));
  const tPct  = Math.min(100, Math.round(((rack.tempC - 20) / 50) * 100));

  return (
    <div className="flex flex-col w-56 flex-shrink-0">
      {/* Rack header */}
      <div className="rounded-t-xl border border-b-0 border-white/10 bg-[#0d1220] px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-white">{rack.name}</p>
          <span className="text-[10px] text-slate-500 font-mono">{totalUnits}U</span>
        </div>
        <p className="text-[10px] text-slate-500 mb-2">{rack.location}</p>

        {/* Power bar */}
        <div className="mb-1.5">
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="flex items-center gap-1 text-amber-400/80"><Zap size={8} />{usedW}W</span>
            <span className="text-slate-600">{wPct}%</span>
          </div>
          <div className="h-1 bg-white/6 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${wPct}%`, background: wPct > 85 ? "#ef4444" : wPct > 65 ? "#f59e0b" : "#22c55e" }} />
          </div>
        </div>

        {/* Temp bar */}
        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className={`flex items-center gap-1 ${tc.text}`}><Thermometer size={8} />{rack.tempC}°C</span>
            {rack.tempC >= 50 && <AlertTriangle size={9} className="text-red-400" />}
          </div>
          <div className="h-1 bg-white/6 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${tPct}%`, background: tc.bar }} />
          </div>
        </div>
      </div>

      {/* Rack body */}
      <div
        className="relative border border-white/10 bg-[#070b12] rounded-b-xl overflow-hidden"
        style={{ height: totalUnits * RU_H }}
      >
        {/* RU slot lines + drop zones */}
        {Array.from({ length: totalUnits }, (_, i) => i + 1).map(ru => (
          <RuSlot
            key={ru}
            ru={ru}
            isEmpty={!occupied[ru]}
            onDrop={handleDrop}
          />
        ))}

        {/* Placed items */}
        {items.map(item => (
          <RackItem
            key={item.id}
            item={item}
            ruStart={item.ruStart}
            onDragStart={setDragging}
            onClick={onItemClick}
            selected={selectedId === item.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Item detail panel ────────────────────────────────────────────────────────
function ItemPanel({ item, onClose }) {
  const Icon = ICON_MAP[item.category] || Server;
  return (
    <AnimatePresence>
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-80 pointer-events-auto"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0a0f1c]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: item.color + "22" }}>
                <Icon size={13} style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">{item.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.model}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <X size={12} />
            </button>
          </div>
          <div className="px-4 py-3 grid grid-cols-3 gap-3">
            {[
              { label: "Category", value: item.category },
              { label: "Height",   value: `${item.ruHeight}U` },
              { label: "Power",    value: `${item.watts}W` },
            ].map(r => (
              <div key={r.label} className="text-center p-2 rounded-xl bg-white/4 border border-white/6">
                <p className="text-xs font-semibold text-white">{r.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RackElevationTab() {
  const [rackItems, setRackItems] = useState(INITIAL_ITEMS);
  const [selectedItem, setSelectedItem] = useState(null);

  // Drag from one rack to another is handled by HTML5 DnD across rack columns.
  // For simplicity, move within the same rack only (cross-rack drag requires
  // a global drag context — can be added later). onItemMove reorders within rack.
  const handleItemMove = useCallback((rackId, itemId, newRuStart) => {
    setRackItems(prev => ({
      ...prev,
      [rackId]: prev[rackId].map(item =>
        item.id === itemId ? { ...item, ruStart: newRuStart } : item
      ),
    }));
  }, []);

  const allItems = Object.values(rackItems).flat();
  const totalWatts = allItems.reduce((s, i) => s + i.watts, 0);
  const faultRacks = RACKS.filter(r => r.tempC >= 50);

  return (
    <div className="flex flex-col h-full bg-[#060912] overflow-hidden">
      {/* Top summary bar */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-b border-white/6 bg-[#070b13]/60 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Server size={11} className="text-cyan-400" />
          <span>{RACKS.length} racks</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <Zap size={11} />
          <span>{totalWatts}W total draw</span>
        </div>
        {faultRacks.map(r => (
          <div key={r.id} className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle size={11} />
            <span>{r.name} high temp ({r.tempC}°C)</span>
          </div>
        ))}
        <span className="ml-auto text-[10px] text-slate-600">Drag items to reposition within a rack</span>
      </div>

      {/* Racks area */}
      <div className="flex-1 overflow-auto p-5">
        <div className="relative flex gap-6 items-start min-w-max">
          {RACKS.map(rack => (
            <RackColumn
              key={rack.id}
              rack={rack}
              items={rackItems[rack.id] || []}
              onItemMove={handleItemMove}
              onItemClick={item => setSelectedItem(prev => prev?.id === item.id ? null : item)}
              selectedId={selectedItem?.id}
            />
          ))}

          {/* Item detail */}
          {selectedItem && (
            <ItemPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
          )}
        </div>
      </div>
    </div>
  );
}