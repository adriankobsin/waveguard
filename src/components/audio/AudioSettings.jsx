import { useState } from "react";
import { Plus, Trash2, Wifi, WifiOff, Save } from "lucide-react";
import { AUDIO_SYSTEM_TYPES, AUDIO_SYSTEM_LABELS, AUDIO_DEFAULT_PORTS } from "@/lib/integrations/audio/audioSystemTemplate";

export default function AudioSettings({
  systems = [],
  onChange,
  onSave,
}) {
  const [local, setLocal] = useState(systems);

  const handleChange = (updated) => {
    setLocal(updated);
    onChange?.(updated);
  };

  const addSystem = () => {
    const type = "qsys";
    const ports = AUDIO_DEFAULT_PORTS[type];
    const newSys = {
      id: `audio-sys-${Date.now()}`,
      name: "",
      type,
      host: "",
      port: ports?.qrc || 1710,
      protocol: "qrc",
      status: "offline",
      designName: "",
      lastPolled: null,
      enabled: false,
      credentials: { username: "", password: "" },
      inputs: [],
      outputs: [],
      zones: [],
      amplifiers: [],
      snapshots: [],
      danteFlows: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    handleChange([...local, newSys]);
  };

  const removeSystem = (id) => {
    handleChange(local.filter((s) => s.id !== id));
  };

  const updateSystem = (id, patch) => {
    handleChange(
      local.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s))
    );
  };

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          DSP System Configuration
        </p>
        <button
          onClick={addSystem}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
        >
          <Plus size={12} />
          Add System
        </button>
      </div>

      {local.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <Wifi size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No DSP systems configured</p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Click "Add System" to connect a Q-SYS, Symetrix, or Crestron NAX processor
          </p>
        </div>
      )}

      <div className="space-y-3">
        {local.map((sys) => (
          <div
            key={sys.id}
            className="rounded-lg border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sys.enabled ? (
                  <Wifi size={14} className="text-emerald-400" />
                ) : (
                  <WifiOff size={14} className="text-muted-foreground" />
                )}
                <p className="text-sm font-semibold text-foreground">
                  {sys.name || "New DSP System"}
                </p>
              </div>
              <button
                onClick={() => removeSystem(sys.id)}
                className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                  Name
                </label>
                <input
                  type="text"
                  value={sys.name}
                  onChange={(e) => updateSystem(sys.id, { name: e.target.value })}
                  placeholder="e.g. Main Auditorium DSP"
                  className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </label>
                <select
                  value={sys.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const ports = AUDIO_DEFAULT_PORTS[type];
                    updateSystem(sys.id, {
                      type,
                      port: ports?.[Object.keys(ports)[0]] || 1710,
                      protocol: Object.keys(ports)[0] || "qrc",
                    });
                  }}
                  className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/40"
                >
                  {Object.entries(AUDIO_SYSTEM_TYPES).map(([key, val]) => (
                    <option key={key} value={val}>
                      {AUDIO_SYSTEM_LABELS[val] || val}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                  Host
                </label>
                <input
                  type="text"
                  value={sys.host}
                  onChange={(e) => updateSystem(sys.id, { host: e.target.value })}
                  placeholder="192.168.1.100"
                  className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                  Port
                </label>
                <input
                  type="number"
                  value={sys.port}
                  onChange={(e) => updateSystem(sys.id, { port: parseInt(e.target.value) || 1710 })}
                  className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/40"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sys.enabled}
                  onChange={(e) => updateSystem(sys.id, { enabled: e.target.checked })}
                  className="rounded border-border bg-muted text-primary focus:ring-primary/30"
                />
                <span className="text-[10px] text-muted-foreground">Enabled</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {local.length > 0 && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => onSave?.(local)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Save size={12} />
            Save Configuration
          </button>
        </div>
      )}
    </div>
  );
}
