# Deployment

The public tracker is https://jonathandesta.github.io/oly-tracker/. GitHub Pages serves the repository root from `main`. Changing the local preview at http://127.0.0.1:8766/ does not publish it.

Before a release, run `npm run audit` and `git diff --check`. Commit the reviewed release and update `main` without rewriting its history. Wait for the Pages build for that exact commit to complete, then run `npm run check:deployment`. This verifies the HTML, styles, icon, manifest, all application modules, bundled source files and service worker against local bytes. A failed check means the public deployment is not yet verified, regardless of local test results.

The `/oly-tracker/` browser test verifies the real hosting path, settings migration, stretch-only Start buttons and offline session recovery. App 7.10 preserves compatible old Revision 6 settings and maps the old stretch names to the new controls. Original old journal data remains intact; incompatible fields are recorded for review. New-format journals always take precedence.

Old installed clients can retain an already loaded release. After finishing any active workout, close all tracker tabs/windows and reopen the public URL. App 7.12 exposes its build and an update check in Settings; future waiting updates can be activated there. Do not clear site storage to update the code.

To verify session deletion on the deployed release without touching a personal journal, run `OLY_TEST_URL=https://jonathandesta.github.io/oly-tracker/ node tests/deletion-browser.mjs`. This uses a fresh isolated browser context and synthetic logs.

For the fixed targets and guided timers, run `OLY_TEST_URL=https://jonathandesta.github.io/oly-tracker/ node tests/pacing-browser.mjs`. It verifies the deployed runner using an isolated synthetic journal.
