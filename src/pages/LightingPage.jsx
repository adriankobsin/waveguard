import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Layers, Zap, Settings, Play, Moon, Music2, Anchor, Sun, Coffee, ChevronDown, LayoutGrid, Map } from "lucide-react";
import LightingZoneMap from "../components/lighting/LightingZoneMap";
import LightingZoneList from "../components/lighting/LightingZoneList";
import LightingScenePanel from "../components/lighting/LightingScenePanel";
import LightingSystemStatus from "../components/lighting/LightingSystemStatus";
import { INITIAL_ZONES, DECKS, SCENES, GATEWAYS } from "../components/lighting/lightingData";

export default function LightingPage() {
  const [zones, setZones] = useState(INITIAL_ZONES);
  const [activeDeck, setActiveDeck] = useState("main");
  const [selectedZone, setSelectedZone] = useState(null);
  const [viewMode, setViewMode] = useState("map"); // "map" | "list"
  const [activeScene, setActiveScene] = useState(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  // Update a single zone field
  const updateZone = (id, patch) =>
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));

  // Trigger a scene — applies level/color overrides to all targeted zones
  const triggerScene = (scene) => {
    setSceneLoading(true);
    setActiveScene(scene.id);
    setTimeout(() => {
      setZones(prev => prev.map(z => {
        const override = scene.zones[z.id];
        if (!override) return z;
        return { ...z, on: override.on ?? z.on, level: override.level ?? z.level, color: override.color ?? z.color };
      }));
      setSceneLoading(false);
    }, 900);
  };

  const deckZones = zones.filter(z => z.deck === activeDeck);
  const onlineGateways = GATEWAYS.filter(g => g.status === "online").length;
  const onZones = zones.filter(z => z.on).length;
  const faultZones = zones.filter(z => z.fault).length;

  return (
    <div className="min-h-screen bg-[#060912] flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 bg-[#070b13]/90 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/12 flex items-center justify-center ring-1 ring-amber-500/20">
            <Lightbulb size={16} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Lighting Control</h1>
            <p className="text-xs text-slate-500 mt-0.5">DMX · DALI · KNX · Lutron — deck-by-deck zone management</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Summary pills */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Lightbulb size={11} />{onZones} zones on
            </span>
            {faultZones > 0 && (
              <span className="flex items-center gap-1.5 text-red-400">
                <Zap size={11} />{faultZones} fault{faultZones > 1 ? "s" : ""}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Settings size={11} />{onlineGateways}/{GATEWAYS.length} gateways
            </span>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
            {[
              { key: "map",  icon: Map,        label: "Map"  },
              { key: "list", icon: LayoutGrid,  label: "List" },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === v.key
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <v.icon size={12} />{v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Scene panel + System status ── */}
        <div className="w-64 flex-shrink-0 border-r border-white/6 bg-[#070b13]/70 flex flex-col overflow-y-auto">
          <LightingScenePanel
            scenes={SCENES}
            activeScene={activeScene}
            loading={sceneLoading}
            onTrigger={triggerScene}
          />
          <LightingSystemStatus gateways={GATEWAYS} zones={zones} />
        </div>

        {/* ── Center: Deck selector + main view ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Deck tabs */}
          <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/6 bg-[#070b13]/50 flex-shrink-0 overflow-x-auto">
            {DECKS.map(deck => {
              const deckZoneCount = zones.filter(z => z.deck === deck.id).length;
              const deckOnCount = zones.filter(z => z.deck === deck.id && z.on).length;
              const hasFault = zones.some(z => z.deck === deck.id && z.fault);
              return (
                <button
                  key={deck.id}
                  onClick={() => setActiveDeck(deck.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                    activeDeck === deck.id
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "text-slate-500 hover:text-slate-200 hover:bg-white/4 border-transparent"
                  }`}
                >
                  <Layers size={11} />
                  {deck.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeDeck === deck.id ? "bg-amber-500/20 text-amber-300" : "bg-white/6 text-slate-500"
                  }`}>
                    {deckOnCount}/{deckZoneCount}
                  </span>
                  {hasFault && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Main view */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {viewMode === "map" ? (
                <motion.div
                  key="map"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0"
                >
                  <LightingZoneMap
                    deck={DECKS.find(d => d.id === activeDeck)}
                    zones={deckZones}
                    selectedZone={selectedZone}
                    onSelectZone={setSelectedZone}
                    onUpdateZone={updateZone}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 overflow-y-auto p-4"
                >
                  <LightingZoneList
                    zones={deckZones}
                    selectedZone={selectedZone}
                    onSelectZone={setSelectedZone}
                    onUpdateZone={updateZone}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right: Zone detail panel ── */}
        <AnimatePresence>
          {selectedZone && (
            <ZoneDetailPanel
              zone={zones.find(z => z.id === selectedZone)}
              onClose={() => setSelectedZone(null)}
              onUpdate={updateZone}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Zone detail side panel ────────────────────────────────────────────────────
function ZoneDetailPanel({ zone, onClose, onUpdate }) {
  if (!zone) return null;

  const protocolColor = {
    DMX:  "text-purple-400 bg-purple-500/12 border-purple-500/25",
    DALI: "text-blue-400 bg-blue-500/12 border-blue-500/25",
    KNX:  "text-orange-400 bg-orange-500/12 border-orange-500/25",
    Lutron: "text-cyan-400 bg-cyan-500/12 border-cyan-500/25",
  }[zone.protocol] || "text-slate-400 bg-slate-500/12 border-slate-500/25";

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="w-72 flex-shrink-0 border-l border-white/8 bg-[#070b13]/98 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-white/8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${protocolColor}`}>
              {zone.protocol}
            </span>
            {zone.fault && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/12 text-red-400">
                FAULT
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-white">{zone.name}</p>
          <p className="text-xs text-slate-500">{zone.location}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors ml-2 flex-shrink-0">
          <ChevronDown size={14} className="rotate-[-90deg]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Power toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Power</p>
            <p className="text-xs text-slate-500">{zone.on ? "Zone is active" : "Zone is off"}</p>
          </div>
          <button
            onClick={() => onUpdate(zone.id, { on: !zone.on })}
            className={`relative w-12 h-6 rounded-full transition-colors ${zone.on ? "bg-amber-500" : "bg-white/10"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${zone.on ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Dimmer */}
        <div>
          <div className="flex justify-between mb-2">
            <p className="text-sm font-semibold text-white">Dim Level</p>
            <p className="text-sm font-bold text-amber-400">{zone.level}%</p>
          </div>
          <input
            type="range" min={0} max={100} value={zone.level}
            onChange={e => onUpdate(zone.id, { level: +e.target.value, on: +e.target.value > 0 })}
            className="w-full accent-amber-400 cursor-pointer"
            style={{ accentColor: "#f59e0b" }}
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>Off</span><span>Full</span>
          </div>
        </div>

        {/* Color temperature (if supported) */}
        {zone.colorTemp && (
          <div>
            <div className="flex justify-between mb-2">
              <p className="text-sm font-semibold text-white">Color Temp</p>
              <p className="text-xs font-bold text-amber-300">{zone.colorTemp}K</p>
            </div>
            <input
              type="range" min={2700} max={6500} step={100} value={zone.colorTemp}
              onChange={e => onUpdate(zone.id, { colorTemp: +e.target.value })}
              className="w-full cursor-pointer"
              style={{ accentColor: "#fde68a" }}
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>Warm 2700K</span><span>Cool 6500K</span>
            </div>
          </div>
        )}

        {/* Quick levels */}
        <div>
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-widest">Quick Set</p>
          <div className="grid grid-cols-4 gap-2">
            {[0, 25, 50, 75, 100].map(lvl => (
              <button
                key={lvl}
                onClick={() => onUpdate(zone.id, { level: lvl, on: lvl > 0 })}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  zone.level === lvl
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                    : "border-white/8 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {lvl === 0 ? "Off" : `${lvl}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Channel info */}
        <div className="rounded-xl bg-white/3 border border-white/7 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Hardware</p>
          {[
            { label: "Protocol",  value: zone.protocol },
            { label: "Universe",  value: zone.universe ?? "—" },
            { label: "Channel",   value: zone.channel ?? "—" },
            { label: "Gateway",   value: zone.gateway },
            { label: "Fixtures",  value: zone.fixtures },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-xs">
              <span className="text-slate-500">{r.label}</span>
              <span className="text-slate-200 font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}