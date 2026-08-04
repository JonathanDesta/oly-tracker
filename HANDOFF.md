# Oly Tracker — Developer Handoff

A zero-dependency, offline-capable PWA for executing and logging the approved
13-week Olympic-weightlifting training system. It uses vanilla JavaScript and has
no build step.

## Repository and deployment

- Live site: https://jonathandesta.github.io/oly-tracker/
- Repository: https://github.com/JonathanDesta/oly-tracker
- GitHub Pages deploys the repository root from `main`.
- Bump the cache key in `sw.js` whenever program or application assets change.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and all CSS. |
| `js/program.js` | Exercise library, exact 13-week prescription, program transforms, loading helpers, and field/cardio definitions. |
| `js/app.js` | State, persistence, UI, timers, attempt logging, progression policies, test-week flow, and analytics. |
| `js/sync.js` | Optional synchronization support. |
| `tests/program.test.js` | Prescription, calendar, loading, volume, field, cardio, cut, pickup, and readiness tests. |
| `tests/app-policies.test.js` | Progression, receiving, miss-policy, analytics, and override tests. |
| `sw.js` | Network-first service worker with offline asset cache. |

## Program model

The calendar is one 13-week cycle:

- Weeks 1–3: accumulation
- Week 4: deload
- Weeks 5–7: intensification
- Week 8: deload
- Weeks 9–11: realization
- Week 12: taper
- Week 13: testing and atomic TM update

`PROGRAM.getDayPlan(blockId, weekInBlock, dayKey, cutting, context)` returns one day's
full plan (all sessions); `PROGRAM.getWorkout(...)` resolves a single session from it.
The context carries readiness, pickup placement, receiving loads, technical
progression state, and Copenhagen progression. Transforms are pure: gain/cut,
readiness, and pickup changes never mutate the base prescription.

Each day contains independent `sessions`, so AM field work, lifting, Zone 2,
intervals, and test sessions can be started and completed separately. Every
session and exercise slot has a stable identifier. Do not key logs by date alone.

## Durable state

Local storage key: `oly_state` (schema v3). The current schema includes:

- all seven training maxes and `cycleId`
- block/week position and gain/cut mode
- Green/Yellow/Red readiness
- readiness anchored to the calendar day, plus pickup days/timing anchored to the program week
- receiving baselines, stall metadata, and high-hang snatch state
- Copenhagen progression state
- TM-exception exposure state and staged Week-13 test results
- hypertrophy loads, immutable workout logs, and an in-progress workout
- rest, session, and interval phase state so an iOS teardown resumes exactly

`load()` migrates legacy data. Export/import and clear-data actions cover the full
durable schema. A Week-13 TM update is applied only when all seven tests have been
saved; applying it begins a new cycle and resets cycle-specific progression state.

## Important execution policies

- Olympic/technical loading uses the seven stored TMs and rounds to available
  2.5-pound increments.
- The miss protocol stops an exercise after two misses or two consecutive C-grade
  makes. A first miss repeats once; a second attempt is reduced 5–7.5%.
- Competition-lift attempts—including each rep of programmed doubles—log outcome,
  A/B/C grade, RPE, actual percentage, and miss direction. Clean-and-jerk misses
  also log whether the clean or jerk failed.
- Receiving work logs low/high catches and whether every rep was stood. A high
  catch lowers the remaining session's receiving load by 10 pounds without
  changing the next week's baseline.
- Hypertrophy uses slot-specific double progression and requires the assigned RIR.
- A TM exception requires three consecutive complete A-grade exposures at at least
  85% actual TM and RPE 7 or lower, and can occur only once per lift per cycle.
- Analytics distinguish technical A-rate from actual miss rate and group attempts
  by cycle, block, lift, and 2.5%-TM band.

## Local verification

Serve the repository over HTTP so service-worker and PWA behavior match production:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Run the no-dependency policy suite and syntax checks:

```bash
npm test
node --check js/program.js
node --check js/app.js
git diff --check
```

For a release smoke test, verify at mobile width:

1. Home presents AM/PM sessions separately and completion does not overwrite.
2. Settings changes to readiness and pickup immediately transform the week.
3. A lift attempt can record RPE, make/miss, grade, direction, and receiving depth.
4. History shows distinct A-rate and miss-rate summaries.
5. Week 13 stages all seven results and applies them together.
6. Guide copy reflects the current cycle and execution rules.

## Maintenance rule

Do not rebuild the program merely because a block ends. Start a new cycle with the
Week-13 results. Rework the exercise menu or architecture only when logged outcomes,
a material goal/constraint change, injury, equipment change, or materially stronger
evidence justifies it. Keep policy changes covered by tests before deployment.
