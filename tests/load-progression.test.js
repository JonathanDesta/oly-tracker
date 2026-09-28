import test from "node:test";
import assert from "node:assert/strict";
import { nextLoad, fresh, planFor, exposureHistory } from "../src/training.js";
import { failureProgression, FAILURE_POLICY } from "../src/failure-policy.js";
const row = { id: "bench", key: "bench_low", sets: 2, repRange: [3, 5] };
const history = (reps, weights = reps.map(() => 225)) => [
  {
    row,
    sets: reps.map((reps, i) => ({
      reps,
      weight: weights[i],
      endpoint: "failure",
    })),
    record: { omissions: [] },
    normal: false,
  },
];
test("previous workout alone: every set at or above top raises 10; any short set lowers 10", () => {
  for (const reps of [
    [5, 5],
    [6, 7],
  ])
    assert.equal(nextLoad(row, history(reps), 2.5).weight, 235);
  for (const reps of [
    [5, 4],
    [3, 3],
  ])
    assert.equal(nextLoad(row, history(reps)).weight, 225);
  for (const reps of [
    [2, 5],
    [5, 2],
  ])
    assert.equal(nextLoad(row, history(reps)).weight, 215);
  assert.equal(
    nextLoad({ ...row, hold: true, checkpoint: true }, history([5, 5])).weight,
    235,
  );
  assert.equal(
    nextLoad({ ...row, sets: 3 }, history([5, 5])).weight,
    235,
    "previous prescribed count governs completion during ramp changes",
  );
  assert.equal(
    nextLoad(row, history([5])).weight,
    225,
    "partial exercise cannot increase",
  );
  const h = history([5, 5]);
  h[0].sets[1].endpoint = "pain";
  assert.equal(nextLoad(row, h).weight, 225);
});
test("dumbbells change 5 per hand and very light loads never become nonpositive", () => {
  for (const name of [
    "Dumbbell incline press",
    "Supported dumbbell row",
    "Dumbbell lateral raise",
    "Supported dumbbell wrist curl",
    "Supported dumbbell hammer curl",
  ])
    assert.equal(nextLoad({ ...row, name }, history([5, 5])).weight, 230);
  assert.equal(
    nextLoad({ ...row, loadUnit: "per dumbbell" }, history([1, 2], [5, 5]))
      .weight,
    null,
  );
  const s = fresh("2026-09-21", "weekday", "all-failure");
  for (const day of ["monday", "thursday", "friday"])
    for (const e of planFor(s, day).sessions.flatMap((s) => s.rows))
      if (/dumbbell/i.test(e.name)) assert.equal(e.loadUnit, "per dumbbell");
});
test("Olympic recommendations count completed valid reps in every set, excluding terminal misses", () => {
  const e = {
      sets: 2,
      key: "snatch",
      validRepRange: [2, 4],
      endpointPolicy: FAILURE_POLICY,
    },
    set = (n) => [
      ...Array.from({ length: n }, () => ({
        weight: 125,
        outcome: "make",
        grade: "A",
      })),
      { weight: 125, outcome: "miss", grade: "C" },
    ],
    h = (a, b) => [
      { row: e, record: { omissions: [] }, sets: [...set(a), ...set(b)] },
    ];
  assert.equal(failureProgression(e, h(4, 5)).weight, 135);
  assert.equal(failureProgression(e, h(4, 3)).weight, 125);
  assert.equal(failureProgression(e, h(4, 1)).weight, 115);
  const fatigue = h(4, 4);
  fatigue[0].sets.at(-1).endpoint = "fatigue";
  assert.equal(failureProgression(e, fatigue).weight, 125);
});
