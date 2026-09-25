# Dumbbell-row equipment and alarm review · App 7.21

The user confirmed using chest-supported dumbbell rows because their gym lacks a supported row machine. They also reported inaudible alarms, sound requiring manual activation, and missed alarms outside their iPhone Home Screen app.

## Exercise representation

The user-authorized equipment preference migrates once to chest-supported dumbbell rows on an incline bench. Instructions specify both arms together, a comfortable 30–45° bench angle, chest contact, full comfortable reach, and one dumbbell's weight in the log. Sets, rep ranges, rests and the strict-form failure endpoint are unchanged. The actual variant has its own comparison name, preventing automatic reuse of a machine-row load. The time planner treats it as a dumbbell/bench station. Active and historical prescriptions are not rewritten. Later explicit equipment choices remain available.

## Alarm changes

The old cue was a 250 ms oscillator at gain 0.15. It required a manually enabled audio context and a visible Workout countdown element; changing the app screen could prevent it entirely.

The replacement defaults to enabled at full app volume and uses a three-beep pattern every four seconds, for up to one minute or until acknowledged. A complete PCM audio track contains the remaining delay followed by the alert. Playback starts from the session/control interaction, so reaching zero does not depend on executing background JavaScript. The waveform stays below clipping and includes short attack/release envelopes. Quieter app settings scale the actual audio samples because [Apple documents that iOS does not expose programmatic media-element volume control](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html). Phone media volume and output routing still determine audibility.

Deadlines use the saved clock, including pause offsets and extra time. Guided preparation steps, working sets, rests, moving time, mobility, manual preparation, and miscellaneous breaks are covered. A set's early ending transfers to recovery without adding another set or marking work complete. Skipping, pausing, extending or ending cancels the previous track; expired alarms are acknowledged without altering the journal. A paused/unstarted timer has no pending audio. Returning after interrupted media reconciles the saved wall-clock deadline. Blocked playback exposes a Resume control instead of silently consuming the cue. Sound/volume preferences persist on this device across workouts and offline reloads.

## iPhone limits

This remains a static Home Screen web app, not a native Clock/AlarmKit application. Audio uses the browser's media playback path and, where available, `audioSession.type = "playback"`. That can affect other audio applications. Incoming calls, competing music, OS/browser policy, or closing the app can interrupt playback. An expired track is not a guaranteed OS-scheduled alarm. The app explicitly offers a 10-second locked-screen test and advises using the native Clock timer or keeping the app visible until that test succeeds on the user's actual setup.

[MDN's Audio Session documentation](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession) describes platform audio coexistence and interruption. [WebKit's iOS Web Push documentation](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) describes the separate push/permission path; no push service or server has been provisioned in this release. Browser notifications alone do not schedule a future wake-up. No notification or microphone permission is requested for this implementation.

## Verification scope

Unit checks cover default/persistent preferences, absolute deadlines, pause/resume/extension/breaks, distinct preparation clocks, recovery identity, waveform duration/levels/repetition, blocked playback/retry, acknowledgement, cancellation, interrupted-audio reconciliation, and one-time row migration with frozen records.

The new browser suite checks actual media progression past the alarm time while Chromium's page lifecycle is frozen; WebKit checks media progression with another tab foregrounded. Both verify the row form and stored per-dumbbell load, continued alarms on Settings, deadline changes, cancellation, reload persistence, and mobile layout. Chromium also checks cold offline reload. Playwright WebKit's offline navigation is excluded because of its [documented service-worker offline emulation defect](https://github.com/microsoft/playwright/issues/42775); online WebKit reload is still checked. These are browser-engine tests, not tests on the user's physical iPhone. Actual locked-screen audibility remains to be checked using the in-app test.

Final release audit on September 25, 2026: formatting passed; all 168 unit tests and all 15 browser runs passed; dependency audit reported zero vulnerabilities. The Safari-engine layout check also caught and resolved long select-option text expanding the narrow screen. A background-media run during development was interrupted or resynchronized on return, reinforcing that the passing engine tests do not establish guaranteed delivery on a physical iPhone.
