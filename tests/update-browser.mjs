import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { serve } from "../scripts/serve.js";
const upstream = serve(0);
await new Promise((resolve) => upstream.on("listening", resolve));
let version = 1;
// A separate origin supplies successive worker versions without touching repo files.
const server = createServer(async (req, res) => {
  try {
    const response = await fetch(
      `http://127.0.0.1:${upstream.address().port}${req.url}`,
    );
    let body = Buffer.from(await response.arrayBuffer());
    if (req.url === "/sw.js")
      body = Buffer.from(
        body
          .toString()
          .replace(
            /const CACHE = "[^"]+"/,
            `const CACHE = "oly-update-test-${version}"`,
          ),
      );
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("content-type") || "text/plain",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.OLY_BROWSER_CHANNEL || "chrome",
});
const context = await browser.newContext({ timezoneId: "America/Chicago" });
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const read = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("oly_program_v7")));
try {
  await page.clock.install({ time: new Date("2026-09-14T10:00:00-05:00") });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const { fresh } = await import("./src/training.js");
    const s = fresh("2026-09-14");
    s.training.mobility = ["Ankle · bent-knee calf stretch, heel down"];
    s.readiness = {
      date: "2026-09-14",
      level: "green",
      local: "",
      event: "normal",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  const before = await read();
  version = 2;
  await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration()).update(),
  );
  await page
    .getByRole("button", { name: "Load updated app", exact: true })
    .waitFor({ state: "visible" });
  await click("Load updated app");
  await page.locator("#app-update").waitFor({ state: "hidden" });
  assert.deepEqual(
    await read(),
    before,
    "activating an update preserves the saved journal",
  );
  assert.deepEqual(await page.evaluate(() => caches.keys()), [
    "oly-update-test-2",
  ]);
  await click("Settings");
  assert.match(await page.locator("main").innerText(), /App 7\.13/);
  await click("Check for updates");
  await page
    .getByText(
      "App 7.13 is current. Saved workouts and settings are unchanged.",
      { exact: true },
    )
    .waitFor();
  await click("Week");
  const other = await context.newPage();
  await other.goto(page.url());
  await click("Start session →");
  const workout = (await read()).active.id;
  version = 3;
  await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration()).update(),
  );
  await page
    .getByRole("button", { name: "Load updated app", exact: true })
    .waitFor({ state: "visible" });
  await click("Load updated app");
  assert.match(
    await page.locator("#toast").innerText(),
    /Finish the active workout/,
  );
  assert.equal((await read()).active.id, workout);
  assert.equal(await page.locator("#app-update").isVisible(), true);
  await other
    .getByRole("button", { name: "Load updated app", exact: true })
    .click();
  assert.match(
    await other.locator("#toast").innerText(),
    /Finish the active workout/,
  );
  assert.equal((await read()).active.id, workout);
  assert.deepEqual(errors, []);
  console.log(
    "PASS app update: waiting-worker banner, explicit activation, saved journal preserved and active workout protected.",
  );
} finally {
  await browser.close();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => upstream.close(resolve)),
  ]);
}
