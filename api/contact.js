// Receives a "contact us" question and stores it in Redis (separate list from
// sign-ups). Optionally emails a notification via Resend. Same-origin POST.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIST_KEY = "verona:messages";

const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.SIGNUP_FROM_EMAIL;
const NOTIFY_TO = process.env.SIGNUP_NOTIFY_TO;

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json();
}

async function notify(rec) {
  if (!RESEND_KEY || !RESEND_FROM || !NOTIFY_TO) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: NOTIFY_TO,
        reply_to: rec.email,
        subject: "New Verona GAA question: " + rec.name,
        text: "From: " + rec.name + " <" + rec.email + ">\n\n" + rec.message,
      }),
    });
  } catch (e) { /* non-blocking */ }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }
  if (!REDIS_URL || !REDIS_TOKEN) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  let data = req.body;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = {}; } }
  data = data || {};

  if (data["bot-field"] && String(data["bot-field"]).trim() !== "") { res.status(200).json({ ok: true }); return; }

  const email = String(data.email || "").trim();
  const name = String(data.name || "").trim();
  const message = String(data.message || "").trim();
  if (!name || name.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message) {
    res.status(400).json({ ok: false, error: "invalid" }); return;
  }

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    received_at: new Date().toISOString(),
    name: name,
    email: email.slice(0, 200),
    message: message.slice(0, 4000),
    page_language: String(data.page_language || ""),
  };

  try {
    await redis(["LPUSH", LIST_KEY, JSON.stringify(record)]);
    await redis(["LTRIM", LIST_KEY, "0", "4999"]);
    notify(record);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "store failed" });
  }
}
