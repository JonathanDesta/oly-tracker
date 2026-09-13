# Oly Tracker — Revision 6

A zero-build, offline-capable PWA for the September 13, 2026 Revision 6
weightlifting-first program with **all conventional work sets to failure**.
Warm-ups, Olympic lifts, explosive pulls, jumps, sprints and mobility are excluded
from that failure requirement.

## Source and calendar

The approved source is `weightlifting-first-failure-work-sets-program.pdf`,
Revision 6 (43 pages), SHA-256
`dcf2a114ad2c3becccb962913979121c0ceecaa2be4d442d598951fa8c0ce547`.
The PDF is not bundled into this public repository. This update replaces the
previous program; previous prescriptions are available in Git history.

- Weeks 1–3: Foundation; week 4 repeats week 3 at a green checkpoint.
- Weeks 5–7: Build; week 8 repeats week 7 at a green checkpoint.
- Weeks 9–11: Realization; Friday 11 reduces to one set per conventional exercise.
- Week 12: taper, Friday mock meet, Monday low-rep and Saturday moderate bench.
- Week 13: pivot, with light Monday/Thursday Olympic work and recovered
  Tuesday/Friday conventional work.
- Four cycles: 52 program weeks. Disruptions can extend elapsed calendar time.

The first cycle ramps 28 → 36 → 44 weekly failure sets; later cycles do not repeat
onboarding. First cycle totals 498 sets; an established cycle 522; four cycles
2,064. Planned bench exposures total 104 on distinct days, one low-rep exposure
per week. Recovery and event exceptions can reduce actual work; missed volume
is never owed.

## Architecture

| File                      | Purpose                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `js/program.js`           | Pure Revision 6 templates, phases, exercise menu, dose/recovery transforms, loading and failure progression. |
| `js/model.js`             | Migration, quality-attempt accounting, miss protocol, weekly review, legacy bench timestamps.                |
| `js/app.js`               | Responsive UI, ordered workout execution, logging, persistence, timers, history, controls and guide.         |
| `js/sync.js`              | Optional existing Google Drive synchronization, with revision/active-session guards.                         |
| `styles.css`              | Mobile-first app styles.                                                                                     |
| `sw.js`                   | Scoped network-first caching and offline shell.                                                              |
| `tests/*.test.js`         | No-dependency domain, migration and sync policy tests.                                                       |
| `tests/browser-smoke.cjs` | Optional Playwright integration smoke test.                                                                  |

`PROGRAM.dayPlan(training, dayKey, context)` is pure. A started workout stores a
complete prescription snapshot and its own anchors, cycle/week/exposure, actual
start/end times and per-attempt timestamps. Settings cannot edit the active plan.
Bench rescue has its own session identity. Repeating a week creates a new
exposure identity without relabelling history.

The week advances through a review, not the calendar clock. Skill and recovery
eligibility are **user-reviewed**; the app does not infer them from a percentage
of checkbox completions. Advanced controls support one dose change at a time,
retaining successful trials, removal of established additions, phase holds,
assessment replacements and heavy-practice replacements. The Guide contains the
judgment-based event, progression and return rules. The app does not autonomously
choose how much a game or alcohol exposure impaired recovery.

## Execution details

- Tuesday front squat + 3–5 bench; Friday high-bar squat + 6–8 bench.
- Revised menu: overhead cable triceps, standing calves on both days, supported
  reclined leg extension; cable/DB lateral choices and explicit intolerance or
  machine-setup fallbacks.
- Full rests, exercise-specific warm-ups, strict-form failure/TECH/pain endpoints.
- Olympic doubles/triples log each rep; CJ logs each pair with failed component.
  Misses consume the attempt budget. Two consecutive misses or the same material
  fault prompt a reduction; a poor rep among the next two ends that lift.
- Actual bench timestamps enforce 48 hours, including prior-program records.
- Split visits enforce 3 hours after visit 1. A single visit remains available.
- Rack jerk and full clean start **unassessed**. The old power-clean value and
  inferred maxes are never used as new technical references.
- Cutting does not automatically change volume, effort targets or Olympic caps.
- Conventional load recommendations require valid failure sets and a manual
  confirmation that subsequent recovery remained normal. They are suggestions;
  actual load and reps are logged explicitly.

## Storage and migration

`oly_state` remains the primary shared localStorage key. New data has
`revision: 6`, `schemaVersion: 4`, `training`, `records`, `activeWorkout`,
`restEnd`, and a full `legacy` archive.

The old state—including all old logs, maxes, progression, timers, and any
unfinished old workout—is retained verbatim as `legacy`. It is viewable and
exportable but is not resumed under a different program. The first migration
also preserves `oly_before_rev6`. No history is relabelled as Revision 6.

`oly_rev6_backup` mirrors the newest Revision 6 state. This protects it against
an older Day/GymApp installation seeding a stale `oly_state`. Cloud pulls update
the mirror; boot does not manufacture a new modification timestamp. Export/import
covers the complete workout state and legacy archive, without Google credentials.
Malformed imports do not replace valid data.

`oly_day_durations` publishes a versioned duration snapshot with per-session
kind/minutes. **GymApp was not edited.** Its existing consumer may still use its
own old duration table until that separate app is updated. Estimates include
warm-ups, work/rest and transitions; they are not a reason to shorten rest.

Google Drive keeps the existing `oly_sync.json` and optional client-ID setup.
A prior-program remote state cannot replace Revision 6; different old cloud copies
are preserved in the previous-program archives before Revision 6 is pushed. A
fresh, untouched installation pulls existing Revision 6 cloud data even when its
local initialization timestamp is newer. A different cloud session
cannot interrupt an active workout. Synchronization is still newest-state wins,
not a conflict-free merge of simultaneously edited devices. Real Google account
sync should be checked in the signed-in deployment; automated tests use fixtures.

## Source-conformance follow-up

See [PROGRAM-CONFORMANCE.md](PROGRAM-CONFORMANCE.md) for the source identity,
clause-to-workflow mapping, literal-source tests and deliberate review inputs.
The follow-up corrects taper rests and the inter-lift timer, adds all technique
regressions as selectable replacements, holds actual assistance loads, preserves
paused trial identity, adds gradual recovery restoration, and handles alternate
athletic exposures/returns and distinct event paths. Machine/setup changes can
start a fresh load comparison. Previous workout snapshots remain unchanged.

## Verification

```sh
npm test
node --check js/program.js
node --check js/model.js
node --check js/app.js
node --check js/sync.js
git diff --check
python3 -m http.server 8766 --bind 127.0.0.1
```

With Playwright installed and Chrome available:

```sh
node tests/browser-smoke.cjs
node tests/browser-conformance.cjs
```

Optional environment variables: `OLY_TEST_URL`, `OLY_BROWSER_CHANNEL`; `NODE_PATH`
may point to an existing Playwright installation. Browser QA uses an isolated
profile with synthetic data and blocks Google sign-in. It covers migration,
ordered logging, timer persistence, export/import, bench spacing, offline reload
and 320–1280px viewport widths. Screenshots are written under `/tmp/oly-rev6-qa`.

## Deployment

GitHub Pages serves the repository root from `main`:
https://jonathandesta.github.io/oly-tracker/

Bump `CACHE` in `sw.js` for a release. The service worker handles only this app's
scope and deletes only Oly caches; it does not delete another GitHub Pages app's
caches. New assets must appear in `ASSETS`.
