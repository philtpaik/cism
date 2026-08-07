# CISM Exam Prep

**Live:** https://philtpaik.github.io/cism/ — open on your phone and
install it from there (see below).

An installable, offline-capable practice app for the ISACA CISM (Certified
Information Security Manager) exam. Pure static HTML/CSS/JS — no build step,
no framework, no dependencies.

## What's in the question bank

280 **original** practice questions written to match the style, difficulty,
and "best answer" management-judgment format of the real ISACA CISM exam —
mapped to the official [CISM Exam Content Outline](https://www.isaca.org/credentialing/cism/cism-exam-content-outline)
(current version, valid through **2 Nov 2026**):

| Domain | Weight | Questions in bank |
|---|---|---|
| 1. Information Security Governance | 17% | 64 |
| 2. Information Security Risk Management | 20% | 66 |
| 3. Information Security Program | 33% | 76 |
| 4. Incident Management | 30% | 74 |

(80 of these were hand-written from scratch; the other 200 were migrated in
from an earlier, non-installable prototype — `cism-practice`, a sibling
folder now superseded by this project — and converted to this app's
schema.)

**Important:** these are not reproductions of real/leaked ISACA exam items.
Using actual secured exam content ("exam dumps") violates ISACA's
certification agreement and copyright. This bank is meant to build the same
judgment skills the real exam tests.

ISACA is replacing this content outline on **3 November 2026** with a
revised domain structure (shifting weight toward governance/risk and adding
architecture topics). Full task/knowledge statements for the new outline
won't be published until September 2026 — this bank will need a refresh
once that lands, if you're testing after that date.

## Features

- **Practice mode** — pick a domain (or all), answer one question at a time,
  get instant feedback and a full explanation.
- **Mock exam mode** — timed, no feedback until you finish, questions drawn
  proportionally across domains just like the real exam. Choose 25/50/100/150
  questions — 150 is full real-exam length, at the real exam's 235-minute
  time limit. Flag questions, jump around via a question palette, then
  review every question with its explanation at the end.
- **Progress tracking** — per-domain accuracy and exam history, stored
  locally on your device (`localStorage`). Nothing leaves your phone.
- **Installable PWA** — add it to your home screen and it works offline
  after the first load.

## Installing on your phone

PWA install (the "Add to Home Screen" → full-screen app experience) requires
HTTPS, so the easiest path is GitHub Pages:

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** → Source: **Deploy from a
   branch** → Branch: `main` (or `master`), folder `/ (root)` → Save.
3. GitHub gives you a URL like `https://<your-username>.github.io/cism/`.
   Open it on your phone.
4. **Android (Chrome):** tap the in-app "Install" banner, or Chrome's menu
   → "Install app" / "Add to Home screen".
5. **iPhone/iPad (Safari):** tap the Share icon → **Add to Home Screen**.
6. Launch it from your home screen — it opens full-screen with no browser
   chrome, and keeps working with no signal once it's loaded once.

Any other static host (Netlify, Vercel, Cloudflare Pages, your own web
server with HTTPS) works the same way — there's no backend and no build
step, just serve the files as-is.

## Local development

No build tooling needed. From the project root:

```
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Service worker registration
and PWA install prompts only activate on `localhost` or real HTTPS, so use
GitHub Pages (or similar) to test the actual install flow on a phone.

Icons are generated from `scripts/gen_icons.py` (requires Pillow: `pip
install pillow`) — re-run it if you want to change the app icon design.

A smoke test (`scripts/smoke_test.py`, requires `pip install quickjs`) runs
the app's JS in a headless engine and drives a full practice + mock-exam
session to catch rendering/logic errors without a browser.

## Adding more questions

Questions live in `js/questions.js` as a flat array. Each entry:

```js
{
  id: "g015",              // unique string id
  domain: 1,                // 1=Governance, 2=Risk Mgmt, 3=Program, 4=Incident Mgmt
  question: "...",
  options: ["...", "...", "...", "..."],  // exactly 4
  answer: 1,                 // 0-based index of the correct option
  explanation: "...",        // why it's correct (and ideally why the others aren't)
}
```

Just append new objects to the `CISM_QUESTIONS` array — no other code
changes needed. Keep questions roughly proportional to the domain weights
above if you want mock exams to stay representative.

## Project structure

```
index.html              entry point
css/style.css            styling (dark/light aware)
js/questions.js          question bank + domain metadata
js/app.js                app logic (rendering, quiz/exam state, stats)
manifest.webmanifest      PWA manifest
service-worker.js         offline caching
icons/                    generated app icons
scripts/gen_icons.py      icon generator (Pillow)
scripts/smoke_test.py     headless JS smoke test (quickjs)
scripts/merge_cism_practice.py   one-time migration script (already run; kept for reference)
```
