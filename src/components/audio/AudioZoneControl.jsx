import { Volume2, VolumeX, Music, ChevronUp, ChevronDown } from "lucide-react";

export default function AudioZoneControl({
  zone,
  systemName,
  onChange,
}) {
  if (!zone) return null;

  const handleVolumeChange = (delta) => {
    const next = Math.max(-60, Math.min(10, (zone.volume ?? 0) + delta));
    onChange?.({ ...zone, volume: next });
  };

  const handleMuteToggle = () => {
    onChange?.({ ...zone, mute: !zone.mute });
  };

  const volumeLabel = zone.mute ? "MUTED" : `${zone.volume ?? 0} dB`;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music size={14} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">{zone.name}</p>
            <p className="text-[9px] text-muted-foreground">{systemName}</p>
          </div>
        </div>

        <button
          onClick={handleMuteToggle}
          className={`p-1.5 rounded-lg transition-colors ${
            zone.mute
              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {zone.mute ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleVolumeChange(-2)}
          className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown size={14} />
        </button>

        <div className="flex-1 relative h-8 bg-muted rounded-lg border border-border overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-200 rounded-lg ${
              zone.mute
                ? "bg-red-500/20"
                : (zone.volume ?? 0) > -6
                ? "bg-amber-500/30"
                : "bg-primary/20"
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, ((zone.volume ?? -60) + 60) / 70 * 100))}%`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`text-xs font-bold ${
                zone.mute ? "text-red-400" : "text-foreground"
              }`}
            >
              {volumeLabel}
            </span>
          </div>
        </div>

        <button
          onClick={() => handleVolumeChange(2)}
          className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp size={14} />
        </button>
      </div>

      {zone.sourceSelected && (
        <p className="text-[10px] text-muted-foreground/70">
          Source: {zone.sourceSelected}
        </p>
      )}
    </div>
  );
}
