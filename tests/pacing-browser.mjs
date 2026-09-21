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
  viewport: { width: 390, height: 900 },
  timezoneId: "America/Chicago",
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
const stage = async () => {
  const w = (await read()).active;
  return w.pacing.plan.find((s) => s.id === w.pacing.currentId);
};
async function seed(date, mobility = false, cardio = false) {
  await context.setOffline(false);
  await page.clock.setSystemTime(new Date(`${date}T10:00:00-05:00`));
  await page.evaluate(
    async ({ date, mobility, cardio }) => {
      const { fresh } = await import("./src/training.js");
      const s = fresh("2026-09-14", "source");
      s.training.mobility = mobility
        ? ["Ankle · bent-knee calf stretch, heel down"]
        : [];
      s.training.cardio.enabled = cardio;
      s.readiness = { date, level: "green", event: "normal", local: "" };
      localStorage.setItem("oly_program_v7", JSON.stringify(s));
    },
    { date, mobility, cardio },
  );
  await page.reload();
}
async function continuePrep() {
  for (let guard = 0; guard < 100; guard++) {
    const x = await stage();
    if (["work", "aerobic", "mobility"].includes(x?.role)) return;
    assert.ok(x, "a work stage must follow preparation");
    await page.clock.fastForward(Math.max(1, x.seconds) * 1000);
    await click(
      x.role === "general-check"
        ? "Confirm general preparation"
        : x.role === "prepare-check"
          ? "Confirm exercise preparation"
          : "Continue timer",
    );
  }
  throw Error("Preparation did not reach work");
}
async function saveAttempt() {
  await page.locator('[data-form="set"] [name="weight"]').fill("100");
  await page.locator('[data-form="set"] [name="effort"]').fill("6");
  await click("Save attempt");
}
try {
  await fs.mkdir("test-results", { recursive: true });
  await page.clock.install({ time: new Date("2026-09-14T10:00:00-05:00") });
  await page.goto(url);
  await seed("2026-09-14");
  assert.doesNotMatch(await page.locator(".day-time strong").innerText(), /–/);
  await click("Start session →");
  assert.equal(await page.locator("#pace-clock").innerText(), "4:00");
  await page.clock.fastForward(10000);
  await click("Take a 2-minute break");
  assert.equal(await page.locator("#pace-clock").innerText(), "2:00");
  await page.clock.fastForward(30000);
  await click("Finish break · resume");
  assert.equal(Math.round((await read()).active.pacing.breakUsed), 30);
  assert.equal(await page.locator("#pace-clock").innerText(), "3:50");
  await continuePrep();
  assert.equal((await read()).active.warmup, true);
  assert.ok(
    (await read()).active.preparationLog.some(
      (x) => x.key === "general" && x.method === "timed",
    ),
  );
  assert.equal((await stage()).attempt, 0);
  await click("Start timed set");
  await page.clock.fastForward(10000);
  await click("Set finished · record result");
  const ended = (await read()).active.pacing.workEndedAt;
  await page.clock.fastForward(5000);
  await saveAttempt();
  assert.equal((await read()).active.sets[0].at, ended);
  assert.equal((await stage()).role, "rest");
  assert.equal(await page.locator("#pace-clock").innerText(), "0:10");
  assert.equal(await page.locator("#pace-next").isEnabled(), false);
  await page.clock.fastForward(10000);
  await click("Continue timer");
  await click("Start timed set");
  await page.clock.fastForward(3000);
  await click("Pause countdown");
  const frozen = await page.locator("#pace-clock").innerText();
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.clock.fastForward(60000);
  assert.equal(await page.locator("#pace-clock").innerText(), frozen);
  await click("Resume countdown");
  await page.clock.fastForward(60000);
  assert.match(await page.locator("#pace-clock").innerText(), /over/);
  assert.equal(
    (await read()).active.sets.length,
    1,
    "overtime must not manufacture a result",
  );
  await page.screenshot({
    path: "test-results/pacing-work-mobile.png",
    fullPage: true,
  });
  await click("Set finished · record result");
  await saveAttempt();
  assert.equal((await stage()).role, "rest");
  const rest = (await read()).active.session.rows[0].rest;
  assert.equal(
    await page.locator("#pace-clock").innerText(),
    `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")}`,
  );
  await click("Undo most recent entry");
  assert.equal((await read()).active.sets.length, 1);
  assert.equal((await stage()).attempt, 1);
  assert.equal((await stage()).role, "work");
  await click("End session early");
  await page
    .locator('dialog [name="reason"]')
    .fill("Synthetic timing regression");
  await click("End & save");
  assert.equal((await read()).records[0].pacing.plan.length, 0);
  assert.ok((await read()).records[0].pacing.completed.length > 0);
  await seed("2026-09-16", true);
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  assert.equal(
    await page.locator(".day-time strong").innerText(),
    "3 min 50 s",
  );
  await click("Start session →");
  await continuePrep();
  await click("Start timed step");
  for (let i = 0; i < 8; i++) {
    const x = await stage();
    assert.equal(x.step, i);
    await page.clock.fastForward(x.seconds * 1000);
    await click(
      i === 7 ? "Active reps complete · save timed drill" : "Continue timer",
    );
  }
  assert.equal((await read()).active.sets[0].holds, 4);
  assert.equal((await read()).active.sets[0].stepLog.length, 8);
  assert.match(
    await page.locator("#pace-label").innerText(),
    /Timed plan complete/,
  );
  await page.screenshot({
    path: "test-results/pacing-mobility-mobile.png",
    fullPage: true,
  });
  await click("Finish session");
  await page
    .locator("dialog")
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await seed("2026-09-16", false, true);
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  await click("Start session →");
  await continuePrep();
  await click("Start timed step");
  assert.equal(await page.locator("#pace-clock").innerText(), "20:00");
  await page.clock.fastForward(60000);
  await click("Pause countdown");
  await page.clock.fastForward(30000);
  assert.equal(await page.locator("#pace-clock").innerText(), "19:00");
  assert.equal(await page.locator("#aerobic-clock").innerText(), "19:00");
  await click("Resume countdown");
  await page.clock.fastForward(60000);
  await click("Stop & confirm moving minutes");
  assert.equal(await page.locator('dialog [name="minutes"]').inputValue(), "2");
  await click("Save moving minutes");
  assert.equal((await read()).active.sets[0].minutes, 2);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "test-results/pacing-browser.json",
    JSON.stringify(
      {
        url,
        appBuild: "7.19",
        fixedTotals: true,
        guidedWarmups: true,
        actualSetEnd: true,
        restWhileLogging: true,
        pauseOffline: true,
        noAutomaticResults: true,
        undo: true,
        mobility: true,
        aerobic: true,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS guided pacing: fixed totals, warm-up steps, sets/resets/rests, actual set-end, breaks, pause/offline reload, overtime, undo, mobility, aerobic moving dose and responsive layout.",
  );
} finally {
  await browser.close();
  if (server) await new Promise((r) => server.close(r));
}
