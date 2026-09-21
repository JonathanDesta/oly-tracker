# App 7.16 · failure amendment audit

Audited September 21, 2026 against the user's clarified scope (loaded working sets only) and endpoint (first missed or technically invalid Olympic rep). The implemented prescription and evidence limits are in [FAILURE-CONSTRAINT-REVIEW.md](FAILURE-CONSTRAINT-REVIEW.md). The unchanged PDF remains the source for unaffected rules.

## Results

- `npm run audit`: **passed**. Formatting clean; **134 unit tests**, **11 browser suites**, and dependency audit with **0 reported vulnerabilities**.
- New prescription matrix: all **52 program weeks** across **11 readiness/event contexts**, **4 recovery states**, and **7 days** — **16,016 generated day plans** — retain the amendment endpoint for eligible loaded work. Technique restrictions were checked separately.
- New full-year execution: **196 sessions**, with each retained Olympic set reaching its actual first invalid/missed attempt and every conventional set recording failure. Both weekly bench slots complete with at least 48 actual hours between bench exposures. Taper and pivot follow the amended specification.
- Source compatibility: the existing PDF/calendar runner and 212-session annual execution remain covered for frozen old histories and explicit source fixtures.
- Mobile/offline runner: actual general/local preparation, extra valid reps beyond the nominal budget, load locking, missed jerk, grade-C terminal rep, five-minute recovery, shortened/extended queues, undo, offline reload, complete-session saving, amendment guide and removal of superseded Olympic controls passed. No uncaught browser errors or horizontal overflow in the new mobile scenario.
- Migration: new journals and unstarted old work adopt the amendment immediately. Active old sessions retain their prescription; adoption follows finish/end. Historic rows remain unchanged and cannot supply Olympic failure-progression evidence.
- Timing/Planner: endpoint/reset/recovery fields distinguish new duration signatures from source quality work. All 13 amended week feeds were also passed through the installed **Planner 2.0.3** validator and date selector, including the Monday/Friday/Saturday taper and Monday/Friday pivot. No Planner schema change is required.
- `git diff --check`: passed.

The original source suites exercise their original prescription explicitly. They are regression protection, not evidence that the new failure prescription is the PDF's original prescription. The dedicated amendment tests check the new behavior.

## Limits

These checks passed with no detected discrepancies in the exercised scenarios. They do not prove the absence of every possible software bug, nor do software tests establish physiological optimality. The precise failure-set dose, reset/recovery times, load estimates and special-week changes are practical inferences; equal or superior Olympic performance is not established by the reviewed literature.

Public release verification uses `npm run check:deployment` to compare every served asset with the release and the isolated deployed `failure-browser.mjs` scenario. Saved personal journals are not modified by those synthetic deployment tests.
