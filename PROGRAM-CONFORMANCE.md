# Revision 6 prescription conformance

Source: **Weightlifting-first, failure-work-set program — Revision 6**,
13 September 2026, 43 pages. SHA-256:
`dcf2a114ad2c3becccb962913979121c0ceecaa2be4d442d598951fa8c0ce547`.
This is the approved program, including the subsequent exercise review, rather
than any of the competing Claude versions. The personal PDF is not published here.

The program engine and its observable workflows were compared with the source's
executable prescriptions. This is a conformance record, not a claim of exhaustive
proof or a new exercise-science review. A range uses a valid point inside that
range for the default timer (for example 150 seconds inside a 2–3 minute rest).
Actual repetitions, load, effort, technical faults and recovery remain logged
observations. No test count establishes that an app is infallible.

| Source prescription                                                                                          | App behavior and verification                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority order; conventional work sets at strict-form failure; Olympic, explosive and preparation exclusions | Separate quality/failure/speed/aerobic rows and endpoints. TECH/pain cannot earn progression. Ordered exercise logging and Guide.                                                                                                                                                                     |
| Initial SN/CJ references; no inferred clean or rack-jerk max                                                 | 155/205 lb; clean and RJ unknown. Demonstrated assessment/test references and separate direct rack work load. Migration tests preserve old values only in archive.                                                                                                                                    |
| Four-day A/B/C/D schedule; F/B/R set, rep, percentage and effort tables                                      | Literal source fixtures for all 12 phase/day Olympic templates, both complete conventional menus, heavy sequences, entry ramp and failure counts.                                                                                                                                                     |
| First entry 28→36→44 sets; first/later cycle and annual arithmetic                                           | Calendar tests: 498 first cycle, 522 established cycle, 2,064 total and 104 planned bench days. Readiness can reduce actual work.                                                                                                                                                                     |
| Two flat-barbell bench days, low/moderate distinction and ≥48 actual hours                                   | Base Tuesday/Friday, taper Monday/Saturday; actual timestamp guard, historical bench inclusion, rescued bench identity and after-test guard. Browser logging/spacing tests.                                                                                                                           |
| One visit or split after laterals, ≥3 h between visits                                                       | Identical total work, 9+13 distribution at the full base dose; actual time guard. Later-work impairment is assessed from the log by the lifter.                                                                                                                                                       |
| Per-exercise rests, warm-up ramps, safe receiving/release and idle restart                                   | Session preparation and expandable exercise instructions; taper Tuesday 180 s, Thursday 120 s; test snatch→CJ 540 s before the CJ ramp. User may extend rest within the source rules.                                                                                                                 |
| Weeks 4/8 repeat preceding loads and dose                                                                    | Checkpoint annotations and secure actual-load history; no automatic multi-set load progression, explicit rep-window correction exception. Source tests verify held prescriptions and that history cannot override readiness reductions.                                                               |
| Week 11 reduction, week 12 taper/test, week 13 pivot                                                         | Phase overrides precede stricter recovery rules. No extra Friday-11 squat; press replaces that day's sole incline set. Exact taper tests and pivot templates; longer lower recovery can omit final Friday lower work.                                                                                 |
| Technique regression menu (p16)                                                                              | Receiving rehearsals, 40–60% receiving return, high-hang turnover, knee-pause floor work, light stance/recovery and 40–60% dip-drift jerk are selectable replacements. Distinct 60–75% assessed-RJ assistance. Literal tests plus browser selection/reload.                                           |
| Failure progression, rep-window correction, new equipment/ROM                                                | Comparable row histories, actual failure endpoint and subsequent recovery confirmation. Equipment alternatives and an explicit fresh-comparison control prevent old machine/setup loads from being reused as earned progression.                                                                      |
| Assistance/addition trials and 2/4/8 exposure reviews (p31–32)                                               | Relevant FS or BS choice, supported press substitution, pause-dip replacement, added accessory set and fixed calf partial. Retain/remove/review controls; checkpoint/R9–10 load hold; paused identity survives taper/pivot and resumes after a new tolerance review.                                  |
| Earned heavy ladder and component assessments                                                                | Replacement slots, phase caps, one-lift dose changes and assessment attempt budgets; extra heavy work removed for verification returns. Eligibility and direct RJ progression require explicit review of secure exposures.                                                                            |
| Local A→B, C→D and lower accessory recovery adjustments                                                      | 4×2 A snatch option, one fewer C jerk with suspended assistance, lower base curl/calf reduction and extension/crunch omission. The causal decision remains reviewed.                                                                                                                                  |
| Amber/red, targeted reduction, full reset, progressive restoration                                           | Phase-first transforms; combined tests across all 13 weeks; no failure in amber, no training in red, no reset squat/accessories. Gradual return repeats the week, adds at most one set per successful row exposure, holds progression and requires subsequent recovery confirmation.                  |
| Athletics entry, step progression, secondary dose, fly/cut alternation, taper and return                     | Reviewed optional configuration; primary-log alternation; week-11 Monday halves sets/runs, week12 omits, pivot returns earned dose. A >14-day break steps down for two good exposures. Timing reliability, landing quality and whether a game overlaps are observations.                              |
| Aerobics and mobility                                                                                        | Separate introduction, weekly minute progression and phase holds; Wed/Sat default allocation can be lengthened within the program. Up to two mobility restrictions with the prescribed sets/time/frequency and active reps. Splitting aerobic minutes into shorter walks is a user scheduling choice. |
| Pickup, later fixed games and alcohol scenarios                                                              | Today-specific event modes distinguish whole deferral, priority-lifts-only, optional separate rehearsal, verification and unsafe readiness. Event notes persist in History. Larger/unfamiliar taper-Saturday event defers bench. Source warm-up and rolling-session sequence are in Guide.            |
| Saved work, interrupted sessions and prior program                                                           | Frozen active prescriptions; previous logs never relabelled; backup/import, cloud revision guards and offline shell tested. Companion GymApp and deployed Pages were not modified in this audit.                                                                                                      |

## Deliberate human decisions

The app cannot establish sobriety, pain-free receiving positions, safe release
competence, whether a rep was technically acceptable, whether a press/squat trial
helps the Olympic lifts, whether run times are comparable, or whether a game was
demanding. Those are explicit readiness, log, omission, setting and review inputs.
The Guide supplies the decision rules. Whole-session deferrals are performed from
the original day card in A–B–rest–C–D order; the app does not invent new dates or
replay finished Olympic work. Bench uses a separate rescue path.

Olympic/RJ load advancement and individual assistance decisions are reviewed,
not inferred from checked-off sets. The actual load field remains editable so a
lifter can reduce load or record what happened; a suggestion is not a mechanical
lock on the bar. Precise monitoring thresholds and troubleshooting steps remain
visible in the Guide. An omitted row never creates an automatic volume debt.

## Repeatable verification

- `npm test`: literal source fixtures, calendar arithmetic, rule combinations,
  progression, migration, active snapshots, service-worker scope and mock sync.
- `node tests/browser-smoke.cjs`: isolated synthetic profile; logging, timers,
  import/export, bench spacing, mobile layouts and offline reload.
- `node tests/browser-conformance.cjs`: technique selection and frozen reload,
  equipment/support-squat choices, trial pause/resume, pickup event history and
  rehearsal identity, gradual recovery review and responsive settings.

Both browser scripts use Playwright with installed Chrome and a local server;
Google sign-in is blocked in these synthetic tests. Real signed-in cloud sync is
not verified by them.
