// Returns all stored sign-ups from Redis, gated by named logins in ADMIN_USERS.
// The /admin dashboard calls this with x-admin-user + x-admin-key headers.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIST_KEY = "verona:signups";

// Access control. Simplest mode: ADMIN_EMAILS is a comma-separated allow-list of
// emails — logging in just means entering an email that's on the list (low
// security, chosen deliberately; tighten later). Named ADMIN_USERS (user+pass)
// and a single ADMIN_PASSWORD still work too, if set.
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
  if (!authOK(req)) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  if (!REDIS_URL || !REDIS_TOKEN) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  try {
    const out = await redis(["LRANGE", LIST_KEY, "0", "-1"]);
    const items = (out.result || [])
      .map((s) => { try { return JSON.parse(s); } catch (e) { return null; } })
      .filter(Boolean);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, count: items.length, items: items });
  } catch (e) {
    res.status(500).json({ ok: false, error: "read failed" });
  }
}
