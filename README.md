# Oly Tracker

An offline training journal rebuilt around **Weightlifting First — Failure Work-Set Edition, Revision 6 (13 September 2026)**. The original 43-page PDF and a searchable text copy are bundled in `program/`.

```sh
npm start
```

Open [localhost:8766](http://127.0.0.1:8766). Node 22+ is required for the local server and tests. The app itself uses native browser modules, has no runtime dependencies, and needs no build step. It can also be served from an ordinary static host, including under a subdirectory. Offline use becomes available after the service worker finishes its first installation.

## Training workflow

1. Check today's readiness and actual sport/alcohol exposure.
2. Start the next dated A/B/C/D session. A late start rolls later dates; use **Move this day** for planned deferrals.
3. Complete the general and exercise-specific preparations. Log actual Olympic attempts, or valid conventional reps and their honest endpoint. Misses count. TECH and safety stops do not count as successful failure sets.
4. Save a next-session follow-up in History. Use the weekly review to repeat, advance, reduce, or restore the dose.
5. Start optional work or a controlled trial only through a documented eligibility review in Settings. Read the adjacent source pages for the required observations.

Bench is tracked as separate low- and moderate-rep exposures, with at least 48 actual hours between attempts, including legacy records. Only unperformed bench slots can be rescued. Taper moderate bench follows the Olympic test. An omitted block is never replayed as catch-up work.

## Data

Records stay in this browser on this device. Export JSON backups in Settings or History. Imports are validated before replacement, and the current journal is archived in the restored state. Previous `oly_state`, `oly_rev6_backup`, and `oly_before_rev6` data are preserved intact as previous-program archives. The rebuild starts at the program's entry dose; use a reviewed starting position for established training.

The new journal uses `oly_program_v7`. The app has no account, cloud synchronization, analytics, or external font/script requirement. The service worker does not force an update over a running workout. Use Settings → Check for updates, then the update banner. For an older version without these controls, close all app tabs and reopen.

## Verification

```sh
npm ci
npm run audit
```

Browser checks use installed Google Chrome by default. Alternatively run `npx playwright install chromium` and set `OLY_BROWSER_CHANNEL=chromium`. The browser suite starts and closes its own isolated server and browser profile. It never edits the real training journal.

See [the full audit and source checklist](docs/FULL-AUDIT.md), [the historical rebuild report](docs/AUDIT.md) and [architecture](docs/ARCHITECTURE.md).

## Time planning

Each exercise, session and scheduled day shows a planning range including preparation, rest, equipment changes, waiting and breaks. Settings → Time planning defaults to moderate traffic (1–3 minutes per station) and ten minutes miscellaneous time per visit. Split-visit gaps are shown separately. See [the timing assumptions and example breakdown](docs/TIME-ESTIMATES.md). Training prescriptions and timers are unchanged by these settings.

Selected mobility is a runnable session, including on days with no lifting: timed holds on both sides, rests and active-rep completion are saved to the journal. General, field and exercise-specific preparation have resumable stopwatches and separate completion logs; interruption re-warm-up is also available. An update banner activates a waiting version after the current workout is finished.

Aerobic main sessions and additional walks have start/pause/resume clocks and actual-minute confirmation. Their easy start is included in moving time; pauses and equipment waits are excluded from moving dose. App 7.11 identifies the installed release in Settings and checks for updates when returning online or focusing the app.

GitHub Pages publishes **main**, not the local working directory or a feature branch. After releasing, run `npm run check:deployment` to verify all 16 served app/source assets match the workspace. See [DEPLOYMENT.md](docs/DEPLOYMENT.md). Compatible saved Revision 6 settings migrate, including selected stretches and optional work; original logs and unfinished older sessions remain intact in the archive.

## Removing test sessions

Open History → select a session → Delete session, then confirm. You can also use View log on the day tab. Deleting a saved test, partial, completed or omitted session removes its entries and progression credit and reopens its slot in the current week. Ordinary readiness, sequence and bench-spacing rules still apply to remaining work. Earlier-week deletion does not rewind the program. Finish any active workout before deleting saved history. Export a backup first if you may want the record later.
