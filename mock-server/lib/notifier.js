/**
 * Alert delivery channels: email (SMTP), Telegram, ntfy, and webhooks
 * (generic JSON, Slack, Microsoft Teams, Discord). Channels are stored in
 * db.notificationChannels; secrets in them are encrypted at rest by persistence.js.
 */
import crypto from "crypto";
import { httpError } from "./exec.js";

export const CHANNEL_TYPES = {
  email: { label: "Email (SMTP)", fields: ["smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPassword", "from", "to"] },
  telegram: { label: "Telegram", fields: ["botToken", "chatId"] },
  ntfy: { label: "ntfy push", fields: ["serverUrl", "topic", "accessToken"] },
  webhook: { label: "Webhook (JSON)", fields: ["url", "format", "webhookSecret"] },
};

const SEVERITY_EMOJI = { critical: "🔴", warning: "🟠", info: "🔵", ok: "🟢" };

export function normalizeChannel(raw = {}) {
  const type = CHANNEL_TYPES[raw.type] ? raw.type : "webhook";
  const out = {
    id: raw.id || `chan-${crypto.randomUUID()}`,
    type,
    name: String(raw.name || CHANNEL_TYPES[type].label).slice(0, 80),
    enabled: raw.enabled !== false,
    minSeverity: ["info", "warning", "critical"].includes(raw.minSeverity) ? raw.minSeverity : "warning",
    sendRecovery: raw.sendRecovery !== false,
    remindMinutes: Math.max(0, Math.min(1440, Number(raw.remindMinutes) || 0)),
  };
  for (const f of CHANNEL_TYPES[type].fields) out[f] = raw[f] ?? "";
  if (type === "email") out.smtpPort = Number(raw.smtpPort) || 587;
  if (type === "ntfy" && !out.serverUrl) out.serverUrl = "https://ntfy.sh";
  if (type === "webhook" && !["generic", "slack", "teams", "discord"].includes(out.format)) out.format = "generic";
  return out;
}

/** Public view of a channel: secret fields are masked. */
export function maskChannel(ch) {
  const out = { ...ch };
  for (const f of ["smtpPassword", "botToken", "accessToken", "webhookSecret"]) {
    if (out[f]) out[f] = "••••••••";
  }
  return out;
}

/** Merge an update from the UI, keeping existing secrets when the masked placeholder is sent back. */
export function mergeChannel(existing, update) {
  const merged = { ...existing, ...update, id: existing.id };
  for (const f of ["smtpPassword", "botToken", "accessToken", "webhookSecret"]) {
    if (update[f] === "••••••••") merged[f] = existing[f];
  }
  return normalizeChannel(merged);
}

const SEV_RANK = { info: 0, warning: 1, critical: 2 };
export function channelWants(ch, alert) {
  if (!ch.enabled) return false;
  if (alert.recovery) return ch.sendRecovery;
  return (SEV_RANK[alert.severity] ?? 1) >= (SEV_RANK[ch.minSeverity] ?? 1);
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

function assertHttpUrl(u) {
  try {
    const url = new URL(u);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw httpError(400, "Invalid URL");
  }
}

/**
 * alert = { title, message, severity, recovery, source, vessel, ts, link }
 */
export async function sendToChannel(ch, alert) {
  const icon = alert.recovery ? SEVERITY_EMOJI.ok : SEVERITY_EMOJI[alert.severity] || "⚪";
  const subject = `${icon} ${alert.vessel ? `[${alert.vessel}] ` : ""}${alert.title}`;
  const text = `${alert.message}\n\n${new Date(alert.ts || Date.now()).toISOString()}${alert.link ? `\n${alert.link}` : ""}`;

  switch (ch.type) {
    case "email": {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport({
        host: ch.smtpHost,
        port: Number(ch.smtpPort) || 587,
        secure: ch.smtpSecure === true || ch.smtpSecure === "true" || Number(ch.smtpPort) === 465,
        auth: ch.smtpUser ? { user: ch.smtpUser, pass: ch.smtpPassword } : undefined,
        connectionTimeout: 10000,
      });
      await transport.sendMail({ from: ch.from || ch.smtpUser, to: ch.to, subject, text });
      return;
    }
    case "telegram": {
      if (!ch.botToken || !ch.chatId) throw httpError(400, "Bot token and chat ID required");
      await postJson(`https://api.telegram.org/bot${encodeURIComponent(ch.botToken)}/sendMessage`, {
        chat_id: ch.chatId,
        text: `${subject}\n\n${text}`,
        disable_web_page_preview: true,
      });
      return;
    }
    case "ntfy": {
      const base = assertHttpUrl(ch.serverUrl || "https://ntfy.sh").replace(/\/$/, "");
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(ch.topic || "")) throw httpError(400, "Invalid ntfy topic");
      const headers = {
        Title: subject.replace(/[^\x20-\x7E]/g, "").trim() || "WaveGuard",
        Priority: alert.recovery ? "default" : alert.severity === "critical" ? "urgent" : "high",
        Tags: alert.recovery ? "white_check_mark" : alert.severity === "critical" ? "rotating_light" : "warning",
      };
      if (ch.accessToken) headers.Authorization = `Bearer ${ch.accessToken}`;
      const res = await fetch(`${base}/${ch.topic}`, { method: "POST", headers, body: text, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
      return;
    }
    case "webhook": {
      const url = assertHttpUrl(ch.url);
      if (ch.format === "slack") return postJson(url, { text: `*${subject}*\n${text}` });
      if (ch.format === "discord") return postJson(url, { content: `**${subject}**\n${text}`.slice(0, 1900) });
      if (ch.format === "teams") {
        return postJson(url, {
          type: "message",
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                { type: "TextBlock", size: "Medium", weight: "Bolder", text: subject, wrap: true },
                { type: "TextBlock", text, wrap: true },
              ],
            },
          }],
        });
      }
      const body = { event: alert.recovery ? "recovered" : "alert", ...alert, subject };
      const headers = {};
      if (ch.webhookSecret) {
        headers["X-WaveGuard-Signature"] = crypto.createHmac("sha256", ch.webhookSecret).update(JSON.stringify(body)).digest("hex");
      }
      return postJson(url, body, headers);
    }
    default:
      throw httpError(400, `Unknown channel type ${ch.type}`);
  }
}

/** Fan an alert out to every channel that wants it. Never throws. */
export async function dispatchAlert(channels, alert, { onResult } = {}) {
  const targets = (channels || []).filter((c) => channelWants(c, alert));
  const results = await Promise.all(
    targets.map(async (ch) => {
      try {
        await sendToChannel(ch, alert);
        return { channelId: ch.id, name: ch.name, ok: true };
      } catch (err) {
        console.warn(`[notify] ${ch.type} "${ch.name}" failed: ${err.message}`);
        return { channelId: ch.id, name: ch.name, ok: false, error: err.message };
      }
    })
  );
  onResult?.(results);
  return results;
}
