# Fixed time targets and guided countdowns

App 7.12 replaces the displayed time ranges with one target per exercise, session and day. These are planned durations, not measurements or a guarantee of completion time. Actual set endpoints still follow the program. All displayed totals use the same whole-second timeline as the countdown.

## Included time

`src/timeline.js` builds the timed steps from the current prescription and frozen timing settings. The sequence covers arrival; general/field warm-up drills; equipment setup and waits; specific warm-up sets and ramp rests; work sets and individual Olympic attempts; within-set resets; between-set recovery; loading/logging beyond recovery; miscellaneous breaks; and final unloading/logging/packing. Mobility has setup, four holds, three 15-second rests and a 20-second planning target for the five active reps. Aerobic moving time stays separate from setup and breaks. No additional cooldown is prescribed by the source.

Default gym waiting targets are 30 seconds for quiet, two minutes for moderate and four minutes for busy conditions. Setup and loading use the selected typical times, with short transitions between related rows. Recovery overlaps transitions and loading where possible. Work-rep planning uses the midpoint of the documented exercise-specific tempo/rep-window allowances; Olympic attempts, CJ pairs, unilateral raises, jumps and cuts have distinct targets. These execution targets never create reps or change the failure endpoint.

General lifting preparation specifies the page-8 movements individually. Specific ramps follow pages 8–9 and the page-27 assessment replacement. Olympic ramps use the first suggested work load, normally the lower end of its band, and omit stages reaching that load. Check the original warm-up instructions against the actual selected work load: a heavier target can need additional 70/80% stages, and optional squat/pull rehearsals are used when needed. Extend the preparation allowance for additional rehearsals. A ramp that reaches the actual work weight can be marked unnecessary with its paired ramp rest. All preparation remains submaximal.

The mock-meet inter-lift allowance is nine minutes before the CJ ramp. Split visits retain their separate overhead and at least three hours between visits outside training time. Same-visit athletics includes the five-minute transition plus the full field warm-up. Daily totals count scheduled mobility and aerobic work once. Travel and unscheduled work are outside the starting target.

## Using the timer

Starting a session begins the arrival/setup countdown. Confirm each preparation step using **Continue timer**; explicit checks finish general and local preparation. **Start timed set** begins the execution target. Tap **Set finished · record result** at the actual end, then save the real result. The next reset/rest starts from that recorded end time, so typing does not add recovery. Without that button, the log timestamp remains the best available end time.

At zero, the clock shows overtime and can sound a cue if sound is enabled. Work is never auto-logged and failure work is never terminated by a clock. The guide prevents advancing a programmed rest before its time is complete. Add time when needed. A small countdown remains visible when scrolling to the outcome form; the Timer button returns to the full controls.

Pause/resume preserves the step target. The session deadline continues to reflect wall time, and the projected finish follows the remaining steps. Timestamps survive reload and offline use. Sound requires an enabled browser audio session; the visible clock and stored timestamps remain the timing record.

**Take a 2-minute break** uses the ten-minute miscellaneous pool, with actual elapsed break time deducted when the break ends. Recovery continues if the break overlaps an existing rest. Longer breaks can use more of the pool; overruns remain visible against the original session target. The remaining pool appears near the end and can be released if unused. Equipment waits can likewise end when equipment becomes available. Paused preparation and interrupted work retain their timing traces; timed steps do not claim unmeasured confirmations.

After more than 15 minutes idle, the source's re-warm-up control provides a four-minute target for two minutes of easy movement and two ascending rehearsals. It pauses/resumes a running guide step and contributes its remaining time to the finish forecast. Actual safety and readiness govern resumption.

Saved timing logs retain measured steps; completed sessions drop their executable queue and unmeasured placeholders to avoid unnecessary journal growth. Session deletion removes the timing record along with its workout. Existing sessions without a guide can enable it for their remaining work.

## Example at the default full Foundation dose

Cycle 1, week 3, full entry dose, one-arm cable laterals, single B/D visit, moderate traffic, ten minutes of miscellaneous time per visit, optional modules disabled:

| Day      | Planned time |
| -------- | ------------ |
| Monday   | 75 min 16 s  |
| Tuesday  | 226 min 8 s  |
| Thursday | 86 min 11 s  |
| Friday   | 232 min 52 s |

A single selected 30-second stretch restriction takes a planned 3 min 50 s on each scheduled mobility day. Other weeks, readiness restrictions, equipment and optional doses produce different totals automatically. Adjust timing settings after observing actual sessions; the defaults have not been calibrated to personal measured durations.

## Verification

Nine pacing regression tests cover fixed totals over 189 phase/readiness/day configurations, source set/rest counts, actual set-end timestamps, no automatic outcomes, persistent pauses, break accounting, readiness reductions, saved-trace compaction and invalid timer rejection. The guided browser suite runs complete preparation, Olympic doubles, recovery during logging, overtime, undo, offline reload, an entire stretch-only session and aerobic moving-time confirmation, with 320/390/768/1440 px layout checks. The prior program, journal, annual execution, migration and deployment suites remain part of the full audit.
