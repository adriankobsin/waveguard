import { HVACService } from "../core/HVACService";
import type { HVACMode, HVACFanSpeed, HVACConfig } from "../core/HVACTypes";

export function createHVACRouter(service: HVACService) {
  return {
    async listZones() {
      return service.getAllZones();
    },

    async getZone(zoneId: string) {
      const zone = service.getZone(zoneId);
      if (!zone) throw Object.assign(new Error("Zone not found"), { status: 404 });
      return zone;
    },

    async setPower(zoneId: string, power: boolean) {
      await service.setPower(zoneId, power);
      return { success: true, zoneId, power };
    },

    async setSetpoint(zoneId: string, temperature: number) {
      await service.setSetpoint(zoneId, temperature);
      return { success: true, zoneId, temperature };
    },

    async setMode(zoneId: string, mode: HVACMode) {
      await service.setMode(zoneId, mode);
      return { success: true, zoneId, mode };
    },

    async setFanSpeed(zoneId: string, fanSpeed: HVACFanSpeed) {
      await service.setFanSpeed(zoneId, fanSpeed);
      return { success: true, zoneId, fanSpeed };
    },

    async getDiagnostics(zoneId: string) {
      return service.getDiagnostics(zoneId);
    },

    async getSystemStatus() {
      return service.getSystemStatus();
    },

    async getConfig() {
      return service.getConfig();
    },
  };
}

export function createExpressRouter(service: HVACService) {
  const router = createHVACRouter(service);

  return async function handler(req: { method: string; url: string; pathname?: string; params?: Record<string, string>; body?: unknown }) {
    const url = new URL(req.url, "http://localhost");
    const parts = url.pathname.replace("/api/hvac", "").split("/").filter(Boolean);
    const method = req.method;

    try {
      if (parts.length === 1 && parts[0] === "zones" && method === "GET") {
        return { status: 200, body: await router.listZones() };
      }
      if (parts.length === 1 && parts[0] === "system" && url.pathname.endsWith("status") && method === "GET") {
        return { status: 200, body: await router.getSystemStatus() };
      }
      if (parts.length === 1 && parts[0] === "config" && method === "GET") {
        return { status: 200, body: await router.getConfig() };
      }
      if (parts.length === 2 && parts[0] === "zones" && method === "GET") {
        return { status: 200, body: await router.getZone(parts[1]) };
      }
      if (parts.length === 3 && parts[0] === "zones" && method === "POST") {
        const body = req.body as Record<string, unknown>;
        const zoneId = parts[1];
        const action = parts[2];
        if (action === "power") return { status: 200, body: await router.setPower(zoneId, Boolean(body?.power)) };
        if (action === "setpoint") return { status: 200, body: await router.setSetpoint(zoneId, Number(body?.temperature)) };
        if (action === "mode") return { status: 200, body: await router.setMode(zoneId, body?.mode as HVACMode) };
        if (action === "fan") return { status: 200, body: await router.setFanSpeed(zoneId, body?.fanSpeed as HVACFanSpeed) };
        if (action === "diagnostics") return { status: 200, body: await router.getDiagnostics(zoneId) };
      }
      return { status: 404, body: { error: "Not found" } };
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const message = err instanceof Error ? err.message : "Internal error";
      return { status, body: { error: message } };
    }
  };
}

export type HVACRouter = ReturnType<typeof createExpressRouter>;
