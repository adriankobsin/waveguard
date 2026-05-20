import { PLATFORM_RESET_CONFIRM } from "@/lib/platformFactoryReset";
import { getMockAppApiBase, getMockAuthHeaders } from "@/api/mockApiHelpers";

/**
 * Reset platform data to factory defaults (mock server). Requires admin + confirm text.
 */
export async function resetPlatformToFactory(confirm = PLATFORM_RESET_CONFIRM) {
  const base = getMockAppApiBase();
  if (!base) {
    throw new Error("Factory reset is only available with the local mock server.");
  }

  const res = await fetch(`${base}/platform/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getMockAuthHeaders() },
    body: JSON.stringify({ confirm }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || "Platform reset failed";
    if (res.status === 403) {
      throw new Error(`${msg}. Try signing out and signing in again as an administrator.`);
    }
    if (res.status === 404) {
      throw new Error(
        "Reset endpoint not found. Restart the mock server (npm run mock or npm run dev:all) and try again."
      );
    }
    throw new Error(msg);
  }
  return data;
}
