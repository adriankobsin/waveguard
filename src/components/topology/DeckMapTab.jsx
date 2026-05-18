import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DevicePinDrawer from "./DevicePinDrawer";
import DeckMapUploader from "./DeckMapUploader";
import DeckMapCanvas from "./DeckMapCanvas";
import { DEVICES, MOCK_STATUS, MOCK_EVENTS, MOCK_DOCS } from "./deckMapData";

export default function DeckMapTab() {
  const [floorPlan, setFloorPlan] = useState(null); // { url, name, width, height }
  const [pins, setPins] = useState([]);             // [{ id, deviceId, x, y }] — x/y as % of image
  const [placingDevice, setPlacingDevice] = useState(null); // device to place next
  const [selectedPin, setSelectedPin] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleImageUpload = (imageData) => {
    setFloorPlan(imageData);
    setPins([]);
  };

  const handleCanvasClick = useCallback((xPct, yPct) => {
    if (!placingDevice) return;
    setPins(prev => [
      ...prev.filter(p => p.deviceId !== placingDevice.id), // one pin per device
      { id: `pin-${Date.now()}`, deviceId: placingDevice.id, x: xPct, y: yPct },
    ]);
    setPlacingDevice(null);
  }, [placingDevice]);

  const handlePinClick = (pin) => {
    const device = DEVICES.find(d => d.id === pin.deviceId);
    setSelectedPin({ ...pin, device });
    setDrawerOpen(true);
  };

  const handleRemovePin = (pinId) => {
    setPins(prev => prev.filter(p => p.id !== pinId));
    setDrawerOpen(false);
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#060912]">
      {/* ── Left panel: device list ─────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-r border-white/6 bg-[#070b13]/80 flex flex-col">
        <div className="px-4 py-3 border-b border-white/6">
          <p className="text-xs font-bold text-white uppercase tracking-widest">Devices</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Click to pin on map</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {DEVICES.map(device => {
            const status = MOCK_STATUS[device.id] || "unknown";
            const isPinned = pins.some(p => p.deviceId === device.id);
            const isPlacing = placingDevice?.id === device.id;
            const dotColor = status === "online" ? "bg-emerald-400" : status === "offline" ? "bg-red-400" : status === "warning" ? "bg-amber-400" : "bg-slate-500";

            return (
              <button
                key={device.id}
                onClick={() => setPlacingDevice(isPlacing ? null : device)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all ${
                  isPlacing
                    ? "bg-cyan-500/15 border-l-2 border-cyan-500"
                    : isPinned
                    ? "bg-white/3 border-l-2 border-emerald-500/40"
                    : "border-l-2 border-transparent hover:bg-white/4"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="text-xs text-slate-200 truncate flex-1">{device.name}</span>
                {isPinned && !isPlacing && (
                  <span className="text-[9px] text-emerald-400/70 flex-shrink-0">●</span>
                )}
                {isPlacing && (
                  <span className="text-[9px] text-cyan-400 flex-shrink-0 animate-pulse">+</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-white/6 space-y-1.5">
          {[
            { color: "bg-emerald-400", label: "Online" },
            { color: "bg-amber-400", label: "Warning" },
            { color: "bg-red-400", label: "Offline" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${l.color}`} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {!floorPlan ? (
          <DeckMapUploader onUpload={handleImageUpload} />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/6 bg-[#070b13]/60 flex-shrink-0">
              <span className="text-xs text-slate-400 truncate flex-1">{floorPlan.name}</span>
              {placingDevice && (
                <span className="flex items-center gap-1.5 text-xs text-cyan-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Placing: <b>{placingDevice.name}</b> — click on map
                </span>
              )}
              <span className="text-xs text-slate-600">{pins.length} pin{pins.length !== 1 ? "s" : ""}</span>
              <button
                onClick={() => { setFloorPlan(null); setPins([]); setDrawerOpen(false); }}
                className="text-xs text-slate-500 hover:text-red-400 border border-white/10 px-2.5 py-1 rounded-lg transition-colors"
              >
                Change plan
              </button>
            </div>

            <DeckMapCanvas
              floorPlan={floorPlan}
              pins={pins}
              devices={DEVICES}
              mockStatus={MOCK_STATUS}
              placingDevice={placingDevice}
              onCanvasClick={handleCanvasClick}
              onPinClick={handlePinClick}
            />
          </>
        )}
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && selectedPin && (
          <DevicePinDrawer
            pin={selectedPin}
            status={MOCK_STATUS[selectedPin.deviceId] || "unknown"}
            events={MOCK_EVENTS[selectedPin.deviceId] || []}
            docs={MOCK_DOCS[selectedPin.deviceId] || []}
            onClose={() => setDrawerOpen(false)}
            onRemovePin={() => handleRemovePin(selectedPin.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}