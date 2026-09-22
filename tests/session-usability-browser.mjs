import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";
const server = serve(0);
await new Promise((r) => server.on("listening", r));
const url =
  process.env.OLY_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
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
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
async function prep(generalOnly = false) {
  for (let i = 0; i < 100; i++) {
    const w = (await read()).active;
    if (generalOnly && w.warmup) return;
    const stage = w.pacing.plan.find((s) => s.id === w.pacing.currentId);
    if (stage.role === "work") return;
    if (stage.role === "ramp-rest") {
      await click("Ready · skip warm-up rest");
      continue;
    }
    await page.clock.fastForward(Math.max(1, stage.seconds) * 1000);
    await click(
      stage.role === "general-check"
        ? "Warm-up complete"
        : stage.role === "prepare-check"
          ? "Ready for this exercise"
          : "Done · next step",
    );
  }
  throw Error("Did not reach the work set");
}
async function weight(value) {
  await page
    .locator('[data-form="olympic-load"] [name="weight"]')
    .fill(String(value));
  await click("Use this weight");
}
async function set(reps, finish) {
  await click("Log completed set · enter reps");
  const form = page.locator('[data-form="olympic-report"]');
  await form.locator('[name="reps"]').fill(String(reps));
  await form.locator('[name="finish"]').selectOption(finish);
  await click("Save completed set");
  assert.equal(
    await form.isVisible(),
    false,
    await form.locator(".form-error").innerText(),
  );
}
try {
  await page.clock.install({ time: new Date("2026-09-21T15:00:00-05:00") });
  await page.goto(url);
  await page.evaluate(async () => {
    const { fresh } = await import("./src/training.js");
    const s = fresh("2026-09-21", "weekday", "all-failure");
    s.readiness = {
      date: "2026-09-21",
      level: "green",
      event: "normal",
      local: "",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await click("Start session →");
  await page.locator(".workout-list > summary").click();
  assert.match(
    await page.locator('.workout-list [data-exercise="bench_low"]').innerText(),
    /3–5/,
  );
  assert.match(
    await page.locator('.workout-list [data-exercise="lateral"]').innerText(),
    /12–20/,
  );
  await prep(true);
  await weight(165);
  let w = (await read()).active;
  assert(
    w.pacing.plan.some((s) => s.key === "cj" && s.label.includes("140 lb")),
  );
  await prep();
  assert(
    (await read()).active.pacing.completed.some(
      (s) => s.role === "ramp-rest" && s.method === "not-needed",
    ),
  );
  await set(6, "jerk_miss");
  w = (await read()).active;
  assert.equal(w.sets.filter((s) => s.validRep).length, 6);
  assert.equal(w.sets.at(-1).outcome, "jerk_miss");
  assert(w.sets.every((s) => s.effort === null));
  await weight(125);
  await click("End rest early");
  assert.equal((await read()).active.restOverrides.length, 1);
  await prep();
  await set(3, "form");
  await page.locator(".workout-list > summary").click();
  await click("Do Cable lateral raise next");
  assert.match(
    await page.locator(".focus-card .prescription").innerText(),
    /12–20/,
  );
  w = (await read()).active;
  assert.equal(w.session.rows[2].id, "lateral");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  if (
    await page
      .getByRole("button", { name: "Resume workout", exact: true })
      .count()
  )
    await click("Resume workout");
  assert.equal((await read()).active.session.rows[2].id, "lateral");
  assert.equal((await read()).active.sets.length, 11);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/session-usability-mobile.png",
    fullPage: true,
  });
  await click("End session early");
  await page
    .locator('[data-form="end-early"] textarea')
    .fill("Synthetic usability test");
  await page.locator('[data-form="end-early"] button[type="submit"]').click();
  await click("History");
  await page.locator('[data-action="record"]').click();
  await page.locator('[data-action="correct-olympic"][data-key="cj"]').click();
  await page.locator('[data-form="correct-olympic"] [name="reps"]').fill("5");
  await click("Save correction");
  const r = (await read()).records[0];
  assert.equal(r.sets.filter((s) => s.key === "cj" && s.validRep).length, 5);
  assert.equal(r.corrections[0].previous.length, 7);
  // A correction starts from that specific saved set's real ending and details.
  await page.evaluate(async () => {
    const t = await import("./src/training.js");
    const s = t.fresh("2026-09-21", "weekday", "all-failure"),
      at = Date.parse("2026-09-21T15:00:00-05:00");
    Object.assign(s.training, { entry: 3, failureEntry: 4 });
    s.readiness = {
      date: "2026-09-21",
      level: "green",
      event: "normal",
      local: "",
    };
    t.startSession(s, "tuesday", "main", at);
    s.active.warmup = true;
    const row = t.nextRow(s.active);
    t.chooseOlympicLoad(s, row.key, 165);
    s.active.preparations.push(row.key);
    t.logOlympicSet(
      s,
      { weight: 165, reps: 3, finish: "jerk_miss", fault: "First set detail" },
      at + 300000,
    );
    t.logOlympicSet(
      s,
      { weight: 165, reps: 2, finish: "pain", fault: "Second set detail" },
      at + 660000,
    );
    t.finishSession(s, "Synthetic correction defaults", at + 670000);
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await click("History");
  await page.locator('[data-action="record"]').click();
  await page.locator('[data-action="correct-olympic"][data-key="cj"]').click();
  const correction = page.locator('[data-form="correct-olympic"]');
  assert.equal(
    await correction.locator('[name="finish"]').inputValue(),
    "pain",
  );
  assert.equal(
    await correction.locator('[name="fault"]').inputValue(),
    "Second set detail",
  );
  await correction.locator('[name="setNumber"]').selectOption("1");
  assert.equal(await correction.locator('[name="reps"]').inputValue(), "3");
  assert.equal(
    await correction.locator('[name="finish"]').inputValue(),
    "jerk_miss",
  );
  assert.equal(
    await correction.locator('[name="fault"]').inputValue(),
    "First set detail",
  );
  await click("Save correction");
  assert.equal((await read()).records[0].status, "partial");
  assert.deepEqual(errors, []);
  console.log(
    "PASS session usability: self-selected weights, shorter warm-ups, visible reps, early rests, set-total logging, reordering, correction, mobile and offline persistence.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
