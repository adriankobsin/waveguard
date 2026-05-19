import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import DevicePinDrawer from "./DevicePinDrawer";
import DeckMapUploader from "./DeckMapUploader";
import DeckMapCanvas from "./DeckMapCanvas";
import CablePathDrawer from "./CablePathDrawer";
import { DEVICES, MOCK_STATUS, MOCK_EVENTS, MOCK_DOCS } from "./deckMapData";
import { Cable, MapPin, Layers, X } from "lucide-react";

export default function DeckMapTab({ topologyData }) {
  const [floorPlan, setFloorPlan] = useState(null);
  const [pins, setPins] = useState([]);
  const [cablePaths, setCablePaths] = useState([]);
  const [placingDevice, setPlacingDevice] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cable draw mode: click first pinned device → click second → creates a cable path
  const [cableDrawMode, setCableDrawMode] = useState(false);
  const [cableDrawStart, setCableDrawStart] = useState(null); // { deviceId, x, y }
  const [selectedCable, setSelectedCable] = useState(null);
  const [cableDrawerOpen, setCableDrawerOpen] = useState(false);

  // Use live topology devices if available, fall back to mock
  const devices = topologyData?.devices?.length ? topologyData.devices : DEVICES;
  const statusMap = topologyData?.devices?.length
    ? Object.fromEntries(topologyData.devices.map(d => [d.id, d.status || "unknown"]))
    : MOCK_STATUS;

  const handleImageUpload = (imageData) => {
    setFloorPlan(imageData);
    setPins([]);
    setCablePaths([]);
  };

  const handleCanvasClick = useCallback((xPct, yPct) => {
    if (placingDevice) {
      setPins(prev => [
        ...prev.filter(p => p.deviceId !== placingDevice.id),
        { id: `pin-${Date.now()}`, deviceId: placingDevice.id, x: xPct, y: yPct },
      ]);
      setPlacingDevice(null);
    }
  }, [placingDevice]);

  const handlePinClick = useCallback((pin) => {
    if (cableDrawMode) {
      if (!cableDrawStart) {
        // First device selected — store as start
        setCableDrawStart({ deviceId: pin.deviceId, x: pin.x, y: pin.y });
        return;
      }
      if (cableDrawStart.deviceId === pin.deviceId) {
        // Clicked same device — cancel
        setCableDrawStart(null);
        return;
      }
      // Second device — open cable creation drawer
      setSelectedCable({
        fromDeviceId: cableDrawStart.deviceId,
        toDeviceId: pin.deviceId,
      });
      setCableDrawStart(null);
      setCableDrawerOpen(true);
      return;
    }

    // Normal mode — show device details
    const device = devices.find(d => d.id === pin.deviceId);
    setSelectedPin({ ...pin, device });
    setDrawerOpen(true);
  }, [cableDrawMode, cableDrawStart, devices]);

  const handleRemovePin = (pinId) => {
    setPins(prev => prev.filter(p => p.id !== pinId));
    setDrawerOpen(false);
  };

  const handleSaveCable = (cableData) => {
    setCablePaths(prev => [...prev, { id: `cable-${Date.now()}`, ...cableData }]);
    setCableDrawerOpen(false);
    setSelectedCable(null);
  };

  const handleRemoveCable = (cableId) => {
    setCablePaths(prev => prev.filter(c => c.id !== cableId));
  };

  const pinnedDeviceIds = new Set(pins.map(p => p.deviceId));

  return (
    <div className="flex h-full overflow-hidden bg-[#060912]">
      {/* ── Left panel: device list ─────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-r border-white/6 bg-[#070b13]/80 flex flex-col">
        <div className="px-4 py-3 border-b border-white/6">
          <p className="text-xs font-bold text-white uppercase tracking-widest">Devices</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {floorPlan ? "Click to pin on map" : "Upload a floor plan first"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {devices.map(device => {
            const status = statusMap[device.id] || "unknown";
            const isPinned = pinnedDeviceIds.has(device.id);
            const isPlacing = placingDevice?.id === device.id;
            const dotColor =
              status === "online" ? "bg-emerald-400" :
              status === "offline" ? "bg-red-400" :
              status === "warning" ? "bg-amber-400" : "bg-slate-500";

            return (
              <button
                key={device.id}
                onClick={() => floorPlan && setPlacingDevice(isPlacing ? null : device)}
                disabled={!floorPlan}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all disabled:opacity-40 ${
                  isPlacing
                    ? "bg-cyan-500/15 border-l-2 border-cyan-500"
                    : isPinned
                    ? "bg-white/3 border-l-2 border-emerald-500/40"
                    : "border-l-2 border-transparent hover:bg-white/4"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="text-xs text-slate-200 truncate flex-1">{device.name}</span>
                {isPinned && !isPlacing && <span className="text-[9px] text-emerald-400/70 flex-shrink-0">●</span>}
                {isPlacing && <span className="text-[9px] text-cyan-400 flex-shrink-0 animate-pulse">+</span>}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-white/6 space-y-1.5">
          {[
            { color: "bg-emerald-400", label: "Online" },
            { color: "bg-amber-400",   label: "Warning" },
            { color: "bg-red-400",     label: "Offline" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${l.color}`} />
              {l.label}
            </div>
          ))}
          {cablePaths.length > 0 && (
            <div className="pt-1 border-t border-white/6 mt-1">
              <p className="text-[10px] text-slate-500">{cablePaths.length} cable path{cablePaths.length !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {!floorPlan ? (
          <DeckMapUploader onUpload={handleImageUpload} />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/6 bg-[#070b13]/60 flex-shrink-0 flex-wrap">
              <span className="text-xs text-slate-400 truncate flex-1 min-w-0">{floorPlan.name}</span>

              {placingDevice && (
                <span className="flex items-center gap-1.5 text-xs text-cyan-400 animate-pulse">
                  <MapPin size={11} />
                  Placing: <b>{placingDevice.name}</b> — click on map
                </span>
              )}

              {cableDrawMode && !cableDrawStart && (
                <span className="flex items-center gap-1.5 text-xs text-orange-400 animate-pulse">
                  <Cable size={11} />
                  Select <b>start</b> device
                </span>
              )}
              {cableDrawMode && cableDrawStart && (
                <span className="flex items-center gap-1.5 text-xs text-orange-400 animate-pulse">
                  <Cable size={11} />
                  Select <b>end</b> device
                </span>
              )}

              <span className="text-xs text-slate-600">{pins.length} pin{pins.length !== 1 ? "s" : ""}</span>

              {/* Cable draw toggle */}
              <button
                onClick={() => {
                  setCableDrawMode(m => !m);
                  setCableDrawStart(null);
                  setPlacingDevice(null);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  cableDrawMode
                    ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <Cable size={11} />
                {cableDrawMode ? "Cancel Cable" : "Draw Cable Path"}
              </button>

              <button
                onClick={() => { setFloorPlan(null); setPins([]); setCablePaths([]); setDrawerOpen(false); }}
                className="text-xs text-slate-500 hover:text-red-400 border border-white/10 px-2.5 py-1 rounded-lg transition-colors"
              >
                Change plan
              </button>
            </div>

            <DeckMapCanvas
              floorPlan={floorPlan}
              pins={pins}
              devices={devices}
              mockStatus={statusMap}
              placingDevice={placingDevice}
              onCanvasClick={handleCanvasClick}
              onPinClick={handlePinClick}
              cablePaths={cablePaths}
              cableDrawMode={cableDrawMode}
              cableDrawStart={cableDrawStart}
            />
          </>
        )}
      </div>

      {/* ── Device detail drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && selectedPin && (
          <DevicePinDrawer
            pin={selectedPin}
            status={statusMap[selectedPin.deviceId] || "unknown"}
            events={MOCK_EVENTS[selectedPin.deviceId] || []}
            docs={MOCK_DOCS[selectedPin.deviceId] || []}
            onClose={() => setDrawerOpen(false)}
            onRemovePin={() => handleRemovePin(selectedPin.id)}
          />
        )}
      </AnimatePresence>

      {/* ── Cable path creation drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {cableDrawerOpen && selectedCable && (
          <CablePathDrawer
            fromDevice={devices.find(d => d.id === selectedCable.fromDeviceId)}
            toDevice={devices.find(d => d.id === selectedCable.toDeviceId)}
            onSave={handleSaveCable}
            onClose={() => { setCableDrawerOpen(false); setSelectedCable(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}