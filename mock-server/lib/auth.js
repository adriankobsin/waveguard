/**
 * Authentication for the WaveGuard local server.
 *
 * - Passwords hashed with scrypt (Node built-in, no native deps).
 * - Sessions are random 256-bit tokens; only their SHA-256 is stored (and persisted),
 *   so the data file never contains a usable login token.
 * - The browser gets an HttpOnly SameSite=Lax cookie, so every existing fetch()/
 *   EventSource call in the UI is authenticated without code changes.
 * - Bearer tokens are also accepted (session token or WAVEGUARD_API_TOKEN).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config } from "./config.js";

export const SESSION_COOKIE = "wg_session";
const SCRYPT_N = 16384;
const ROLES = ["admin", "technician", "user", "viewer"];

// ---------------------------------------------------------------- passwords
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
  const [, n, saltB64, hashB64] = stored.split("$");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(String(password ?? ""), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n) || SCRYPT_N,
  });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function validatePasswordStrength(password) {
  const p = String(password || "");
  if (p.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Password must contain letters and numbers";
  return null;
}

// ---------------------------------------------------------------- sessions
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out;
}

export function sanitizeUser(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { password, passwordHash, ...safe } = user;
  return safe;
}

/**
 * Build the auth layer bound to the in-memory db. `db.users` and `db.sessions`
 * are persisted by persistence.js.
 */
export function createAuth(db, { onChange } = {}) {
  if (!Array.isArray(db.users)) db.users = [];
  if (!db.sessions || Array.isArray(db.sessions) || typeof db.sessions !== "object") db.sessions = {};

  const changed = () => onChange && onChange();
  const ttlMs = config.sessionTtlHours * 3600 * 1000;

  // Brute-force protection: 8 failures per IP per 10 minutes.
  const failures = new Map();
  function tooManyAttempts(ip) {
    const now = Date.now();
    const rec = failures.get(ip);
    if (!rec || now - rec.first > 10 * 60 * 1000) return false;
    return rec.count >= 8;
  }
  function recordFailure(ip) {
    const now = Date.now();
    const rec = failures.get(ip);
    if (!rec || now - rec.first > 10 * 60 * 1000) failures.set(ip, { first: now, count: 1 });
    else rec.count += 1;
  }

  function findUserByIdentifier(identifier) {
    const id = String(identifier || "").trim().toLowerCase();
    if (!id) return null;
    return db.users.find((u) => u.username?.toLowerCase() === id || u.email?.toLowerCase() === id) || null;
  }

  function createSession(user, req) {
    const token = crypto.randomBytes(32).toString("base64url");
    db.sessions[sha256(token)] = {
      userId: user.id,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      ip: req?.ip || "",
      agent: String(req?.headers?.["user-agent"] || "").slice(0, 160),
    };
    changed();
    return token;
  }

  function destroySession(token) {
    if (!token) return;
    delete db.sessions[sha256(token)];
    changed();
  }

  function pruneSessions() {
    const now = Date.now();
    let removed = 0;
    for (const [k, s] of Object.entries(db.sessions)) {
      if (!s || now - (s.lastSeen || 0) > ttlMs || !db.users.some((u) => u.id === s.userId)) {
        delete db.sessions[k];
        removed++;
      }
    }
    if (removed) changed();
  }
  setInterval(pruneSessions, 60 * 60 * 1000).unref();

  function tokenFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
    const auth = String(req.headers.authorization || "");
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    if (typeof req.query?.access_token === "string") return req.query.access_token;
    return null;
  }

  /** Resolve the logged-in user for a request, or null. */
  function userFromRequest(req) {
    if (config.authDisabled) return db.users.find((u) => u.role === "admin") || null;
    const token = tokenFromRequest(req);
    if (!token) return null;
    if (config.apiToken && token.length === config.apiToken.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(config.apiToken))) {
      return { id: "api-token", username: "api", role: "admin", name: "API token" };
    }
    const sess = db.sessions[sha256(token)];
    if (!sess) return null;
    if (Date.now() - (sess.lastSeen || 0) > ttlMs) {
      delete db.sessions[sha256(token)];
      return null;
    }
    const user = db.users.find((u) => u.id === sess.userId);
    if (!user || user.disabled) return null;
    // Touch at most once a minute to avoid write amplification.
    if (Date.now() - sess.lastSeen > 60 * 1000) {
      sess.lastSeen = Date.now();
      changed();
    }
    return user;
  }

  function setSessionCookie(res, token) {
    const maxAge = Math.floor(ttlMs / 1000);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.secureCookies ? "; Secure" : ""}`
    );
  }
  function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  // ------------------------------------------------------------ first boot
  /**
   * Hash any legacy plaintext passwords and make sure an admin exists.
   * Admin password comes from WAVEGUARD_ADMIN_PASSWORD, otherwise a random one is
   * generated and written to <dataDir>/initial-admin-password.txt (0600).
   */
  function ensureAdmin() {
    let migrated = 0;
    for (const u of db.users) {
      if (u.password && !u.passwordHash) {
        u.passwordHash = hashPassword(u.password);
        migrated++;
      }
      delete u.password;
    }
    if (migrated) console.log(`[auth] Migrated ${migrated} legacy plaintext password(s) to scrypt hashes`);

    if (!db.users.some((u) => u.role === "admin" && u.passwordHash && !u.disabled)) {
      let pw = process.env.WAVEGUARD_ADMIN_PASSWORD;
      let generated = false;
      if (!pw) {
        pw = crypto.randomBytes(9).toString("base64url");
        generated = true;
      }
      const existing = db.users.find((u) => u.username?.toLowerCase() === "admin");
      if (existing) {
        existing.role = "admin";
        existing.passwordHash = hashPassword(pw);
        existing.mustChangePassword = generated;
        existing.disabled = false;
      } else {
        db.users.push({
          id: "user-admin",
          username: "admin",
          email: "admin@local",
          name: "Administrator",
          full_name: "Administrator",
          role: "admin",
          passwordHash: hashPassword(pw),
          mustChangePassword: generated,
          created_date: new Date().toISOString(),
        });
      }
      if (generated) {
        const file = path.join(config.dataDir, "initial-admin-password.txt");
        fs.writeFileSync(file, `username: admin\npassword: ${pw}\n`, { mode: 0o600 });
        console.log("============================================================");
        console.log("[auth] No administrator account existed — one was created.");
        console.log("[auth]   username: admin");
        console.log(`[auth]   password: ${pw}`);
        console.log(`[auth] (also saved to ${file} — delete it after first login)`);
        console.log("============================================================");
      } else {
        console.log("[auth] Administrator 'admin' created from WAVEGUARD_ADMIN_PASSWORD");
      }
      changed();
    }
  }

  // ------------------------------------------------------------ middleware
  const PUBLIC_PATTERNS = [
    /^\/api\/health$/,
    /^\/api\/auth\/(login|logout|status)$/,
    /^\/api\/apps\/[^/]+\/auth\/login$/,
    /^\/api\/apps\/auth\/logout$/,
    /^\/api\/apps\/public\//,
    /^\/api\/apps\/[^/]+\/scanner\/health$/,
    /^\/api\/status-page$/,
  ];
  const PROTECTED_PREFIXES = ["/api", "/chat", "/functions", "/uploads", "/cws", "/ws-user-apps"];

  function middleware(req, res, next) {
    const p = req.path;
    if (!PROTECTED_PREFIXES.some((pre) => p === pre || p.startsWith(pre + "/"))) return next();
    if (req.method === "OPTIONS") return next();
    if (PUBLIC_PATTERNS.some((re) => re.test(p))) return next();
    const user = userFromRequest(req);
    if (!user) return res.status(401).json({ message: "Login required", code: "auth_required" });
    req.user = user;
    // Viewers are read-only everywhere except their own password / logout.
    if (user.role === "viewer" && !["GET", "HEAD"].includes(req.method) && !/\/(change-password|logout)$/.test(p)) {
      return res.status(403).json({ message: "Your account is read-only" });
    }
    next();
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      const user = req.user || userFromRequest(req);
      if (!user) return res.status(401).json({ message: "Login required", code: "auth_required" });
      if (!roles.includes(user.role)) return res.status(403).json({ message: "Insufficient permissions" });
      req.user = user;
      next();
    };
  }
  const requireAdmin = requireRole("admin");

  // ------------------------------------------------------------ routes
  function registerRoutes(app) {
    const login = (req, res) => {
      const ip = req.ip || "unknown";
      if (tooManyAttempts(ip)) {
        return res.status(429).json({ message: "Too many failed attempts. Try again in 10 minutes.", code: "rate_limited" });
      }
      const { email, username, password } = req.body || {};
      const user = findUserByIdentifier(username || email);
      if (!user || user.disabled || !verifyPassword(password, user.passwordHash)) {
        recordFailure(ip);
        return res.status(401).json({ message: "Invalid username or password", code: "auth_error" });
      }
      failures.delete(ip);
      user.lastLoginAt = new Date().toISOString();
      const token = createSession(user, req);
      setSessionCookie(res, token);
      res.json({ access_token: token, user: sanitizeUser(user), expires_in: Math.floor(ttlMs / 1000) });
    };
    app.post("/api/auth/login", login);
    app.post("/api/apps/:appId/auth/login", login);

    const logout = (req, res) => {
      destroySession(tokenFromRequest(req));
      clearSessionCookie(res);
      // Always land on the local login page (never an external from_url — avoids open redirects).
      if (req.method === "GET") return res.redirect("/login");
      res.json({ success: true });
    };
    app.post("/api/auth/logout", logout);
    app.get("/api/apps/auth/logout", logout);

    app.get("/api/auth/status", (req, res) => {
      const user = userFromRequest(req);
      res.json({ authenticated: !!user, user: sanitizeUser(user), authDisabled: config.authDisabled });
    });

    // Disable stub sign-up / OTP / OAuth flows from the Base44 template.
    const notAvailable = (_req, res) =>
      res.status(404).json({ message: "Not available on a standalone WaveGuard server. Ask an administrator to create your account." });
    app.post("/api/apps/:appId/auth/register", notAvailable);
    app.post("/api/apps/:appId/auth/verify-otp", notAvailable);
    app.post("/api/apps/:appId/auth/resend-otp", notAvailable);
    app.post("/api/apps/:appId/auth/reset-password-request", notAvailable);
    app.post("/api/apps/:appId/auth/reset-password", notAvailable);
    app.get("/api/apps/auth/login", (_req, res) => res.redirect("/login"));
    app.get("/api/apps/auth/:provider/login", (_req, res) => res.redirect("/login"));

    const changePassword = (req, res) => {
      const user = req.user;
      if (!user || !db.users.includes(user)) return res.status(401).json({ message: "Login required" });
      const { currentPassword, current_password, oldPassword, newPassword, new_password } = req.body || {};
      const current = currentPassword ?? current_password ?? oldPassword;
      const next = newPassword ?? new_password;
      if (!verifyPassword(current, user.passwordHash)) return res.status(400).json({ message: "Current password is incorrect" });
      const weak = validatePasswordStrength(next);
      if (weak) return res.status(400).json({ message: weak });
      user.passwordHash = hashPassword(next);
      user.mustChangePassword = false;
      // Log out every other session of this user.
      const keep = sha256(tokenFromRequest(req));
      for (const [k, s] of Object.entries(db.sessions)) if (s.userId === user.id && k !== keep) delete db.sessions[k];
      const initial = path.join(config.dataDir, "initial-admin-password.txt");
      if (user.role === "admin" && fs.existsSync(initial)) fs.rmSync(initial, { force: true });
      changed();
      res.json({ message: "Password changed successfully." });
    };
    app.post("/api/auth/change-password", changePassword);
    app.post("/api/apps/:appId/auth/change-password", changePassword);

    app.get("/api/apps/:appId/entities/User/me", (req, res) => {
      if (!req.user) return res.status(401).json({ message: "Login required", code: "auth_required" });
      res.json(sanitizeUser(req.user));
    });
    app.put("/api/apps/:appId/entities/User/me", (req, res) => {
      const user = req.user;
      if (!user || !db.users.includes(user)) return res.status(401).json({ message: "Login required" });
      const { name, full_name, email, preferences } = req.body || {};
      if (name !== undefined) user.name = String(name);
      if (full_name !== undefined) user.full_name = String(full_name);
      if (email !== undefined) user.email = String(email);
      if (preferences !== undefined) user.preferences = preferences;
      changed();
      res.json(sanitizeUser(user));
    });

    // ---- User management (admin only)
    app.get("/api/apps/:appId/users", requireAdmin, (_req, res) => {
      res.json({ users: db.users.map(sanitizeUser) });
    });
    app.post("/api/apps/:appId/users", requireAdmin, (req, res) => {
      const { username, password, role, name, email } = req.body || {};
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      if (!/^[a-z0-9._-]{2,40}$/i.test(username)) return res.status(400).json({ message: "Username may only contain letters, numbers, . _ -" });
      if (db.users.some((u) => u.username?.toLowerCase() === String(username).toLowerCase())) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const weak = validatePasswordStrength(password);
      if (weak) return res.status(400).json({ message: weak });
      const user = {
        id: "user-" + crypto.randomUUID(),
        username,
        email: email || `${username}@local`,
        name: name || username,
        full_name: name || username,
        role: ROLES.includes(role) ? role : "user",
        passwordHash: hashPassword(password),
        created_date: new Date().toISOString(),
      };
      db.users.push(user);
      changed();
      res.json({ user: sanitizeUser(user) });
    });
    app.put("/api/apps/:appId/users/:id", requireAdmin, (req, res) => {
      const user = db.users.find((u) => u.id === req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { role, password, disabled, name } = req.body || {};
      if (role) {
        if (!ROLES.includes(role)) return res.status(400).json({ message: "Unknown role" });
        if (user.role === "admin" && role !== "admin" && db.users.filter((u) => u.role === "admin" && !u.disabled).length <= 1) {
          return res.status(400).json({ message: "Cannot demote the last administrator" });
        }
        user.role = role;
      }
      if (password) {
        const weak = validatePasswordStrength(password);
        if (weak) return res.status(400).json({ message: weak });
        user.passwordHash = hashPassword(password);
        for (const [k, s] of Object.entries(db.sessions)) if (s.userId === user.id) delete db.sessions[k];
      }
      if (disabled !== undefined) user.disabled = !!disabled;
      if (name !== undefined) user.name = user.full_name = String(name);
      changed();
      res.json({ user: sanitizeUser(user) });
    });
    app.delete("/api/apps/:appId/users/:id", requireAdmin, (req, res) => {
      const user = db.users.find((u) => u.id === req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (req.user?.id === user.id) return res.status(400).json({ message: "You cannot delete your own account" });
      if (user.role === "admin" && db.users.filter((u) => u.role === "admin").length <= 1) {
        return res.status(400).json({ message: "Cannot delete the last administrator" });
      }
      db.users = db.users.filter((u) => u.id !== user.id);
      for (const [k, s] of Object.entries(db.sessions)) if (s.userId === user.id) delete db.sessions[k];
      changed();
      res.json({ success: true });
    });

    // ---- Active sessions (admin)
    app.get("/api/auth/sessions", requireAdmin, (_req, res) => {
      res.json({
        sessions: Object.values(db.sessions).map((s) => ({
          user: sanitizeUser(db.users.find((u) => u.id === s.userId))?.username || s.userId,
          ip: s.ip,
          agent: s.agent,
          createdAt: new Date(s.createdAt).toISOString(),
          lastSeen: new Date(s.lastSeen).toISOString(),
        })),
      });
    });
  }

  return {
    middleware,
    requireRole,
    requireAdmin,
    registerRoutes,
    ensureAdmin,
    userFromRequest,
    sanitizeUser,
  };
}
