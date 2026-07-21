# Sign-ups: storage + dashboard — setup

Join-form sign-ups are captured into **Supabase** (which you already use for
GGE-Fixtures) and shown on a private dashboard at **`/admin`** — stat tiles,
charts, table, CSV export. Optionally, each sign-up also emails you via **Resend**
(which you already use too).

Everything is coded. You need to: (1) make a table, (2) set a few secrets,
(3) flip the form live. ~10 minutes, free tier. Low traffic — this is plenty.

## What's in the repo
- `api/register.js` — validates a join-form POST, inserts a row in Supabase,
  optionally emails a Resend notification.
- `api/submissions.js` — returns the rows, gated by an admin password (uses the
  Supabase **service_role** key server-side, so public keys never see the data).
- `admin.html` — the dashboard (served at `/admin`), `noindex`, password-gated.

## 1. Create the table in Supabase
**Recommended: a dedicated Supabase project** for the club (free tier allows a
second project) so member/minor data is kept separate from the GGE-Fixtures app.
Reusing the existing project also works — just add the table below.

Supabase → SQL Editor → run:
```sql
create table if not exists public.verona_signups (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  role text,
  registering_for_u18 text,
  player_name text,
  player_dob text,
  contact_name text,
  email text,
  contact_number text,
  date_of_birth text,
  sports_interested jsonb default '[]'::jsonb,
  consent text,
  page_language text
);
-- Lock it down: only the server-side service_role key can read/write.
alter table public.verona_signups enable row level security;
```
(If you reuse the GGE project and want a different table name, set `SIGNUPS_TABLE`
in step 2 to match.)

## 2. Set environment variables (Vercel → verona-gaa → Settings → Env Vars)
| Name | Value |
|---|---|
| `SUPABASE_URL` | your project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** secret |
| `ADMIN_PASSWORD` | a strong password you choose (for `/admin`) |

**Optional — email each sign-up via Resend** (add all three to switch it on):
| Name | Value |
|---|---|
| `RESEND_API_KEY` | your Resend key |
| `SIGNUP_FROM_EMAIL` | a Resend-verified sender, e.g. `hello@gaelicgamesverona.com` |
| `SIGNUP_NOTIFY_TO` | where sign-up emails should land |

> ⚠️ The **service_role** key is a powerful secret — only ever put it in Vercel
> env vars (server-side). It is never sent to the browser.

## 3. Redeploy
Env-var changes need a fresh deploy: Vercel → Deployments → ⋯ → **Redeploy**.

## 4. Go live: point the form at the API
In `index.html`, change `window.VERONA_FORM_ENDPOINT = ""` to
`window.VERONA_FORM_ENDPOINT = "/api/register"`, then commit + push. (Ask Claude to
do this once steps 1–3 are done, so no real sign-up fails during setup.)

## 5. Use it
- **https://gaelicgamesverona.com/admin** → enter `ADMIN_PASSWORD`.
- Submit a test sign-up on the live site → it appears on the dashboard (and, if
  configured, lands in your inbox).

## Notes
- **Minors' data / GDPR:** `/admin` is `noindex` + password-gated; the data API
  returns nothing without the password; RLS blocks public reads. Supabase is
  EU-hosted. Keep the password tight, add a short privacy notice near the form,
  and set a retention period. Rows can be deleted in the Supabase table editor, or
  ask Claude to add a delete button to the dashboard.
- **Site traffic analytics:** you use Google Analytics elsewhere, but GA needs a
  cookie-consent banner under EU law. For this site I'd suggest **Vercel Web
  Analytics** (cookieless, no banner) — one toggle in the Vercel dashboard. Happy
  to wire up either.
