# Workout control · App 7.22 · September 26, 2026

The user explicitly requested removal of restrictions preventing a workout the day after a previous session and other unwanted workout lockouts. This amendment supersedes the original document's mandatory calendar enforcement. The training plan still supplies the recommended exercises, doses, recovery and order; the user decides when to run it.

## Behavior

- Start a planned session before its date, after its date, on consecutive days, or before earlier slots are resolved. Split assistance, athletics, aerobic work and mobility do not require completing another session first.
- Readiness is optional. A missing check-in remains `unchecked`; an adverse check-in remains adverse. The app never fabricates green readiness to permit a start or a saved set.
- Readiness reductions remain the suggested plan. The week view offers the full original plan as an explicit alternative, including on future-dated tabs. An active reduced workout can also restore the full plan. Existing sets and deliberate omissions stay intact, and later readiness entries do not silently remove work from an explicitly selected full plan.
- The 48-hour bench interval is guidance. Both starting and logging bench remain available. Actual prior timestamps, including archived logs, still inform the displayed recommendation.
- Repeat a resolved workout without deleting its previous record. Every run gets its own identity, actual date and set log. The full repeated workout includes its bench slot even when that slot was already performed.
- Move a day earlier or later. Other dates stay unchanged unless the user selects the option to shift later unfinished days. Starting a late workout no longer silently moves the rest of the week. Completed logs retain their actual dates.
- Choose any unfinished Olympic or conventional exercise next, including before finishing another exercise's remaining sets. A currently running set must be recorded before switching so its result is not lost. The original prescription remains in the snapshot.
- Starting another workout while one is open offers a switch that saves the current workout as unfinished, including its actual sets. The journal retains one active session rather than overwriting one.
- Olympic recovery recommendations do not reject actual set logs. Existing early-rest controls retain measured recovery times.
- Planner receives `notBefore: null`. Its separate `recommendedAfter` carries the suggested bench interval without preventing scheduling.

## Record integrity

Valid dates, actual positive weights and valid outcome fields are still required. An explicit repeat prevents an accidental second start from silently duplicating a slot. Program dosing, failure endpoints, progression reviews, and the source PDF are not rewritten by this scheduling amendment. Readiness and outcome evidence still determine whether a logged exposure supports automatic progression.

The recommended plan and the selected workout can differ. Full-plan overrides are recorded on the session, with the real check-in and guidance retained. The app does not claim that choosing less recovery improves training outcomes.

## Verification

The focused unit suite covers next-day starts, stale/missing check-ins, bench logging within 48 hours, separate repeat records, earlier dates with and without rolling later days, adverse-readiness overrides and restoring a reduced active workout without losing actual sets or deliberate omissions.

The focused browser suite exercises the actual mobile controls for these flows, including lossless session switching, Planner output, a future-dated full-plan override, and cold offline reload. Existing source-prescription tests retain their dose expectations; previous tests that required schedule lockouts now assert the authorized user-controlled behavior.

Release audit: formatting passed, all 174 unit tests and 16 browser runs passed, and the dependency audit reported zero vulnerabilities. The browser runs include the existing alarm checks in Chromium and WebKit. These checks establish the tested behaviors, not a guarantee against every possible defect.
