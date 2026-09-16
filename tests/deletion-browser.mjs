import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";

// OLY_TEST_URL also exercises the published release using an isolated journal.
const server = process.env.OLY_TEST_URL ? null : serve(0);
if (server) await new Promise((resolve) => server.on("listening", resolve));
const url =
  process.env.OLY_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.OLY_BROWSER_CHANNEL || "chrome",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 900 },
  timezoneId: "America/Chicago",
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
const endEarly = async () => {
  await click("End session early");
  await page.locator('dialog [name="reason"]').fill("Synthetic test run only");
  await click("End & save");
};
try {
  await fs.mkdir("test-results", { recursive: true });
  await page.clock.install({ time: new Date("2026-09-14T10:00:00-05:00") });
  await page.goto(url);
  await page.evaluate(async () => {
    const { fresh, omissionRecord } = await import("./src/training.js");
    const s = fresh("2026-09-14");
    s.readiness = {
      date: "2026-09-14",
      level: "green",
      event: "normal",
      local: "",
    };
    omissionRecord(
      s,
      "friday",
      "main",
      "Earlier week record to keep",
      Date.now() - 7 * 86400000,
    );
    s.records[0].id = "older-record";
    s.records[0].weekId = "older-week";
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await click("Settings");
  assert.match(await page.locator("main").innerText(), /App 7\.13/);
  await click("Week");
  await page.locator('[data-action="day"][data-day="monday"]').click();
  await click("Start session →");
  await page.clock.fastForward(5000);
  await endEarly();
  const saved = await read(),
    testId = saved.records.at(-1).id;
  assert.equal(saved.records.at(-1).sets.length, 0);
  await click("Week");
  await click("View log");
  await click("Delete session");
  assert.match(
    await page.locator("dialog").innerText(),
    /slot in this week will be available/,
  );
  await click("Keep session");
  assert.deepEqual(
    (await read()).records,
    saved.records,
    "cancel keeps the entire log",
  );
  await click("Delete session");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "test-results/delete-session-mobile.png",
    fullPage: true,
  });
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await click("Delete session permanently");
  assert.deepEqual(
    (await read()).records,
    [saved.records[0]],
    "only the selected session is removed",
  );
  await page.reload();
  assert.equal(
    await page.locator('[data-action="start"][data-id="main"]').count(),
    1,
  );
  await click("Start session →");
  assert.notEqual(
    (await read()).active.id,
    testId,
    "same slot starts a fresh workout offline",
  );
  assert.equal((await read()).active.session.id, "main");
  await click("History");
  await page.locator('.record-list button[data-id="older-record"]').click();
  await click("Delete session");
  await click("Delete session permanently");
  assert.match(
    await page.locator("#toast").innerText(),
    /Finish the active session/,
  );
  assert.equal(
    (await read()).records.length,
    1,
    "active workout protects the saved state",
  );
  await page
    .locator("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await click("Workout");
  await endEarly();
  await page.locator('.record-list button[data-id="older-record"]').click();
  await click("Delete session");
  assert.match(
    await page.locator("dialog").innerText(),
    /current program week will stay unchanged/,
  );
  await click("Delete session permanently");
  assert.equal((await read()).weekId, saved.weekId);
  assert.equal((await read()).records.length, 1);
  assert.equal((await read()).records[0].weekId, saved.weekId);
  await page.reload();
  assert.equal((await read()).records.length, 1);
  assert.deepEqual(errors, []);
  const result = {
    url,
    appBuild: "7.13",
    cancellation: true,
    offlineDeletion: true,
    offlineRestart: true,
    retainedRecordIntact: true,
    activeSessionProtected: true,
    olderWeekUnchanged: true,
    errors,
  };
  await fs.writeFile(
    "test-results/deletion-browser.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    "PASS session deletion: confirmation/cancel, current-week restart, persistence offline, unrelated history, active-session protection, older-week deletion and mobile layout.",
  );
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
