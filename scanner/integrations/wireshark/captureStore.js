import fs from "fs";
import path from "path";
import crypto from "crypto";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createCaptureStore(baseDir) {
  fs.mkdirSync(baseDir, { recursive: true });

  function purgeOld() {
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      const cutoff = Date.now() - MAX_AGE_MS;
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        const full = path.join(baseDir, ent.name);
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
      }
    } catch {
      /* ignore */
    }
  }

  function newCaptureId() {
    return crypto.randomBytes(8).toString("hex");
  }

  function capturePath(captureId) {
    return path.join(baseDir, `${captureId}.pcapng`);
  }

  function exists(captureId) {
    return fs.existsSync(capturePath(captureId));
  }

  function writeFromBase64(captureId, base64) {
    purgeOld();
    const buf = Buffer.from(base64, "base64");
    fs.writeFileSync(capturePath(captureId), buf);
    return capturePath(captureId);
  }

  return {
    baseDir,
    purgeOld,
    newCaptureId,
    capturePath,
    exists,
    writeFromBase64,
  };
}
