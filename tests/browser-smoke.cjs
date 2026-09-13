// Optional browser QA. Install Playwright or set NODE_PATH to an existing installation.
'use strict';
const { chromium } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const { PROGRAM: P } = require('../js/program'),
  { MODEL: M } = require('../js/model');
fs.mkdirSync('/tmp/oly-rev6-qa', { recursive: true });
const url = process.env.OLY_TEST_URL || 'http://127.0.0.1:8766/';
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.OLY_BROWSER_CHANNEL || 'chrome',
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      deviceScaleFactor: 1,
      acceptDownloads: true,
    });
    await context.route('https://accounts.google.com/**', (r) => r.abort());
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const legacy = {
      schemaVersion: 3,
      ts: Date.now() - 1e8,
      program: { blockId: 5 },
      maxes: { clean: 255, jerk: 205 },
      log: {
        old: {
          date: '2020-01-01',
          title: 'Old workout',
          setsLogged: { x: [{ exId: 'bench', weight: 200, reps: 5, ts: 1 }] },
        },
      },
      activeWorkout: { id: 'legacy-active', setsLogged: {} },
    };
    await page.addInitScript((data) => {
      if (!localStorage.getItem('qa-seeded')) {
        localStorage.setItem('oly_state', JSON.stringify(data));
        localStorage.setItem('qa-seeded', '1');
      }
    }, legacy);
    await page.goto(url);
    await page.locator('h1').waitFor();
    assert.ok((await page.locator('main').innerText()).includes('28'));
    assert.deepEqual(await page.evaluate(() => STATE.legacy), legacy);
    assert.equal(await page.evaluate(() => STATE.training.anchors.jerk), null);
    // Verify subsequent reload is a read, not an artificial newer cloud timestamp.
    const stamp = await page.evaluate(() => STATE.ts);
    await page.reload();
    assert.equal(await page.evaluate(() => STATE.ts), stamp);
    await page.getByRole('button', { name: 'Tue B', exact: false }).click();
    await page.getByRole('button', { name: 'Start this session', exact: true }).click();
    await page.getByRole('button', { name: 'Warm-up done', exact: true }).click();
    assert.equal(
      await page
        .locator('#exercise-1')
        .getByRole('button', { name: 'Log next attempt' })
        .isDisabled(),
      true,
    );
    await page.locator('#exercise-0').getByRole('button', { name: 'Log next attempt' }).click();
    await page.locator('#set-effort').fill('6');
    await page.getByRole('button', { name: 'Save attempt & start rest' }).click();
    const end = await page.evaluate(() => STATE.restEnd);
    assert.ok(end > Date.now());
    await page.reload();
    assert.equal(await page.evaluate(() => STATE.activeWorkout.sets.length), 1);
    assert.equal(await page.evaluate(() => STATE.restEnd), end);
    await page.locator('#exercise-0').getByRole('button', { name: 'Omit', exact: true }).click();
    await page.locator('#exercise-1').getByRole('button', { name: 'Omit', exact: true }).click();
    await page.locator('#exercise-2').getByRole('button', { name: 'Log next set' }).click();
    await page.locator('#set-weight').fill('260');
    await page.locator('#set-reps').fill('6');
    await page.getByRole('button', { name: 'Save set & start rest' }).click();
    assert.equal(await page.evaluate(() => STATE.activeWorkout.sets.at(-1).endpoint), 'failure');
    await page.locator('#exercise-3').getByRole('button', { name: 'Log next set' }).click();
    await page.locator('#set-weight').fill('245');
    await page.locator('#set-reps').fill('4');
    await page.getByRole('button', { name: 'Save set & start rest' }).click();
    await page.screenshot({ path: '/tmp/oly-rev6-qa/workout-mobile.png' });
    await page.getByRole('button', { name: 'Finish session', exact: true }).click();
    await page.getByRole('button', { name: 'Save partial session', exact: true }).click();
    assert.equal(await page.evaluate(() => STATE.records.length), 1);
    await page.getByRole('button', { name: 'History', exact: true }).click();
    assert.ok((await page.locator('main').innerText()).includes('Previous program archive'));
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export all data', exact: true }).click();
    const download = await dl;
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.deepEqual(backup.legacy, legacy);
    assert.equal(backup.records.length, 1);
    // Restore via the real file import control.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    page.once('dialog', (d) => d.accept());
    await page.locator('input[type=file]').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    assert.equal(await page.evaluate(() => STATE.records.length), 1);
    // Choose a full-dose week via settings, then inspect the schedule on a small phone.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByText('Set program position manually', { exact: true }).click();
    await page.locator('#position-week').fill('3');
    await page.locator('#entry-stage').selectOption('3');
    await page.getByRole('button', { name: 'Set position', exact: true }).click();
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await page.getByRole('button', { name: 'Tue B', exact: false }).click();
    assert.ok((await page.locator('main').innerText()).includes('44'));
    await page.screenshot({ path: '/tmp/oly-rev6-qa/week-full-mobile.png' });
    // Starting Friday cannot squeeze another bench into <48 actual hours.
    await page.getByRole('button', { name: 'Fri D', exact: false }).click();
    await page.getByRole('button', { name: 'Start this session', exact: true }).click();
    assert.ok((await page.locator('dialog').innerText()).includes('Bench needs more spacing'));
    await page.getByRole('button', { name: 'Start without bench', exact: true }).click();
    assert.equal(
      await page.evaluate(() => STATE.activeWorkout.session.rows.some((e) => e.id === 'bench')),
      false,
    );
    // Offline reload restores the same active prescription and logs.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    assert.ok((await page.locator('main').innerText()).includes('D · Both lifts'));
    assert.equal(
      await page.evaluate(() => STATE.activeWorkout.session.rows.some((e) => e.id === 'bench')),
      false,
    );
    await context.setOffline(false);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: mobile navigation, legacy migration, ordered attempt/failure logging, durable timers, reload, export/import, bench spacing, offline, and 320–1280px layouts.',
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
