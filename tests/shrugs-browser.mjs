import { chromium } from "playwright";
import assert from "node:assert/strict";
import { serve } from "../scripts/serve.js";
const server = serve(0);
await new Promise((r) => server.on("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;
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
try {
  await page.clock.install({ time: new Date("2026-09-28T12:00:00-05:00") });
  await page.goto(url);
  await page.evaluate(async () => {
    const t = await import("./src/training.js"),
      s = t.fresh("2026-09-28", "weekday", "all-failure");
    s.training.equipment.shrug = "db";
    delete s.training.shrugEquipmentRevision;
    t.startSession(s, "tuesday", "main");
    s.active.warmup = true;
    t.moveExerciseNext(s, "shrug");
    s.active.preparations.push("shrug");
    t.logSet(s, { weight: 115, reps: 18, endpoint: "failure" });
    t.stopSession(s, "Synthetic dumbbell history");
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await click("Settings");
  assert.equal(await page.locator('[name="shrug"]').inputValue(), "barbell");
  await page.locator('[name="shrug"]').selectOption("db");
  await click("Save schedule & equipment");
  await page.reload();
  await click("Settings");
  assert.equal(
    await page.locator('[name="shrug"]').inputValue(),
    "db",
    "later choices survive migration",
  );
  await page.locator('[name="shrug"]').selectOption("barbell");
  await click("Save schedule & equipment");
  await page.evaluate(async () => {
    const t = await import("./src/training.js"),
      p = await import("./src/pacing.js"),
      s = JSON.parse(localStorage.getItem("oly_program_v7"));
    t.startSession(s, "thursday", "main");
    s.active.warmup = true;
    t.moveExerciseNext(s, "shrug");
    s.active.preparations.push("shrug");
    p.syncPacing(
      s.active,
      Object.fromEntries(
        s.active.session.rows.map((row) => [
          row.key,
          t.rowStatus(s.active, row),
        ]),
      ),
    );
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  assert.equal(
    await page.locator(".focus-card h2").innerText(),
    "Barbell shrug · from rack",
  );
  assert.match(
    await page.locator(".focus-card .prescription").innerText(),
    /10–15/,
  );
  const weight = page.getByLabel("Barbell + plates · lb", { exact: true });
  assert.equal(
    await weight.inputValue(),
    "",
    "115-per-hand history must not become a barbell recommendation",
  );
  await weight.fill("225");
  await page.getByLabel("Valid completed reps", { exact: true }).fill("15");
  await click("Save set");
  const logged = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oly_program_v7")),
  );
  assert.equal(logged.active.sets[0].weight, 225);
  assert.equal(logged.active.sets[0].loadUnit, "total barbell");
  assert.equal(logged.records[0].sets[0].weight, 115);
  assert.equal(logged.records[0].sets[0].loadUnit, "per dumbbell");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oly_program_v7")),
  );
  assert.equal(restored.training.equipment.shrug, "barbell");
  assert.deepEqual(restored.active.sets, logged.active.sets);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS barbell shrugs: automatic migration, equipment selection, separate dumbbell history, total-load entry, mobile layout and offline persistence.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
