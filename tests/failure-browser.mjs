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
const click = (text) =>
  page.getByRole("button", { name: text, exact: true }).click();
const currentStage = async () => {
  const w = (await read()).active;
  return w.pacing.plan.find((s) => s.id === w.pacing.currentId);
};
async function preparation() {
  for (let guard = 0; guard < 100; guard++) {
    const stage = await currentStage();
    if (stage.role === "work") return;
    await page.clock.fastForward(Math.max(1, stage.seconds) * 1000);
    await click(
      stage.role === "general-check"
        ? "Confirm general preparation"
        : stage.role === "prepare-check"
          ? "Confirm exercise preparation"
          : "Continue timer",
    );
  }
  throw Error("Did not reach work");
}
async function rep(outcome = "make", grade = "A") {
  await click("Start timed set");
  await page.clock.fastForward(30000);
  await click("Set finished · record result");
  await page
    .locator('[data-form="set"] [name="outcome"]')
    .selectOption(outcome);
  await page.locator('[data-form="set"] [name="grade"]').selectOption(grade);
  if (grade === "C")
    await page.locator('[name="fault"]').fill("Unstable overhead position");
  await click("Save attempt");
  assert(
    (
      await page.locator('[data-form="set"] .form-error').allTextContents()
    ).every((text) => !text),
  );
}
try {
  await fs.mkdir("test-results", { recursive: true });
  await page.clock.install({ time: new Date("2026-09-21T15:00:00-05:00") });
  await page.goto(url);
  assert.match(
    await page.locator("main").innerText(),
    /Loaded work: failure endpoint/,
  );
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
  await preparation();
  assert.match(
    await page.locator(".focus-meta").innerText(),
    /OLYMPIC FAILURE SET/,
  );
  assert.equal(await page.locator('[name="preparation"]').count(), 0);
  for (let i = 0; i < 6; i++) {
    await rep();
    await preparation();
  }
  let w = (await read()).active;
  assert.equal(w.sets.length, 6);
  assert.equal((await currentStage()).key, "cj");
  assert.equal(
    await page.locator('[name="weight"]').getAttribute("readonly"),
    "",
  );
  assert.match(
    await page.locator(".focus-meta").innerText(),
    /set 1: 6 valid pairs/,
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  if (
    await page
      .getByRole("button", { name: "Resume workout", exact: true })
      .count()
  )
    await click("Resume workout");
  assert.equal((await read()).active.sets.length, 6);
  await rep("jerk_miss");
  assert.equal((await currentStage()).role, "recovery");
  assert.equal((await currentStage()).seconds, 300);
  assert.match(
    await page.locator(".session-ledger").innerText(),
    /terminal attempt · 0 valid reps/,
  );
  await click("Undo most recent entry");
  assert.equal((await currentStage()).key, "cj");
  assert.equal((await currentStage()).attempt, 6);
  await rep("make", "C");
  w = (await read()).active;
  assert.equal(w.sets.filter((s) => s.key === "cj").length, 7);
  assert(w.sets.at(-1).terminal);
  assert(!w.sets.at(-1).validRep);
  assert(!w.pacing.plan.some((s) => s.id === "cj:work:7"));
  await page.screenshot({
    path: "test-results/failure-mobile-runner.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await context.setOffline(false);
  // Complete the remaining ordinary sets through the engine; the UI then saves
  // and displays the entire session, including the expected Olympic endpoint.
  await page.evaluate(async () => {
    const T = await import("./src/training.js");
    const { olympicFailure } = await import("./src/failure-policy.js");
    const s = JSON.parse(localStorage.getItem("oly_program_v7"));
    let now = Date.now();
    while (T.nextRow(s.active)) {
      const e = T.nextRow(s.active);
      s.active.preparations.push(e.key);
      now += 300000;
      if (olympicFailure(e))
        T.logSet(
          s,
          {
            weight: T.nextQualityRange(s.active, e)[0],
            outcome: T.rowStatus(s.active, e).count ? "miss" : "make",
            grade: "A",
            effort: 8,
          },
          now,
        );
      else
        T.logSet(
          s,
          { weight: 100, reps: e.repRange[0], endpoint: "failure" },
          now,
        );
    }
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  if (
    await page
      .getByRole("button", { name: "Resume workout", exact: true })
      .count()
  )
    await click("Resume workout");
  await click("Finish session");
  await page
    .locator("dialog textarea")
    .fill("Synthetic test: expected terminal Olympic reps, no extra attempts.");
  await page.locator('dialog button[type="submit"]').click();
  assert.equal((await read()).records.at(-1).status, "complete");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  assert.match(
    await page.locator("#failure-amendment").innerText(),
    /not proven optimal or equivalent/,
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await click("Review one program change");
  const options = await page
    .locator('dialog select[name="kind"] option')
    .evaluateAll((xs) => xs.map((x) => x.value));
  assert(
    !options.some((v) => /heavy_|extra_|assessment|pause_|^rack$/.test(v)),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Failure amendment mobile/offline runner: passed; dynamic extra reps, first endpoint, locked load, undo, complete log, guide and change controls.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
