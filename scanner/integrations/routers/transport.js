const DEFAULT_TIMEOUT = 10000;

export async function fetchWithTimeout(url, opts = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...rest } = opts;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${url} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  if (body.stat === "fail") {
    throw new Error(`API error ${body.code || "?"}: ${body.message || "unknown"}`);
  }
  return body;
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

export function cookieHeader(cookie) {
  return { Cookie: cookie };
}
