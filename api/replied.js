// Marks a "Get in touch" question as replied to (or un-marks it) so committee
// members don't answer the same person twice. Same-origin POST, gated by the
// same logins as the read endpoints. Stored in a Redis hash keyed by message id:
// { by, at }. api/messages.js merges these into the list it returns.
//
// Marking uses HSETNX, so if two people click at once only the first wins; the
// second gets 409 with who already replied.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REPLIED_KEY = "verona:replied";

// Access control — identical to api/submissions.js (email allow-list first,
// then the older named-user / single-password modes).
function authOK(req) {
  const user = String(req.headers["x-admin-user"] || "").toLowerCase().trim();
  const key = String(req.headers["x-admin-key"] || (req.query && req.query.key) || "");
  if (!key) return false;
  const keyLc = key.toLowerCase().trim();

  const emails = String(process.env.ADMIN_EMAILS || "")
    .split(/[,;\s]+/).map((e) => e.toLowerCase().trim()).filter(Boolean);
  if (emails.length && emails.indexOf(keyLc) !== -1) return true;

  let users = {};
  try { users = JSON.parse(process.env.ADMIN_USERS || "{}"); } catch (e) { users = {}; }
  const map = {};
  Object.keys(users).forEach((k) => { map[k.toLowerCase()] = users[k]; });
  if (user && map[user] && map[user] === key) return true;

  if (process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD) return true;
  return false;
}

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }
  if (!authOK(req)) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  if (!REDIS_URL || !REDIS_TOKEN) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  let data = req.body;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = {}; } }
  data = data || {};

  const id = String(data.id || "").slice(0, 80);
  if (!id) { res.status(400).json({ ok: false, error: "invalid" }); return; }
  const by = String(req.headers["x-admin-user"] || "").trim().slice(0, 200) || "admin";

  try {
    res.setHeader("Cache-Control", "no-store");
    if (data.replied === false) {
      await redis(["HDEL", REPLIED_KEY, id]);
      res.status(200).json({ ok: true, replied: null });
      return;
    }
    const mark = { by: by, at: new Date().toISOString() };
    const set = await redis(["HSETNX", REPLIED_KEY, id, JSON.stringify(mark)]);
    if (set.result === 1) { res.status(200).json({ ok: true, replied: mark }); return; }

    // Someone got there first — hand back their mark.
    const cur = await redis(["HGET", REPLIED_KEY, id]);
    let existing = null;
    try { existing = JSON.parse(cur.result); } catch (e) { existing = null; }
    res.status(409).json({ ok: false, error: "already replied", replied: existing });
  } catch (e) {
    res.status(500).json({ ok: false, error: "save failed" });
  }
}
