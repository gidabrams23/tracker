# Tracker

A personal tracker that installs on an iPhone home screen as a web app. Modules: push-ups, workouts, album a day, and running. The original spec is in [docs/PRD.md](docs/PRD.md).

All data stays on the phone (IndexedDB). Back it up from Settings → Export backup.

## Run it locally

```bash
npm install
npm run dev
```

`npm run dev` listens on your local network, so you can open the printed `http://192.168.x.x:5173` address on your iPhone (same Wi-Fi) and see changes live. Push notifications and install only work from the deployed HTTPS site, not from this local address.

Other scripts:

| Command | What it does |
|---|---|
| `npm test` | Unit tests (streak rules) |
| `npm run check` | Svelte + TypeScript type check |
| `npm run build` | Production build into `dist/` |
| `npm run icons` | Regenerates the app icons from `scripts/make-icons.mjs` |

## Put it on your iPhone (one-time setup)

1. On github.com, create a **public** repository named `tracker` (free GitHub Pages needs a public repo; your data never goes in it).
2. Push this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/tracker.git
   git push -u origin main
   ```
3. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Wait for the "Deploy to GitHub Pages" action to finish (Actions tab, about a minute).
5. On your iPhone, open `https://<your-username>.github.io/tracker/` in **Safari**, tap **Share → Add to Home Screen**.
6. Open it from the icon from now on. A Safari tab has separate storage and will look empty.

Every push to `main` redeploys. The app shows a "New version ready" bar when an update arrives; tap Reload.

## Project layout

```
src/
  App.svelte            screen switching, day rollover, update prompt
  screens/
    Home.svelte         module tiles + weekly habit chain
    Pushups, FloorMode, Settings
    workouts/           overview, flexible session logger, plan editor, exercise picker
    albums/             weekly goal, iTunes search, 0–100 scoring, wall + ranked
    running/            log runs, weekly/monthly/yearly totals, bests, milestones
  components/           Stepper, Sheet, SetJar, Ring, Bars, WeekBars, Heatmap, FlipDigits
  lib/
    db.ts               Dexie schema (bump version() for every change; upgrade is tested)
    pushups.ts, streak.ts
    workouts/           exercise library, plan logic (tested), store
    albums/             score tiers + weekly streak (tested), iTunes search, store
    running/            stats (tested), store
    settings.svelte.ts  goals, set buttons, albums per week, feedback toggles
    backup.ts           JSON export/import of every table
    feedback.ts         haptics, sounds, confetti
    wakelock.ts         keep screen on in Floor mode and workouts
```
