import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";
const server = serve(0);
await new Promise((r) => server.on("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.OLY_BROWSER_CHANNEL || "chrome",
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("test-results", { recursive: true });
const dialog = page.locator("dialog");
async function click(text) {
  await page.getByRole("button", { name: text, exact: true }).click();
}
async function dclick(text) {
  await dialog.getByRole("button", { name: text, exact: true }).click();
}
async function seed(fn, argument) {
  await page.evaluate(
    async ({ source, arg }) => {
      const { fresh } = await import("./src/training.js");
      const s = fresh("2026-09-14", "source");
      s.readiness = {
        date: "2026-09-14",
        level: "green",
        event: "normal",
        local: "",
      };
      new Function("s", "arg", source)(s, arg);
      localStorage.setItem("oly_program_v7", JSON.stringify(s));
    },
    { source: fn, arg: argument },
  );
  await page.reload();
}
try {
  await page.clock.install({ time: new Date("2026-09-14T10:00:00") });
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Build the lifts. Keep the quality." })
    .waitFor();
  await seed("s.readiness = null;");
  await page.screenshot({
    path: "test-results/week-desktop.png",
    fullPage: true,
  });
  await click("Check readiness");
  await dclick("Apply to today");
  await click("Start session →");
  await click("General warm-up complete");
  await click("Warm-up, setup & local readiness checked");
  await page.locator('[name="weight"]').fill("100");
  await page.getByRole("button", { name: "Save attempt", exact: true }).click();
  assert.match(await page.locator(".session-ledger").innerText(), /100 lb/);
  await page.reload();
  await page.getByRole("heading", { name: "A · Snatch practice" }).waitFor();
  assert.match(await page.locator(".session-ledger").innerText(), /100 lb/);
  await click("End session early");
  await dialog
    .locator('[name="reason"]')
    .fill("Source audit synthetic session: end without replay.");
  await dclick("End & save");
  assert.match(await page.locator("main").innerText(), /partial/);
  await page.locator(".record-list button").first().click();
  await dialog.locator('[name="normal"]').check();
  await dialog
    .locator('[name="notes"]')
    .fill("Next familiar-load positions normal.");
  await dclick("Save follow-up");
  await click("Settings");
  await page.locator('[name="incline"]').selectOption("db");
  await page.getByRole("button", { name: "Save schedule & equipment" }).click();
  await click("Set reviewed starting position");
  await dialog.locator('[name="entry"]').selectOption("3");
  await dialog.locator('[name="week"]').fill("3");
  await dialog
    .locator('[name="reason"]')
    .fill("Two secure normal weeks, entry complete.");
  await dialog.locator('[name="confirmed"]').check();
  await dclick("Set reviewed position");
  await click("Review one program change");
  await dialog.locator('[name="kind"]').selectOption("squat");
  await dialog.locator('[name="exercise"]').selectOption("front_squat");
  await dialog.locator('[name="ready"]').check();
  await dialog.locator('[name="stable"]').check();
  await dialog
    .locator('[name="reason"]')
    .fill("Three observations of clean stand-up; two stable green weeks.");
  await dclick("Apply reviewed change");
  assert.match(await page.locator("main").innerText(), /squat · Friday/);
  await click("Program");
  await page.locator(".source-text").waitFor();
  await page.locator('[name="guide-page"]').selectOption("34");
  assert.match(
    await page.locator(".source-text").innerText(),
    /ONE Friday calf set/,
  );
  await page.locator('[name="guide-search"]').fill("2,064");
  assert.match(await page.locator("#search-results").innerText(), /Page 30/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["Week", "Workout", "History", "Program", "Settings"]) {
      await click(name);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow ${name} at ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await click("Week");
  await page.screenshot({
    path: "test-results/week-mobile.png",
    fullPage: true,
  });
  // Full conventional workflow including failed attempt, bench spacing and source-order progression.
  await seed(
    "s.training.entry=3;s.training.week=13;s.weekStart='2026-09-13';s.records.push({id:'a',weekId:s.weekId,day:'monday',week:13,cycle:1,date:'2026-09-13',startedAt:Date.now()-86400000,endedAt:Date.now()-86300000,session:{id:'main',kind:'lifting',title:'A',rows:[]},sets:[],omissions:[],status:'omitted'});",
  );
  await page.locator('[data-action="day"][data-day="tuesday"]').click();
  await click("Start session →");
  await click("General warm-up complete");
  await click("Safeties, spotter / safe exit & warm-up checked");
  await page.locator('[name="weight"]').fill("250");
  await page.locator('[name="reps"]').fill("5");
  await click("Save set");
  await click("Safeties, spotter / safe exit & warm-up checked");
  await page.locator('[name="weight"]').fill("225");
  await page.locator('[name="reps"]').fill("4");
  await click("Save set");
  await page.screenshot({
    path: "test-results/workout-mobile.png",
    fullPage: true,
  });
  await click("End session early");
  await dialog
    .locator('[name="reason"]')
    .fill("Only the priority strength work was appropriate today.");
  await dclick("End & save");
  await click("Week");
  await click("Rescue a bench slot");
  await dialog.locator('[name="slot"]').selectOption("bench_moderate");
  await dialog.locator('[name="placement"]').check();
  await dclick("Start eligible bench");
  assert.match(await dialog.innerText(), /Bench is eligible after/);
  await dclick("Close");
  // Backup round-trip through native file input.
  await click("Settings");
  const downloadPromise = page.waitForEvent("download");
  await click("Export full backup");
  const download = await downloadPromise;
  await download.saveAs("test-results/journal.json");
  await page.locator("#import").setInputFiles("test-results/journal.json");
  await dialog.getByText(/Validated:/).waitFor();
  await dclick("Restore validated backup");
  assert.match(
    await page.locator("main").innerText(),
    /Previous-program archives/,
  );
  // Cold navigation offline after complete service-worker installation.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await ctx.setOffline(true);
  await page.reload();
  await page
    .getByRole("heading", { name: "Build the lifts. Keep the quality." })
    .waitFor();
  await click("Program");
  await page.locator(".source-text").waitFor();
  assert.ok((await page.locator(".source-text").innerText()).length > 100);
  await ctx.setOffline(false);
  await seed("");
  await click("Move this day");
  await dialog.locator('[name="date"]').fill("2026-09-15");
  await dialog
    .locator('[name="reason"]')
    .fill("Calendar rotation with the original recovery pattern.");
  await dialog.locator('button[type="submit"]').click();
  await page.reload();
  assert.match(
    await page.locator('[data-action="day"][data-day="monday"]').innerText(),
    /Tue\s+A\s+Sep 15/i,
  );
  assert.match(
    await page.locator('[data-action="day"][data-day="friday"]').innerText(),
    /Sat\s+D\s+Sep 19/i,
  );
  assert.match(
    await page.locator(".day-content > .section-label .eyebrow").innerText(),
    /Tuesday/i,
  );
  const rotatedFeed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("oly_planner_feed_v1")),
  );
  assert.equal(rotatedFeed.repeatStart, "2026-09-22");
  await page.screenshot({
    path: "test-results/calendar-rotation-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: readiness, Olympic and failure logging, refresh recovery, next-session review, setup, trial, source navigation/search, 320–1440px layout, bench spacing, backup import/export, cold offline reload.",
  );
} finally {
  await ctx.close();
  await browser.close();
  server.close();
}
