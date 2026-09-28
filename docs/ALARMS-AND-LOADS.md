# App 7.24 · music, online timer notifications and load recommendations

This September 27 user amendment supersedes earlier load-progression increments,
repeat-exposure requirements and held-week recommendation rules. It does not
change set counts, rep windows, endpoints or exercise selection.

## Load recommendations

Use the most recent comparable workout in chronological order. Increase 10 lb
when every working set meets or exceeds the upper rep bound. If any completed
working set is below the lower bound, decrease 10 lb from the final working
weight. Otherwise repeat that weight. With dumbbells, the logged weight is per
hand and the change is 5 lb per hand (10 lb for the pair). Recommendations are
editable. The user's barbell plate increment does not round away this change.

The previous workout's prescribed set count determines completeness, even when
the upcoming ramp stage prescribes more sets. An incomplete exercise, omitted
set, pain/safety stop or fatigue stop cannot earn an increase. Olympic sets count
only valid reps before the first missed/invalid attempt, not that terminal
attempt. A reduction that would leave a nonpositive weight prompts selection of
an available lighter load. Setup/rep-window changes still begin a separate
comparison. Deleting a workout removes it from recommendations.

## Music and foreground sound

Removed the media element containing minutes of silence and the exclusive
`playback` audio session. A user interaction prepares Web Audio in the mixable
`ambient` session; no audio source starts until the countdown expires while the
page is visible. The repeating alert stops on acknowledgement, cancellation,
changed timers or mute. A blocked/suspended audio context gives a visible
resume action. Volume scales the audio samples. iPhone ambient audio observes
Silent mode. Media volume controls foreground alerts.

[W3C Audio Session](https://www.w3.org/TR/audio-session/) distinguishes exclusive
playback from mixable ambient sessions.
[WebKit's implementation discussion](https://bugs.webkit.org/show_bug.cgi?id=264473)
describes mixing with Music and the silent-switch behavior. Desktop tests cannot
verify a physical iPhone's headphones, Apple Music or notification settings.

## Online background notifications

The GitHub Pages frontend stays in place. `notifications/worker.js` runs on
Cloudflare Workers with one SQLite Durable Object per device. Its alarm stores
one absolute timer deadline independently of the page. The service uses
standard encrypted Web Push and private VAPID credentials. The app's service
worker always displays a visible notification for a received push and opens or
focuses the app when tapped. The next exercise never starts automatically.

Connect each Home Screen installation once in Settings → Alarms using the
private connection code and allow notifications. A ten-second test is included.
The alarm switch controls both foreground and background alerts. Pausing,
skipping, muting, acknowledging or finishing cancels the pending server timer;
extending/resuming replaces it. A monotonic request revision prevents a delayed
older update from restoring a cancelled timer. The app displays confirmation
only after the server saves the countdown. Offline errors remain visible and
retry. Never claim an unsaved countdown is protected in the background.

Only an opaque timer identifier, deadline and push subscription are sent. There
are no exercise names, rep counts, workout logs or Google credentials in this
service. The pairing secret authorizes registration; a random device credential signed by the service
authorizes changes before any device storage is accessed. Credentials are device-local and excluded from journal
exports/cloud sync. The server validates subscription hosts and keys, does not
follow provider redirects, limits requests, and restricts browser origins. It
removes subscriptions rejected as revoked and drops alarms more than a minute
late. Push TTL is 30 seconds; retries use the same notification tag.

Notifications require network availability, permission and allowed iPhone
notification/Focus settings. iOS chooses the background notification sound; a
web app cannot give it the repeating custom foreground alarm or bypass Focus.
Delivery timing is not guaranteed. An already transmitted notification cannot
be recalled, including when an offline cancellation has not reached the server.

Apple supports Web Push for iOS 16.4+ Home Screen apps:
[Apple documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers),
[WebKit announcement](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
Server alarms use [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/api/alarms/).

## Operation and validation

Run `npm run setup` to install both dependency sets. Run `npm run audit` for
formatting, unit tests, all browser workflows and both dependency audits.
Notification tests cover authentication, endpoint validation, encryption,
ordering, pause/cancel, retry/expiry and subscription revocation. Browser tests
cover connection controls and actual service-worker notification display after
the app page closes, using a synthetic push. Chromium and desktop WebKit test
foreground timer controls, silence during countdowns and offline preferences.
A physical iPhone test with Apple Music, followed by locking the screen, remains
necessary to verify that device's settings and final APNs delivery.

To redeploy the service, use `npm run deploy --prefix notifications` after
Cloudflare sign-in. `notifications/wrangler.jsonc` contains only public
configuration. `src/push-config.js` contains only the public service URL.
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and PAIRING_CODE are Worker secrets.
The local deployment copy is the ignored `notifications/.secrets.json` (mode
0600); never commit it or include it in a web deployment. Existing subscriptions
are tied to the VAPID key, so retaining that key avoids re-pairing devices.
