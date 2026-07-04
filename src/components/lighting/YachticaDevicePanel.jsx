import { useCallback, useEffect, useState } from "react";
import {
  Plus, Trash2, Lightbulb, Keyboard, Layers, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CHANNEL_COUNT = 8;
const MAX_ADDRESSES = 64;
const SCENE_COUNT = 56;

const CHANNEL_ROLE_OPTIONS = [
  { value: "dimmer", label: "Dimmer", icon: "~" },
  { value: "relay", label: "Relay (ON/OFF)", icon: "⚡" },
  { value: "keypad_input", label: "Keypad input", icon: "⌨" },
  { value: "keypad_led", label: "Keypad LED feedback", icon: "●" },
  { value: "scene_trigger", label: "Scene trigger", icon: "▣" },
  { value: "unused", label: "Unused", icon: "—" },
];

export default function YachticaDevicePanel({ conn: _conn, onSave }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("yachtica_devices");
    if (stored) {
      try { setDevices(JSON.parse(stored)); } catch { setDevices([]); }
    }
    setLoading(false);
  }, []);

  const persist = useCallback((next) => {
    setDevices(next);
    localStorage.setItem("yachtica_devices", JSON.stringify(next));
  }, []);

  const addDevice = () => {
    const used = new Set(devices.map((d) => d.address));
    let addr = 0;
    while (used.has(addr) && addr < MAX_ADDRESSES) addr++;
    if (addr >= MAX_ADDRESSES) { toast.error("Max 64 device addresses per gateway"); return; }
    const next = [...devices, {
      id: `yacht_${Date.now()}`,
      address: addr,
      name: `Device ${addr}`,
      channels: Array.from({ length: DEFAULT_CHANNEL_COUNT }, (_, i) => ({
        index: i,
        role: i < 4 ? "dimmer" : i < 6 ? "relay" : "unused",
        label: `Channel ${i + 1}`,
        keypadLink: null,
      })),
      scenes: Array.from({ length: SCENE_COUNT }, (_, i) => ({
        index: i,
        label: `Scene ${i + 1}`,
        enabled: false,
      })),
    }];
    persist(next);
  };

  const removeDevice = (id) => {
    persist(devices.filter((d) => d.id !== id));
  };

  const updateDevice = (id, patch) => {
    persist(devices.map((d) => d.id === id ? { ...d, ...patch } : d));
  };

  const updateChannel = (deviceId, chIndex, patch) => {
    persist(devices.map((d) => {
      if (d.id !== deviceId) return d;
      const channels = d.channels.map((ch) => ch.index === chIndex ? { ...ch, ...patch } : ch);
      return { ...d, channels };
    }));
  };

  const updateScene = (deviceId, scIndex, patch) => {
    persist(devices.map((d) => {
      if (d.id !== deviceId) return d;
      const scenes = d.scenes.map((s) => s.index === scIndex ? { ...s, ...patch } : s);
      return { ...d, scenes };
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Lighting loads &amp; keypad interfaces</p>
          <p className="text-xs text-muted-foreground">
            Configure Yachtica device addresses (0–63) and assign roles to each of the 8 channels.
          </p>
        </div>
        <button
          type="button"
          onClick={addDevice}
          disabled={devices.length >= MAX_ADDRESSES}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
        >
          <Plus size={12} />
          Add device
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center">
          <Layers size={24} className="text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No Yachtica devices configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Add a device and assign channel roles — dimmer, relay, keypad input, keypad LED, or scene trigger.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((dev) => (
            <div key={dev.id} className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Lightbulb size={14} className="text-amber-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={dev.name}
                    onChange={(e) => updateDevice(dev.id, { name: e.target.value })}
                    className="bg-transparent border-b border-transparent hover:border-border focus:border-amber-500 text-sm font-medium text-foreground outline-none px-1 py-0.5 w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono">
                    Addr {dev.address}
                  </span>
                  <button
                    onClick={() => {
                      const next = prompt("Enter new address (0-63):", String(dev.address));
                      if (next !== null) {
                        const n = parseInt(next, 10);
                        if (!isNaN(n) && n >= 0 && n < MAX_ADDRESSES) {
                          if (devices.some((d) => d.address === n && d.id !== dev.id)) {
                            toast.error(`Address ${n} already in use`);
                            return;
                          }
                          updateDevice(dev.id, { address: n });
                        } else {
                          toast.error("Address must be 0-63");
                        }
                      }
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground"
                    title="Change address"
                  >
                    Change
                  </button>
                  <button
                    onClick={() => removeDevice(dev.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                    title="Remove device"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Channels */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Layers size={10} /> Channels
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dev.channels.map((ch) => (
                    <div key={ch.index} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border">
                      <span className="text-xs text-muted-foreground font-mono w-6">{ch.index + 1}</span>
                      <input
                        type="text"
                        value={ch.label}
                        onChange={(e) => updateChannel(dev.id, ch.index, { label: e.target.value })}
                        className="flex-1 bg-transparent text-xs text-foreground border-b border-transparent hover:border-border focus:border-amber-500 outline-none px-1 py-0.5"
                        placeholder={`Channel ${ch.index + 1}`}
                      />
                      <select
                        value={ch.role}
                        onChange={(e) => updateChannel(dev.id, ch.index, { role: e.target.value })}
                        className="text-[10px] bg-secondary border border-border rounded px-1.5 py-1 text-muted-foreground focus:outline-none"
                      >
                        {CHANNEL_ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scenes */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Keyboard size={10} /> Scenes
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
                  {dev.scenes.filter((s) => s.enabled).length === 0 && (
                    <p className="text-[10px] text-muted-foreground col-span-full">No scenes enabled. Click to enable scenes below.</p>
                  )}
                  {dev.scenes.map((sc) => (
                    <label
                      key={sc.index}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] cursor-pointer border ${
                        sc.enabled
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : "border-border bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={sc.enabled}
                        onChange={(e) => updateScene(dev.id, sc.index, { enabled: e.target.checked })}
                        className="sr-only"
                      />
                      <span className="font-mono">{sc.index + 1}</span>
                      <input
                        type="text"
                        value={sc.label}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateScene(dev.id, sc.index, { label: e.target.value })}
                        className="flex-1 bg-transparent text-[10px] text-foreground outline-none border-b border-transparent focus:border-amber-500"
                        placeholder={`Scene ${sc.index + 1}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {devices.length > 0 && (
        <button
          type="button"
          onClick={() => {
            localStorage.setItem("yachtica_devices", JSON.stringify(devices));
            onSave?.(devices);
            toast.success("Yachtica device configuration saved");
          }}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Save device configuration
        </button>
      )}
    </div>
  );
}
