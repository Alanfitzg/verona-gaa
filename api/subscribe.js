// Stores a community-list subscriber (email) in Redis. Same-origin POST.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIST_KEY = "verona:subscribers";

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
  if (!REDIS_URL || !REDIS_TOKEN) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  let data = req.body;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = {}; } }
  data = data || {};

  if (data["bot-field"] && String(data["bot-field"]).trim() !== "") { res.status(200).json({ ok: true }); return; }

  const email = String(data.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "invalid" }); return;
  }

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    received_at: new Date().toISOString(),
    email: email.slice(0, 200),
    page_language: String(data.page_language || ""),
  };

  try {
    await redis(["LPUSH", LIST_KEY, JSON.stringify(record)]);
    await redis(["LTRIM", LIST_KEY, "0", "9999"]);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "store failed" });
  }
}
