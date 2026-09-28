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
  page.evaluate(() => ({
    starts: window.__audioStarts,
    active: window.__audioActive,
  }));
await page.addInitScript(() => {
  window.__audioStarts = 0;
  window.__audioActive = 0;
  const Original = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = class extends Original {
    createBufferSource() {
      const source = super.createBufferSource(),
        start = source.start.bind(source),
        stop = source.stop.bind(source);
      source.start = (...args) => {
        window.__audioStarts++;
        window.__audioActive++;
        return start(...args);
      };
      source.stop = (...args) => {
        window.__audioActive--;
        return stop(...args);
      };
      return source;
    }
  };
});
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
try {
  await page.goto(url);
  await click("Settings");
  assert(await page.getByLabel("Alarm sound on", { exact: true }).isChecked());
  assert.equal(await page.locator('[name="volume"]').inputValue(), "1");
  assert.equal(await page.locator('[name="row"]').inputValue(), "db");
  await click("Test alarm sound");
  await page.waitForFunction(() => window.__audioStarts === 1);
  assert.equal(
    await page.locator("audio").count(),
    0,
    "no exclusive media element or silent keepalive track",
  );
  await click("Silence alarm");
  assert.equal((await audio()).active, 0);

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
  const original = (await audio()).starts;
  assert.equal(
    (await audio()).active,
    0,
    "rest countdown plays no audio before zero",
  );
  await click("Settings");
  assert.equal(await page.locator("#pace-clock").count(), 0);
  assert.equal(
    (await audio()).starts,
    original,
    "changing app screen must not cancel or restart the alarm",
  );
  await page.clock.fastForward(180000);
  assert.match(
    await page.locator("#alarm-message").innerText(),
    /timer finished/,
  );
  assert.equal((await audio()).starts, original + 1);
  await click("Silence alarm");
  await click("Workout");
  await click("Add 1 minute");
  assert.equal(
    (await audio()).active,
    0,
    "extending the timer does not start audio",
  );
  await click("Pause countdown");
  assert.equal((await audio()).active, 0);
  await page.clock.fastForward(30000);
  assert.equal(await page.locator("#alarm-status").isVisible(), false);
  await click("Resume countdown");
  assert.equal((await audio()).active, 0);
  await click("End rest early");
  assert.equal(
    (await audio()).active,
    0,
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
    `PASS alarms and dumbbell rows (${engine}): foreground Web Audio without silent playback, other app screens, deadline changes/cancellation, per-dumbbell logging, mobile layout and ${engine === "chromium" ? "offline" : "reload"} preferences. Physical iPhone lock-screen behavior remains a device test.`,
  );
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
