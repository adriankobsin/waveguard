/**
 * IP geolocation with provider fallbacks (server-side only).
 * Primary: ipapi.co · Fallback: freeipapi.com
 */

const LOOKUP_TIMEOUT_MS = 8000;
const USER_AGENT = "WaveGuard/1.0";

function isValidPublicIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return false;
  const parts = trimmed.split(".").map(Number);
  if (parts.some((n) => n < 0 || n > 255)) return false;
  if (parts[0] === 10) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 127) return false;
  return true;
}

function failure(requestedIp, error, source = "unknown") {
  return {
    success: false,
    ip: requestedIp || null,
    error,
    source,
    lookedUpAt: new Date().toISOString(),
  };
}

function successFromFields(fields) {
  const latitude = Number(fields.latitude);
  const longitude = Number(fields.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    success: true,
    ip: fields.ip || null,
    latitude,
    longitude,
    city: fields.city || "",
    region: fields.region || "",
    country: fields.country || "",
    countryCode: fields.countryCode || "",
    isp: fields.isp || "",
    timezone: fields.timezone || "",
    source: fields.source,
    lookedUpAt: new Date().toISOString(),
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    const message =
      err?.name === "AbortError" ? "Geolocation lookup timed out" : err?.message || "Lookup failed";
    return { ok: false, status: 0, body: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeIpapi(raw, requestedIp) {
  if (!raw || raw.error) {
    return null;
  }
  return successFromFields({
    ip: raw.ip || requestedIp,
    latitude: raw.latitude,
    longitude: raw.longitude,
    city: raw.city,
    region: raw.region,
    country: raw.country_name,
    countryCode: raw.country_code,
    isp: raw.org || raw.asn,
    timezone: raw.timezone,
    source: "ipapi.co",
  });
}

function normalizeFreeIpApi(raw, requestedIp) {
  if (!raw || !raw.ipAddress) return null;
  return successFromFields({
    ip: raw.ipAddress || requestedIp,
    latitude: raw.latitude,
    longitude: raw.longitude,
    city: raw.cityName,
    region: raw.regionName,
    country: raw.countryName,
    countryCode: raw.countryCode,
    isp: raw.asnOrganization || raw.asn,
    timezone: Array.isArray(raw.timeZones) ? raw.timeZones[0] : "",
    source: "freeipapi.com",
  });
}

async function lookupViaIpapi(requestedIp) {
  const url = requestedIp
    ? `https://ipapi.co/${requestedIp}/json/`
    : "https://ipapi.co/json/";
  const { ok, status, body, error } = await fetchJson(url);
  if (error) return failure(requestedIp, error, "ipapi.co");
  if (!ok) {
    const detail = body?.reason || body?.error || `Geolocation service returned HTTP ${status}`;
    return failure(requestedIp, detail, "ipapi.co");
  }
  const normalized = normalizeIpapi(body, requestedIp);
  return normalized || failure(requestedIp, "Geolocation response missing coordinates", "ipapi.co");
}

async function lookupViaFreeIpApi(requestedIp) {
  const url = requestedIp
    ? `https://freeipapi.com/api/json/${requestedIp}`
    : "https://freeipapi.com/api/json";
  const { ok, status, body, error } = await fetchJson(url);
  if (error) return failure(requestedIp, error, "freeipapi.com");
  if (!ok) {
    return failure(
      requestedIp,
      body?.message || `Geolocation service returned HTTP ${status}`,
      "freeipapi.com"
    );
  }
  const normalized = normalizeFreeIpApi(body, requestedIp);
  return normalized || failure(requestedIp, "Geolocation response missing coordinates", "freeipapi.com");
}

/**
 * Resolve approximate location for an IP address (or caller's public IP when omitted).
 * @param {string} [ip] - Optional public IPv4 to look up
 * @returns {Promise<object>}
 */
export async function lookupIpGeolocation(ip) {
  const requestedIp = isValidPublicIp(ip) ? ip.trim() : null;

  const primary = await lookupViaIpapi(requestedIp);
  if (primary.success) return primary;

  const fallback = await lookupViaFreeIpApi(requestedIp);
  if (fallback.success) return fallback;

  return {
    ...failure(
      requestedIp,
      fallback.error || primary.error || "Geolocation lookup failed",
      fallback.source || primary.source
    ),
  };
}
