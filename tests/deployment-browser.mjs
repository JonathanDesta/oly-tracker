import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { serve } from "../scripts/serve.js";
import { checkDeployment } from "../scripts/check-deployment.js";

const upstream = serve(0);
await new Promise((resolve) => upstream.on("listening", resolve));
const prefix = "/oly-tracker/";
const server = createServer(async (req, res) => {
  if (!req.url.startsWith(prefix)) return res.writeHead(404).end();
  const response = await fetch(
    `http://127.0.0.1:${upstream.address().port}/${req.url.slice(prefix.length)}`,
  );
  res.writeHead(response.status, {
    "Content-Type": response.headers.get("content-type"),
    "Cache-Control": "no-store",
  });
  res.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
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
page.on("pageerror", (error) => errors.push(error.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
try {
  assert.equal(
    (await checkDeployment(base)).matches,
    true,
    "all published assets match the working release",
  );
  assert.equal(
    (await checkDeployment(base + "missing/")).matches,
    false,
    "a missing or incorrect deployment fails verification",
  );
  await page.clock.install({ time: new Date("2026-09-16T10:00:00-05:00") });
  await page.goto(base);
  const previous = {
    revision: 6,
    ts: 100,
    records: [],
    training: {
      cycle: 1,
      week: 1,
      entryStage: 1,
      phaseGate: "F",
      mobility: ["Bent-knee ankle wall stretch"],
      mobilitySeconds: 30,
      mobilityDays: 3,
    },
  };
  await page.evaluate(
    (previous) => localStorage.setItem("oly_state", JSON.stringify(previous)),
    previous,
  );
  await page.reload();
  await click("Settings");
  assert.match(await page.locator("main").innerText(), /App 7\.11/);
  assert.equal(
    await page
      .getByLabel("Ankle · bent-knee calf stretch, heel down", { exact: true })
      .isChecked(),
    true,
    "the existing published app's selected stretch survives the upgrade",
  );
  await page
    .getByLabel("Ankle · bent-knee calf stretch, heel down", { exact: true })
    .check();
  await click("Save mobility");
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("oly_state"))),
    previous,
    "the original journal remains untouched",
  );
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("oly_program_v7"));
    state.readiness = {
      date: "2026-09-16",
      level: "green",
      local: "",
      event: "normal",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(state));
  });
  await page.reload();
  await click("Week");
  for (const day of ["wednesday", "saturday", "sunday"]) {
    await page.locator(`[data-action="day"][data-day="${day}"]`).click();
    assert.equal(await page.locator(".day-time strong").innerText(), "4–5 min");
    assert.equal(
      await page.locator('[data-action="start"][data-id="mobility"]').count(),
      1,
    );
  }
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  await click("Start session →");
  await click("Position comfortable · start drill");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator("#mobility-clock").innerText(), "0:30");
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("oly_program_v7")).training.mobility
          .length,
    ),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS deployment path: matching assets, wrong-release rejection, /oly-tracker/ navigation, saved mobility, all three start buttons and offline session recovery.",
  );
} finally {
  await browser.close();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => upstream.close(resolve)),
  ]);
}
