/**
 * Pharos architectural lighting (DMX over Art-Net / sACN).
 * Reuses the DMX mock engine and client — Pharos controllers speak standard DMX protocols.
 */
import {
  buildMockDmxEngine,
  createDmxClient,
} from "@/lib/integrations/dmx/dmxAdapter";

export const buildMockPharosEngine = buildMockDmxEngine;
export const createPharosClient = createDmxClient;
