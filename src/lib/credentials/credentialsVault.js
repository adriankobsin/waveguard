export const CREDENTIALS_VAULT_KEY = "device-credentials-vault";
export const CREDENTIALS_CHANGED_EVENT = "waveguard-credentials-changed";

export const CREDENTIAL_PLATFORMS = [
  { id: "web", label: "Web / browser" },
  { id: "peplink", label: "Peplink" },
  { id: "cisco", label: "Cisco" },
  { id: "fortinet", label: "Fortinet" },
  { id: "unifi", label: "UniFi" },
  { id: "kerio", label: "Kerio" },
  { id: "ssh", label: "SSH" },
  { id: "snmp", label: "SNMP" },
  { id: "lutron", label: "Lutron LEAP" },
  { id: "api", label: "API / other" },
];

export const DEFAULT_BROWSER_LOGIN = {
  loginUrl: "",
  username: "",
  password: "",
  credentialId: "",
};

function normId() {
  return `cred-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCredential(raw) {
  if (!raw) return null;
  const id = raw.id || normId();
  return {
    id,
    label: raw.label || "",
    equipmentId: raw.equipmentId || "",
    platform: raw.platform || "web",
    host: raw.host || "",
    loginUrl: raw.loginUrl || "",
    username: raw.username || "",
    password: raw.password || "",
    notes: raw.notes || "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeBrowserLogin(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BROWSER_LOGIN };
  return {
    loginUrl: raw.loginUrl || "",
    username: raw.username || "",
    password: raw.password || "",
    credentialId: raw.credentialId || "",
  };
}

export function normalizeCredentialsVault(raw) {
  const list = Array.isArray(raw) ? raw : raw?.credentials || raw?.items || [];
  return list.map(normalizeCredential).filter(Boolean);
}

export function loadCredentialsLocal() {
  try {
    const raw = localStorage.getItem(CREDENTIALS_VAULT_KEY);
    if (!raw) return [];
    return normalizeCredentialsVault(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCredentialsLocal(credentials) {
  const normalized = normalizeCredentialsVault(credentials);
  localStorage.setItem(CREDENTIALS_VAULT_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT, { detail: normalized }));
  return normalized;
}

/** Upsert credential linked to equipment; returns credential id. */
export function upsertEquipmentCredential(credentials, equipmentId, patch, label = "") {
  const list = [...normalizeCredentialsVault(credentials)];
  const idx = list.findIndex((c) => c.equipmentId === equipmentId && c.platform === (patch.platform || "web"));
  const next = normalizeCredential({
    ...(idx >= 0 ? list[idx] : {}),
    ...patch,
    equipmentId,
    label: label || patch.label || list[idx]?.label || "Device login",
    updatedAt: new Date().toISOString(),
    id: idx >= 0 ? list[idx].id : undefined,
  });
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return { credentials: list, credentialId: next.id };
}

export function findCredentialForEquipment(credentials, equipmentId, platform = "web") {
  return normalizeCredentialsVault(credentials).find(
    (c) => c.equipmentId === equipmentId && (!platform || c.platform === platform)
  );
}
