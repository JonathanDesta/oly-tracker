import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";
const server = process.env.OLY_TEST_URL ? null : serve(0);
if (server) await new Promise((r) => server.on("listening", r));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.OLY_BROWSER_CHANNEL || "chrome",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const dialog = page.getByRole("dialog");
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
const day = (key) =>
  page.locator(`[data-action="day"][data-day="${key}"]`).click();
async function end() {
  await click("End session early");
  await dialog.locator('[name="reason"]').fill("Synthetic test finished");
  await dialog.getByRole("button", { name: "End & save", exact: true }).click();
}
async function pickBench() {
  await page
    .getByText("All exercises · reps, weights & change order", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Do Flat barbell bench press next",
      exact: true,
    })
    .click();
  await click("Safeties, spotter / safe exit & warm-up checked");
  await page.locator('[data-form="set"] [name="weight"]').fill("150");
  await page.locator('[data-form="set"] [name="reps"]').fill("5");
  await click("Save set");
}
try {
  await page.clock.install({ time: new Date("2026-09-21T12:00:00-05:00") });
  await page.goto(
    process.env.OLY_TEST_URL || `http://127.0.0.1:${server.address().port}/`,
  );
  await click("Start session →");
  assert.equal((await read()).active.context.level, "unchecked");
  await click("General warm-up complete");
  await pickBench();
  await end();
  const first = (await read()).records[0];
  // The next civil day: no readiness form, no wait for Friday, no earlier-slot gate.
  await page.clock.setSystemTime(new Date("2026-09-22T12:00:00-05:00"));
  await click("Week");
  await day("friday");
  await click("Start session →");
  assert.equal((await read()).active.date, "2026-09-22");
  await click("General warm-up complete");
  await pickBench();
  assert.equal((await read()).active.sets[0].exerciseId, "bench");
  assert.deepEqual((await read()).records[0], first);
  assert.equal((await read()).dates.thursday, undefined);
  await end();
  await click("Week");
  await day("tuesday");
  await click("Repeat session");
  assert.equal((await read()).active.repeated, true);
  assert.equal((await read()).records.length, 2);
  // Starting a different session offers a lossless switch, not a disabled button.
  await click("Week");
  await day("thursday");
  await click("Start session →");
  await dialog
    .getByRole("button", {
      name: "Save current & start selected workout",
      exact: true,
    })
    .click();
  assert.equal((await read()).active.day, "thursday");
  assert.equal((await read()).records.length, 3);
  assert.deepEqual((await read()).records[0], first);
  await end();
  await click("Week");
  await day("friday");
  await click("Move this day");
  assert.equal(await dialog.locator('[name="rollLater"]').isChecked(), false);
  await dialog.locator('[name="date"]').fill("2026-09-21");
  await dialog
    .getByRole("button", { name: "Save workout date", exact: true })
    .click();
  assert.equal((await read()).dates.friday, "2026-09-21");
  assert.deepEqual((await read()).records[0], first);
  const feed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oly_planner_feed_v1")),
  );
  assert(feed.entries.every((e) => e.notBefore === null));
  // An adverse check-in offers the full plan explicitly, rather than hiding all starts.
  await page.evaluate(async () => {
    const { fresh } = await import("./src/training.js");
    const s = fresh("2026-09-21", "weekday", "all-failure");
    s.readiness = {
      date: "2026-09-22",
      level: "red",
      event: "normal",
      local: "",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await day("friday");
  await page
    .getByText("Full planned workout · optional override", { exact: true })
    .click();
  await click("Start full planned workout");
  assert.equal((await read()).active.fullPlan, true);
  assert.equal((await read()).active.context.level, "red");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  assert.equal((await read()).active.fullPlan, true);
  await page
    .getByText("Training guidance · you decide", { exact: true })
    .click();
  assert.match(
    await page.locator("main").innerText(),
    /You control whether to proceed/,
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/workout-control-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS workout control: next-day starts and bench logs, optional readiness, any exercise order, repeat logs, lossless session switch, earlier independent dates, Planner guidance, full-plan override, offline persistence and mobile layout.",
  );
} finally {
  await browser.close();
  if (server) await new Promise((r) => server.close(r));
}
