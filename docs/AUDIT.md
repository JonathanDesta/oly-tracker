# Revision 6 rebuild audit

**Historical report — superseded by [the full source-to-app audit](FULL-AUDIT.md). The earlier scope missed defects; the counts and conclusions below describe that earlier run, not the current audit.**

The audit used the supplied 43-page PDF, not the retired repo's conformance claims. Pages 1–34 were read directly for all operational requirements; the complete source, including references on pages 35–43, is bundled without edits. `program/source.json` records the PDF's SHA-256, checked by the test suite.

## Source traceability

| Source pages | Implementation and verification                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–3          | Priority order, provisional SN/CJ anchors, no invented component maximum; failure vs quality endpoints; honest TECH/pain/unsafe outcomes; evidence boundaries in the source reader                                                      |
| 4–5          | A/B/rest/C/D rhythm, ordered upper/lower blocks, 9+13 preferred split with ≥3 hours, all warm-ups, entry doses 28/36/44 conventional sets                                                                                               |
| 6–7          | Four 13-week cycles; all F/B/R Olympic rows independently transcribed in tests; phase gates, earned heavy replacements and attempt budgets                                                                                              |
| 8–12         | General/local preparation, lift ramps, secure catches and release, exercise-specific rests; short within-set Olympic resets; B/D conventional order and strength rep windows                                                            |
| 13–15        | Exact 22-set B/D blocks, failure endpoints, upper-chest/delt/trap priorities, zero glute isolation, one-set trials and two-week observation review                                                                                      |
| 16           | Receiving, return, high-hang turnover, knee-pause balance and light split/dip regressions; original work is replaced                                                                                                                    |
| 17–18        | Global/local amber and red rules, miss/fault reduction then stop, targeted/full reductions, restored rows grow one set per successful exposure, repeat weeks reopen with a new exposure identity                                        |
| 19–20        | Entire taper replaces the ordinary week; three scored attempts per lift, technical benchmark option, post-test moderate bench, actual ≥48-hour bench spacing, rep-window progression and separate bench rescue                          |
| 21–22        | Exact initial athletic dose and progression, source warm-up/rests, optional measured jumps within the existing dose, timing stop rule; aerobics 40→60→150→300 with reviewed eligibility; at most two mobility restrictions              |
| 23–25        | Demand-based game adjustments, separate rehearsal that does not complete the deferred session, rolling dates, alcohol verification, no automatic next-day ban, source equipment fallbacks and bulk/cut guidance                         |
| 26–30        | Before/during/after logging, next-session follow-ups, weekly/pivot review prompts, independent CL/RJ assessments, heavier practice replacements, retained athletics and annual volume audit                                             |
| 31–34        | Squat, overhead-press and pause-jerk trials; phase-specific substitutions, preserved IDs/history across pauses, 2/4/8-exposure reviews and optional four-exposure extension; fixed calf partial trial; provisional pull omission review |
| 35–43        | Original reference text and PDF available offline; no additional scientific claims or external prescriptions introduced                                                                                                                 |

## Executed checks

- **44 automated test cases**, including independent source-table fixtures and a complete synthetic 52-week execution through the journal API.
- **212 scheduled sessions** completed and validated in that annual execution; the program stops after cycle 4, week 13.
- **2,064 conventional sets** in the annual baseline: first cycle 498, subsequent cycles 522 each. Normal split 9+13, normal week 44, week 11 total 36, taper 2.
- **24,024 generated scenarios** covering weeks, entry stages, recovery states, readiness/events, splits, heavy replacements, assistance substitutions and optional workloads. Checks include valid budgets, unique rows, no unsafe active sessions, and no taper-restored accessory work.
- Journal tests for preparation, immutable references, actual missed attempts, quality stops, actual bench spacing, whole-session deferral, missed-low-bench replacement, taper bench ordering, held-week load correction, restoration, repeat weeks, direct rack progression and trial continuity.
- Persistence tests for legacy preservation, malformed imports, backup recovery, rejected stale writes and storage failure atomicity.
- Browser workflows for readiness, Olympic and conventional logging, refresh recovery, next-session follow-up, equipment changes, reviewed position/trial creation, full source navigation/search, native JSON export/import, and cold offline reload.
- All main views checked for horizontal overflow at **320, 390, 768 and 1440 px**. Desktop and mobile screenshots inspected for layout and control legibility. Browser suite checks for uncaught JavaScript errors.
- Formatting, source syntax through module execution, local serving, locked dependency install and dependency vulnerability audit.

The repeatable entry point is `npm run audit`. Browser artifacts are written to ignored `test-results/`. Tests use isolated synthetic data and a temporary local server.

## Findings resolved during the rebuild

Reduction paths preserve per-slot Olympic rep budgets instead of turning earned singles back into doubles. Within-set Olympic attempts use short resets rather than a full between-set timer. A held week permits source-authorized rep-window correction. Repeat/reduction reviews open a usable new exposure without advancing the phase prematurely. Restoration accepts confirmed recovery after a reduced exposure. Readiness changes also restrict active sessions. Direct rack progression is available in eligible Realization weeks. TECH/unsafe early endings are saved as partial sessions rather than successful completed targets. Corrupt imports and failed writes leave valid journal data intact.

## Audit boundaries

This is evidence of source conformance and operability for the reviewed paths, not a mathematical proof that no future software defect can exist. Human observations required by the source—safe technique, actual readiness, competent spotting, comparable video, and useful transfer—remain explicit review inputs. Browser testing ran in Chrome; hardware-specific iOS installation and wake-lock behavior are optional platform features and are not required to log workouts.

## Follow-up discrepancy audit

[All seven reported discrepancies](REPORTED-DISCREPANCIES.md) were checked individually against the current worktree and the source. Confirmed gaps in heavy bands and contextual starting estimates were fixed; the review checklist was made explicit. New unit and browser checks also protect the already-correct amber timer, first-cycle cap, cut/fly introduction and year-week display.

[The subsequent thirteen-report audit](SECOND-DISCREPANCIES.md) corrected week-11 assistance load holds, limited-event load progression, the athletics entry gate and warning retention after unrelated logs. Main aerobic sessions and added walks now display and log separately. It also reverified every repeated claim and the protection rule against the current implementation and PDF.
