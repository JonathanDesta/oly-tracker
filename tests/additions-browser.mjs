import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { serve } from "../scripts/serve.js";
const server = serve(0);
await new Promise((r) => server.on("listening", r));
const url =
  process.env.OLY_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
const safari = process.env.OLY_ADDITIONS_ENGINE === "webkit";
const browser = await (safari ? webkit : chromium).launch({
  headless: true,
  ...(safari ? {} : { channel: process.env.OLY_BROWSER_CHANNEL || "chrome" }),
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const dialog = page.locator("dialog");
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
async function seed(established = false, changes = {}) {
  await page.evaluate(
    async ({ established, changes }) => {
      const { fresh } = await import("./src/training.js");
      const s = fresh("2026-09-21", "weekday", "all-failure");
      if (established) {
        Object.assign(s.training, {
          week: 5,
          entry: 3,
          failureEntry: 4,
          failureWeeks: ["one", "two"],
        });
        s.training.scheduleTrial.weeks = ["one", "two"];
        s.reviews = [3, 4].map((week) => ({
          type: "weekly",
          at: Date.now() - (5 - week) * 7 * 86400000,
          weekId: `prior-${week}`,
          week,
          green: true,
          recovery: "normal",
          training: { ...structuredClone(s.training), week },
        }));
      }
      Object.assign(s.training, changes);
      localStorage.setItem("oly_program_v7", JSON.stringify(s));
    },
    { established, changes },
  );
  await page.reload();
}
async function openPlan(name = "athletics") {
  await page
    .getByRole("button", { name: "Add or adjust training", exact: true })
    .first()
    .click();
  await click(`See ${name} plan`);
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(
    await dialog.evaluate((d) => d.scrollWidth > d.clientWidth + 1),
    false,
  );
}
try {
  await page.clock.install({ time: new Date("2026-09-21T15:00:00-05:00") });
  await page.goto(url);
  await seed();
  const original = await read();
  await openPlan();
  assert.match(
    await dialog.innerText(),
    /Build up your lifting first · 1 of 4/,
  );
  assert.match(
    await dialog.innerText(),
    /2 sets of 3 jumps \(6 total\).*3 × 10 m/,
  );
  assert.match(await dialog.innerText(), /Wednesday/);
  assert.equal(
    await dialog.getByRole("button", { name: "Review this change" }).count(),
    0,
  );
  assert.equal(await dialog.locator('select[name="exercise"]').count(), 0);
  await noOverflow();
  await dialog
    .locator("summary", { hasText: "See the progression from the beginning" })
    .click();
  assert.match(
    await dialog.innerText(),
    /3 sets of 3 jumps \(9 total\).*3 × 15 m/,
  );
  await page.screenshot({
    path: "/tmp/oly-guided-athletics.png",
    fullPage: false,
  });
  await click("Close");
  assert.deepEqual((await read()).training, original.training);

  // The waiting reason is visible from Week; users can follow the checklist or
  // explicitly add now without inventing completed preparation.
  await click("Open athletics");
  assert.match(await dialog.innerText(), /Lifting build-up: level 1 of 4/);
  assert.match(await dialog.innerText(), /Full-workload reviews: 0 of 2/);
  assert.match(await dialog.innerText(), /same two full-workload weeks/);
  assert.match(await dialog.innerText(), /0 of 3 recorded/);
  await dialog
    .getByRole("button", { name: "View workout", exact: true })
    .first()
    .click();
  assert.equal(await dialog.isVisible(), false);
  await page.evaluate(async () => {
    const t = await import("./src/training.js");
    const s = JSON.parse(localStorage.getItem("oly_program_v7"));
    let at = Date.now() - 8 * 3600000;
    s.readiness = {
      date: s.weekStart,
      level: "green",
      event: "normal",
      local: "",
    };
    t.startSession(s, "tuesday", "main", at);
    s.active.warmup = true;
    s.active.preparations = s.active.session.rows.map((e) => e.key);
    while (t.nextRow(s.active)) {
      const e = t.nextRow(s.active);
      at += 300000;
      if (e.kind === "quality")
        t.logOlympicSet(
          s,
          {
            weight: 100,
            reps: 3,
            finish: e.id === "cj" ? "jerk_miss" : "miss",
          },
          at,
        );
      else
        t.logSet(
          s,
          { weight: 100, reps: e.repRange[1], endpoint: "failure" },
          at,
        );
    }
    t.finishSession(s, "Synthetic workout awaiting recovery check.", at + 1000);
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await click("Open athletics");
  assert.match(
    await dialog.innerText(),
    /Next-session recovery check is missing/,
  );
  await click("Open workout log");
  assert.match(await dialog.innerText(), /Next-session check/);
  await dialog.locator('[name="normal"]').check();
  await dialog
    .locator('[data-form="followup"] [name="notes"]')
    .fill("Synthetic normal recovery after the next practice.");
  await click("Save follow-up");
  await click("Open athletics");
  assert.match(await dialog.innerText(), /1 of 3 recorded/);
  await click("Add now anyway");
  assert.match(
    await dialog.innerText(),
    /recommended preparation or recovery checks may still be incomplete/,
  );
  await click("Close");
  assert.equal((await read()).training.athletics.enabled, false);
  await click("Open athletics");
  await click("Add now anyway");
  await click("Add to my week");
  assert.match(await dialog.locator(".form-error").innerText(), /Confirm/);
  await dialog.locator('[name="confirmed"]').check();
  await click("Add to my week");
  const chosen = await read();
  assert.equal(chosen.training.athletics.enabled, true);
  assert.equal(chosen.training.failureEntry, 1);
  assert.deepEqual(chosen.training.failureWeeks, []);
  assert.deepEqual(chosen.training.scheduleTrial.weeks, []);
  assert.equal(chosen.reviews.at(-1).change.chooseNow, true);
  assert.match(await page.locator("main").innerText(), /Jumps & accelerations/);
  // Match the existing WebKit harness workaround for offline/SW navigation
  // (#42775); Chromium checks cold offline, WebKit checks persistent reload.
  if (!safari) await context.setOffline(true);
  await page.reload();
  assert.equal((await read()).training.athletics.enabled, true);
  if (!safari) await context.setOffline(false);

  await seed(true);
  await openPlan();
  const proposed = await page.evaluate(async () => {
    const { optionalPreview } = await import("./src/additions.js");
    return optionalPreview(
      JSON.parse(localStorage.getItem("oly_program_v7")),
      "athletic_start",
    );
  });
  await click("Review this change");
  assert.equal(await dialog.locator('input[type="checkbox"]').count(), 1);
  await click("Add to my week");
  assert.match(await dialog.locator(".form-error").innerText(), /Confirm/);
  assert.equal((await read()).training.athletics.enabled, false);
  await dialog.locator('[name="confirmed"]').check();
  await click("Add to my week");
  assert.equal(await dialog.isVisible(), false);
  assert.equal((await read()).training.athletics.enabled, true);
  assert.equal(
    await page
      .locator('[data-action="day"][data-day="thursday"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.match(await page.locator("main").innerText(), /Jumps & accelerations/);
  const actual = await page.evaluate(async () => {
    const { planFor } = await import("./src/training.js");
    const { fixedDay } = await import("./src/timeline.js");
    const s = JSON.parse(localStorage.getItem("oly_program_v7"));
    return fixedDay(
      planFor(s, "thursday", false, Date.now(), false, true),
      s.training,
    ).seconds[0];
  });
  assert.equal(actual, proposed.days[0].afterSeconds);
  await openPlan();
  assert.match(
    await dialog.innerText(),
    /0 of 2 successful main athletic sessions/,
  );
  await dialog.locator("summary", { hasText: "Other athletic goals" }).click();
  await click("Add a second day: 6 jumps only");
  assert.match(await dialog.innerText(), /0 of 2 successful/);
  assert.equal(
    await dialog.getByRole("button", { name: "Add to my week" }).count(),
    0,
  );
  await click("Back to plan");
  await dialog.locator("summary", { hasText: "Keep, reduce or pause" }).click();
  await click("Reduce or pause this work");
  await dialog.locator('[name="reason"]').fill("Reviewing recovery cost.");
  await click("Save reduction");
  assert.equal((await read()).training.athletics.enabled, false);

  await seed(true);
  await openPlan("cardio");
  assert.match(await dialog.innerText(), /Tuesday/);
  assert.match(await dialog.innerText(), /Saturday/);
  await click("Review this change");
  await dialog.locator('[name="confirmed"]').check();
  await click("Add to my week");
  assert.equal((await read()).training.cardio.minutes, 40);
  await openPlan("cardio");
  assert.match(await dialog.innerText(), /0 of 2 weeks reviewed/);
  await noOverflow();
  await click("Close");

  await seed(true);
  await page
    .getByRole("button", { name: "Add or adjust training", exact: true })
    .first()
    .click();
  await click("Adjust lifting sets");
  await dialog.locator("summary", { hasText: "Wednesday" }).click();
  await dialog
    .locator('[data-kind="set"][data-day="thursday"]')
    .first()
    .click();
  assert.equal(await dialog.locator('select[name="exercise"]').count(), 0);
  assert.match(await dialog.innerText(), /sets on Wednesday/);
  await click("Close");

  await seed(true, { week: 8 });
  await openPlan("cardio");
  assert.match(await dialog.innerText(), /Week 8 holds new additions/);
  await click("Close");
  await click("Settings");
  await openPlan();
  await noOverflow();
  await click("Close");
  await seed(true, { week: 12 });
  await openPlan();
  await click("Add now anyway");
  assert.match(await dialog.innerText(), /phase temporarily omits/);
  await dialog.locator('[name="confirmed"]').check();
  await click("Save for future sessions");
  assert.equal((await read()).training.athletics.enabled, true);
  assert.match(
    await page.locator("#toast").innerText(),
    /Saved for future sessions/,
  );
  assert.deepEqual(errors, []);
  console.log(
    `Guided training additions (${safari ? "WebKit" : "Chromium"}): passed; introduction, preview/save timing parity, progression, second-day hold, reduction, cardio, lifting selection, held weeks, actionable preparation checks, explicit add-now choice, ${safari ? "reload" : "offline"} persistence and mobile layout.`,
  );
} finally {
  await browser.close();
  server.close();
}
