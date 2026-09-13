'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.OLY_BROWSER_CHANNEL || 'chrome',
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    await context.route('https://accounts.google.com/**', (r) => r.abort());
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.OLY_TEST_URL || 'http://127.0.0.1:8766/');
    await page.locator('h1').waitFor();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByText('Technique regressions', { exact: true }).click();
    await page.locator('#technique-jerk').selectOption('dip');
    await page.getByRole('button', { name: 'Save technique prescription', exact: true }).click();
    const jerk = await page.evaluate(() =>
      plan('thursday', true)
        .sessions.flatMap((s) => s.rows)
        .find((e) => e.id === 'pause_jerk'),
    );
    assert.deepEqual([jerk.sets, jerk.reps, jerk.rest, jerk.anchor], [3, 2, 90, 'cj']);
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await page.getByRole('button', { name: 'Thu C', exact: false }).click();
    await page.getByRole('button', { name: 'Start this session', exact: true }).click();
    assert.match(await page.locator('main').innerText(), /Pause-dip split jerk/);
    await page.reload();
    assert.equal(
      await page.evaluate(
        () => STATE.activeWorkout.session.rows.find((e) => e.id === 'pause_jerk').rest,
      ),
      90,
    );
    // Reset only the isolated synthetic profile to exercise the event/assistance paths.
    await page.evaluate(() => {
      STATE = { ...MODEL.migrate({}), selectedDay: 'monday', view: 'settings' };
      STATE.training.onboarding = false;
      STATE.training.week = 3;
      save();
      nav('settings');
    });
    await page.locator('#incline-choice').selectOption('db');
    await page.locator('#legcurl-choice').selectOption('lying');
    await page.getByRole('button', { name: 'Save schedule & equipment', exact: true }).click();
    assert.match(
      await page.evaluate(
        () => plan('friday').sessions[0].rows.find((e) => e.id === 'incline').name,
      ),
      /DB/,
    );
    await page.getByText('Optional dose & assistance', { exact: true }).click();
    await page.locator('#trial-kind').selectOption('squat');
    await page.locator('#trial-squat').selectOption('front_squat');
    await page.locator('#dose-ready').check();
    await page
      .locator('#dose-reason')
      .fill('Two stable green weeks; relevant front squat support trial.');
    await page.getByRole('button', { name: 'Save reviewed dose', exact: true }).click();
    assert.equal(await page.evaluate(() => STATE.training.trial.kind), 'squat');
    assert.equal(
      await page.evaluate(
        () => plan('friday').sessions[0].rows.find((e) => e.key === 'squat_support').id,
      ),
      'front_squat',
    );
    const started = await page.evaluate(() => STATE.training.trial.startedAt);
    await page.evaluate(() => {
      STATE.training.week = 11;
      for (let i = 0; i < 3; i++)
        STATE.training = MODEL.reviewAdvance(STATE.training, { action: 'advance', green: true });
      save();
      nav('settings');
    });
    await page.getByText('Optional dose & assistance', { exact: true }).click();
    await page
      .getByRole('button', { name: 'Resume paused assistance after readiness review', exact: true })
      .click();
    await page.locator('#resume-ready').check();
    await page.getByRole('button', { name: 'Resume same trials', exact: true }).click();
    assert.equal(await page.evaluate(() => STATE.training.trial.startedAt), started);
    assert.equal(await page.evaluate(() => STATE.training.trial.paused), false);
    // Actual event selection generates a separately loggable rehearsal and preserves deferral.
    await page.locator('#event').selectOption('game');
    await page.locator('#game-rehearsal').check();
    await page
      .locator('#event-notes')
      .fill('Pickup: 45 minutes, demanding running, no contact or symptoms.');
    await page.getByRole('button', { name: 'Apply to today', exact: true }).click();
    assert.equal(
      await page.evaluate(() => plan('monday', true).sessions.find((s) => s.id === 'main').skipped),
      true,
    );
    assert.ok(
      await page.evaluate(() => plan('monday', true).sessions.some((s) => s.id === 'rehearsal')),
    );
    await page.getByRole('button', { name: 'History', exact: true }).click();
    assert.match(await page.locator('main').innerText(), /Pickup \/ event/);
    // A reduced week cannot jump straight back to the full dose through review.
    await page.evaluate(() => {
      STATE.readiness = { date: dateISO(), level: 'green', event: 'normal' };
      STATE.training.recovery = 'targeted';
      STATE.training.week = 6;
      save();
      nav('home');
      openReview();
    });
    await page.locator('#review-green').check();
    await page.locator('#review-build').check();
    await page.locator('#review-recovery').selectOption('normal');
    await page.getByRole('button', { name: 'Save review', exact: true }).click();
    assert.equal(await page.evaluate(() => STATE.training.recovery), 'restore');
    assert.equal(await page.evaluate(() => STATE.training.week), 6);
    // End restoration only through the explicit tolerated-dose review.
    await page.evaluate(() => openReview());
    await page.locator('#review-green').check();
    await page.locator('#restore-complete').check();
    await page.getByRole('button', { name: 'Save review', exact: true }).click();
    assert.equal(await page.evaluate(() => STATE.training.recovery), 'normal');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText('Technique regressions', { exact: true }).click();
    await page.screenshot({ path: '/tmp/oly-rev6-qa/conformance-settings.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: source-correct technique workflow, equipment choice, support squat selection, trial continuity/resume, separate game rehearsal/event history, gradual recovery review, responsive settings.',
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
