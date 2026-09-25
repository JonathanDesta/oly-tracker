import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";
const server = process.env.OLY_TEST_URL ? null : serve(0);
if (server) await new Promise((resolve) => server.on("listening", resolve));
const url =
  process.env.OLY_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
const engine =
  process.env.OLY_ALARM_ENGINE === "webkit" ? "webkit" : "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  headless: true,
  ...(engine === "chromium"
    ? { channel: process.env.OLY_BROWSER_CHANNEL || "chrome" }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const audio = () =>
  page.locator("#workout-alarm-audio").evaluate((a) => ({
    src: a.src,
    paused: a.paused,
    time: a.currentTime,
    duration: a.duration,
    volume: a.volume,
  }));
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
try {
  await page.goto(url);
  await click("Settings");
  assert(await page.getByLabel("Alarm sound on", { exact: true }).isChecked());
  assert.equal(await page.locator('[name="volume"]').inputValue(), "1");
  assert.equal(await page.locator('[name="row"]').inputValue(), "db");
  await click("Test with phone locked · 10 seconds");
  await page.waitForFunction(
    () =>
      document.querySelector("audio")?.readyState >= 3 &&
      !document.querySelector("audio").paused &&
      document.querySelector("audio").currentTime > 0.1,
  );
  const scheduled = await audio();
  assert(scheduled.duration >= 69 && scheduled.duration <= 71);
  // Suspend page lifecycle callbacks. The media track itself contains the alert.
  if (engine === "chromium") {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
    await new Promise((resolve) => setTimeout(resolve, 11500));
    await cdp.send("Page.setWebLifecycleState", { state: "active" });
  } else {
    const other = await context.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    await new Promise((resolve) => setTimeout(resolve, 11500));
    await other.close();
    await page.bringToFront();
  }
  const continued = await audio();
  assert(
    continued.time >= 10,
    `media must reach the embedded alarm without page timers: ${continued.time}`,
  );
  await page.waitForFunction(() =>
    document
      .querySelector("#alarm-message")
      .textContent.includes("timer finished"),
  );
  await click("Silence alarm");
  assert.equal((await audio()).paused, true);

  await page.clock.install({ time: new Date("2026-09-25T12:00:00-05:00") });
  await page.evaluate(async () => {
    const t = await import("./src/training.js"),
      p = await import("./src/pacing.js");
    const s = t.fresh("2026-09-21", "weekday", "all-failure");
    s.training.entry = 3;
    s.training.failureEntry = 2;
    s.readiness = {
      date: "2026-09-25",
      level: "green",
      event: "normal",
      local: "",
    };
    t.startSession(s, "tuesday", "main");
    const row = t
      .planFor(s, "thursday")
      .sessions.flatMap((s) => s.rows)
      .find((e) => e.id === "row");
    const session = { ...s.active.session, rows: [row] };
    Object.assign(s.active, {
      session,
      originalSession: structuredClone(session),
      baseSession: structuredClone(session),
      warmup: true,
      preparations: [row.key],
    });
    p.createPacing(s.active);
    p.syncPacing(s.active, { [row.key]: t.rowStatus(s.active, row) });
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  assert.match(
    await page.locator(".focus-card h2").innerText(),
    /dumbbell row/,
  );
  await page.getByLabel("Each dumbbell · lb", { exact: true }).fill("50");
  await page.getByLabel("Valid completed reps", { exact: true }).fill("10");
  await click("Save set");
  assert.equal((await read()).active.sets[0].loadUnit, "per dumbbell");
  await page.waitForFunction(() => !document.querySelector("audio").paused);
  const original = (await audio()).src;
  await click("Settings");
  assert.equal(await page.locator("#pace-clock").count(), 0);
  assert.equal(
    (await audio()).src,
    original,
    "changing app screen must not cancel or restart the alarm",
  );
  await page.clock.fastForward(180000);
  assert.match(
    await page.locator("#alarm-message").innerText(),
    /timer finished/,
  );
  await click("Silence alarm");
  await click("Workout");
  await click("Add 1 minute");
  assert.notEqual((await audio()).src, original);
  await click("Pause countdown");
  assert.equal((await audio()).paused, true);
  await page.clock.fastForward(30000);
  assert.equal(await page.locator("#alarm-status").isVisible(), false);
  await click("Resume countdown");
  await page.waitForFunction(() => !document.querySelector("audio").paused);
  await click("End rest early");
  assert.equal(
    (await audio()).paused,
    true,
    "an unstarted work set must not retain the old rest alarm",
  );
  await click("Settings");
  await page.getByLabel("Alarm sound on", { exact: true }).uncheck();
  await click("Save alarm settings");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  // Playwright WebKit has an offline/SW navigation bug (#42775). Keep its
  // reload online; Chromium separately verifies the full cold-offline path.
  if (engine === "chromium") await context.setOffline(true);
  await page.reload();
  await click("Settings");
  assert.equal(
    await page.getByLabel("Alarm sound on", { exact: true }).isChecked(),
    false,
  );
  assert.equal(await page.locator('[name="row"]').inputValue(), "db");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    JSON.stringify(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth)
          .map((e) => ({
            tag: e.tagName,
            text: e.textContent.slice(0, 100),
            width: e.getBoundingClientRect().width,
          }))
          .slice(0, 15),
      })),
    ),
  );
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: `test-results/alarm-settings-${engine}.png`,
    fullPage: true,
  });
  await page
    .locator("section.panel")
    .filter({ has: page.getByRole("heading", { name: "Alarms", exact: true }) })
    .screenshot({ path: `test-results/alarm-panel-${engine}.png` });
  assert.deepEqual(errors, []);
  console.log(
    `PASS alarms and dumbbell rows (${engine}): automatic loud audio, ${engine === "chromium" ? "frozen-page" : "background-tab"} media playback, other app screens, deadline changes/cancellation, per-dumbbell logging, mobile layout and ${engine === "chromium" ? "offline" : "reload"} preferences. Physical iPhone lock-screen behavior remains a device test.`,
  );
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
