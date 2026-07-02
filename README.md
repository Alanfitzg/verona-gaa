# Verona GAA — landing page

A bilingual (English / Italian) landing page for a new GAA club and community in Verona, Italy. Static site — no build step, no dependencies.

## Files

| File          | Purpose |
|---------------|---------|
| `index.html`  | Page structure and content |
| `styles.css`  | Theme + layout. **Edit the 3 color variables at the top to match the crest.** |
| `i18n.js`     | All EN/IT copy (the `data-i18n` keys) |
| `script.js`   | Language toggle + form handling |
| `assets/crest.png` | The club crest (add this file) |

## Run it locally

Just open `index.html` in a browser, or serve the folder:

```bash
cd ~/verona-gaa
python3 -m http.server 8000
# then visit http://localhost:8000
```

## 1. Add the crest

Drop your crest into `assets/crest.png` (PNG with transparent background works best). It appears in the header and hero automatically. If you name it something else, update the two `<img src="assets/crest.png">` references in `index.html`.

## 2. Match the theme to the crest

Open `styles.css` and edit the top three variables to the crest's colors:

```css
--brand:      #0a7d34;   /* main color */
--brand-dark: #075526;   /* darker shade for hovers/gradient */
--accent:     #f2c14e;   /* accent / highlight color */
```

That's it — the header, hero, buttons and form all re-theme from those.

## 3. Wire up the form (choose one)

The form currently has **no live backend**. Until you connect one, submissions just show a friendly on-page confirmation.

- **Netlify** (easiest): deploy to Netlify and the form works out of the box — it already has `data-netlify="true"`. Submissions show up in your Netlify dashboard.
- **Formspree**: set the form's `action="https://formspree.io/f/XXXX"` and `method="POST"`, and remove `data-netlify`.
- **Custom / Google Sheet / email**: point `action` at your own endpoint.

## Deploy

Any static host works: Netlify (drag-and-drop the folder), Vercel, GitHub Pages, Cloudflare Pages.

## Editing text

All copy lives in `i18n.js` under `en` and `it`. Change both languages for any key you edit.
