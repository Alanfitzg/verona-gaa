# Wiring the sign-up form into Microsoft 365

The landing-page form keeps its custom design **and** sends every submission into
your official Microsoft 365 system. The flow is:

```
Custom form  ──POST (JSON)──►  Power Automate (HTTP trigger)  ──►  SharePoint List
 (verona-gaa)                   the free "bridge"                  (the dashboard)
```

The **SharePoint List is the dashboard** — a live, sortable, filterable grid of
every sign-up that you share with a chosen few people. Add Power BI on top later
if you want charts.

---

## Step 1 — Create the SharePoint List (the dashboard)

1. Go to your club/team SharePoint site → **New → List → Blank list**.
2. Name it e.g. **Verona GAA Sign-ups**.
3. Add these columns (all *Single line of text* unless noted):

   | Column name        | Type              |
   |--------------------|-------------------|
   | Title              | (default — use for Contact name) |
   | Email              | Single line       |
   | ContactNumber      | Single line       |
   | DateOfBirth        | Single line (or Date) |
   | Role               | Single line       | (player / administrator) |
   | RegisteringForU18  | Single line       | (yes / no) |
   | PlayerName         | Single line       |
   | PlayerDOB          | Single line (or Date) |
   | Sports             | Single line       | (e.g. "gaelic-football, hurling") |
   | Consent            | Single line       |
   | PageLanguage       | Single line       |
   | SubmittedAt        | Single line (or Date/Time) |

4. **Share for a few people:** List → **⋯ → Manage access** (or the site's
   permissions) → add the specific colleagues, **Can view** or **Can edit**.

---

## Step 2 — Create the Power Automate flow (the bridge)

1. Go to **make.powerautomate.com → Create → Instant cloud flow →**
   skip the trigger picker and search **"When an HTTP request is received"**.
2. In that trigger, paste this **Request Body JSON Schema** (Use sample payload
   to generate schema → paste the sample from *Step 4* below):

3. Add an action **SharePoint → Create item**:
   - **Site Address / List Name:** the site + list from Step 1.
   - Map each field, e.g.
     - **Title** → `contact_name`
     - **Email** → `email`
     - **ContactNumber** → `contact_number`
     - **DateOfBirth** → `date_of_birth`
     - **Role** → `role`
     - **RegisteringForU18** → `registering_for_u18`
     - **PlayerName** → `player_name`
     - **PlayerDOB** → `player_dob`
     - **Sports** → `join(triggerBody()?['sports_interested'], ', ')`
     - **Consent** → `consent`
     - **PageLanguage** → `page_language`
     - **SubmittedAt** → `submitted_at`
   - (Optional) add a **Send an email** action to notify the secretary.
4. **Save.** Re-open the HTTP trigger and copy the generated **HTTP POST URL**.

---

## Step 3 — Paste the URL into the site

In `index.html`, near the bottom:

```html
<script>
  window.VERONA_FORM_ENDPOINT = "PASTE-THE-POWER-AUTOMATE-URL-HERE";
  window.VERONA_FORM_MODE = "no-cors";   // simplest; see note below
</script>
```

That's it — the form now posts to Power Automate, which files each sign-up in the
SharePoint List.

### CORS note (important)
Browsers block cross-site POSTs unless the server sends CORS headers. Power
Automate's HTTP trigger doesn't by default, so keep **`VERONA_FORM_MODE = "no-cors"`**.
In that mode the browser sends the data fine but can't read the reply, so the page
optimistically shows the thank-you message. If you later add a **Response** action
that returns `Access-Control-Allow-Origin: *`, switch the mode to `"cors"` to get
real success/error detection.

---

## Step 4 — Sample payload (for the schema in Step 2)

This is exactly what the form sends:

```json
{
  "submitted_at": "2026-07-02T12:00:00.000Z",
  "role": "player",
  "registering_for_u18": "no",
  "player_name": "",
  "player_dob": "",
  "contact_name": "Jane Murphy",
  "email": "jane@example.com",
  "contact_number": "+39 333 1234567",
  "date_of_birth": "1998-04-12",
  "sports_interested": ["gaelic-football", "camogie"],
  "consent": "yes",
  "page_language": "en"
}
```

---

## Testing

1. Add the URL as above, save, reload the page.
2. Submit a test entry → a new row should appear in the SharePoint List within a
   few seconds.
3. Check the flow's **Run history** in Power Automate if anything doesn't show.

## Alternatives
- **Excel table** instead of a List: swap the "Create item" action for
  **Excel → Add a row into a table** (table stored in SharePoint/OneDrive).
- **Microsoft Graph** (no Power Automate): a small serverless function writes to
  the List/Excel directly — more control, more setup. Ask if you want this route.
