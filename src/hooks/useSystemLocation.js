import { useCallback, useEffect, useMemo, useState } from "react";
import { lookupLocation } from "@/api/geoApi";
import { useSystemData } from "@/contexts/SystemDataContext";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export function formatLocationLine(loc) {
  if (!loc?.success) return "Location unavailable";
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}

export function formatCoords(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "—";
  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
}

/** Resolve system location from WAN public IP (or host egress IP as fallback). */
export function useSystemLocation({ active = true, refreshIntervalMs = REFRESH_INTERVAL_MS } = {}) {
  const { snapshot } = useSystemData();
  const wan = snapshot?.wan;
  const publicIp = useMemo(
    () => wan?.publicIp || wan?.selected?.publicIp || null,
    [wan?.publicIp, wan?.selected?.publicIp]
  );

  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await lookupLocation(publicIp || undefined);
      if (result?.success) {
        setLocation(result);
        setError(null);
      } else {
        setLocation(result);
        setError(result?.error || "Could not resolve location");
      }
      return result;
    } catch (err) {
      setError(err?.message || "Geolocation lookup failed");
      setLocation(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [publicIp]);

  useEffect(() => {
    if (!active) return;
    refresh();
  }, [active, refresh]);

  useEffect(() => {
    if (!active || !refreshIntervalMs) return undefined;
    const id = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(id);
  }, [active, refresh, refreshIntervalMs]);

  const hasCoords =
    location?.success &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude);

  return {
    publicIp,
    location,
    loading,
    error,
    refresh,
    hasCoords,
    mapCenter: hasCoords
      ? [location.latitude, location.longitude]
      : [51.505, -0.09],
  };
}
