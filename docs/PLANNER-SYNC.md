# Planner integration · App 7.13

Oly remains the only writer of its journal. Planner consumes a versioned read-only scheduling feed and never changes doses, exercise order, rests, readiness or progression.

`src/planner-feed.js` exposes `buildPlannerFeed(state, now)`. Schema 1 (`type: oly:planner-feed`) includes source revision/time, program position, current week identity, actual session dates, prescription signatures, forecast/guided seconds, timing coverage, visit count, completion/active status, and live remaining seconds. Chicago dates are used regardless of the browser timezone. Future Planner projections retain Mon/Tue/Thu/Fri; Oly controls actual postponements and program advancement.

The feed is published to `oly_planner_feed_v1` and to the embedding parent through an origin-checked message. It contains scheduling metadata, not the workout journal. The iframe is not reset by calendar refresh or Planner navigation.

## Duration calibration

The reported introductory A observation is 45 inclusive minutes for the matching default entry prescription. It is a seed observation, not a fabricated journal session or training date. Matching completed records replace it with the median of up to five recent sessions. Unmatched prescriptions use the existing component model; B and D never inherit A's ratio. Equipment, dose, order, rests and unilateral cable timing participate in the signature.

Guided timer targets stay distinct from empirical scheduling forecasts. Existing stage and elapsed-session timing remain automatic. Partial sessions and records flagged for deliberate non-training interruptions are excluded. The active Workout view has an interruption checkbox; Settings also supports excluding completed records. Changing coverage is normalized so the ten-minute Planner allowance is counted once, including mixed samples. Ordinary queues, warm-ups and rests remain part of the measurement.

## Private synchronization

`src/cloud-sync.js` and `src/google-auth.js` are byte-identical to Planner's shared protocol modules. Both apps use the same OAuth web client and Google account, but separate revision namespaces (`oly-v1` and `planner-v2`). Authorization uses `drive.file`; files are private app-created JSON revisions, never published to Git. No Calendar write is made.

Revisions have immutable identities, parent references and per-entity values or deletion markers. Independent records merge. Concurrent edits to the same record and edit/delete races retain alternatives for explicit resolution. Program configuration and an active session are coherent entities; a conflict blocks adoption until resolved. No timestamp is used to replace the whole journal.

Revisions and the offline queue live in IndexedDB. The current journal and existing backup remain in localStorage. If both are absent, a valid current-format journal in the former Planner mirror can be recovered once with a backup; older mirrors are preserved as archives. An existing Oly journal is never replaced by that mirror. Captures occur on substantive changes; synchronization occurs while connected on opening, foregrounding, completion, a debounced change and a visible periodic retry. A token expiry requires the reconnect button. There is no promise of background sync while a closed iPhone app is suspended.

The embedded instance receives its client ID and temporary token from the trusted parent; standalone contexts reconnect as needed. Unsaved forms and open dialogs defer cloud adoption. Journal validation and optimistic storage revisions protect local edits before adoption. Conflicting versions remain in revision history after a choice.

See [Google's token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model). Keep local backups, test journals, OAuth tokens and calendar caches outside public repositories.

## Release and regression checks

Deploy Oly before Planner. Cache `oly-groundup-v7-13` includes the integration modules, only intercepts its own application path and never deletes Planner caches. Existing active-session update guards remain in force.

Run `npm test`, `npm run test:browser`, `npm run format:check` and `npm run check:deployment`. Planner additionally supplies two-device browser tests for IndexedDB reloads, concurrent edits, explicit conflict choices, deletions and offline queues. Simulated requests never touch a real Google account. Original source, 52-week execution, duration, migration, pacing and offline browser tests remain required.
