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
  viewport: { width: 390, height: 844 },
  timezoneId: "America/Chicago",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const dialog = page.locator("dialog");
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const dclick = (name) =>
  dialog.getByRole("button", { name, exact: true }).click();
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
async function seed() {
  await page.evaluate(async () => {
    const { fresh } = await import("./src/training.js");
    const s = fresh("2026-09-14");
    Object.assign(s.training, { week: 3, entry: 3 });
    s.readiness = {
      date: "2026-09-14",
      level: "green",
      local: "",
      event: "normal",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
}
try {
  await page.clock.install({ time: new Date("2026-09-14T10:00:00-05:00") });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await seed();
  // Separate sport and alcohol inputs survive save, reload, and effective restrictions.
  await click("Update readiness");
  await dialog.locator('[name="sport"]').selectOption("game");
  await dialog.locator('[name="event"]').selectOption("unsafe");
  await dialog.locator('[name="rehearsal"]').check();
  await dclick("Apply to today");
  assert.equal((await read()).readiness.sport, "game");
  assert.equal((await read()).readiness.event, "unsafe");
  assert.equal(
    await page
      .getByRole("button", { name: "Start session →", exact: true })
      .count(),
    0,
  );
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: "Start session →", exact: true })
      .count(),
    0,
  );
  await click("Update readiness");
  assert.equal(await dialog.locator('[name="sport"]').inputValue(), "game");
  assert.equal(await dialog.locator('[name="event"]').inputValue(), "unsafe");
  await dclick("Close");
  // Active reductions remain stable after repeated readiness saves and a cold UI render.
  await seed();
  await click("Start session →");
  await click("Week");
  await click("Update readiness");
  await dialog.locator('[name="level"]').selectOption("amber");
  await dclick("Apply to today");
  const reduced = (await read()).active.session.rows;
  await click("Update readiness");
  await dclick("Apply to today");
  assert.deepEqual((await read()).active.session.rows, reduced);
  await page.reload();
  assert.deepEqual((await read()).active.session.rows, reduced);
  // Malformed trial import must leave the valid saved workout intact.
  await click("Settings");
  const good = await read();
  const bad = structuredClone(good);
  bad.training.trials.push({
    id: "bad",
    kind: "squat",
    day: "tuesday",
    reviews: [],
  });
  await page.locator("#import").setInputFiles({
    name: "invalid-trial.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await page.getByText(/Invalid backup: support squat exercise/).waitFor();
  assert.deepEqual(await read(), good);
  assert.equal(await dialog.isVisible(), false);
  // Source mobility progression: observed plateau and one changed component.
  await seed();
  await click("Settings");
  const form = page.locator('form[data-form="mobility"]');
  await form.locator('[name="seconds"]').selectOption("45");
  await form.locator('[name="days"]').selectOption("4");
  await click("Save mobility");
  assert.match(await form.locator(".form-error").innerText(), /duration OR/);
  await form.locator('[name="days"]').selectOption("3");
  await click("Save mobility");
  assert.match(await form.locator(".form-error").innerText(), /two weeks/);
  await form.locator('[name="observed"]').check();
  await click("Save mobility");
  assert.equal((await read()).training.mobilitySeconds, 45);
  assert.equal((await read()).training.mobilityDays, 3);
  // The exact source, every script and the updated interface remain usable offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await click("Program");
  await page.locator(".source-text").waitFor();
  for (const p of [1, 16, 18, 19, 22, 24, 27, 28, 29, 32, 34, 43]) {
    await page.locator('[name="guide-page"]').selectOption(String(p));
    assert.ok((await page.locator(".source-text").innerText()).length > 100);
  }
  await click("History");
  assert.match(await page.locator("main").innerText(), /Actual quality dose/);
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/full-audit-history-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS full-audit browser: combined restrictions, repeated active reduction, reload persistence, malformed-import atomicity, mobility progression, source and app cold offline use; no uncaught errors.",
  );
} finally {
  await context.close();
  await browser.close();
  server.close();
}
