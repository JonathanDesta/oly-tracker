# Set-dose release audit · App 7.17

Local release gate completed September 21, 2026: `npm run audit` exited successfully; **142 unit tests**, **12 browser suites**, formatting checks and the dependency audit passed. The dependency audit reported **0 vulnerabilities**. `git diff --check` passed.

## Evidence/prescription audit

The [set-dose review](SET-DOSE-REVIEW.md) records the source evidence, its limits, every exercise's ordinary day/week allocation, muscle accounting, restart stages, adjustment process and actual duration budgets. It distinguishes the user's later failure/set-dose instructions from the unchanged PDF. The previous one-set-only recommendation is explicitly superseded. No exact allocation, fractional set credit or four-hour session is represented as a demonstrated individual optimum.

## Software checks

- Ordinary stages reconcile to 28/36/44/56 conventional and 9/9/11/15 Olympic sets. Tests explicitly check every established B/D conventional exercise and each day's Olympic/conventional total.
- The full 52-week readiness/event matrix covers 16,016 day plans. Realization, checkpoint, taper, pivot, technical restrictions, verification, local symptoms, missing protection, games and alcohol-related restrictions retain their overrides. Restart stages do not advance into checkpoint/Realization/taper/pivot weeks.
- The amended full-year runner executes 196 sessions with independent Olympic terminal sets, both bench exposures and at least 48 hours between actual bench exposures. Separate original-program fixtures retain the 212-session source-year coverage.
- Direct/indirect muscle counts reconcile across days and weeks. Regional upper chest is a labeled subset, Olympic contributions are unquantified, and no glute isolation appears. Per-session breakdowns cover separate visits when selected.
- Multiple Olympic sets cannot finish from reaching a rep target. An early terminal attempt closes only its own set. Five-minute inter-set recovery is enforced. A zero-valid-rep set or repeated recorded material fault ends further sets. Pain/voluntary stops cannot earn successful work.
- Variable pacing handles early/late endpoints, set/reset/rest transitions, safety stops and undo. Mobile tests execute two independent Olympic terminal sets, reload offline between them, undo and restore the final attempt, then validate the saved journal. No viewport overflow or uncaught page errors was found in those checks.
- Progression requires every prescribed set in two comparable normal exposures to reach the rep-window top. First-set monitoring uses the first set rather than all reps combined.
- Added-set trials target an existing exercise/day, block another concurrent trial and require review before retention. Individual reductions pause an addition or reduce established work. Reduced base counts cannot erase a trial or create a zero-set row when limited-event rules remove extras.
- Legacy active rows retain their original endpoint/version and prescriptions. Reviewed-dose migration waits until the active workout ends, resets the stable-dose observation and excludes mixed-version weeks from advancement. Current and legacy state round trips pass.
- New set counts and endpoint versions change Planner duration signatures. Feed creation and cloud round trips preserve the revised configuration. The service-worker cache includes the new dose module.
- Existing browser coverage also passed for readiness, original source conformance, imports/exports, deletion and restart, timing settings, app updates, warm-ups, stretching-only sessions, cardio, prescribed calendar order, bench spacing and cold offline operation.

Two issues were found and corrected during this release audit: a new muscle disclosure initially shared the timing disclosure's selector, and several release tests still expected App 7.16. The final complete audit above passed after both corrections. Additional review corrected checkpoint entry progression, a renewed lower entry dose and the interaction of individual reductions with added-set trials.

## Publication gate

Publication uses a normal fast-forward push and the Pages build for the exact release commit. After that build succeeds, `npm run check:deployment` compares the public HTML, styles, modules, source files, manifest, icon and service worker to local bytes. The dose mobile/offline suite is then run against the public URL. Production results are reported in the task completion after those checks succeed; local success alone is not treated as deployment verification.

These checks establish conformance for the implemented rules and tested paths. They do not prove an individual's optimal adaptations or rule out every possible software defect. Training outcomes remain necessary for the dose review.
