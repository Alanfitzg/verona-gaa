// Returns all stored sign-ups from Supabase, gated by the ADMIN_PASSWORD env
// var. The /admin dashboard calls this with an "x-admin-key" header. Uses the
// service_role key server-side (bypasses RLS) so public keys can never read PII.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TABLE = process.env.SIGNUPS_TABLE || "verona_signups";
const ADMIN = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  const key = req.headers["x-admin-key"] || (req.query && req.query.key) || "";
  if (!ADMIN || key !== ADMIN) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  if (!SB_URL || !SB_KEY) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  try {
    const r = await fetch(SB_URL + "/rest/v1/" + TABLE + "?select=*&order=received_at.desc&limit=5000", {
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
    });
    if (!r.ok) throw new Error("supabase " + r.status);
    const items = await r.json();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, count: items.length, items: items });
  } catch (e) {
    res.status(500).json({ ok: false, error: "read failed" });
  }
}
