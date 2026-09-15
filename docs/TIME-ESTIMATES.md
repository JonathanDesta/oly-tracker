# Time planning

The app now estimates each exercise, each session and the complete scheduled day. These are planning ranges, not measured workout durations or additional training prescriptions. They cover the configured dose, including readiness restrictions. Actual completion time depends on load, rep outcome, gym conditions and interruptions.

## Default assumptions

- Moderate gym traffic: 1–3 minutes waiting when acquiring a station. Consecutive exercises at the same station keep it.
- A typical 45-second plate/stack change and 90-second station move/setup, each modelled from two-thirds to four-thirds of that time. Includes walking, adjusting supports/safeties and loading the first work area.
- Ten minutes per visit for water, restroom and other interruptions, plus 3–5 minutes arriving and 2–4 minutes unloading, logging the last set and packing up. Standalone aerobic visits use 1–2 minutes each for arrival/departure.
- Conventional reps: 3–4 seconds including the roughly two-second eccentric; bench, squats and calves 4–5 seconds including their pauses. Add handling/unrack/rerack time. Low/high bounds use the prescribed rep window. One-arm cable lateral raises count both sides by default; choose both-arm timing in Settings, or select dumbbells.
- Olympic execution: snatch/clean 12–20 seconds per rep, CJ pair 25–40 seconds, jerk 10–18 seconds, pull 4–7 seconds. Doubles include resets; rack-jerk upper estimates allow the permitted 30-second split. Pause variations receive additional execution allowance.
- Jump sets include two ten-second resets. Flies include the 20 m run-in. Cuts include both sides and the 20–30 second reset. Walking back and logging fit inside the prescribed long field rests.

## What comes from the program

Pages 8–9 supply the general warm-up, specific ramps, skipped light stages, 75/85% thresholds, work-set rests and the second-visit re-warm-up. General lifting preparation is budgeted at 10–15 minutes; the second visit uses the prescribed 3–5 minutes plus each local ramp. Field preparation on page 21 is budgeted at 9–13 minutes, including the easy walk/jog, drills, build-up runs, walk-backs and 90-second final rest.

Each exercise includes its warm-up execution and ramp rests, work execution, within-set resets, between-set rests, equipment transition, and waiting. There are n−1 rests between n work sets. A full final-set rest is not automatically added before another exercise’s warm-up. Continuation rows retain recovery but do not repeat an entire ramp; a heavier continuation allows a brief rehearsal. Loading/logging and equipment changes share recovery when possible; only time beyond the available recovery is added. Optional final squat/pull ramps appear in the upper allowance.

Page 19’s mock meet includes the 8–10 minute inter-lift interval **before** the CJ ramp. Page 4’s split visits add at least three hours outside training time. Athletics defaults to a separate visit with the same preferred gap; same-visit planning adds the page-21 five-minute transition and full field warm-up, sharing the visit overhead.

Aerobic prescriptions remain actual moving minutes. Arrival, setup and breaks affect the planning total only. The main aerobic range covers a walk with no equipment queue through a bike setup/queue at the chosen gym traffic; additional prescribed walks have no machine queue. Aerobics is assumed to follow other training when present. Additional walks retain their separate moving dose; add travel for separate outings. Selected mobility/stretches are counted on their scheduled days: four unilateral holds per restriction, three 15-second rests, five slow active reps, setup and side changes. No mobility is invented for unselected restrictions. The source prescribes no separate cooldown.

## Reading and adjusting the app

Each day has a whole-day budget, each session has a range, and every exercise shows its allowance including preparation, transitions and rest. Open “How this time is estimated” for the itemized breakdown. Totals use unrounded seconds, so separately rounded labels can differ by a few minutes. These are broad low/high planning bounds, not confidence intervals or guarantees.

Settings → Time planning changes traffic, breaks, typical load changes, station setup, extra recovery, athletics visit arrangement and one-arm lateral timing. These settings do not change training dose, rest timers, progression eligibility or comparison setup. Existing workouts retain their starting assumptions; the active exercise allowance describes the complete exercise, not time remaining.

Travel to/from training and unscheduled optional walking are additional. An unusually long interruption can exceed the buffer; after more than 15 minutes idle, use the source re-warm-up. Actual failure reps outside their expected window, early stops and additional recovery can move elapsed time outside the estimate.

## Example: first-cycle Foundation, week 3, full entry dose

Default moderate traffic, one-arm cable laterals, single B/D visit, ten minutes miscellaneous time; optional athletics, aerobics and mobility disabled. Different phases and your actual settings produce different totals.

| Day      | Full session budget |
| -------- | ------------------- |
| monday   | 64–94 min           |
| tuesday  | 173–289 min         |
| thursday | 71–108 min          |
| friday   | 180–296 min         |

The B/D bounds are wide because many separate exercises each have a warm-up, equipment transition and possible wait. The upper bound assumes all of those take the longer end simultaneously; it is not a claim that every visit will last that long.

### Tuesday detail

| Exercise / visit overhead        | Allowance |
| -------------------------------- | --------- |
| Full clean & jerk                | 26–40 min |
| Above-knee hang full snatch      | 13–20 min |
| Front squat                      | 11–21 min |
| Flat barbell bench press         | 13–21 min |
| Incline machine press · 30–45°   | 14–21 min |
| Cable lateral raise              | 18–30 min |
| Chest-supported row              | 9–14 min  |
| Lat pulldown                     | 5–10 min  |
| Supported machine or DB shrug    | 5–10 min  |
| Reverse pec deck                 | 5–11 min  |
| Cable curl · arms beside torso   | 5–10 min  |
| Overhead cable triceps extension | 3–6 min   |
| Seated leg curl                  | 8–14 min  |
| Standing calf raise              | 9–14 min  |
| Supported reclined leg extension | 5–10 min  |
| Machine abdominal crunch         | 5–10 min  |
| arrival                          | 3–5 min   |
| general                          | 10–15 min |
| breaks                           | 10 min    |
| departure                        | 2–4 min   |

## Verification

Regression tests cover rep windows, unilateral timing, Olympic resets, ramp thresholds, loading/rest overlap, repeated rows, meet intervals, split visits, field work, aerobic totals, mobility, all phase/restriction combinations, backup validation and frozen session assumptions. The browser suite checks all seven days, settings persistence, active budgets, split/athletic placement, 320/390/768/1440 px layouts and cold offline reload. The existing prescription and full-year audit remain part of `npm run audit`.

## Executable preparation and stretch-only days

Selected mobility now appears as a real session with Start, timed left/right holds, 15-second rests, active-rep completion, early stop and a saved journal. It runs without a lifting session or invented lifting warm-up. The day budget includes that session once. General/field warm-ups and local ramps have resumable stopwatches, exact source instructions and completion records. A separately performed warm-up can be confirmed, with its duration left unknown. The interruption re-warm-up is available with its additional 3–5 minute planning allowance. Paused timer time is excluded from timed preparation; the overall session timestamps retain elapsed wall time.

Additional checks execute 156 cycle/week/mobility-day combinations and run stretch-only sessions through a cold offline reload, completion and early stop. Browser tests also cover warm-up pause/resume and activating a cached app update while preserving the journal. The update action is blocked during an active workout.

## Executable aerobics

Both main aerobic sessions and additional prescribed walks have start/pause/resume clocks. The easy start belongs to the prescribed moving dose, so cardio does not get a separate zero-minute lifting warm-up screen. Stop at the target and confirm actual moving minutes; the timer measures unpaused time, not physical movement. Setup, waiting and breaks remain in the planning total but are excluded from moving dose. Shorter bouts save as partial work. Ending without confirmation retains the interrupted clock trace separately from confirmed minutes. Timers, targets and paused time survive offline reload.

App 7.10 exposes its installed build and an update check in Settings, including on mobile. The update banner preserves the journal and blocks activation while any saved session is active, including in another tab.
