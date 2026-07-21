// Store a join-form sign-up in Redis (Upstash, provisioned via Vercel Storage —
// dedicated to this site, always-on, free). Same-origin POST, no CORS needed.
// Optionally emails a notification via Resend — env-gated and non-blocking.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIST_KEY = "verona:signups";

const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.SIGNUP_FROM_EMAIL; // a Resend-verified sender
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
        subject: "New Verona GAA sign-up: " + rec.contact_name,
        text: [
          "Name: " + rec.contact_name,
          "Email: " + rec.email,
          "Phone: " + rec.contact_number,
          "Role: " + rec.role,
          "Sports: " + (rec.sports_interested || []).join(", "),
          "Date of birth: " + rec.date_of_birth,
          "Under 18: " + rec.registering_for_u18,
          rec.registering_for_u18 === "yes" ? "Player: " + rec.player_name + " (" + rec.player_dob + ")" : "",
          "Language: " + rec.page_language,
        ].filter(Boolean).join("\n"),
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
  const name = String(data.contact_name || "").trim();
  if (!name || name.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "invalid" }); return;
  }

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    received_at: new Date().toISOString(),
    role: String(data.role || ""),
    registering_for_u18: String(data.registering_for_u18 || "no"),
    player_name: String(data.player_name || "").slice(0, 200),
    player_dob: String(data.player_dob || ""),
    contact_name: name,
    email: email.slice(0, 200),
    contact_number: String(data.contact_number || "").slice(0, 60),
    date_of_birth: String(data.date_of_birth || ""),
    sports_interested: Array.isArray(data.sports_interested) ? data.sports_interested.slice(0, 10) : [],
    consent: String(data.consent || ""),
    page_language: String(data.page_language || ""),
  };

  try {
    await redis(["LPUSH", LIST_KEY, JSON.stringify(record)]);
    await redis(["LTRIM", LIST_KEY, "0", "4999"]); // keep the store bounded
    notify(record); // fire-and-forget email
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "store failed" });
  }
}
