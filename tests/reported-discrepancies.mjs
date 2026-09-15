import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { serve } from "../scripts/serve.js";
const server = serve(0);
await new Promise((r) => server.on("listening", r));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.OLY_BROWSER_CHANNEL || "chrome",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: "America/Chicago",
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const dialog = page.locator("dialog");
async function seed(options) {
  await page.evaluate(async (options) => {
    const { fresh } = await import("./src/training.js");
    const s = fresh("2026-09-14");
    Object.assign(s.training, { entry: 3, ...options });
    s.readiness = {
      date: "2026-09-14",
      level: "green",
      event: "normal",
      local: "",
    };
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  }, options);
  await page.reload();
}
try {
  await page.clock.install({ time: new Date("2026-09-14T10:00:00-05:00") });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page
    .getByRole("heading", { name: "Build the lifts. Keep the quality." })
    .waitFor();
  // 7: Verify the actual header across cycle boundaries, not merely its formula.
  for (const [cycle, week, year] of [
    [1, 1, 1],
    [2, 1, 14],
    [2, 13, 26],
    [4, 13, 52],
  ]) {
    await seed({ cycle, week });
    assert.match(
      await page.locator(".page-header").innerText(),
      new RegExp(`WEEK ${year} OF 52`),
    );
  }
  // 6: The advance dialog contains the complete page-26 checklist.
  await click("Weekly review");
  let text = await dialog.locator(".review-checklist").innerText();
  for (const term of [
    "Normal Friday review",
    "like-load Olympic quality",
    "first-set failure performance",
    "hold, one trial addition, reversal, or a reduced week",
    "Pivot review",
    "Valid total or technical benchmark",
    "Lift videos",
    "Squat/bench rep performance",
    "Standardized physique photos and circumferences",
    "Optional CMJ/short-run trend from eligible athletic sessions",
  ])
    assert.ok(text.includes(term), term);
  await dialog.locator('[name="action"]').selectOption("advance");
  assert.ok(await dialog.locator(".review-checklist").isVisible());
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  );
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/pivot-review-mobile.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await seed({ week: 3 });
  await click("Weekly review");
  assert.ok(
    await dialog
      .getByRole("heading", { name: "Normal Friday review" })
      .isVisible(),
  );
  assert.equal(
    await dialog.getByRole("heading", { name: "Pivot review" }).count(),
    0,
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  // 1: The real UI timer uses amber rest after a completed snatch double.
  await click("Update readiness");
  await dialog.locator('[name="level"]').selectOption("amber");
  await dialog.getByRole("button", { name: "Apply to today" }).click();
  await click("Start session →");
  await click("General warm-up complete");
  await click("Warm-up, setup & local readiness checked");
  for (let i = 0; i < 2; i++) {
    await page.locator('[name="weight"]').fill("45");
    await click("Save attempt");
  }
  const remaining = await page.locator("#timer-count").innerText();
  assert.ok(["3:00", "2:59"].includes(remaining), remaining);
  // 3: B/R heavy-band text reaches the prescription card.
  for (const [week, gate, heavy, band] of [
    [5, "B", 92, "90–92"],
    [9, "R", 95, "93–95"],
  ]) {
    await seed({
      week,
      gate,
      heavy: { snatch: heavy, cj: heavy, extraSnatch: 0, extraCj: 0 },
    });
    await page.locator('[data-action="day"][data-day="friday"]').click();
    const prescriptions = await page.locator(".exercise-table").innerText();
    assert.ok(prescriptions.includes(band + "%"), prescriptions);
  }
  // 5: Exact source text remains in the reader, and estimates appear at first work.
  await click("Program");
  await page.locator(".source-text").waitFor();
  await page.locator('[name="guide-page"]').selectOption("5");
  text = await page.locator(".source-text").innerText();
  for (const term of [
    "245-250",
    "260-265",
    "320-325",
    "same high-bar depth/setup",
  ])
    assert.ok(text.includes(term), term);
  await seed({ week: 13 });
  await page.evaluate(async () => {
    const { omissionRecord } = await import("./src/training.js");
    const s = JSON.parse(localStorage.getItem("oly_program_v7"));
    s.weekStart = "2026-09-13";
    omissionRecord(
      s,
      "monday",
      "main",
      "Synthetic setup: next strength session",
      Date.now(),
    );
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await page.locator('[data-action="day"][data-day="tuesday"]').click();
  await click("Start session →");
  await click("General warm-up complete");
  text = await page.locator(".focus-card").innerText();
  assert.ok(text.includes("260–265"));
  assert.ok(text.includes("Fewer than 4"));
  await click("Safeties, spotter / safe exit & warm-up checked");
  await page.locator('[name="weight"]').fill("200");
  await page.locator('[name="reps"]').fill("3");
  await click("Save set");
  assert.match(
    await page.locator("#toast").innerText(),
    /load estimate needs review/,
  );
  text = await page.locator(".focus-card").innerText();
  assert.ok(text.includes("245–250"));
  assert.ok(text.includes("Fewer than 3"));
  // Second report 5: main minutes and added walks render and log independently.
  await seed({ week: 5, cardio: { enabled: true, minutes: 150 } });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oly_program_v7"));
    s.weekStart = "2026-09-12";
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await page.locator('[data-action="day"][data-day="wednesday"]').click();
  text = await page.locator(".exercise-table").innerText();
  for (const term of [
    "Main aerobic session",
    "30 min",
    "Additional brisk walk",
    "10 min",
  ])
    assert.ok(text.includes(term), term);
  await page.screenshot({
    path: "test-results/aerobic-walks-mobile.png",
    fullPage: true,
  });
  await click("Start session →");
  for (const minutes of [30, 10]) {
    await click("Log already completed minutes");
    assert.equal(
      await page.locator('[name="minutes"]').inputValue(),
      String(minutes),
    );
    await click("Save moving minutes");
    await page.reload();
  }
  const logged = await page.evaluate(
    () => JSON.parse(localStorage.getItem("oly_program_v7")).active.sets,
  );
  assert.deepEqual(
    logged.map((x) => [x.key, x.minutes]),
    [
      ["aerobic", 30],
      ["aerobic_walk", 10],
    ],
  );
  assert.ok(
    await page
      .getByRole("heading", { name: "Work accounted for." })
      .isVisible(),
  );
  // Second reports 11/12: both exact rules remain visible in the offline source.
  await click("Program");
  for (const [number, terms] of [
    [17, ["more than 20% on two exposures", "review flag, not a diagnosis"]],
    [
      25,
      [
        "No bench or squat protection",
        "Defer the barbell failure set",
        "does not fulfill the flat BARBELL bench requirement",
      ],
    ],
  ]) {
    await page.locator('[name="guide-page"]').selectOption(String(number));
    text = (await page.locator(".source-text").innerText()).replace(
      /\s+/g,
      " ",
    );
    for (const term of terms) assert.ok(text.includes(term), term);
  }
  await seed({ week: 3 });
  await click("Week");
  await click("Update readiness");
  assert.match(
    await dialog.innerText(),
    /Machine or dumbbell pressing does not fulfill the flat barbell bench requirement/,
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  // Second report 9: the Settings gate rejects a normal early start, and saves
  // the explicit source exception atomically when prior adaptation is attested.
  await click("Settings");
  await click("Review one program change");
  await dialog.locator('[name="kind"]').selectOption("athletic_start");
  await dialog.locator('[name="ready"]').check();
  await dialog.locator('[name="stable"]').check();
  await dialog
    .locator('[name="reason"]')
    .fill("Earlier training history: two stable green weeks at this dose.");
  await dialog.getByRole("button", { name: "Apply reviewed change" }).click();
  assert.match(
    await dialog.locator(".form-error").innerText(),
    /Normally introduce athletics in week 5/,
  );
  await dialog.locator('[name="adapted"]').check();
  await dialog.getByRole("button", { name: "Apply reviewed change" }).click();
  assert.equal(await dialog.isVisible(), false);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("oly_program_v7")).training.athletics
          .enabled,
    ),
    true,
  );
  await seed({ week: 3 });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("oly_program_v7"));
    s.reviews = [1, 2].map((entry) => ({
      at: Date.now(),
      weekId: crypto.randomUUID(),
      week: entry,
      green: true,
      recovery: "normal",
      training: { ...structuredClone(s.training), entry, week: entry },
    }));
    localStorage.setItem("oly_program_v7", JSON.stringify(s));
  });
  await page.reload();
  await click("Settings");
  await click("Review one program change");
  await dialog.locator('[name="kind"]').selectOption("athletic_start");
  for (const name of ["ready", "stable", "adapted"])
    await dialog.locator(`[name="${name}"]`).check();
  await dialog
    .locator('[name="reason"]')
    .fill("Test: a checkbox must not override the recorded ramp.");
  await dialog.getByRole("button", { name: "Apply reviewed change" }).click();
  assert.match(await dialog.locator(".form-error").innerText(), /entry ramp/);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("oly_program_v7")).training.athletics
          .enabled,
    ),
    false,
  );
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  );
  await page.screenshot({
    path: "test-results/athletic-entry-gate-mobile.png",
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS reported-discrepancy UI checks: amber timer, heavy bands, first-exposure guidance/warning, complete Friday/pivot checklist, year-week boundaries, separate aerobic/walk logging, protection/recovery source and athletics entry gate.",
  );
} finally {
  await context.close();
  await browser.close();
  server.close();
}
