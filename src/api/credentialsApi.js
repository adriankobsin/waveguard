import { base44, isMockServer, MOCK_SERVER_URL } from "@/api/base44Client";
import { parseSettingsValue } from "@/lib/parseSettingsValue";
import {
  CREDENTIALS_VAULT_KEY,
  normalizeCredentialsVault,
  saveCredentialsLocal,
  loadCredentialsLocal,
} from "@/lib/credentials/credentialsVault";

const MOCK_APP = "mock-app";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("base44_access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadFromSettings() {
  try {
    const records = await base44.entities.SystemSettings.filter({ key: CREDENTIALS_VAULT_KEY });
    if (records.length > 0 && records[0].value != null) {
      return normalizeCredentialsVault(parseSettingsValue(records[0].value));
    }
  } catch (err) {
    console.warn("[credentialsApi] settings load failed:", err);
  }
  return loadCredentialsLocal();
}

async function persistToSettings(credentials) {
  const normalized = normalizeCredentialsVault(credentials);
  saveCredentialsLocal(normalized);
  try {
    const records = await base44.entities.SystemSettings.filter({ key: CREDENTIALS_VAULT_KEY });
    if (records.length > 0) {
      await base44.entities.SystemSettings.update(records[0].id, {
        key: CREDENTIALS_VAULT_KEY,
        value: normalized,
      });
    } else {
      await base44.entities.SystemSettings.create({
        key: CREDENTIALS_VAULT_KEY,
        value: normalized,
      });
    }
  } catch (err) {
    console.warn("[credentialsApi] settings save failed:", err);
  }
  if (isMockServer) {
    const base = `${MOCK_SERVER_URL}/api/apps/${MOCK_APP}`;
    await fetch(`${base}/credentials/vault`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(normalized),
    }).catch(() => {});
  }
  return normalized;
}

export async function listCredentials() {
  return loadFromSettings();
}

export async function saveCredentials(credentials) {
  return persistToSettings(credentials);
}

export async function upsertCredential(credential) {
  const list = await loadFromSettings();
  const idx = list.findIndex((c) => c.id === credential.id);
  const normalized = normalizeCredentialsVault([credential])[0];
  if (idx >= 0) list[idx] = normalized;
  else list.push(normalized);
  return persistToSettings(list);
}

export async function deleteCredential(id) {
  const list = (await loadFromSettings()).filter((c) => c.id !== id);
  return persistToSettings(list);
}
