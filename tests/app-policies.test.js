'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const { PROGRAM: P } = require('../js/program'),
  { MODEL: M } = require('../js/model');
function app() {
  const store = new Map(),
    inputs = {},
    ctx = vm.createContext({
      PROGRAM: P,
      MODEL: M,
      console,
      Date,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      JSON,
      URL,
      Blob,
      navigator: {},
      window: { addEventListener() {} },
      document: {
        addEventListener() {},
        getElementById(id) {
          return (
            inputs[id] || {
              hidden: false,
              textContent: '',
              innerHTML: '',
              close() {},
              showModal() {},
            }
          );
        },
        querySelectorAll() {
          return [];
        },
      },
      localStorage: { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
      schedulePush() {},
    });
  vm.runInContext(fs.readFileSync(require.resolve('../js/app'), 'utf8'), ctx);
  return { ctx, store, inputs, run: (code) => vm.runInContext(code, ctx) };
}
test('migration preserves all old data including unfinished work without repurposing old maxes', () => {
  const old = {
    schemaVersion: 3,
    maxes: { snatch: 160, clean: 255, jerk: 205 },
    program: { blockId: 7 },
    log: { old: { foo: 1 } },
    activeWorkout: { id: 'old-active', setsLogged: { a: [1] } },
  };
  const out = M.migrate(old);
  assert.deepEqual(out.legacy, old);
  assert.equal(out.activeWorkout, null);
  assert.equal(out.training.anchors.clean, null);
  assert.equal(out.training.anchors.jerk, null);
  assert.equal(out.training.anchors.snatch, 155);
  assert.equal(out.records.length, 0);
  assert.equal(out.training.week, 1);
});
test('Revision 6 roundtrip keeps active snapshots, logs, reviews and timestamps', () => {
  const state = M.migrate({});
  state.training.anchors.jerk = 210;
  state.records = [{ id: 'one', session: { rows: [] }, sets: [] }];
  state.activeWorkout = {
    id: 'active',
    session: { rows: [] },
    omitted: [],
    sets: [{ exerciseId: 'bench', at: 123 }],
  };
  state.restEnd = 123456;
  assert.deepEqual(M.migrate(JSON.parse(JSON.stringify(state))), state);
});
test('legacy snapshot cannot erase a newer saved Revision 6 copy', () => {
  const a = app(),
    state = M.migrate({});
  state.records = [{ id: 'keep', session: { rows: [] }, sets: [] }];
  state.training.week = 6;
  a.store.set('oly_rev6_backup', JSON.stringify(state));
  a.store.set('oly_state', JSON.stringify({ maxes: { clean: 255 }, log: {} }));
  a.run('load()');
  assert.equal(a.run('STATE.training.week'), 6);
  assert.equal(a.run('STATE.records[0].id'), 'keep');
});
test('invalid/corrupt imports fail without turning arbitrary JSON into empty user data', () => {
  assert.throws(() => M.migrate(null));
  assert.throws(() => M.migrate([]));
  assert.throws(() => M.migrate({ unrelated: true }));
  const a = app();
  a.store.set('oly_state', '{bad');
  a.run('load();save()');
  assert.equal(a.store.get('oly_state'), '{bad');
});
test('48-hour bench rule uses actual timestamps across week boundaries', () => {
  const at = Date.UTC(2026, 8, 13, 20),
    records = [{ sets: [{ exerciseId: 'bench', at }] }];
  assert.equal(P.benchWindow(records, at + 47 * 3600000).ready, false);
  assert.equal(P.benchWindow(records, at + 48 * 3600000).ready, true);
  const old = M.migrate({
    log: { old: { date: '2026-09-13', setsLogged: { a: [{ exId: 'bench', ts: at }] } } },
  });
  assert.equal(P.benchWindow(M.benchRecords(old), at + 47 * 3600000).ready, false);
});
test('a technique/pain stop cannot earn failure progression; latest poor exposure is not skipped', () => {
  const ex = P.failure('incline', 3, 6, 10, 210);
  const good = {
    normal: true,
    rows: Array.from({ length: 3 }, () => ({ weight: 100, reps: 10, endpoint: 'failure' })),
  };
  const bad = { normal: false, rows: [{ weight: 100, reps: 10, endpoint: 'tech' }] };
  assert.equal(P.nextLoad(ex, [good]).action, 'increase');
  assert.equal(P.nextLoad(ex, [good, bad]).action, 'hold');
  assert.equal(P.nextLoad(ex, [{ ...good, rows: good.rows.slice(0, 2) }]).action, 'hold');
});
test('one-set and low-bench progression require two at-bound exposures; squat/low bench overshoot is corrected once', () => {
  const ex = P.failure('bench', 1, 3, 5, 240, { key: 'bench_low' }),
    atBound = { normal: true, rows: [{ weight: 245, reps: 5, endpoint: 'failure' }] };
  assert.equal(P.nextLoad(ex, [atBound]).action, 'hold');
  assert.equal(P.nextLoad(ex, [atBound, atBound]).action, 'increase');
  assert.equal(
    P.nextLoad(ex, [{ normal: true, rows: [{ weight: 245, reps: 6, endpoint: 'failure' }] }])
      .action,
    'increase',
  );
  assert.equal(
    P.nextLoad(ex, [{ normal: true, rows: [{ weight: 245, reps: 2, endpoint: 'failure' }] }])
      .action,
    'reduce',
  );
  const different = { normal: true, rows: [{ weight: 240, reps: 5, endpoint: 'failure' }] };
  assert.equal(P.nextLoad(ex, [different, atBound]).action, 'hold');
});
test('Olympic double logs account for each rep; misses consume budget and reduction protocol stops after another poor attempt', () => {
  const ex = { kind: 'quality', sets: 3, reps: 2 };
  const bad = { outcome: 'miss', grade: 'C', fault: 'forward', weight: 100 };
  const good = { outcome: 'make', grade: 'A', weight: 92.5 };
  assert.equal(M.qualityState(ex, [bad, bad]).planned, 6);
  assert.equal(M.qualityState(ex, [bad, bad]).loadCap, 92.5);
  assert.equal(M.qualityState(ex, [bad, bad, good, bad]).stop, true);
  assert.equal(M.slotAt(ex, 0), 0);
  assert.equal(M.slotAt(ex, 1), 0);
  assert.equal(M.slotAt(ex, 2), 1);
  const mixed = { ...ex, repSequence: [2, 2, 1] };
  assert.equal(M.qualityState(mixed, []).planned, 5);
});
test('assessments stop at effort 8 or first error without retry', () => {
  const ex = { sets: 5, reps: 1, assessment: true };
  assert.ok(M.qualityState(ex, [{ outcome: 'make', grade: 'A', effort: 8 }]).done);
  assert.ok(M.qualityState(ex, [{ outcome: 'miss', grade: 'C', effort: 6 }]).done);
});
test('week review repeats and advances without recycling session identity or repeating onboarding every cycle', () => {
  const t = P.defaults();
  const repeat = M.reviewAdvance(t, { action: 'repeat', green: false });
  assert.equal(repeat.week, 1);
  assert.equal(repeat.entryStage, 1);
  assert.equal(repeat.exposure, 2);
  const second = M.reviewAdvance(t, { action: 'advance', green: true });
  assert.equal(second.week, 2);
  assert.equal(second.entryStage, 2);
  const next = M.reviewAdvance({ ...t, week: 13 }, { action: 'advance', green: true });
  assert.equal(next.week, 1);
  assert.equal(next.cycle, 2);
  assert.equal(next.onboarding, false);
});
test('dose controls reject simultaneous additions, skipped stages and held-week increases', () => {
  const a = app();
  a.ctx.t = P.defaults();
  a.ctx.n = structuredClone(a.ctx.t);
  a.ctx.n.athletics.enabled = true;
  assert.equal(a.run("validateDose({...t,week:5},n,true,'Two stable green weeks')"), '');
  assert.match(a.run("validateDose({...t,week:8},n,true,'ready')"), /No new dose/);
  a.ctx.n.cardio.enabled = true;
  assert.match(a.run("validateDose({...t,week:5},n,true,'ready')"), /one module/);
  a.ctx.n = structuredClone(a.ctx.t);
  a.ctx.n.athletics.stage = 3;
  assert.match(a.run("validateDose({...t,week:5},n,true,'ready')"), /one athletic step/);
});
test('consecutive misses reduce even when miss directions differ; pull triples retain all reps', () => {
  const ex = { sets: 2, reps: 3, kind: 'quality' };
  const rows = [
    { outcome: 'miss', grade: 'C', fault: 'forward', weight: 100 },
    { outcome: 'miss', grade: 'C', fault: 'backward', weight: 100 },
  ];
  assert.equal(M.qualityState(ex, rows).loadCap, 92.5);
  assert.equal(M.qualityState(ex, []).planned, 6);
  assert.equal(M.slotAt(ex, 2), 0);
  assert.equal(M.slotAt(ex, 3), 1);
});
test('an unready entry week holds its dose and week position', () => {
  const t = M.reviewAdvance(P.defaults(), { action: 'advance', green: false });
  assert.equal(t.week, 1);
  assert.equal(t.entryStage, 1);
});
test('an older Revision 6 mirror also cannot overwrite the newer local backup', () => {
  const a = app(),
    state = M.migrate({});
  state.ts = 200;
  state.training.week = 8;
  a.store.set('oly_rev6_backup', JSON.stringify(state));
  state.ts = 100;
  state.training.week = 3;
  a.store.set('oly_state', JSON.stringify(state));
  a.run('load()');
  assert.equal(a.run('STATE.training.week'), 8);
});
test('a malformed Revision 6 session is rejected before importing it', () => {
  assert.throws(
    () => M.migrate({ revision: 6, training: P.defaults(), records: [{ id: 'bad' }] }),
    /Invalid saved session/,
  );
});
test('unfinished old workouts and separate cloud archives also preserve bench spacing', () => {
  const at = Date.now(),
    state = M.migrate({
      maxes: { bench: 285 },
      activeWorkout: { setsLogged: { b: [{ exId: 'bench', ts: at, weight: 245, reps: 4 }] } },
    });
  assert.equal(P.benchWindow(M.benchRecords(state), at + 1000).ready, false);
  state.legacy = null;
  state.legacyArchives = [{ log: { b: { setsLogged: { x: [{ exId: 'bench', ts: at }] } } } }];
  assert.equal(P.benchWindow(M.benchRecords(state), at + 1000).ready, false);
});
