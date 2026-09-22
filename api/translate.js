// Translates "Get in touch" messages into English for the /admin dashboard.
// Same-origin POST, gated by the same logins as the read endpoints. Uses
// Claude over the Messages API (raw fetch, like every other integration in
// this folder). Each message is translated once: results are cached in a
// Redis hash keyed by message id, so repeat dashboard visits cost nothing.
//
// Needs ANTHROPIC_API_KEY in the Vercel env vars; without it the endpoint
// answers 503 and the dashboard falls back to per-message Google Translate links.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CACHE_KEY = "verona:translations";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
// ANTHROPIC_BASE_URL is the same override the official SDKs honour (local testing).
const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages";
const MODEL = "claude-opus-5";

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

// One Claude call for a batch of messages. Structured output guarantees a
// parseable JSON reply; the numbering ties each translation back to its message.
async function translate(items) {
  const numbered = items.map((it, i) => "[" + (i + 1) + "]\n" + it.text).join("\n\n");
  const schema = {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: { n: { type: "integer" }, english: { type: "string" } },
          required: ["n", "english"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  };

  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      fallbacks: "default",
      system:
        "You translate messages sent through the website contact form of Verona GAA, " +
        "a Gaelic games club in Verona, Italy, into English for the club committee. " +
        "Translate each numbered message faithfully and naturally, keeping names, places, " +
        "club and sport terms, and the writer's tone. If a message is already in English, " +
        "return it unchanged. Never add commentary or answer the message.",
      output_config: { effort: "low", format: { type: "json_schema", schema: schema } },
      messages: [{
        role: "user",
        content: "Translate these " + items.length + " messages. Return exactly one entry per message number.\n\n" + numbered,
      }],
    }),
  });
  if (!r.ok) throw new Error("anthropic " + r.status);
  const msg = await r.json();
  if (msg.stop_reason === "refusal") throw new Error("refused");

  const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = JSON.parse(text);
  const out = {};
  (parsed.translations || []).forEach((t) => {
    const it = items[Number(t.n) - 1];
    if (it && typeof t.english === "string") out[it.id] = t.english.trim();
  });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }
  if (!authOK(req)) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  if (!ANTHROPIC_KEY) { res.status(503).json({ ok: false, error: "translation not configured" }); return; }
  if (!REDIS_URL || !REDIS_TOKEN) { res.status(503).json({ ok: false, error: "storage not configured" }); return; }

  let data = req.body;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = {}; } }
  data = data || {};

  const items = (Array.isArray(data.items) ? data.items : [])
    .slice(0, 60)
    .map((it) => ({ id: String((it && it.id) || "").slice(0, 80), text: String((it && it.text) || "").trim().slice(0, 4000) }))
    .filter((it) => it.id && it.text);
  if (!items.length) { res.status(400).json({ ok: false, error: "invalid" }); return; }

  try {
    // Cached first; only untranslated messages go to the model.
    const cached = await redis(["HMGET", CACHE_KEY].concat(items.map((it) => it.id)));
    const result = {};
    const missing = [];
    (cached.result || []).forEach((v, i) => {
      if (typeof v === "string" && v) result[items[i].id] = v; else missing.push(items[i]);
    });

    if (missing.length) {
      const fresh = await translate(missing);
      const hset = ["HSET", CACHE_KEY];
      Object.keys(fresh).forEach((id) => { result[id] = fresh[id]; hset.push(id, fresh[id]); });
      if (hset.length > 2) await redis(hset);
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, translations: result, translated_now: missing.length });
  } catch (e) {
    res.status(502).json({ ok: false, error: "translate failed: " + (e && e.message ? e.message : "unknown") });
  }
}
