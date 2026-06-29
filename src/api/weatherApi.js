import { fetchOpenMeteoForecast } from "../../scanner/integrations/weather/openMeteo.js";

/**
 * Fetch live weather for coordinates via Open-Meteo (direct GET, CORS-enabled).
 * @see https://open-meteo.com/en/docs
 */
export async function fetchLiveWeather({ latitude, longitude }) {
  return fetchOpenMeteoForecast(latitude, longitude);
}
