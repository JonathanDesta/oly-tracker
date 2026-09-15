import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";
const server = serve(0);
await new Promise((resolve) => server.on("listening", resolve));
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
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
async function seed(date, mobility = true) {
  await page.clock.setSystemTime(new Date(`${date}T10:00:00-05:00`));
  await page.evaluate(
    async ({ date, mobility }) => {
      const { fresh } = await import("./src/training.js");
      const s = fresh("2026-09-14");
      s.training.mobility = mobility
        ? ["Ankle · bent-knee calf stretch, heel down"]
        : [];
      s.readiness = { date, level: "green", local: "", event: "normal" };
      localStorage.setItem("oly_program_v7", JSON.stringify(s));
    },
    { date, mobility },
  );
  await page.reload();
}
try {
  await fs.mkdir("test-results", { recursive: true });
  await page.clock.install({ time: new Date("2026-09-16T10:00:00-05:00") });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await seed("2026-09-16");
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  assert.equal(
    await page.locator(".day-time strong").innerText(),
    "3 min 50 s",
  );
  assert.equal(await page.locator(".session-card").count(), 1);
  await click("Start session →");
  assert.equal(
    await page
      .getByRole("button", { name: "General warm-up complete", exact: true })
      .count(),
    0,
  );
  await click("Position comfortable · start drill");
  assert.equal(await page.locator("#mobility-clock").innerText(), "0:30");
  assert.equal(await page.locator("#mobility-next").isEnabled(), false);
  await page.screenshot({
    path: "test-results/stretch-run-mobile.png",
    fullPage: true,
  });
  for (const [index, seconds] of [30, 15, 30, 15, 30, 15, 30, 20].entries()) {
    if (index === 2) {
      await page.evaluate(async () => navigator.serviceWorker.ready);
      await page.reload();
      await context.setOffline(true);
      await page.reload();
      assert.equal((await read()).active.mobilityRun.index, 2);
    }
    await page.clock.fastForward(seconds * 1000);
    await click(
      index === 7 ? "Five active reps complete · save drill" : "Continue",
    );
  }
  assert.equal((await read()).active.sets[0].holds, 4);
  assert.equal((await read()).active.sets[0].stepLog.length, 8);
  await click("Finish session");
  await page
    .locator('dialog [name="notes"]')
    .fill("Position rechecked; comfortable.");
  await page
    .locator("dialog")
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  assert.equal((await read()).records[0].status, "complete");
  await context.setOffline(false);
  await click("History");
  await page.locator(".record-list button").first().click();
  assert.match(
    await page.locator("dialog").innerText(),
    /4 × 30 s holds · 5 active reps/,
  );
  await page
    .locator("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await seed("2026-09-14", false);
  await click("Start session →");
  await click("Run warm-up");
  await page.clock.fastForward(120000);
  await click("Pause preparation");
  await page.clock.fastForward(60000);
  assert.equal(await page.locator("#preparation-clock").innerText(), "9:15");
  await page.reload();
  assert.equal(await page.locator("#preparation-clock").innerText(), "9:15");
  await click("Resume preparation");
  await page.clock.fastForward(300000);
  await click("General warm-up complete");
  assert.ok(
    Math.abs((await read()).active.preparationLog[0].seconds - 420) < 2,
  );
  await click("Run exercise preparation");
  await page.clock.fastForward(180000);
  await click("Warm-up, setup & local readiness checked");
  assert.ok(
    Math.abs((await read()).active.preparationLog[1].seconds - 180) < 2,
  );
  assert.match(
    await page.locator(".preparation-ledger").innerText(),
    /General \/ field warm-up/,
  );
  await page.screenshot({
    path: "test-results/warmup-run-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await seed("2026-09-16");
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  await click("Start session →");
  await click("Position comfortable · start drill");
  await page.clock.fastForward(30000);
  await click("Continue");
  await page.clock.fastForward(5000);
  await click("Stop mobility");
  await page
    .locator('dialog [name="reason"]')
    .fill("Position became uncomfortable.");
  await page
    .locator("dialog")
    .getByRole("button", { name: "End & save", exact: true })
    .click();
  const partial = (await read()).records[0];
  assert.equal(partial.status, "partial");
  assert.equal(partial.mobilityPartials[0].steps.length, 1);
  assert.equal(partial.sets.length, 0);
  // A non-lifting day can run both its aerobic prescription and stretches.
  await seed("2026-09-16");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oly_program_v7"));
    s.training.cardio = { enabled: true, minutes: 150 };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  assert.equal(await page.locator('[data-action="start"]').count(), 2);
  assert.match(
    await page.locator(".day-time").innerText(),
    /targeted mobility/,
  );
  await page.locator('[data-action="start"][data-id="cardio"]').click();
  assert.equal(
    await page
      .getByRole("button", { name: "Run warm-up", exact: true })
      .count(),
    0,
  );
  await click("Start moving time");
  await page.clock.fastForward(600000);
  await click("Pause moving time");
  await page.clock.fastForward(120000);
  assert.equal(await page.locator("#aerobic-clock").innerText(), "20:00");
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator("#aerobic-clock").innerText(), "20:00");
  await click("Resume moving time");
  await page.screenshot({
    path: "test-results/aerobic-run-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.clock.fastForward(1200000);
  assert.match(
    await page.locator("#aerobic-target").innerText(),
    /Target reached/,
  );
  await click("Stop & review moving time");
  assert.equal(
    await page.locator('dialog [name="minutes"]').inputValue(),
    "30",
  );
  await click("Save moving minutes");
  const aerobic = (await read()).active.sets[0];
  assert.ok(Math.abs(aerobic.timedSeconds - 1800) < 2);
  assert.ok(Math.abs(aerobic.pausedSeconds - 120) < 2);
  assert.equal(aerobic.minutes, 30);
  assert.equal(aerobic.timingMethod, "timed-confirmed");
  await click("Log already completed minutes");
  await click("Save moving minutes");
  await click("Finish session");
  await page
    .locator("dialog")
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  const cardio = (await read()).records[0];
  assert.equal(cardio.status, "complete");
  assert.deepEqual(
    cardio.sets.map((r) => r.minutes),
    [30, 10],
  );
  await click("Week");
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  assert.equal(
    await page.locator('[data-action="start"][data-id="mobility"]').count(),
    1,
  );
  await page.locator('[data-action="start"][data-id="mobility"]').click();
  await click("Position comfortable · start drill");
  assert.equal(await page.locator("#mobility-clock").innerText(), "0:30");
  await context.setOffline(false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS routine runner: stretch-only start, timed holds/rests, active reps, offline recovery, journal, partial stop, paused/resumed warm-ups and moving-time aerobics with separate walk and mobility sessions.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
