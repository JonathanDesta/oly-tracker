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
const stage = async () => {
  const w = (await read()).active;
  return w.pacing.plan.find((s) => s.id === w.pacing.currentId);
};
async function prep() {
  for (let i = 0; i < 100; i++) {
    const s = await stage();
    if (s.role === "work") return;
    await page.clock.fastForward(Math.max(1, s.seconds) * 1000);
    await click(
      s.role === "general-check"
        ? "Confirm general preparation"
        : s.role === "prepare-check"
          ? "Confirm exercise preparation"
          : "Continue timer",
    );
  }
  throw Error("Work stage was not reached");
}
async function rep(outcome = "make") {
  await click("Start timed set");
  await page.clock.fastForward(30000);
  await click("Set finished · record result");
  await page
    .locator('[data-form="set"] [name="outcome"]')
    .selectOption(outcome);
  await click("Save attempt");
  assert(
    (
      await page.locator('[data-form="set"] .form-error').allTextContents()
    ).every((x) => !x),
  );
}
try {
  await page.clock.install({ time: new Date("2026-09-21T15:00:00-05:00") });
  await page.goto(url);
  await page.evaluate(async () => {
    const { fresh } = await import("./src/training.js");
    const s = fresh("2026-09-21", "weekday", "all-failure");
    Object.assign(s.training, {
      entry: 3,
      failureEntry: 4,
      failureWeeks: ["one", "two"],
    });
    s.training.scheduleTrial.weeks = ["one", "two"];
    s.readiness = {
      date: "2026-09-21",
      level: "green",
      event: "normal",
      local: "",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await page.locator(".dose-panel > summary").click();
  assert.match(
    await page.locator(".dose-panel").innerText(),
    /3 Olympic \+ 28 conventional/,
  );
  assert.match(await page.locator(".dose-panel").innerText(), /15 \+ 56/);
  const chest = page
    .locator(".dose-panel tr")
    .filter({ hasText: "Chest (all regions)" });
  assert.match(await chest.innerText(), /12 direct/);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/dose-mobile-table.png",
    fullPage: true,
  });
  await click("Start session →");
  await prep();
  await rep();
  await prep();
  await rep("miss");
  assert.equal((await stage()).id, "cj:rest:0");
  assert.equal((await stage()).seconds, 300);
  assert.match(
    await page.locator(".focus-meta").innerText(),
    /1\/2 sets ended/,
  );
  assert.equal((await read()).active.sets.at(-1).setNumber, 1);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  if (
    await page
      .getByRole("button", { name: "Resume workout", exact: true })
      .count()
  )
    await click("Resume workout");
  assert.equal((await stage()).id, "cj:rest:0");
  await prep();
  await rep();
  await prep();
  await rep("miss");
  assert.equal((await read()).active.sets.at(-1).setNumber, 2);
  assert.equal((await stage()).role, "recovery");
  assert.match(
    await page.locator(".session-ledger").innerText(),
    /2\/2 sets ended/,
  );
  await click("Undo most recent entry");
  assert.equal((await stage()).key, "cj");
  await rep("miss");
  assert.equal((await stage()).role, "recovery");
  await page.screenshot({
    path: "test-results/dose-mobile-runner.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await context.setOffline(false);
  await page.evaluate(async () => {
    const { validate } = await import("./src/storage.js");
    validate(JSON.parse(localStorage.getItem("oly_program_v7")));
  });
  assert.deepEqual(errors, []);
  console.log(
    "Dose browser: muscle/exercise accounting, multi-set failure/rest, reload, offline, undo, mobile layout and storage passed.",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((r) => server.close(r));
}
