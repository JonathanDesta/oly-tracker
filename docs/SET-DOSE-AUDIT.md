# Regional allocation release audit · App 7.18

Local release gate completed September 21, 2026: `npm run audit` passed **145 unit tests**, **12 browser suites**, formatting and dependency checks, with **0 reported dependency vulnerabilities**. `git diff --check` passed. Separate integration verification used Planner 2.0.3's actual `validateFeed` against **36 stage/phase combinations**, preserving each feed and exact duration unchanged.

## Prescription review

The [complete allocation](SET-DOSE-REVIEW.md) specifies every exercise, 34 regional decisions, the distinction between direct/indirect/supporting work, the evidence and the inferences. The full target is 80 conventional plus 15 Olympic sets in ordinary Foundation/Build, with explicit restart doses 34/42/62/80 and 9/9/11/15. Wrist flexion, wrist extension and neutral-grip elbow flexion now have actual prescribed rows. Zero-isolation choices have reasons and are not described as maximal hypertrophy coverage.

The audit does **not** certify individual physiological optimality, equivalence of technical-failure Olympic training, or practical availability of five-hour school-year gym slots. The full B/D budgets are about 300/307 minutes and this limitation appears in the app and review. The approved calendar and one-visit default are retained. No shortened timer hides prescribed work, rest or waiting. Source-PDF fixtures remain separate from later user-authorized changes.

## Software coverage

- Every established B/D exercise count is asserted against an explicit expected list. All 34 muscle rows reconcile by day/week, and every displayed region has a decision. Muscle-region overlap is labeled. Warm-ups/athletics/mobility do not inflate work-set counts; Olympic sets get no numeric hypertrophy credit. A seated-calf fallback does not receive equivalent gastrocnemius credit.
- The original source-profile checks remain green. The amended 52-week readiness/event matrix checks 16,016 day plans; the amended runner completes 196 sessions through the actual restart and full target, taper/pivot, all endpoints and both bench exposures with actual ≥48-hour spacing. The source-profile full-year fixture retains its 212-session coverage.
- Direct forearm rows have safe strict-form endpoint cues, local warm-ups, repetitions, rest clocks, realistic bilateral execution time, and shared-station accounting. They execute after grip-dependent work. A mobile test runs all three new exercises through their actual UI, then validates saved state.
- Local upper-body restrictions remove the new rows; verification caps retained work at one set. Limited-later-event rules remove optional extras while preserving the ordinary dose. The new rows support added-set trials, reductions, schema validation and cloud serialization through the existing path.
- New and old dose versions remain readable. A 7.17 active workout is preserved byte-for-byte during loading; migration queues until completion, retains historical rows, caps the new introduction at stage 3 and resets stable-dose observations. Old mixed-dose sessions cannot earn new-dose advancement.
- Each independent Olympic failure set retains its first-invalid endpoint, fixed load and five-minute recovery. Existing tests cover early/late endpoints, zero-valid-rep/repeated-fault stops, safety omissions, first-set monitoring, undo and reload.
- Daily tables distinguish current dose from the established normal-week target, including during stage 1. The browser checks wrist targets of one set today / two this week / four at the full target, the full regional decision list and mobile overflow.
- Counts and timing changes alter Planner prescription signatures. Existing timing tests cover all warm-ups, rests, transitions, waiting, miscellaneous allowance, cardio and stretch-only sessions. Planner forecasts receive the actual new totals; no arbitrary duration ceiling truncates them.
- Existing browser suites pass for original conformance, restrictions, progression, imports/exports, deletion and restarting a test session, calendar order, recovery-only routines, update activation, offline operation and responsive layouts.

Two new browser-fixture issues were corrected during the audit: an expected region-row count included one extra row, and a synthetically constructed active workout needed the same pacing synchronization used by real UI transactions. Neither was bypassed; the final full suite above passed after correcting the fixtures.

## Publication verification

Publish by normal fast-forward push, wait for the Pages job belonging to the exact release commit, compare all cached public assets with local bytes using `npm run check:deployment`, and run the regional mobile/offline browser suite against the public URL. Local test success alone does not constitute publication verification. The completion message reports the resulting public checks.

These checks verify the implemented rules and exercised paths. They are not proof of absence of every possible defect, nor evidence that every muscle's exact optimal volume is knowable without individual outcome data.
