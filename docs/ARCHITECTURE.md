# Architecture

The rebuild separates the source prescription from the actual training record. It retains source-verified exercise descriptions and tables as data; the former application, model, prescription engine, cloud-sync integration, interface and tests were replaced.

| Module                | Responsibility                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/catalog.js`      | Exercise names, source execution cues, base accessory doses, warm-ups                                                                               |
| `src/prescription.js` | Pure phase templates, entry ramp, substitutions, optional work, then stricter readiness/event rules                                                 |
| `src/training.js`     | Dated sequence, actual bench spacing, immutable session snapshots, attempt accounting, progression, repeat/recovery transitions                     |
| `src/review.js`       | Explicit eligibility reviews, one-domain changes, bounded assistance trials and continuity                                                          |
| `src/duration.js`     | Exercise, session and whole-day planning ranges; visit gaps, preparation, waiting and mobility counted once                                         |
| `src/routines.js`     | Preparation stopwatches and trace validation for timed mobility holds/rests                                                                         |
| `src/storage.js`      | Schema validation, transactional persistence, backup recovery, stale-tab detection, legacy archives                                                 |
| `src/app.js`          | Accessible forms, source reader, session logging, history, timer and backup UI                                                                      |
| `sw.js`               | Versioned offline shell and source document; activation waits for old clients to close or explicit update action; active workouts block that action |
| `scripts/serve.js`    | Local static server, including nested modules and PDF MIME types                                                                                    |

A workout freezes its prescription, original prescription, anchors, increment and readiness context at start. Live readiness changes can reduce or omit remaining work. Every attempt has its own timestamp; actual bench attempts govern spacing. Configuration changes cannot mutate a saved workout. The original snapshot also survives a technical-benchmark or easy-return adjustment.

All UI writes clone the current state, perform the operation, validate it, then persist before updating the displayed state. An invalid import or failed storage write cannot replace the in-memory journal. The previous valid storage value is kept as a fallback. Cross-tab version checks reject stale writes.

The plan deliberately asks the lifter to assess positions, safe release, next-session response, video observations, and the value of a dose trial. These facts cannot be inferred reliably from repetition arithmetic. Source rules govern the allowed changes; recorded reviews supply those observational decisions. No invented 1RM conversion, fatigue-clearance score, or automatic calendar deload is used.

Mobility is a distinct session and row kind. Its runner stores each completed hold/rest separately from barbell work, then logs the completed drill after five active reps. Early termination retains completed steps and the interrupted-step time without inventing completed holds. Preparation logs distinguish timed, externally confirmed and interrupted work; timer state and partial routines survive reload/import. Optional fields preserve compatibility with existing schema-7 journals.

Aerobic sessions use an independent resumable moving-time clock and confirmed-minute entries. Timer traces retain paused versus unpaused time; shortened bouts are partial, while stopped unconfirmed traces do not claim a moving dose. Cardio shares its easy start with the moving dose instead of adding a lifting warm-up. Update activation checks the saved journal for an active session to protect workouts opened in another tab.

When upgrading the original published Revision 6 journal, compatible saved settings are validated individually and restored, with canonical names for mobility controls. The newest valid-format legacy mirror supplies settings; original journals remain unchanged in archives. A new-format journal always wins over legacy data. Deployment verification compares every cached resource against the published server; the subpath browser suite covers `/oly-tracker/`.
