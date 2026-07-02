# Verona GAA — project status & how to resume

_Last updated: 2026-07-02_

## What this is
A bilingual (EN/IT) landing page for **Verona GAA**, a new Gaelic Games club in
Verona, Italy. Static site: `index.html`, `styles.css`, `script.js`, `i18n.js`.

## Live & hosted
- **Live site:** https://alanfitzg.github.io/verona-gaa/  (GitHub Pages)
- **Repo:** https://github.com/Alanfitzg/verona-gaa
- Any `git push` to `main` auto-redeploys in ~1–3 min.

## Done so far
- Hero with an iconic Verona panorama sunk behind the crest-blue tone.
- Club crest wired in (`assets/crest.png`).
- "Part of **Gaelic Games Europe**" band + footer link (crest in `assets/gge-crest.*`).
- **Tocatì festival** section with a custom standalone logo (`assets/tocati-logo.svg`).
- Sign-up form collecting: name, email, contact number, DOB, sport(s),
  Player/Administrator role, and a parent/guardian flow for under-18s.
- Form is **M365-ready** — posts JSON to an endpoint set in `index.html`
  (`window.VERONA_FORM_ENDPOINT`). Currently blank = demo mode (shows thank-you,
  sends nothing).

## Next steps (in priority order)
1. **Form backend** — build the Power Automate flow + SharePoint list per
   `FORM-SETUP.md`, then paste the flow URL into `index.html`
   (`window.VERONA_FORM_ENDPOINT`). This is what makes sign-ups actually save.
   Needs M365 admin help; a hand-off spec can be drafted.
2. **Real club content** — replace placeholder copy with training location/times,
   a contact email, and Instagram/Facebook links.
3. **Optional** — swap hero to Arena di Verona; add a custom domain.

## How to resume
1. Open the folder `~/verona-gaa` in your editor (VS Code).
2. Start a new Claude Code session in that folder and say
   "continue the Verona GAA project" (point it at this file).
3. Preview locally by opening `index.html`, or just visit the live URL above.
4. To publish changes: `git add -A && git commit -m "..." && git push`.

## Image credit
Verona panorama © Livioandronico2013, CC BY-SA 4.0.
