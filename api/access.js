// Lists who can log in to /admin, for the "Who has access" panel. ADMIN_EMAILS is
// stored as a Vercel Secret (can't be revealed in Vercel itself), so this is the
// only way to see it. Gated by the same logins; never returns passwords — for
// ADMIN_USERS only the usernames, and for ADMIN_PASSWORD only whether it's set.
function parseEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(/[,;\s]+/).map((e) => e.toLowerCase().trim()).filter(Boolean);
}

function parseUsers() {
  try { return JSON.parse(process.env.ADMIN_USERS || "{}") || {}; } catch (e) { return {}; }
}

// Access control — identical to api/submissions.js (email allow-list first,
// then the older named-user / single-password modes).
function authOK(req) {
  const user = String(req.headers["x-admin-user"] || "").toLowerCase().trim();
  const key = String(req.headers["x-admin-key"] || (req.query && req.query.key) || "");
  if (!key) return false;
  const keyLc = key.toLowerCase().trim();

  const emails = parseEmails();
  if (emails.length && emails.indexOf(keyLc) !== -1) return true;

  const users = parseUsers();
  const map = {};
  Object.keys(users).forEach((k) => { map[k.toLowerCase()] = users[k]; });
  if (user && map[user] && map[user] === key) return true;

  if (process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD) return true;
  return false;
}

export default async function handler(req, res) {
  if (!authOK(req)) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    emails: parseEmails(),
    users: Object.keys(parseUsers()),
    shared_password: !!process.env.ADMIN_PASSWORD,
  });
}
