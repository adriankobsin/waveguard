/**
 * Live weather via Open-Meteo (free, no API key).
 * @see https://open-meteo.com/
 */

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const LOOKUP_TIMEOUT_MS = 10000;

/** WMO weather interpretation codes (Open-Meteo standard). */
export const WMO_LABELS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export function weatherLabelFromCode(code) {
  const n = Number(code);
  return WMO_LABELS[n] || "Unknown";
}

function failure(error) {
  return {
    success: false,
    error: error || "Weather lookup failed",
    source: "open-meteo.com",
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchOpenMeteoForecast(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return failure("Valid latitude and longitude are required");
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return failure("Coordinates out of range");
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "wind_speed_10m",
      "weather_code",
    ].join(","),
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min"].join(","),
    timezone: "auto",
    forecast_days: "1",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const res = await fetch(`${FORECAST_BASE}?${params}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "WaveGuard/1.0" },
    });
    if (!res.ok) {
      return failure(`Open-Meteo returned HTTP ${res.status}`);
    }
    const raw = await res.json();
    const cur = raw?.current;
    const daily = raw?.daily;
    if (!cur) {
      return failure("Open-Meteo response missing current conditions");
    }

    const code = cur.weather_code ?? daily?.weather_code?.[0] ?? null;

    return {
      success: true,
      latitude: lat,
      longitude: lon,
      timezone: raw.timezone || "",
      temperatureC: cur.temperature_2m,
      apparentTemperatureC: cur.apparent_temperature,
      humidityPct: cur.relative_humidity_2m,
      windSpeedKmh: cur.wind_speed_10m,
      weatherCode: code,
      weatherLabel: weatherLabelFromCode(code),
      dailyHighC: daily?.temperature_2m_max?.[0] ?? null,
      dailyLowC: daily?.temperature_2m_min?.[0] ?? null,
      observedAt: cur.time || null,
      source: "open-meteo.com",
      attribution: "Weather data by Open-Meteo.com",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message =
      err?.name === "AbortError" ? "Weather lookup timed out" : err?.message || "Weather lookup failed";
    return failure(message);
  } finally {
    clearTimeout(timer);
  }
}
