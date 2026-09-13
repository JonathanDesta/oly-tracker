# Oly Tracker

Revision 6 of the weightlifting-first program, with native workout logging and
offline support. Four Olympic days, two flat-barbell bench days, and conventional
strength/hypertrophy work sets taken to strict-form failure.

Run locally:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/. Run `npm test` for the prescription and persistence
checks. No build step or runtime package installation is needed.

Existing data migrates into an intact previous-program archive. New sessions
start at the Revision 6 entry dose; Settings can select an established position.
Use weekly reviews to advance, hold or reduce the program. Optional athletics,
aerobics and assistance begin only after their eligibility review.

See [PROGRAM-CONFORMANCE.md](PROGRAM-CONFORMANCE.md) for the source audit and
which decisions require your review. See [HANDOFF.md](HANDOFF.md) for program provenance, implementation details,
migration, browser testing and deployment.
