#!/usr/bin/env node
/**
 * Reset (or create) the "admin" account password directly in the data file.
 * Used by `sudo waveguard reset-admin`. The WaveGuard service must be stopped
 * first, otherwise it will overwrite the file on its next save.
 *
 *   node scripts/reset-admin.js [new-password]
 *
 * Without an argument a random password is generated and printed.
 */
import crypto from "crypto";
import { loadPersistedDb, flushSave } from "../persistence.js";
import { hashPassword, validatePasswordStrength } from "../lib/auth.js";

const supplied = process.argv[2];
if (supplied) {
  const weak = validatePasswordStrength(supplied);
  if (weak) {
    console.error(weak);
    process.exit(1);
  }
}
const password = supplied || crypto.randomBytes(9).toString("base64url");

const db = loadPersistedDb() || {};
if (!Array.isArray(db.users)) db.users = [];
let admin = db.users.find((u) => u.username?.toLowerCase() === "admin");
if (!admin) {
  admin = { id: "user-admin", username: "admin", email: "admin@local", name: "Administrator", full_name: "Administrator", created_date: new Date().toISOString() };
  db.users.push(admin);
}
admin.role = "admin";
admin.disabled = false;
admin.passwordHash = hashPassword(password);
admin.mustChangePassword = !supplied;
delete admin.password;
// Sign the admin out everywhere.
for (const [k, s] of Object.entries(db.sessions || {})) if (s.userId === admin.id) delete db.sessions[k];
flushSave(db);

console.log("Administrator password reset.");
console.log("  username: admin");
console.log(`  password: ${password}`);
process.exit(0);
