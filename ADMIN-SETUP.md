# Sign-ups: storage + dashboard — setup

Join-form sign-ups are captured into a **dedicated Upstash Redis database
provisioned inside your Vercel project** (free, always-on, isolated to this site)
and shown on a private dashboard at **`/admin`** — stat tiles, charts, table, CSV
export. Optionally, each sign-up also emails you via **Resend**.

Why this store (not Supabase): the club's data stays isolated to this site (best
practice), it lives on Vercel where the site is already hosted (no separate
account to babysit), and it does **not** pause on inactivity the way a free
Supabase project does — so nothing quietly shuts down between sign-ups.

## What's in the repo
- `api/register.js` — validates a join-form POST, stores it in Redis, optional
  Resend email. Store capped at 5,000 records.
- `api/submissions.js` — returns the records, gated by named logins.
- `api/contact.js`, `api/messages.js` — the "Get in touch" form and its reader.
- `api/subscribe.js`, `api/subscribers.js` — the leaving pop-up mailing list.
- `api/translate.js` — translates questions to English for the dashboard (optional,
  needs `ANTHROPIC_API_KEY`).
- `admin.html` — the dashboard (served at `/admin`), `noindex`, desktop-only,
  email allow-list login.

## 1. Create the database (in Vercel — 1 minute)
1. Vercel → your **verona-gaa** project → **Storage** tab → **Create Database**.
2. Choose **Upstash → Redis** (free plan), a nearby region (EU), and **connect it
   to this project**. Vercel injects the credentials automatically as env vars
   (`KV_REST_API_URL`/`KV_REST_API_TOKEN` or the `UPSTASH_REDIS_REST_*` pair — the
   code accepts either). Nothing to copy by hand.

## 2. Set the logins (Vercel → Settings → Environment Variables)
| Name | Value |
|---|---|
| `ADMIN_EMAILS` | Comma-separated list of emails allowed in, e.g. `chris@example.com,pro.europe@gaa.ie` |

`/admin` is **desktop-only** and logs you in by **email alone** — anyone on the
list types their address and is in (a deliberate low-security choice; there's no
password). The variable is stored as a Secret, so its value can't be viewed
afterwards: when you edit it, retype the **whole** list, not just the new name.
The older `ADMIN_USERS` (JSON of `{"user":"password"}`) and `ADMIN_PASSWORD`
modes still work if set.

**Optional — "Translate to English" button on the Questions table.** Messages
usually arrive in Italian; the button translates them with Claude and shows the
English under each original (translated once, then cached in the database).
| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | an API key from https://console.anthropic.com → API Keys |

Without the key the button still works, but offers a Google Translate link per
message instead. Cost is negligible: a batch of a dozen messages is a fraction
of a cent.

**Optional — email each sign-up via Resend** (add all three to switch it on):
| Name | Value |
|---|---|
| `RESEND_API_KEY` | your Resend key |
| `SIGNUP_FROM_EMAIL` | a Resend-verified sender, e.g. `hello@gaelicgamesverona.com` |
| `SIGNUP_NOTIFY_TO` | where sign-up emails should land |

## 3. Redeploy
Env-var / storage changes need a fresh deploy: Vercel → Deployments → ⋯ →
**Redeploy**.

## 4. Go live: point the form at the API
In `index.html`, change `window.VERONA_FORM_ENDPOINT = ""` to
`window.VERONA_FORM_ENDPOINT = "/api/register"`, then commit + push. (Ask Claude to
do this once steps 1–3 are done, so no real sign-up fails during setup.)

## 5. Use it
- **https://gaelicgamesverona.com/admin** (on a computer) → log in.
- Submit a test sign-up on the live site → it appears on the dashboard (and, if
  configured, lands in your inbox).

## Notes
- **Minors' data / GDPR:** `/admin` is `noindex`, desktop-only, and password-gated;
  the data API returns nothing without a valid login. Keep passwords private, add a
  short privacy notice near the form (done), and set a retention period. Ask Claude
  to add a delete button to the dashboard for erasure requests.
- **Prefer SQL instead of Redis?** A dedicated **Neon Postgres** (also free/isolated
  via Vercel Storage) is an easy alternative — ask Claude to switch the two API
  functions over.
