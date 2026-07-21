// Returns all stored sign-ups, gated by the ADMIN_PASSWORD env var.
// The /admin dashboard calls this with an "x-admin-key" header.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIST_KEY = "verona:signups";
const ADMIN = process.env.ADMIN_PASSWORD;

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
  const key = req.headers["x-admin-key"] || (req.query && req.query.key) || "";
  if (!ADMIN || key !== ADMIN) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  if (!REDIS_URL || !REDIS_TOKEN) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  try {
    const out = await redis(["LRANGE", LIST_KEY, "0", "-1"]);
    const items = (out.result || [])
      .map((s) => { try { return JSON.parse(s); } catch (e) { return null; } })
      .filter(Boolean);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, count: items.length, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: "read failed" });
  }
}
