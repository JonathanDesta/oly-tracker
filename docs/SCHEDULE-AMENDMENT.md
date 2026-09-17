# Weekday schedule amendment · App 7.15

The user approved the September 17, 2026 scheduling recommendation. This amendment changes the Revision 6 calendar, not its underlying ordinary lifting prescriptions. It is a monitored practical trial, not a claim of physiological equivalence or proven optimality. The bundled PDF and its original weekday labels remain unchanged; the app's Program view identifies this amendment.

| Calendar day | Ordinary weeks, including the pivot                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Monday       | B: clean & jerk/hang snatch, front squat, low-rep bench and assistance; pivot B retains its source conventional-only prescription |
| Tuesday      | C: snatch, rack jerk and eligible pulls; pivot uses its lighter Olympic replacement                                               |
| Wednesday    | Eligible aerobics and targeted mobility                                                                                           |
| Thursday     | A: snatch/easy clean & jerk; pivot uses its lighter Olympic replacement                                                           |
| Friday       | D: both lifts, back squat, moderate bench and assistance; pivot D retains its source conventional-only prescription               |
| Saturday     | Eligible aerobics and targeted mobility, subject to event/readiness rules                                                         |
| Sunday       | Off or targeted mobility; eligible walking                                                                                        |

The chronological order is B–C–rest–A–D–rest–rest. Bench is normally Monday/Friday, approximately 96 then 72 hours apart. Actual logged bench attempts, including earlier weeks, continue to enforce the 48-hour minimum. A late start moves later unresolved slots in this order; a postponed D also shifts the next week's first session to preserve two recovery days.

## Optional work and observation

Established primary athletics follows Tuesday C in the same visit by default, with the five-minute transition and full field warm-up. A previously earned second exposure follows Thursday A. If the primary C module is missed, its existing dose may move to A instead of adding or duplicating a module; the second exposure is then suppressed. No weekend athletic catch-up is created. All introduction, progression, return, event and quality gates remain applicable. Thursday field work can exceed a short evening window; readiness and actual available time still control whether an optional exposure is practical.

Main aerobics and the three ordinary mobility days remain Wednesday/Saturday/Sunday as prescribed. An earned fourth mobility exposure stays attached to A, now Thursday. Additional walks retain their source slot allocation, and all scheduled modules continue to contribute to each day's displayed time and executable routines.

A new adoption begins a schedule review. New dose additions and resumption of paused trials wait for two complete green weeks at an established, comparable dose, with an explicit weekly assessment of C after B and D after A. Incomplete/abnormal weeks, taper/pivot/entry weeks, and workload/phase changes interrupt that observation window. Ordinary load corrections, direct rack/pause-jerk load progression and eligible component assessments retain their existing gates. This is an initial tolerability check, not proof of equal adaptation; existing readiness rules always act sooner when needed.

## Taper and testing

- Week 11 keeps the ordinary weekday order. B retains its phase dose; Friday D reduces to one failure set per prescribed conventional row. Its last planned lower failure work remains seven days before the Friday test. Primary athletics occurs on Tuesday C only at half the established jump sets and run repetitions, rounded up; no secondary module.
- Week 12 explicitly returns to the source calendar: Monday Olympic practice plus low-rep bench; Tuesday Olympic singles; Wednesday recovery; Thursday easy rehearsal; Friday test or technical benchmark; Saturday moderate bench after the test if ready. No athletic module or formal aerobics. Event rules may defer testing or bench.
- Week 13 returns to B/C/rest/A/D/rest/rest, using the source pivot prescriptions. A Saturday or later bench still governs the next B's actual eligibility. Planner receives the earliest permitted start for currently planned bench sessions; its forecast cannot waive readiness or actual timestamp checks.

Heavy attempts, assessments, squat support, substitutions, trials and progression remain attached to their original A/B/C/D identities. Their source caps and set/repetition budgets do not change with weekday labels. Friday and Monday readiness still depend on actual Thursday/weekend exposure, not elapsed calendar days alone.

## Existing journals and integration

New journals and old unstarted, unmoved weeks adopt the weekday plan. An active workout, existing current-week record, explicit moved date or bench reservation preserves the source calendar for that saved week and queues the weekday plan for its next reviewed exposure. Completed years remain complete. Frozen logs, timers, references and histories are not rewritten. Settings shows the current and pending calendars and permits an explicit return to the source order with the same boundary protection.

The storage schema remains 7 with validated optional schedule fields. Persisted keys named `monday`, `tuesday`, `thursday`, `friday` continue to identify A/B/C/D rather than actual weekdays. `calendar.js` owns their chronological mapping; the interface uses actual dates. Original-calendar tests explicitly select the source profile, while new tests exercise the weekday profile and migration.

Planner 2.0.3 reads the feed's explicit seven-slot projection order and actual bench eligibility. Taper Saturday bench is included as a fifth lifting entry. A pending calendar switch suspends future projection until the reviewed week supplies its new feed, rather than projecting the wrong order. Future projections still repeat the current known dose; only Oly advances program phases. No Google Calendar events are written by this release.

## Verification

New regression coverage checks all 52 weeks against source lifting rows, a full 52-week execution, actual bench spacing, order enforcement, delayed sessions, migration with frozen active records, athletics, recovery-only routines, review gates, cloud round trips and Planner projection. The mobile browser test runs B, restores its runner, checks C athletics and Thursday A, restores an offline stretch-only session, and verifies separate taper bench placement. Original source, timing, deletion, storage, integration and offline suites remain required.

Release validation on September 17, 2026: Oly’s complete audit passed all 126 unit checks and 10 browser suites, including 212 executed lifting sessions across the 52-week calendar. Planner passed 22 unit checks and both browser suites. Formatting and dependency audits passed in both repositories with zero reported dependency vulnerabilities. These checks cover the implemented rules and tested paths; they do not establish physiological optimality.
