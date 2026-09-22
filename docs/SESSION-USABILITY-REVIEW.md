# Session usability and Olympic load selection · App 7.20

The user reported that the first Monday's Olympic sets became limited by exhaustion, that the repeated warm-ups felt excessive, and that logging and navigating the workout were difficult. The user explicitly retained the miss/form-failure requirement and requested self-selection of Olympic weights.

## Prescription decisions

- **Self-selected working weight:** no Olympic starting percentage is imposed. The user selects the weight before the exercise; the runner derives lighter warm-up loads from it. Prior weights and rep counts are references. The weight stays fixed once work begins. Foundation's 2–4 good reps, Build's 1–3 and Realization's 1–2 remain weight-selection guides, not automatic stopping points.
- **Honest endpoints:** one good clean-and-jerk rep includes both lifts. A higher/power catch is not evidence of insufficient power. A changed catch can differ from the prescribed full lift without demonstrating an inability to produce power. The app distinguishes a miss, a form change, a breathing/burning stop and pain. No timer, rep count or subjective burning measures isolated power failure.
- **Between-rep rest:** new Olympic sessions recommend 40 seconds instead of 15. [Hardee et al.](https://pubmed.ncbi.nlm.nih.gov/23121475/) studied 0/20/40-second rests during power-clean sets and supports using between-rep rest to help preserve technique. This is limited acute evidence, not validation of full snatch/CJ sets to failure or proof that 40 seconds is individually optimal. Five minutes remains the work-set recovery recommendation. Early endings are user-controlled and recorded honestly.
- **Shorter preparation:** general preparation once. The first Olympic lift uses two light-bar reps plus singles at 50%, 70% and 85% of the chosen work weight. The second uses its own light-bar check plus singles at 60% and 85%. Duplicate loads are omitted. These exact steps are adjustable programming inferences; [warm-up research](https://pubmed.ncbi.nlm.nih.gov/39864808/) does not identify one universal optimal protocol. The second lift still needs practice of its distinct catch/overhead positions.
- **Starting-load corrections:** a completed above-range first set can suggest one small increase during introduction after normal follow-up recovery is recorded. Fatigue/pain stops do not earn an automatic increase. Comparable new-protocol results follow the lift across weekdays. Old 15-second results remain visible as references, without being treated as equivalent 40-second progression tests.
- **Set counts unchanged:** all prescribed exercise/muscle counts and phase reductions remain as in the whole-week recommendation. No new failure tests or replacement sets are added.

## Runner and records

- “Log completed set” accepts the total good reps and the reason the set ended. Each rep entry is marked as part of a user-reported total; individual effort ratings and rep times are not invented. The existing individual-rep runner remains available.
- History offers “Correct rep count” for logged Olympic sets. Corrections preserve original entries, and do not fabricate a workout that was never recorded.
- “Ready · skip warm-up rest” and the bottom bar's “Skip rest” are immediately available. Early work-rest endings retain the actual elapsed time and prescribed target in the record.
- “All exercises · reps, weights & change order” is available throughout the session, including preparation. “Do next” moves an available unfinished strength/assistance exercise without deleting displaced work. Olympic work stays first; wrist work stays after grip-dependent work. A started exercise's sets must be finished or explicitly stopped before switching.
- New sessions use the new preparation/loading protocol. Active and historical prescriptions remain frozen. The original PDF is unchanged.

## Verification

Regression checks cover self-selected/rounded weights, first-versus-second lift warm-ups, six completed CJ pairs followed by a jerk miss, fatigue stops, correction history, between-day load references, early-rest records, reordering without lost work, mobile layout and offline persistence. The full source and amended-year suites also remain part of the release gate. Published files and the new mobile flow are checked again after deployment.

The final local release audit passed on September 21, 2026: 160 automated tests, all 13 browser suites, formatting checks, and a dependency audit with zero reported vulnerabilities. Additional regressions verify that readiness changes retain the user's selected weight, corrections do not mark incomplete strength work complete, and selecting a saved set restores its actual ending and notes. Passing these checks supports the tested behavior; it does not establish a personal training optimum or guarantee the absence of every possible bug.
