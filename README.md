# Oly Tracker

An offline training journal rebuilt around **Weightlifting First — Failure Work-Set Edition, Revision 6 (13 September 2026)**. The original 43-page PDF and a searchable text copy are bundled in `program/`.

```sh
npm start
```

Open [localhost:8766](http://127.0.0.1:8766). Node 22+ is required for the local server and tests. The app itself uses native browser modules, has no runtime dependencies, and needs no build step. It can also be served from an ordinary static host, including under a subdirectory. Offline use becomes available after the service worker finishes its first installation.

## Training workflow

1. Check today's readiness and actual sport/alcohol exposure.
2. Start the next dated session: ordinarily Monday, Wednesday and Friday under the current whole-week prescription. A late start rolls later dates; use **Move this day** for planned deferrals.
3. Complete the general and exercise-specific preparations. Log actual Olympic attempts, or valid conventional reps and their honest endpoint. Misses count. TECH and safety stops do not count as successful failure sets.
4. Save a next-session follow-up in History. Use the weekly review to repeat, advance, reduce, or restore the dose.
5. Start optional work or a controlled trial only through a documented eligibility review in Settings. Read the adjacent source pages for the required observations.

Bench is tracked as separate low- and moderate-rep exposures, with at least 48 actual hours between attempts, including legacy records. Only unperformed bench slots can be rescued. Taper moderate bench follows the Olympic test. An omitted block is never replayed as catch-up work.

## Data

Records stay in this browser on this device. Export JSON backups in Settings or History. Imports are validated before replacement, and the current journal is archived in the restored state. Previous `oly_state`, `oly_rev6_backup`, and `oly_before_rev6` data are preserved intact as previous-program archives. The rebuild starts at the program's entry dose; use a reviewed starting position for established training.

The new journal uses `oly_program_v7`. Local use needs no account. Optional private Google Drive sync is available; there are no analytics or external font requirements. The service worker does not force an update over a running workout. Use Settings → Check for updates, then the update banner. For an older version without these controls, close all app tabs and reopen.

## Verification

```sh
npm ci
npm run audit
```

Browser checks use installed Google Chrome by default. Alternatively run `npx playwright install chromium` and set `OLY_BROWSER_CHANNEL=chromium`. The browser suite starts and closes its own isolated server and browser profile. It never edits the real training journal.

See [the full audit and source checklist](docs/FULL-AUDIT.md), [the historical rebuild report](docs/AUDIT.md) and [architecture](docs/ARCHITECTURE.md).

## Time planning

Each exercise, session and day shows a fixed planned time. Starting a session opens a guided countdown for arrival, general preparation, local ramps, every work set/attempt, within-set resets, prescribed rests, equipment transitions, waiting, breaks and packing up. Mobility and aerobic-only days have their own timed steps. The displayed totals sum the same steps used by the runner. See [timing assumptions](docs/TIME-ESTIMATES.md).

Tap **Start timed set**, then **Set finished · record result** when the set actually ends. Recovery starts immediately while you enter the result. Zero shows overtime; it never records a result or ends a failure set. Continue confirms preparation/rest steps. Pause/resume, additional time, optional timer sound and a two-minute break control help manage delays. The ten-minute miscellaneous pool covers water/restroom stops; release unused time at the end. A small timer stays visible while logging. Timers and outcomes survive offline reload.

Settings → Time planning retains moderate traffic (a fixed two-minute target per new gym station), adjustable loading/setup and ten minutes of breaks per visit. Active sessions keep their starting assumptions. App 7.21 identifies its installed build and checks for updates; waiting updates activate after the current workout is finished.

GitHub Pages publishes **main**, not the local working directory or a feature branch. After releasing, run `npm run check:deployment` to verify all served app/source assets match the workspace. See [DEPLOYMENT.md](docs/DEPLOYMENT.md). Compatible saved Revision 6 settings migrate, including selected stretches and optional work; original logs and unfinished older sessions remain intact in the archive.

## Removing test sessions

Open History → select a session → Delete session, then confirm. You can also use View log on the day tab. Deleting a saved test, partial, completed or omitted session removes its entries and progression credit and reopens its slot in the current week. Ordinary readiness, sequence and bench-spacing rules still apply to remaining work. Earlier-week deletion does not rewind the program. Finish any active workout before deleting saved history. Export a backup first if you may want the record later.

## Planner and private device sync

App 7.13 adds a read-only Planner feed, prescription-specific duration calibration and automatic private Google Drive revision sync while connected. See [Planner integration](docs/PLANNER-SYNC.md) for setup, conflict handling, offline behavior and test coverage. Guided timers and program prescriptions remain unchanged.

The app shows actual weekdays after a calendar move and preserves the rotated rhythm in Planner forecasts. To move the entire unresolved week, select its first session (B in the weekday plan, A in the source/taper calendar) and use **Move this day**. Session letters continue to identify the PDF prescriptions; no sets, rests, progression or warm-ups change. Calendar convenience does not establish physiological optimality.

App 7.15 applies the user-approved weekday schedule: **Mon B / Tue C / Thu A / Fri D**, with recovery work on Wednesday and the weekend. Week 12 retains its original taper/test calendar. Existing started weeks finish in their saved order before switching. See [the schedule amendment](docs/SCHEDULE-AMENDMENT.md) for optional work, observation gates, migration and the special-week rules.

## Historical 7.16 failure amendment · dose superseded by 7.17

App **7.16** applies the user's later constraint to all retained loaded working sets. Olympic work now uses one fixed-load set per exercise, with 15-second resets, ending at the first miss or technically invalid rep. Rep windows guide next-exposure loads, not set completion. Countdown steps expand or contract around actual attempts. Conventional work keeps strict-form failure; preparation, athletics, aerobic work and mobility retain their original endpoints.

The amendment starts with reduced conventional volume and a new recovery observation period. It replaces the week-12 three-attempt test with fixed-load failure benchmarks and removes Olympic loading in the pivot. Ordinary Mon B / Tue C / Thu A / Fri D and actual bench-spacing checks remain. Existing active sessions and saved records are frozen; unstarted work adopts immediately. The PDF stays unchanged.

This is a preference-constrained prescription, **not a demonstrated optimal or equivalent Olympic-training protocol**. Exact dose, resets, loads and taper adjustments are practical inferences. See [the specification and evidence review](docs/FAILURE-CONSTRAINT-REVIEW.md). `fresh()` retains the source policy for baseline fixtures; production journal creation in `loadStore` and migration explicitly select `all-failure`.

## Whole-week recommendation · App 7.19

The selected routine now uses **Monday, Wednesday and Friday**, one visit each. Both competition lifts lead all three days: six snatch and six CJ working sets weekly at the established dose. This preserves three specific exposures per lift, removes default secondary Olympic failure variants, and gives loaded sessions intervening recovery days.

**56 conventional sets are distributed 20/16/20**, with every exercise and all 34 muscle-region decisions specified, including forearms and deliberate zero-isolation choices. Priority upper chest, side delts and traps retain dedicated allocations. The [recommendation and alternatives](docs/SET-DOSE-REVIEW.md) explain the evidence, whole-week tradeoffs, regional counts, school-calendar fit and uncertainties.

Restart totals are **31 → 41 → 46 → 56 conventional** and **6 → 6 → 9 → 12 Olympic sets**, advancing only after completed green weeks with normal subsequent-session checks. Existing started weeks retain their saved order until the weekly review; the new routine then begins at no higher than stage 2. Historical/active prescriptions remain intact and old trials pause for review. Empty weeks adopt immediately.

Full Foundation targets with default timing are **219:20 Monday, 163:06 Wednesday and 214:49 Friday**, in minutes:seconds, before optional modules. Preparation, rests, station changes, moderate waiting and miscellaneous time are included. Enabled athletics runs after Olympic work and before assistance in the same visit. Planner receives the actual dated regimen and complete duration. See the [release audit](docs/SET-DOSE-AUDIT.md).

This is the chosen best-current recommendation under the user's failure requirement and combined priorities. Its exact personal optimum and equivalence to unrestricted Olympic programming are not experimentally established.

## Session usability · App 7.20

Olympic working weights are now self-selected. Enter a weight before the exercise and the app calculates brief warm-up steps from it. Previous weights/results are references, not mandatory percentages. The miss/form-failure requirement and prescribed set counts remain. New sessions recommend 40 seconds between Olympic reps; that is a practical fatigue-management choice, not a validated test of isolated power failure.

The runner offers whole-set rep entry, a separate breathing/burning stop, saved rep-count corrections with the original entry retained, one-tap early rest endings, and a whole-workout list of reps/weights/rest. After Olympic work, an available strength or assistance exercise can move next without dropping the displaced exercise. Wrist work stays after grip-dependent work. The general warm-up runs once; the second Olympic lift receives a shorter, lift-specific preparation. Active sessions retain their saved prescription.

See [the session usability review](docs/SESSION-USABILITY-REVIEW.md) for the rationale and verification scope.

## Dumbbell rows and alarms · App 7.21

The September 25 equipment amendment selects chest-supported dumbbell rows on a 30–45° incline bench for future sessions, preserving row sets/reps/rests. Log each dumbbell's weight. Historical and active prescriptions remain frozen; later equipment choices remain selectable.

Alarm sound defaults on, with a louder repeating three-beep pattern, device-local volume/mute settings, and a Silence control. An audio track contains the current countdown and its alert, so page timer callbacks are not needed to start the sound at zero. Skipping, pausing, extending, ending and resuming reschedule or cancel that track. Alarms also operate while viewing another app page.

Background audio is still subject to iPhone/browser media policies: other audio, calls, closing the app or device interruptions can stop playback. It may pause music from another app. Settings → Alarms includes a 10-second locked-phone test. This is not a native scheduled alarm or a claim of guaranteed iPhone lock-screen delivery. See [the implementation and verification review](docs/ALARMS-AND-ROW.md).
