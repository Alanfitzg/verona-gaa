# Sign-ups: storage + dashboard — setup

The site can capture join-form sign-ups into a database and show them on a
private dashboard at **`/admin`** (stat tiles, charts, table, CSV export).

Everything is already coded. To switch it on you need to (1) create a database,
(2) set two secrets, (3) flip the form endpoint live. ~10 minutes, all free tier.

## What's in the repo
- `api/register.js` — receives the form POST, validates, stores each sign-up.
- `api/submissions.js` — returns the sign-ups, gated by an admin password.
- `admin.html` — the dashboard (served at `/admin`), `noindex`, password-gated.

## 1. Create the database (Upstash Redis, via Vercel)
1. Vercel → your **verona-gaa** project → **Storage** tab → **Create Database**.
2. Choose **Upstash → Redis** (free plan). Give it a name, pick a nearby region.
3. **Connect it to this project.** Vercel injects the credentials as environment
   variables automatically (e.g. `KV_REST_API_URL` / `KV_REST_API_TOKEN`, or the
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` pair). The code accepts
   either naming — no edit needed.

## 2. Set the admin password
Vercel → project → **Settings → Environment Variables** → add:

| Name | Value | Environments |
|---|---|---|
| `ADMIN_PASSWORD` | *(a strong password you choose)* | Production (Preview too if you like) |

## 3. Redeploy
Env-var changes need a fresh deploy: Vercel → **Deployments** → ⋯ on the latest →
**Redeploy** (or just push any commit).

## 4. Go live: point the form at the API
In `index.html`, change:
```js
window.VERONA_FORM_ENDPOINT = "";           // demo mode
```
to:
```js
window.VERONA_FORM_ENDPOINT = "/api/register";
```
Commit + push. (Ask Claude to do this once steps 1–3 are done — best to flip it
*after* the database exists so no real sign-up ever fails.)

## 5. Use it
- Open **https://gaelicgamesverona.com/admin**, enter `ADMIN_PASSWORD`.
- Test the join form on the live site → the sign-up appears on the dashboard.

## Privacy notes (important — this includes minors' data)
- `/admin` is `noindex` and password-gated; the data endpoint returns nothing
  without the password. Keep the password private; share only with people who
  need it.
- Consider a short **privacy notice** near the form and a **retention policy**
  (how long you keep records). Under GDPR you should be able to delete a person's
  data on request — records can be removed from the Upstash console, or ask Claude
  to add a delete action to the dashboard.
- The store is capped at the most recent 5,000 sign-ups.
