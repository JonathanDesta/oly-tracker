import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";
const server = process.env.OLY_TEST_URL ? null : serve(0);
if (server) await new Promise((r) => server.on("listening", r));
const url =
  process.env.OLY_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.OLY_BROWSER_CHANNEL || "chrome",
});
const context = await browser.newContext({
  timezoneId: "America/Chicago",
  viewport: { width: 390, height: 900 },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const dialog = page.locator("dialog");
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
async function seed(week = 3, legacy = false) {
  await page.evaluate(
    async ({ week, legacy }) => {
      const { fresh } = await import("./src/training.js");
      const s = fresh("2026-09-14");
      Object.assign(s.training, { week, entry: 3, gate: "R" });
      s.training.mobility = ["Ankle · bent-knee calf stretch, heel down"];
      s.training.athletics.enabled = true;
      s.readiness = {
        date: "2026-09-14",
        level: "green",
        local: "",
        event: "normal",
      };
      if (legacy) {
        delete s.training.schedule;
        delete s.training.scheduleTrial;
      }
      localStorage.setItem("oly_program_v7", JSON.stringify(s));
    },
    { week, legacy },
  );
  await page.reload();
}
try {
  await page.clock.install({ time: new Date("2026-09-14T15:00:00-05:00") });
  await page.goto(url);
  await seed(3, true);
  assert.deepEqual(
    await page.locator(".week-days .day strong").allTextContents(),
    ["B", "C", "—", "A", "D", "—", "—"],
  );
  assert.deepEqual(
    await page.locator(".week-days .day small").allTextContents(),
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  );
  await page
    .getByRole("heading", { name: "B · Clean & jerk + failure work" })
    .waitFor();
  assert.match(
    await page.locator(".day-time").innerText(),
    /preparation, rest, transitions and breaks/,
  );
  await click("Start session →");
  assert.equal((await read()).active.day, "tuesday");
  await page.locator(".pace-card").waitFor();
  await page.reload();
  assert.equal(
    (await read()).active.session.title,
    "B · Clean & jerk + failure work",
  );
  await click("End session early");
  await dialog.locator('[name="reason"]').fill("Synthetic weekday audit");
  await dialog.getByRole("button", { name: "End & save", exact: true }).click();
  const history = (await read()).records;
  await click("Week");
  await page.locator('[data-action="day"][data-day="thursday"]').click();
  await page
    .getByRole("heading", { name: "C · Snatch + rack jerk", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Jumps & accelerations", exact: true })
    .waitFor();
  assert.match(await page.locator(".day-content").innerText(), /Tuesday/);
  await page.locator('[data-action="day"][data-day="monday"]').click();
  await page
    .getByRole("heading", { name: "A · Snatch practice", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Jumps & accelerations", exact: true })
      .count(),
    0,
  );
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  await page.clock.setFixedTime(new Date("2026-09-16T15:00:00-05:00"));
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  await click("Check readiness");
  await dialog
    .getByRole("button", { name: "Apply to today", exact: true })
    .click();
  await page.locator('[data-action="start"][data-id="mobility"]').click();
  await click("Position comfortable · start drill");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  assert.equal((await read()).active.session.kind, "mobility");
  assert.deepEqual((await read()).records, history);
  await context.setOffline(false);
  await seed(12);
  assert.deepEqual(
    await page.locator(".week-days .day strong").allTextContents(),
    ["A", "B", "—", "C", "D", "—", "—"],
  );
  await page
    .getByRole("heading", {
      name: "Taper · Olympic practice + low-rep bench",
      exact: true,
    })
    .waitFor();
  assert.match(
    await page.locator(".day-content").innerText(),
    /Flat barbell bench/,
  );
  await page.locator('[data-action="day"][data-day="thursday"]').click();
  assert.doesNotMatch(
    await page.locator(".day-content").innerText(),
    /Flat barbell bench/,
  );
  await page.locator('[data-action="day"][data-day="saturday"]').click();
  await page
    .getByRole("heading", { name: "Moderate bench", exact: true })
    .waitFor();
  await seed(3);
  await click("Weekly review");
  await dialog
    .getByLabel(
      "C/D quality, receiving positions and first-set output stayed normal under this schedule",
      { exact: true },
    )
    .waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await click("Settings");
  assert.match(await page.locator("main").innerText(), /App 7\.18/);
  assert.equal(
    await page.locator('[data-form="schedule"] [name="schedule"]').inputValue(),
    "weekday",
  );
  await click("Week");
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/weekday-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS weekday browser: migrated calendar, B runner/reload, C athletics, A Thursday, offline stretch-only session, taper bench placement and review controls.",
  );
} finally {
  await browser.close();
  if (server) server.close();
}
