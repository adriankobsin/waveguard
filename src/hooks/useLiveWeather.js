import { useCallback, useEffect, useState } from "react";
import { fetchLiveWeather } from "@/api/weatherApi";
import { useSystemLocation } from "@/hooks/useSystemLocation";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Live weather for the system's resolved location (IP geolocation → Open-Meteo).
 */
export function useLiveWeather({ active = true, refreshIntervalMs = REFRESH_INTERVAL_MS } = {}) {
  const {
    location,
    loading: geoLoading,
    error: geoError,
    refresh: refreshGeo,
    hasCoords,
  } = useSystemLocation({ active, refreshIntervalMs: REFRESH_INTERVAL_MS });

  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshWeather = useCallback(async (coords) => {
    const lat = coords?.latitude ?? location?.latitude;
    const lon = coords?.longitude ?? location?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setWeather(null);
      setError(geoError || "Location required for weather");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchLiveWeather({ latitude: lat, longitude: lon });
      if (result?.success) {
        setWeather(result);
      } else {
        setWeather(result);
        setError(result?.error || "Could not load weather");
      }
    } catch (err) {
      setError(err?.message || "Weather lookup failed");
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, [location?.latitude, location?.longitude, geoError]);

  const refresh = useCallback(async () => {
    const loc = await refreshGeo();
    if (loc?.success && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
      await refreshWeather(loc);
    } else {
      setWeather(null);
      setError(loc?.error || geoError || "Location required for weather");
      setLoading(false);
    }
  }, [refreshGeo, refreshWeather, geoError]);

  useEffect(() => {
    if (!active) return;
    if (geoLoading) {
      setLoading(true);
      return;
    }
    if (hasCoords && location?.latitude != null && location?.longitude != null) {
      refreshWeather(location);
    } else if (!geoLoading) {
      setLoading(false);
      setError(geoError || "Location required for weather");
    }
  }, [active, geoLoading, hasCoords, location, geoError, refreshWeather]);

  useEffect(() => {
    if (!active || !refreshIntervalMs) return undefined;
    const id = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(id);
  }, [active, refresh, refreshIntervalMs]);

  return {
    location,
    weather,
    loading: loading || geoLoading,
    error: error || (!hasCoords && !geoLoading ? geoError : null),
    refresh,
    hasCoords,
  };
}
