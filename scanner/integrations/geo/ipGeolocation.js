/**
 * IP geolocation with provider fallbacks (server-side only).
 * Primary: ipwho.is · Fallbacks: ip-api.com, freeipapi.com, ipapi.co
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

function pickCoord(raw, ...keys) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value != null && value !== "") {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
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
      redirect: "follow",
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    const text = await res.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { _rawText: text.trim().slice(0, 200) };
      }
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

function normalizeIpWhoIs(raw, requestedIp) {
  if (!raw?.success) return null;
  return successFromFields({
    ip: raw.ip || requestedIp,
    latitude: raw.latitude,
    longitude: raw.longitude,
    city: raw.city,
    region: raw.region,
    country: raw.country,
    countryCode: raw.country_code,
    isp: raw.connection?.isp || raw.connection?.org || "",
    timezone: typeof raw.timezone === "object" ? raw.timezone?.id || "" : raw.timezone || "",
    source: "ipwho.is",
  });
}

function normalizeIpApiCom(raw, requestedIp) {
  if (!raw || raw.status !== "success") return null;
  return successFromFields({
    ip: raw.query || requestedIp,
    latitude: pickCoord(raw, "lat", "latitude"),
    longitude: pickCoord(raw, "lon", "longitude"),
    city: raw.city,
    region: raw.regionName || raw.region,
    country: raw.country,
    countryCode: raw.countryCode,
    isp: raw.isp || raw.org || "",
    timezone: raw.timezone,
    source: "ip-api.com",
  });
}

function normalizeFreeIpApi(raw, requestedIp) {
  if (!raw?.ipAddress && !raw?.latitude) return null;
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

function normalizeIpapi(raw, requestedIp) {
  if (!raw || raw.error || raw._rawText) return null;
  return successFromFields({
    ip: raw.ip || requestedIp,
    latitude: pickCoord(raw, "latitude", "lat"),
    longitude: pickCoord(raw, "longitude", "lon"),
    city: raw.city,
    region: raw.region,
    country: raw.country_name || raw.country,
    countryCode: raw.country_code || raw.countryCode,
    isp: raw.org || raw.asn,
    timezone: raw.timezone,
    source: "ipapi.co",
  });
}

async function lookupViaIpWhoIs(requestedIp) {
  const url = requestedIp ? `https://ipwho.is/${requestedIp}` : "https://ipwho.is/";
  const { ok, status, body, error } = await fetchJson(url);
  if (error) return failure(requestedIp, error, "ipwho.is");
  if (!ok) {
    return failure(
      requestedIp,
      body?.message || `Geolocation service returned HTTP ${status}`,
      "ipwho.is"
    );
  }
  const normalized = normalizeIpWhoIs(body, requestedIp);
  return normalized || failure(requestedIp, body?.message || "Geolocation response missing coordinates", "ipwho.is");
}

async function lookupViaIpApiCom(requestedIp) {
  const fields = "status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,query";
  const url = requestedIp
    ? `http://ip-api.com/json/${requestedIp}?fields=${fields}`
    : `http://ip-api.com/json/?fields=${fields}`;
  const { ok, status, body, error } = await fetchJson(url);
  if (error) return failure(requestedIp, error, "ip-api.com");
  if (!ok) {
    return failure(
      requestedIp,
      body?.message || `Geolocation service returned HTTP ${status}`,
      "ip-api.com"
    );
  }
  if (body?.status === "fail") {
    return failure(requestedIp, body.message || "Lookup failed", "ip-api.com");
  }
  const normalized = normalizeIpApiCom(body, requestedIp);
  return normalized || failure(requestedIp, "Geolocation response missing coordinates", "ip-api.com");
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
      body?.message || body?._rawText || `Geolocation service returned HTTP ${status}`,
      "freeipapi.com"
    );
  }
  const normalized = normalizeFreeIpApi(body, requestedIp);
  return normalized || failure(requestedIp, "Geolocation response missing coordinates", "freeipapi.com");
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
  if (body?._rawText) {
    return failure(requestedIp, body._rawText, "ipapi.co");
  }
  const normalized = normalizeIpapi(body, requestedIp);
  return normalized || failure(requestedIp, "Geolocation response missing coordinates", "ipapi.co");
}

const PROVIDERS = [
  lookupViaIpWhoIs,
  lookupViaIpApiCom,
  lookupViaFreeIpApi,
  lookupViaIpapi,
];

/**
 * Resolve approximate location for an IP address (or caller's public IP when omitted).
 * @param {string} [ip] - Optional public IPv4 to look up
 * @returns {Promise<object>}
 */
export async function lookupIpGeolocation(ip) {
  const requestedIp = isValidPublicIp(ip) ? ip.trim() : null;

  let lastFailure = null;
  for (const provider of PROVIDERS) {
    const result = await provider(requestedIp);
    if (result.success) return result;
    lastFailure = result;
  }

  return {
    ...failure(
      requestedIp,
      lastFailure?.error || "Geolocation lookup failed",
      lastFailure?.source || "unknown"
    ),
  };
}
