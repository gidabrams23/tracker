# Tracker: product requirements

Working title: Tracker. Owner: Gid. Last edited 2026-10-31.

A personal iPhone app that replaces the tracking I do in Notes. It starts with three modules: daily push-ups, strength workouts, and an album a day. More modules get added over time. The design rule behind every feature is that logging something should take a couple of seconds and feel good. I'd rather the app be a little opinionated and fast than flexible and slow.

UI prototypes live on the design canvas: https://claude.ai/artifact/Bkjyru6Q4yPVzCPYPKz3FC

---

## 1. Decisions made so far

| Topic | Decision | Notes |
|---|---|---|
| Platform | Home-screen web app (PWA), hosted free on GitHub Pages | No App Store, no $99/yr developer account |
| Data | Stored on the iPhone, with one-tap JSON backup | No account, no server, works offline |
| Cost | $0 beyond Claude usage | Every service in this doc is free tier or free forever |
| Reminders | Not in Phase 1. Later: random nudges only during free calendar windows (Outlook + Apple) | See section 8 |
| Workouts | Fixed split days | The app preloads the day's exercises |
| Look and feel | Hybrid of prototype A (tactile counter) and C (dashboard) | Artboard E on the canvas. Orange accent |
| First proof of concept | Push-up tracker | Phase 1 |

---

## 2. How it gets onto your iPhone

Your idea works, and it's the right call. Here is the flow:

1. The app's code lives in a GitHub repo. A GitHub Action builds it and publishes it to GitHub Pages at a URL like `https://<username>.github.io/tracker/`.
2. On the iPhone, open that URL in Safari, tap Share, then Add to Home Screen.
3. It now has its own icon, opens full screen with no browser bar, and works offline.

Since iOS 26, any site added to the Home Screen opens as a web app by default, so this is now a standard path on iPhone rather than a workaround.

Things to know before committing to this path:

- **The repo has to be public on GitHub's free plan.** Pages from a private repo needs a paid plan, and even then the site itself is public. That's fine here, because the code is public but your data never leaves your phone. Just never commit secrets (this matters in Phase 4).
- **Data stored by a home-screen web app is separate from Safari's.** If you open the URL in a Safari tab, you'll see an empty app. Always use the icon.
- **Safari's 7-day storage wipe does not apply to home-screen web apps.** iOS can still evict data under heavy storage pressure, and there's an open WebKit bug report about data loss in installed apps. So backups are a Phase 1 feature, not an extra.

---

## 3. What an iPhone web app can and can't do

This decides several features, so it's worth knowing up front.

| Capability | Works? | What it means for us |
|---|---|---|
| Offline use (service worker) | Yes | App works on a plane or in a basement gym |
| IndexedDB storage | Yes, persistent for home-screen apps | Main data store. Call `navigator.storage.persist()` on first launch |
| Web Push notifications | Yes, iOS 16.4+, home-screen only | Needs a server to send them (see Phase 4) |
| Locally scheduled notifications | **No** | The web has no API to schedule a notification on the device. Random reminders need a server or iOS Shortcuts |
| App icon badge (`setAppBadge`) | Yes | Could show "push-ups left today" on the icon |
| Vibration / haptics | **No** official support | An undocumented trick (toggling a hidden iOS switch input) produces a haptic tap. Treat as a bonus, test on device |
| Keep screen awake (Wake Lock) | Yes, iOS 18.4+ | Keep the screen on during workouts and Floor mode |
| Smooth screen transitions (View Transitions) | Yes, iOS 18+ | Animated transitions between screens |
| Share sheet (Web Share) | Yes | Backup export and "share my album of the day" |
| Long-press icon shortcuts | **No** | Can't add "Log 20 push-ups" to the icon menu |
| Share target (receive shares from other apps) | **No** | Can't share an album straight from Apple Music into the app. Use paste or search instead |

---

## 4. Tech stack

You already build apps, so I've picked tools for a small, fast, offline app on iOS Safari, not for the biggest ecosystem.

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + `vite-plugin-pwa` | Generates the manifest and service worker. Use `registerType: 'prompt'` so updates never interrupt a set |
| UI framework | **Svelte 5** (React works too) | Much smaller runtime than React, which helps on older iPhones. If you'd rather stay in React, swap in React or Preact. Nothing else in this stack changes |
| Language | TypeScript | The data model will grow across modules. Types keep migrations honest |
| Storage | Dexie 4 (IndexedDB wrapper) | The common choice in local-first tracker projects. Its live queries keep the UI in sync with the database automatically |
| Motion | Motion's mini `animate` (~2.3 KB) + CSS | Press, flip, and fill animations |
| Celebrations | `canvas-confetti` with reduced-motion respected | Goal-hit moment |
| Sound | Web Audio, a few short samples | Optional "click" and "goal" sounds. Off in silent mode |
| Hosting | GitHub Pages via GitHub Actions | Free, HTTPS by default |
| Album lookup (Phase 3) | iTunes Search API; MusicBrainz + Cover Art Archive as fallback | Free, no key, works from the browser |
| Exercise library (Phase 2) | `free-exercise-db` (public domain, 800+ exercises) | Bundle only the exercises you use |

Spotify's API is out: since March 2026 its developer mode needs Premium and OAuth, and it has removed endpoints. Deezer's API doesn't allow direct browser calls, so it would need a proxy.

---

## 5. Architecture and data

### Shape of the app

```
Home (dashboard of all modules: today's push-ups, today's workout, today's album)
 ├── Push-ups
 ├── Workouts
 ├── Albums
 └── Settings (goals, sounds, backup/restore, about)
```

Each module is a folder with its own screens, its own Dexie tables, and one "today card" component for the Home dashboard. Adding a module later (water, reading, sleep) means adding a folder and registering its card. Nothing else changes.

### Data model (first pass)

All records get an `id` (string UUID), `createdAt`, and `updatedAt`. Days are stored as local-date strings (`2026-10-31`) so a late-night set never lands on the wrong day.

```ts
// Push-ups
pushupSets:   { id, day, reps, loggedAt, source: 'tap' | 'quick' | 'floor' }
pushupGoals:  { id, effectiveFrom, perWeekday: [Sun..Sat] }   // e.g. lower goal on Sundays
streakState:  { id: 'pushups', freezesBanked, lastEvaluatedDay }

// Workouts
exercises:    { id, name, equipment, muscle, defaultRestSec, increment }
splitDays:    { id, name, order, exerciseIds[] }              // "Push", "Pull", "Legs"
sessions:     { id, day, splitDayId, startedAt, endedAt, notes }
sets:         { id, sessionId, exerciseId, order, weight, reps, type: 'warmup'|'work'|'drop', done }

// Albums
albums:       { id, day, title, artist, year, artworkUrl, artworkBlob?, source, sourceId,
                rating?, favoriteTrack?, note?, relisten: boolean }

// App
meta:         { key, value }  // schemaVersion, lastBackupAt, settings
```

### Rules learned the hard way by other builders

- **Ship backup and restore in Phase 1.** A long-time user of one self-built tracker called export/import its most useful feature, and builders warn that clearing site data wipes everything. Designing the export format early also keeps later migrations simpler.
- **Every Dexie schema change bumps `version()`. Never change a primary key.**
- **Store raw events, compute everything else.** Streaks, totals, PRs, and charts are calculated from `pushupSets` and `sets`. That way a bug in the streak logic never corrupts history.
- **Backups are plain JSON** with a `schemaVersion`. Export goes through the share sheet, so you can save it to iCloud Drive or Files. The app shows a gentle "last backup 9 days ago" nudge.
- **Timers use timestamps, not countdowns.** iOS pauses JavaScript in the background, so a rest timer stores its end time and recalculates when the app comes back.
- **Inputs use 16px+ text** so iOS doesn't zoom when you tap a field.

---

## 6. Design direction

### Chosen look: "warm tactile dashboard" (artboard E)

- Warm near-black ground (`#17130F`), raised cards one step lighter (`#1F1914`), orange accent (`#FF6A13`) with a deeper orange for shadows and past days.
- Dark text on orange. White on this orange fails contrast, so buttons use near-black text.
- Display type Bricolage Grotesque for numbers and titles, Inter for everything else.
- The top half of every module is a toy: a pressable thing that reacts. The bottom half is a dashboard: week bars, today's entries, trends.

### What makes logging feel good

Taken from apps people praise (Not Boring Habits, Hevy, Strong, Apple Fitness rings):

1. The button is the reward. It physically depresses, the digits flip, the ring fills, and there's a short sound plus a haptic tap where available.
2. Pre-fill everything. Quick-set chips match your usual set sizes. Workout sets pre-fill last session's weight and reps, so most sets are one tap.
3. Celebrate thresholds, not every tap: goal hit, new personal best, streak milestones.
4. Undo is always one tap away, so mistakes cost nothing.

### Streaks without guilt

Losing a long streak is one of the most common reasons people quit trackers. One person quit after losing a 1,000+ day streak to a connectivity issue. So:

- **Freezes:** earn one freeze per 7-day run, bank up to 2. A missed day spends a freeze automatically.
- **"Never miss twice":** the streak only breaks after two missed days in a row with no freeze. Habit research (Lally et al.) found a single miss barely affects habit formation.
- **Per-weekday goals and pause:** set a lower Sunday target, or pause during travel or illness without breaking anything (Apple added the same to Activity rings in watchOS 11).

---

## 7. Modules

### 7.1 Push-ups (Phase 1)

**Job:** log push-ups throughout the day in under 2 seconds, and see progress toward a daily goal.

Must have:
- Big +1 button that builds a "current set", plus a Save set button.
- Quick-set chips (defaults 10 / 20 / 25, editable) that log a full set in one tap.
- Undo last entry.
- Today: flip-digit total, progress ring, "N to go", best day, 7-day average.
- This week: bar chart. Today's sets: time and reps list.
- Daily goal (default 100, per-weekday override).
- Streak with freezes, as above.
- Backup/restore to JSON.

Should have:
- **Floor mode** (prototype D): put the phone on the floor and touch it with your chest at the bottom of each rep. The screen stays awake and fills with orange as you approach the set target. This is the most "only in this app" feature, and it's cheap to build.
- Goal-hit celebration (confetti + sound, once per day).
- Calendar heatmap for the year (GitHub-style), tap a day for details.

Could have:
- Icon badge showing push-ups left today.
- Lifetime counter milestones (1,000 / 10,000 / 100,000).

### 7.2 Workouts (Phase 2)

**Job:** start today's split day, fill in weights with as few taps as possible, and see whether you're progressing.

Must have:
- Your split days preloaded (I need your list: see Open questions).
- "Today is Pull day" suggestion based on rotation order, with one-tap override.
- Each exercise shows last session's sets ("Last: 135 × 8, 8, 7") and pre-fills them. Tap the checkmark to confirm a set, adjust with steppers only when something changed.
- Rest timer auto-starts when a set is checked (timestamp-based, keeps the screen awake).
- Personal best toast when a set beats your previous best (estimated 1-rep max or weight × reps).
- History per exercise: chart of top set over time.

Should have:
- Plate calculator ("135 = 45 + bar each side").
- Warm-up set generator (percentages of the working weight).
- Set types: warm-up, working, drop set.
- Progression hint: "You hit 3×8 twice. Try +5 lb." (Liftosaur-style rules, simple version).

Could have:
- Session summary card (volume, PRs, duration) you can share.
- Swap an exercise for one session without changing the template.

### 7.3 Album a day (Phase 3)

**Job:** log the album you listened to today, with cover art, in under 15 seconds. Build a satisfying record of a year of listening.

Must have:
- Search by album or artist (iTunes Search API). Pick a result to fill title, artist, year, and cover art.
- Optional rating (half stars), favorite track, a one-line note, and a "relisten" flag.
- Backdating: log yesterday's album if you forgot.
- Cover art saved locally so the history works offline.
- Grid view: every day's cover in a calendar wall. Empty days show as blank sleeves.

Should have:
- **Record crate view:** flip through past albums like records in a bin. This is where the tactile style earns its keep.
- Stats: albums this year, most-logged artists, decades, average rating.
- "Year in review" wall, exportable as an image, once there are at least 10 entries (Letterboxd does the same).

Could have:
- Queue: a "to listen" list that feeds tomorrow's pick, or a random pick from it.
- Paste a Spotify or Apple Music link to pre-fill the search.

### 7.4 Home dashboard (grows with each phase)

One screen with a card per module: push-ups ring, today's workout status, today's album cover (or an empty sleeve). Tapping a card opens the module. In Phase 1 there's only one card, which is fine.

---

## 8. Reminders that respect your calendar (Phase 4)

You want random push-up nudges, but only when your calendars show you're free. There are two ways to do this at $0. Which one works depends on one thing: **does your work Outlook calendar appear in the iPhone's built-in Calendar app?**

### Option A (recommended): iOS Shortcuts, no server

- Set up hourly "Time of Day" automations (say 9:00 to 20:00) set to run without asking (iOS 17+).
- Each run: pick a random number to decide whether to nudge this hour (for example, 1 in 3). Then use "Find Calendar Events" to check for an event happening now. If you're free, show a notification: "Drop and give me 20."
- Calendar data never leaves the phone. Nothing to host.
- Catches:
  - Shortcuts only sees calendars in the built-in Calendar app. If your work account is only in the Outlook app, it's invisible.
  - Adding a work account to iOS Settings may be blocked by your IT department.
  - Tapping the notification probably opens Shortcuts rather than the tracker (unverified).
  - Apple's docs and a well-known Shortcuts writer disagree on whether "run immediately" automations still show a banner. Test on your phone.

### Option B (fallback): a free Cloudflare Worker sends real push notifications

- A Cloudflare Worker (free plan: 5 cron triggers, 100k requests/day) wakes every 15 minutes, rolls the dice, checks your calendars, and sends a Web Push to the installed app. Tapping the notification opens the tracker directly.
- Calendar access:
  - **Outlook:** a published "can view when I'm busy" calendar link (free/busy only, no event details). Many company tenants disable publishing, so check Outlook on the web: Settings > Calendar > Shared calendars > Publish a calendar.
  - **iCloud:** a public calendar link exposes full event details to anyone with the URL. Weigh that before using it, or skip iCloud in this option.
  - Microsoft Graph is possible for a personal Outlook.com account. Work tenants usually require admin approval.
- Secrets (push keys, calendar links) live in Worker secrets, never in the public repo.
- GitHub Actions cron is not recommended here. Runs are often delayed, sometimes by hours, and the schedule turns off after 60 days of repo inactivity.

**Two 30-second checks before Phase 4:**
1. Does your work calendar show up in the iPhone Calendar app?
2. Does Outlook on the web offer "Publish a calendar"?

---

## 9. Features you might not have thought of

- **Floor mode** for push-ups (prototype D). Your chest is the button.
- **"Grease the groove" mode:** the app suggests small sets spread across the day (for example, 5 × 20) and the reminders in Phase 4 line up with it.
- **Smart quick-set chips** that learn your most common set sizes.
- **Icon badge** with push-ups left today, so you see it without opening the app.
- **Year heatmaps** for every module, plus one combined "life grid" on Home.
- **Album → push-up crossover:** "do 10 push-ups per track" challenge on lazy days.
- **Personal records wall** across push-ups (best day, best set) and lifts.
- **Weekly recap card** on Sunday: totals, PRs, albums. Shareable as an image.
- **Sound packs:** a mechanical counter click, a vinyl crackle for albums.
- **"Proof" photo** (optional) on workout days, stored locally.

---

## 10. Phased roadmap

Each phase ends with something you actually use on your phone for a week before moving on.

| Phase | Scope | Done when |
|---|---|---|
| **0. Skeleton** | Vite + Svelte + PWA plugin, Dexie, GitHub Pages deploy via Actions, app icon, splash colors, safe-area layout, backup/restore | Icon on your home screen opens a full-screen "hello" that works in airplane mode |
| **1. Push-ups** | Everything in 7.1 "must have" + Floor mode | You log every push-up for 7 straight days and don't open Notes for it once |
| **2. Workouts** | 7.2 must haves, your split preloaded, rest timer, PR toasts | You log 3 full sessions faster than in Notes |
| **3. Albums** | 7.3 must haves + grid wall | 14 days of albums logged with covers |
| **4. Reminders** | Shortcuts option first; Worker + Web Push only if needed | Nudges arrive only when you're free, and you don't turn them off within a week |
| **5. Polish & new modules** | Home dashboard, heatmaps, weekly recap, next tracker from your Notes | Your call |

Phases 0 and 1 together are the proof of concept. Realistically that's a few focused sessions with Claude Code.

---

## 11. Open questions

1. **Your split days:** what are the days and exercises in each? Paste your current Notes page and I'll turn it into the seed data.
2. **Units:** pounds, kilograms, or both?
3. **Push-up goal:** 100/day as a starting default, or something else? Different goal on any weekday?
4. **Album fields:** is a rating worth it, or is "listened + note" enough? Do you want a "first listen vs relisten" distinction?
5. **Historical data:** do you want your existing Notes history imported (push-ups, lifts, albums)? If so, paste a sample and I'll write a one-time importer.
6. **Framework:** Svelte is my pick, but if you'd rather work in React because you know it, that's a reasonable trade.
7. **App name and icon:** any name in mind? The icon can be a simple orange mark we design on the canvas.
8. **GitHub:** do you already have an account you want to use? The repo has to be public for free Pages.

---

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| iOS clears app data | Low, but it happens | Backup nudge, one-tap export to iCloud Drive |
| Haptic trick stops working in an iOS update | Medium | Treat it as a bonus. Visual and sound feedback carry the experience |
| Work IT blocks calendar access | Medium-high | Shortcuts option with the calendars the phone can see. Personal calendar only if needed |
| iTunes Search API terms (meant for promoting the store) | Low for personal use | MusicBrainz + Cover Art Archive fallback |
| Scope creep before Phase 1 ships | High (it's fun) | Phase exit criteria above. Nothing from Phase 2 starts until Phase 1 passes its 7-day test |

---

## 13. Sources

Each platform claim above was checked against at least two sources. Single-source items are marked in the text as untested or unverified.

**iOS web app capabilities**
- WebKit, Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit, Meet Declarative Web Push: https://webkit.org/blog/16535/meet-declarative-web-push/
- WebKit, Safari 18.4 features (Declarative Web Push, Wake Lock): https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- WebKit, Safari 26 beta (home-screen sites open as web apps): https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/
- WebKit, Updates to storage policy: https://webkit.org/blog/14403/updates-to-storage-policy/
- WebKit, Tracking prevention (7-day cap, home-screen exemption): https://webkit.org/tracking-prevention/
- Maximiliano Firtman, PWA on iOS notes: https://firt.dev/notes/pwa-ios/
- Apple, Sending web push notifications: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Chrome, Notification Triggers (no longer pursued): https://developer.chrome.com/docs/web-platform/notification-triggers
- caniuse: vibration, web-share, wake-lock, view-transitions, manifest shortcuts, share_target
- WebKit bug on installed-app data loss: https://bugs.webkit.org/show_bug.cgi?id=237350

**Hosting and scheduling**
- GitHub plans and Pages: https://docs.github.com/en/get-started/learning-about-github/githubs-plans, https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub Actions schedule behavior: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Cloudflare Workers limits and cron triggers: https://developers.cloudflare.com/workers/platform/limits/, https://developers.cloudflare.com/workers/configuration/cron-triggers/

**Calendars and Shortcuts**
- Apple Shortcuts, automations that run automatically: https://support.apple.com/en-au/guide/shortcuts/apd602971e63/ios
- Matthew Cassinelli, Run Immediately and Find Calendar Events: https://matthewcassinelli.com/automations-run-immediately-shortcuts-notifications, https://matthewcassinelli.com/actions/find-calendar-events/
- Microsoft, Share/publish an Outlook calendar: https://support.microsoft.com/office/share-an-outlook-calendar-with-other-people-353ed2c1-3ec5-449d-8c73-6931a0adab88
- Microsoft, Publish option missing (tenant policy): https://learn.microsoft.com/en-us/troubleshoot/exchange/outlook-on-the-web-issues/publish-calendar-option-missing-from-calendar-settings
- Microsoft Graph getSchedule / calendarView: https://learn.microsoft.com/en-us/graph/api/calendar-getschedule, https://learn.microsoft.com/en-us/graph/api/user-list-calendarview

**Design and builder lessons**
- Hacker News threads from tracker builders: https://news.ycombinator.com/item?id=14783831, https://news.ycombinator.com/item?id=40893866, https://news.ycombinator.com/item?id=49586902
- Hevy features (previous values, rest timer, PRs): https://www.hevyapp.com/features/track-workouts/
- Liftosaur progression rules: https://www.liftosaur.com/doc/liftoscript
- Not Boring Habits design: https://visual.app/blog/not-borings-mobile-experiences
- Apple watchOS 11 ring pausing: https://www.macrumors.com/guide/25-new-features-apple-watchos-11
- Duolingo on streaks: https://blog.duolingo.com/how-duolingo-streak-builds-habit
- Habit formation (Lally et al. summary): https://bps.org.uk/research-digest/seven-ways-be-good-1-learn-healthier-habits
- Why people abandon tracking: https://library.selfresearch.org/?p=1997

**Data sources**
- iTunes Search API: https://performance-partners.apple.com/search-api
- MusicBrainz rate limiting and Cover Art Archive: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting, https://musicbrainz.org/doc/Cover_Art_Archive/API
- Spotify 2026 developer-mode changes: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- free-exercise-db (Unlicense): https://github.com/yuhonas/free-exercise-db
- Dexie on Safari: https://old.dexie.org/docs/IndexedDB-on-Safari
- vite-plugin-pwa: https://vite-pwa-org.netlify.app/
