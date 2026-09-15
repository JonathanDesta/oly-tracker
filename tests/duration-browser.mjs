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
  viewport: { width: 1440, height: 1000 },
  timezoneId: "America/Chicago",
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
async function seed(options = {}) {
  await page.evaluate(async (options) => {
    const { fresh } = await import("./src/training.js");
    const s = fresh("2026-09-14");
    Object.assign(s.training, { week: 5, entry: 3, gate: "B", ...options });
    s.training.athletics.enabled = true;
    s.training.cardio = options.cardio || { enabled: true, minutes: 150 };
    s.training.mobility = options.mobility || [
      "Ankle · bent-knee calf stretch, heel down",
      "Front rack · supported wrist stretch or unloaded elbow lifts",
    ];
    s.readiness = {
      date: "2026-09-14",
      level: "green",
      local: "",
      event: "normal",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  }, options);
  await page.reload();
}
try {
  await fs.mkdir("test-results", { recursive: true });
  await page.clock.install({ time: new Date("2026-09-14T10:00:00-05:00") });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await seed();
  for (const day of [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]) {
    await page.locator(`[data-action="day"][data-day="${day}"]`).click();
    if (["wednesday", "saturday", "sunday"].includes(day)) {
      assert.equal(await page.locator(".mobility-row").count(), 2);
      assert.equal(
        await page.locator(".mobility-row strong").first().innerText(),
        "4–5 min per restriction",
      );
      assert.match(
        await page.locator(".mobility-card .duration").innerText(),
        /7–9 min/,
      );
    }
    const expected = await page.evaluate(async (day) => {
      const { planFor } = await import("./src/training.js");
      const { estimateDay, minutesText } = await import("./src/duration.js");
      const s = JSON.parse(localStorage.getItem("oly_program_v7"));
      const p = planFor(s, day, false),
        t = estimateDay(p, s.training);
      return {
        total: minutesText(t.seconds),
        rows: p.sessions.reduce(
          (n, s) =>
            n + (s.skipped || s.kind === "mobility" ? 0 : s.rows.length),
          0,
        ),
      };
    }, day);
    assert.equal(
      await page.locator(".day-time strong").innerText(),
      expected.total,
    );
    assert.equal(
      await page.locator(".exercise-table .exercise-duration").count(),
      expected.rows,
    );
    assert.ok((await page.locator(".day-time").innerText()).includes("breaks"));
  }
  await page.locator('[data-action="day"][data-day="monday"]').click();
  assert.match(await page.locator(".visit-gap").innerText(), /3 hours/);
  const before = await page.locator(".day-time strong").innerText();
  await click("Settings");
  const form = page.locator('[data-form="timing"]');
  assert.equal(await form.locator('[name="traffic"]').inputValue(), "moderate");
  await form.locator('[name="traffic"]').selectOption("busy");
  await form.locator('[name="breakMinutes"]').fill("20");
  await form.locator('[name="athleticsVisit"]').selectOption("same");
  await click("Save time planning");
  assert.equal((await read()).training.timing.breakMinutes, 20);
  await page.reload();
  await click("Week");
  assert.notEqual(await page.locator(".day-time strong").innerText(), before);
  assert.equal(await page.locator(".visit-gap").count(), 0);
  assert.match(
    await page.locator(".day-time").innerText(),
    /5-minute transition/,
  );
  await page.locator(".timing-details > summary").first().click();
  await page.locator(".exercise-timing > summary").first().click();
  assert.match(
    await page.locator(".timing-details").first().innerText(),
    /Specific warm-up/,
  );
  await page.screenshot({
    path: "test-results/timing-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Start session →", exact: true })
    .first()
    .click();
  const starting = await page.locator(".session-budget").innerText();
  await click("Settings");
  await page.locator('[data-form="timing"] [name="breakMinutes"]').fill("40");
  await click("Save time planning");
  await click("Workout");
  assert.equal(await page.locator(".session-budget").innerText(), starting);
  await click("General warm-up complete");
  assert.match(
    await page.locator(".focus-card .exercise-duration").innerText(),
    /Full exercise allowance/,
  );
  // A fresh context uses the new module offline, including a cold reload.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator(".session-budget").innerText(), starting);
  await context.setOffline(false);
  await seed({ split: true });
  await page.locator('[data-action="day"][data-day="tuesday"]').click();
  assert.match(
    await page.locator(".visit-gap").innerText(),
    /2 visits.*3 hours/,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.locator(".timing-details > summary").first().click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (width === 390)
      await page.screenshot({
        path: "test-results/timing-mobile.png",
        fullPage: true,
      });
    await page.locator(".timing-details > summary").first().click();
  }
  await seed({ mobility: [], cardio: { enabled: false, minutes: 40 } });
  for (const day of ["wednesday", "saturday", "sunday"]) {
    await page.locator(`[data-action="day"][data-day="${day}"]`).click();
    assert.equal(await page.locator(".day-time strong").innerText(), "0 min");
    assert.match(
      await page.locator(".mobility-card").innerText(),
      /no mobility restrictions are selected/,
    );
  }
  await click("Choose mobility restrictions");
  await page
    .getByLabel("Ankle · bent-knee calf stretch, heel down", { exact: true })
    .check();
  await click("Save mobility");
  await click("Week");
  for (const day of ["wednesday", "saturday", "sunday"]) {
    await page.locator(`[data-action="day"][data-day="${day}"]`).click();
    assert.equal(await page.locator(".day-time strong").innerText(), "4–5 min");
    assert.equal(
      await page.locator('[data-action="start"][data-id="mobility"]').count(),
      1,
    );
  }
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  assert.equal(await page.locator(".day-time strong").innerText(), "4–5 min");
  assert.equal(await page.locator(".mobility-row").count(), 1);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "test-results/mobility-times-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Time planning browser checks passed: all days, settings persistence, frozen active budget, split/athletic visits, responsive layout and cold offline reload.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
