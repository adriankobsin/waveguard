import { useCallback, useEffect, useState } from "react";
import {
  Music,
  Radio,
  Wifi,
  Activity,
  Settings,
  RefreshCcw,
} from "lucide-react";
import AudioSystemStatus from "@/components/audio/AudioSystemStatus";
import AudioZoneControl from "@/components/audio/AudioZoneControl";
import AudioDanteRouting from "@/components/audio/AudioDanteRouting";
import AudioEventLogPanel from "@/components/audio/AudioEventLogPanel";
import AudioSettingsPanel from "@/components/audio/AudioSettings";
import { isDemoModeActive } from "@/lib/platformMode";
import {
  loadAudioSystemsLocal,
  saveAudioSystemsLocal,
  loadZoneStateLocal,
  saveZoneStateLocal,
  loadAudioEventLogLocal,
  normalizeAudioSystems,
  normalizeAudioEventLog,
} from "@/lib/audio/audioSettings";
import { recordAudioEvent, loadAudioEvents } from "@/lib/audio/audioEventLog";
import { DEMO_AUDIO_SYSTEMS, DEMO_AUDIO_EVENTS } from "@/lib/demo/demoAudioData";

const PAGE_TABS = [
  { key: "status", label: "System Status", icon: Radio },
  { key: "zones", label: "Zone Control", icon: Music },
  { key: "dante", label: "Dante / AES67", icon: Wifi },
  { key: "events", label: "Event Log", icon: Activity },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function AudioPage() {
  const [activeTab, setActiveTab] = useState("status");
  const [systems, setSystems] = useState([]);
  const [zoneState, setZoneState] = useState({});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const isDemo = isDemoModeActive();

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        if (isDemo) {
          setSystems(DEMO_AUDIO_SYSTEMS.systems);
          setZoneState({});
          setEvents(DEMO_AUDIO_EVENTS);
        } else {
          const sysData = loadAudioSystemsLocal();
          const parsedSys = normalizeAudioSystems(sysData);
          setSystems(parsedSys.systems);
          const zs = loadZoneStateLocal();
          setZoneState(zs || {});
          const evData = loadAudioEventLogLocal();
          setEvents(normalizeAudioEventLog(evData).events);
        }
      } catch (err) {
        console.warn("[AudioPage] init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [isDemo]);

  const handleZoneChange = useCallback(
    async (zone) => {
      const updated = systems.map((sys) => {
        if (sys.zones?.some((z) => z.id === zone.id)) {
          return {
            ...sys,
            zones: sys.zones.map((z) => (z.id === zone.id ? zone : z)),
          };
        }
        return sys;
      });
      setSystems(updated);

      const sysName =
        systems.find((s) => s.zones?.some((z) => z.id === zone.id))?.name || "";

      if (!isDemo) {
        saveAudioSystemsLocal({ systems: updated });
        saveZoneStateLocal({
          ...zoneState,
          [zone.id]: { volume: zone.volume, mute: zone.mute },
        });
      }

      await recordAudioEvent({
        kind: "system",
        severity: zone.mute ? "warning" : "info",
        systemId:
          systems.find((s) => s.zones?.some((z) => z.id === zone.id))?.id || "",
        systemName: sysName,
        zoneHref: `/zones/${zone.id}`,
        action: zone.mute ? "mute_set" : "volume_set",
        result: "success",
        level: zone.volume,
        message: `${zone.name} ${zone.mute ? "muted" : `volume set to ${zone.volume}dB`}`,
      });
    },
    [systems, zoneState, isDemo]
  );

  const handleSettingsSave = useCallback(
    async (updated) => {
      setSystems(updated);
      if (!isDemo) {
        saveAudioSystemsLocal({ systems: updated });
      }
      await recordAudioEvent({
        kind: "system",
        severity: "info",
        action: "settings_update",
        result: "success",
        message: "Audio system configuration updated",
      });
    },
    [isDemo]
  );

  const handleRefresh = useCallback(async () => {
    if (isDemo) {
      setEvents(DEMO_AUDIO_EVENTS);
    } else {
      const evData = await loadAudioEvents();
      setEvents(normalizeAudioEventLog(evData).events);
    }
  }, [isDemo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCcw size={14} className="animate-spin" />
          <span className="text-xs">Loading audio systems...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 overflow-x-auto">
        {PAGE_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "status" && <AudioSystemStatus systems={systems} />}
        {activeTab === "zones" && (
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {systems.flatMap((sys) =>
              (sys.zones || []).map((zone) => (
                <AudioZoneControl
                  key={zone.id}
                  zone={zone}
                  systemName={sys.name}
                  onChange={handleZoneChange}
                />
              ))
            )}
            {systems.every((s) => !s.zones?.length) && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                <Music size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No zones configured</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "dante" && (
          <AudioDanteRouting systems={systems} />
        )}
        {activeTab === "events" && (
          <AudioEventLogPanel
            events={events}
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === "settings" && (
          <AudioSettingsPanel
            systems={systems}
            onChange={setSystems}
            onSave={handleSettingsSave}
          />
        )}
      </div>
    </div>
  );
}
