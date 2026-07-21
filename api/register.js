// Store a join-form sign-up in Supabase (reuses your existing Supabase stack).
// Same-origin POST, so no CORS needed. Optionally emails a notification via
// Resend — all env-gated and non-blocking.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TABLE = process.env.SIGNUPS_TABLE || "verona_signups";

const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.SIGNUP_FROM_EMAIL; // a Resend-verified sender
const NOTIFY_TO = process.env.SIGNUP_NOTIFY_TO;

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
  if (!SB_URL || !SB_KEY) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  let data = req.body;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = {}; } }
  data = data || {};

  // Honeypot (if a direct poster fills the hidden field): accept + drop silently.
  if (data["bot-field"] && String(data["bot-field"]).trim() !== "") { res.status(200).json({ ok: true }); return; }

  const email = String(data.email || "").trim();
  const name = String(data.contact_name || "").trim();
  if (!name || name.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "invalid" }); return;
  }

  const record = {
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
    const r = await fetch(SB_URL + "/rest/v1/" + TABLE, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
    });
    if (!r.ok) throw new Error("supabase " + r.status);
    notify(record); // fire-and-forget email
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "store failed" });
  }
}
