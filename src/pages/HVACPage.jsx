import { useState, useEffect, useCallback } from "react";
import {
  Thermometer, RefreshCcw, Loader2, AlertTriangle,
} from "lucide-react";
import HVACZoneCard from "../hvac/components/HVACZoneCard";
import HVACSystemStatus from "../hvac/components/HVACSystemStatus";
import HVACDiagnosticsModal from "../hvac/components/HVACDiagnosticsModal";
import HVACEmptyState from "../hvac/components/HVACEmptyState";
import {
  fetchAllZones,
  setZonePower,
  setZoneSetpoint,
  setZoneMode,
  setZoneFanSpeed,
  fetchSystemStatus,
} from "@/api/hvacApi";
import { toast } from "sonner";

export default function HVACPage() {
  const [zones, setZones] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diagnosticsZoneId, setDiagnosticsZoneId] = useState(null);
  const [writesDisabled, setWritesDisabled] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [zoneData, statusData] = await Promise.all([
        fetchAllZones(),
        fetchSystemStatus().catch(() => null),
      ]);
      setZones(zoneData);
      setStatus(statusData);
    } catch (e) {
      setError(e.message);
      toast.error(`Failed to load HVAC data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handlePower = async (zoneId, power) => {
    try {
      await setZonePower(zoneId, power);
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, powerState: power ? "on" : "off" } : z)),
      );
      toast.success(`${power ? "Turned on" : "Turned off"} ${zoneId}`);
    } catch (e) {
      toast.error(`Failed to set power: ${e.message}`);
      throw e;
    }
  };

  const handleSetpoint = async (zoneId, temperature) => {
    try {
      await setZoneSetpoint(zoneId, temperature);
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, targetTemperature: temperature } : z)),
      );
    } catch (e) {
      toast.error(`Failed to set temperature: ${e.message}`);
      throw e;
    }
  };

  const handleMode = async (zoneId, mode) => {
    try {
      await setZoneMode(zoneId, mode);
      setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, mode } : z)));
    } catch (e) {
      toast.error(`Failed to set mode: ${e.message}`);
      throw e;
    }
  };

  const handleFan = async (zoneId, fanSpeed) => {
    try {
      await setZoneFanSpeed(zoneId, fanSpeed);
      setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, fanSpeed } : z)));
    } catch (e) {
      toast.error(`Failed to set fan speed: ${e.message}`);
      throw e;
    }
  };

  const onlineCount = zones.filter((z) => z.online).length;
  const alarmCount = zones.filter((z) => z.alarmStatus).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/12 flex items-center justify-center ring-1 ring-cyan-500/20">
            <Thermometer size={16} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-none">HVAC Control</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? "Loading…" : `${onlineCount}/${zones.length} zones online · ${alarmCount} alarms`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alarmCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25">
              <AlertTriangle size={10} /> {alarmCount} alarm{alarmCount > 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* System status */}
      <div className="px-5 py-3">
        <HVACSystemStatus status={status} />
      </div>

      {/* Content */}
      <div className="px-5 pb-8">
        {loading && zones.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Loading HVAC zones…
            </div>
          </div>
        ) : error && zones.length === 0 ? (
          <HVACEmptyState onRefresh={loadAll} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {zones.map((zone) => (
              <HVACZoneCard
                key={zone.id}
                zone={zone}
                onPower={handlePower}
                onSetpoint={handleSetpoint}
                onMode={handleMode}
                onFan={handleFan}
                onDiagnostics={(id) => setDiagnosticsZoneId(id)}
                disabled={writesDisabled}
              />
            ))}
          </div>
        )}
      </div>

      {diagnosticsZoneId && (
        <HVACDiagnosticsModal
          zoneId={diagnosticsZoneId}
          onClose={() => setDiagnosticsZoneId(null)}
        />
      )}
    </div>
  );
}
