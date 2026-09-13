'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { PROGRAM: P } = require('../js/program');
const config = (week = 3, extra = {}) => ({
  ...P.defaults(),
  cycle: 1,
  week,
  entryStage: 3,
  phaseGate: 'R',
  ...extra,
});
const rows = (t, d, ctx) =>
  P.dayPlan(t, d, ctx)
    .sessions.filter((s) => !s.skipped)
    .flatMap((s) => s.rows);
const failureCount = (t, d) =>
  rows(t, d)
    .filter((e) => e.kind === 'failure')
    .reduce((n, e) => n + e.sets, 0);
const weekCount = (t) => P.days.reduce((n, d) => n + failureCount(t, d), 0);
test('52-week calendar reproduces 2,064 work sets and 104 distinct bench days', () => {
  let total = 0,
    benches = 0;
  for (let cycle = 1; cycle <= 4; cycle++)
    for (let week = 1; week <= 13; week++) {
      const t = config(week, { cycle, entryStage: Math.min(week, 3) });
      total += weekCount(t);
      const days = P.days.filter((d) => rows(t, d).some((e) => e.id === 'bench'));
      assert.equal(days.length, 2);
      assert.deepEqual(days, week === 12 ? ['monday', 'saturday'] : ['tuesday', 'friday']);
      assert.deepEqual(rows(t, days[0]).find((e) => e.id === 'bench').repRange, [3, 5]);
      benches += days.length;
    }
  assert.equal(total, 2064);
  assert.equal(benches, 104);
});
test('entry, Friday-11 and pivot failure doses match the program', () => {
  assert.equal(weekCount(config(1, { entryStage: 1 })), 28);
  assert.equal(weekCount(config(2, { entryStage: 2 })), 36);
  assert.equal(weekCount(config(3)), 44);
  assert.equal(failureCount(config(11), 'tuesday'), 22);
  assert.equal(failureCount(config(11), 'friday'), 14);
  assert.equal(weekCount(config(12)), 2);
  assert.equal(weekCount(config(13)), 44);
});
test('both failure days use the exact revised menu, order, reps and set allocation', () => {
  for (const d of ['tuesday', 'friday']) {
    const list = rows(config(), d).filter((e) => e.kind === 'failure');
    assert.deepEqual(
      list.map((e) => [e.id, e.sets, e.repRange]),
      [
        [d === 'tuesday' ? 'front_squat' : 'back_squat', 1, [4, 6]],
        ['bench', 1, d === 'tuesday' ? [3, 5] : [6, 8]],
        ['incline', 3, [6, 10]],
        ['lateral', 4, [12, 20]],
        ['row', 2, [8, 12]],
        ['pulldown', 1, [8, 12]],
        ['shrug', 1, [10, 15]],
        ['rear_delt', 1, [12, 20]],
        ['curl', 1, [8, 12]],
        ['triceps', 1, [10, 15]],
        ['leg_curl', 2, [8, 12]],
        ['calf', 2, [10, 15]],
        ['leg_ext', 1, [10, 15]],
        ['crunch', 1, [10, 15]],
      ],
    );
    assert.match(list.find((e) => e.id === 'triceps').name, /Overhead/);
    assert.match(list.find((e) => e.id === 'calf').name, /Standing/);
    assert.match(list.find((e) => e.id === 'leg_ext').name, /reclined/);
    assert.ok(list.every((e) => e.rir === 0 && e.rest >= 150));
  }
});
test('Foundation work totals 28 snatches, 13 cleans, 19 jerks and 6 pulls', () => {
  const all = P.days.flatMap((d) => rows(config(), d));
  const reps = (id) =>
    all
      .filter((e) => e.id === id)
      .reduce((n, e) => n + e.sets * (e.reps === '1+1' ? 1 : Number(e.reps)), 0);
  assert.equal(reps('snatch') + reps('hang'), 28);
  assert.equal(reps('cj'), 13);
  assert.equal(reps('cj') + reps('jerk'), 19);
  assert.equal(reps('pull'), 6);
});
test('phase loads and earned heavy slots never create unearned >90% base work', () => {
  const expected = {
    3: {
      monday: [
        [6, 2, [65, 75]],
        [3, '1+1', [60, 70]],
      ],
      tuesday: [
        [6, '1+1', [65, 75]],
        [3, 2, [55, 65]],
      ],
    },
    6: {
      monday: [
        [6, 2, [70, 80]],
        [3, '1+1', [65, 75]],
      ],
      tuesday: [
        [6, '1+1', [72, 82]],
        [3, 2, [60, 70]],
      ],
    },
    10: {
      monday: [
        [5, 1, [78, 85]],
        [3, '1+1', [70, 78]],
      ],
      tuesday: [
        [5, '1+1', [78, 85]],
        [3, 1, [65, 75]],
      ],
    },
  };
  for (const [week, days] of Object.entries(expected))
    for (const [d, values] of Object.entries(days))
      assert.deepEqual(
        rows(config(Number(week)), d)
          .filter((e) => e.kind === 'quality')
          .map((e) => [e.sets, e.reps, e.range]),
        values,
      );
  for (const week of [6, 10, 11])
    for (const ex of rows(config(week), 'friday').filter((e) => e.kind === 'quality'))
      assert.ok(ex.sequence.every((r) => r[1] <= 90));
  const t = config(10, { heavy: { snatch: 95, cj: 92, extraSnatch: 3, extraCj: 3 } }),
    a = rows(t, 'monday')[0];
  assert.equal(a.sets, 5);
  assert.equal(a.repSequence.at(-1), 1);
  assert.deepEqual(a.sequence.at(-1), [90, 92]);
});
test('unknown RJ uses CJ light technique and never power clean or inferred max', () => {
  for (const week of [3, 6, 10]) {
    const r = rows(config(week), 'thursday').find((e) => e.id === 'jerk');
    assert.equal(r.anchor, 'cj');
    assert.deepEqual([r.sets, r.reps, r.range, r.effort], [3, 2, [50, 70], 6]);
  }
  const t = config(6);
  t.anchors.jerk = 200;
  const r = rows(t, 'thursday').find((e) => e.id === 'jerk');
  assert.deepEqual([r.sets, r.reps, r.range, r.anchor], [4, 1, [85, 95], 'jerk']);
});
test('weeks 4/8 hold the preceding prescription, not automatic deloads', () => {
  for (const [held, previous] of [
    [4, 3],
    [8, 7],
  ])
    for (const d of P.days) assert.deepEqual(rows(config(held), d), rows(config(previous), d));
});
test('uncleared phase gates hold the appropriate phase', () => {
  assert.equal(P.dayPlan(config(6, { phaseGate: 'F' }), 'monday').phase, 'F');
  assert.deepEqual(rows(config(10, { phaseGate: 'B' }), 'monday')[0].range, [70, 80]);
  assert.deepEqual(rows(config(12, { phaseGate: 'B' }), 'friday')[0].range, [75, 85]);
});
test('split changes distribution to 9 + 13 without changing exercise work', () => {
  for (const d of ['tuesday', 'friday']) {
    const split = P.dayPlan(config(3, { split: true }), d).sessions;
    assert.deepEqual(
      split.map((s) => s.rows.filter((e) => e.kind === 'failure').reduce((n, e) => n + e.sets, 0)),
      [9, 13],
    );
    assert.deepEqual(
      split.flatMap((s) => s.rows),
      rows(config(), d),
    );
  }
});
test('taper Friday is three scored attempts per lift; Saturday only moderate bench', () => {
  assert.deepEqual(
    rows(config(12), 'friday').map((e) => [e.id, e.sets, e.test]),
    [
      ['snatch', 3, true],
      ['cj', 3, true],
    ],
  );
  assert.deepEqual(
    rows(config(12), 'saturday').map((e) => [e.id, e.repRange]),
    [['bench', [6, 8]]],
  );
  for (const d of ['monday', 'thursday'])
    assert.deepEqual(
      rows(config(13), d).map((e) => [e.id, e.sets, e.range]),
      [
        ['snatch', 4, [60, 70]],
        ['cj', 3, [60, 70]],
      ],
    );
  for (const d of ['tuesday', 'friday'])
    assert.ok(rows(config(13), d).every((e) => e.kind === 'failure'));
});
test('cutting is initially identical and the base configuration is never mutated', () => {
  const t = config(),
    snapshot = JSON.stringify(t);
  for (const d of P.days) assert.deepEqual(rows({ ...t, cutting: true }, d), rows(t, d));
  P.dayPlan(t, 'tuesday', { readiness: 'amber' });
  assert.equal(JSON.stringify(t), snapshot);
});
test('amber omits ALL conventional work and reduces Olympic sets with floor', () => {
  const p = P.dayPlan(config(), 'tuesday', { readiness: 'amber' }),
    es = p.sessions.flatMap((s) => s.rows);
  assert.ok(es.every((e) => e.kind === 'quality'));
  assert.deepEqual(
    es.map((e) => e.sets),
    [4, 2],
  );
  assert.ok(es.every((e) => e.effort <= 7));
  const red = P.dayPlan(config(), 'tuesday', { readiness: 'red' });
  assert.ok(red.sessions.every((s) => s.skipped));
});
test('targeted reductions and reset respect the failure-scope exceptions', () => {
  const target = rows(config(3, { recovery: 'targeted' }), 'tuesday');
  assert.equal(target.find((e) => e.id === 'incline').sets, 2);
  assert.equal(target.find((e) => e.id === 'lateral').sets, 2);
  assert.equal(target.find((e) => e.id === 'row').sets, 1);
  const reset = rows(config(3, { recovery: 'reset' }), 'tuesday');
  assert.deepEqual(
    reset.filter((e) => e.kind === 'failure').map((e) => e.id),
    ['bench'],
  );
  assert.ok(reset.filter((e) => e.kind === 'quality').every((e) => e.effort === 6));
});
test('athletics and aerobics require explicit introduction, taper omits them, week 11 halves Monday only', () => {
  for (const week of [1, 5, 9, 13])
    for (const d of P.days)
      assert.ok(P.dayPlan(config(week), d).sessions.every((s) => s.kind === 'lifting'));
  const t = config(11, {
    athletics: { enabled: true, stage: 7, day: 'thursday', secondary: 2, variation: 'none' },
    cardio: { enabled: true, minutes: 60 },
  });
  const field = P.dayPlan(t, 'monday').sessions.find((s) => s.kind === 'field');
  assert.deepEqual(
    field.rows.map((e) => e.sets),
    [3, 2],
  );
  assert.equal(P.dayPlan(t, 'thursday').sessions.filter((s) => s.kind === 'field').length, 0);
  t.week = 12;
  for (const d of P.days) assert.ok(P.dayPlan(t, d).sessions.every((s) => s.kind === 'lifting'));
});
test('overhead trial replaces incline, pauses week 12/13; week 11 respects one set per exercise', () => {
  const trial = { kind: 'press', day: 'friday' };
  assert.equal(weekCount(config(6, { trial })), 44);
  const w11 = rows(config(11, { trial }), 'friday');
  assert.ok(w11.some((e) => e.id === 'press'));
  assert.ok(!w11.some((e) => e.id === 'incline'));
  assert.equal(failureCount(config(11, { trial }), 'friday'), 14);
  assert.ok(!rows(config(13, { trial }), 'friday').some((e) => e.id === 'press'));
});
test('clean/RJ assessments are replacements with explicit Foundation effort exception', () => {
  const c = rows(config(4, { assessment: 'clean' }), 'tuesday').filter((e) => e.kind === 'quality');
  assert.equal(c.find((e) => e.id === 'cj').sets, 3);
  assert.equal(c.find((e) => e.id === 'clean').effort, 8);
  const t = config(6, { assessment: 'jerk' });
  t.anchors.jerk = 200;
  const j = rows(t, 'thursday').find((e) => e.id === 'jerk');
  assert.equal(j.sets, 4);
  assert.ok(j.assessment);
  assert.match(j.warmup, /Replaces/);
});
test('all plan/session/row identifiers are unique under every week and recovery mode', () => {
  for (let week = 1; week <= 13; week++)
    for (const split of [false, true])
      for (const recovery of ['normal', 'targeted', 'reset'])
        for (const readiness of ['green', 'amber', 'red'])
          for (const d of P.days) {
            const p = P.dayPlan(config(week, { split, recovery }), d, { readiness });
            assert.equal(new Set(p.sessions.map((s) => s.id)).size, p.sessions.length);
            for (const s of p.sessions) {
              assert.equal(new Set(s.rows.map((e) => e.key)).size, s.rows.length);
              assert.ok(Number.isFinite(s.totalMin));
              for (const e of s.rows) if (!e.minutes) assert.ok(e.sets > 0);
            }
          }
});
test('established set trials remain after a new trial starts and obey week 11/pivot overrides', () => {
  const established = [
    { kind: 'set', day: 'tuesday', exercise: 'shrug' },
    { kind: 'set', day: 'friday', exercise: 'shrug' },
  ];
  assert.equal(weekCount(config(6, { established })), 46);
  assert.equal(
    weekCount(
      config(6, { established, trial: { kind: 'set', day: 'tuesday', exercise: 'lateral' } }),
    ),
    47,
  );
  assert.equal(failureCount(config(11, { established }), 'friday'), 14);
  assert.equal(weekCount(config(13, { established })), 44);
});
test('targeted A-to-B and C-to-D controls reduce only the implicated work', () => {
  const t = config(6, {
    reduceMondaySnatch: true,
    reduceCJerk: true,
    trial: { kind: 'pause_jerk', day: 'thursday' },
  });
  t.anchors.jerk = 200;
  assert.equal(rows(t, 'monday')[0].sets, 4);
  const c = rows(t, 'thursday');
  assert.equal(c.find((e) => e.id === 'jerk').sets, 3);
  assert.ok(!c.some((e) => e.id === 'pause_jerk'));
});
test('a local Monday reduction truncates previously earned heavy/double sequences to the reduced budget', () => {
  const { MODEL: M } = require('../js/model');
  const t = config(6, {
      reduceMondaySnatch: true,
      heavy: { snatch: 92, cj: 0, extraSnatch: 3, extraCj: 0 },
    }),
    ex = rows(t, 'monday')[0];
  assert.equal(ex.sets, 4);
  assert.equal(M.qualityState(ex, []).planned, 8);
});
