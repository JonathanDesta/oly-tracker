import test from "node:test";
import assert from "node:assert/strict";
import { defaults, quality, failure, dayPlan } from "../src/prescription.js";
import {
  fresh,
  localDate,
  addDays,
  scheduledDate,
  startSession,
  stopSession,
  finishSession,
  nextRow,
  rowStatus,
  logSet,
  qualityStatus,
  benchWindow,
  omissionRecord,
  planFor,
  advanceWeek,
  consumedBench,
  nextLoad,
  easyReturn,
  attempts,
} from "../src/training.js";
import {
  validate,
  loadStore,
  saveStore,
  KEY,
  BACKUP,
  importData,
} from "../src/storage.js";
import { applyChange, reviewTrial } from "../src/review.js";
const mon = new Date("2026-09-14T10:00:00").getTime();
function ready(now = mon) {
  const s = fresh(localDate(new Date(now)));
  s.readiness = {
    date: localDate(new Date(now)),
    level: "green",
    event: "normal",
    local: "",
  };
  return s;
}
function prep(s) {
  s.active.warmup = true;
  s.active.preparations.push(nextRow(s.active).key);
}
function made(weight = 100, other = {}) {
  return { weight, outcome: "make", grade: "A", effort: 6, ...other };
}
function memory(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => (data[k] = v),
    data,
  };
}
test("journal preparation, sequential reps, TECH/pain distinction, omission and immutable snapshots", () => {
  const s = ready();
  startSession(s, "monday", "main", mon);
  assert.throws(() => logSet(s, made(100), mon), /warm-up/);
  prep(s);
  logSet(s, made(100), mon + 1000);
  assert.equal(s.active.sets.length, 1);
  assert.equal(rowStatus(s.active, nextRow(s.active)).count, 1);
  s.training.anchors.snatch = 200;
  assert.equal(s.active.anchors.snatch, 155);
  stopSession(s, "Readiness deteriorated", mon + 5000);
  assert.equal(s.records[0].sets.length, 1);
  assert.equal(s.records[0].status, "partial");
  assert.throws(
    () => startSession(s, "monday", "main", mon + 6000),
    /already resolved/,
  );
  validate(s);
});
test("p.17 consecutive misses and repeated material faults reduce, then stop", () => {
  const e = quality("snatch", 6, 2, [65, 75], "snatch");
  let log = [made(100, { outcome: "miss" }), made(100, { outcome: "miss" })];
  assert.equal(qualityStatus(e, log).cap, 92.5);
  assert.equal(qualityStatus(e, log).stop, false);
  log.push(made(90, { outcome: "miss" }));
  assert.equal(qualityStatus(e, log).stop, true);
  log = [
    made(100, { grade: "C", fault: "forward" }),
    made(100, { grade: "C", fault: "forward" }),
  ];
  assert.equal(qualityStatus(e, log).reduceAt, 1);
  const assessment = { ...e, assessment: true };
  assert.equal(
    qualityStatus(assessment, [made(100, { effort: 8 })]).stop,
    true,
  );
});
test("p.20 actual 48-hour boundary includes old-program and partial bench attempts", () => {
  const s = ready();
  s.archives = [
    {
      revision: 6,
      records: [{ sets: [{ exerciseId: "bench", weight: 200, at: mon }] }],
    },
  ];
  assert.equal(benchWindow(s, mon + 48 * 3600000 - 1).ready, false);
  assert.equal(benchWindow(s, mon + 48 * 3600000).ready, true);
});
test("p.23 late B rolls C/D and no compressed out-of-order sessions", () => {
  const s = ready();
  omissionRecord(s, "monday", "main", "Travel", mon);
  const wed = mon + 2 * 86400000;
  s.readiness.date = localDate(new Date(wed));
  startSession(s, "tuesday", "main", wed);
  assert.equal(scheduledDate(s, "thursday"), "2026-09-18");
  assert.equal(scheduledDate(s, "friday"), "2026-09-19");
  stopSession(s, "Done for today", wed + 60000);
  assert.throws(
    () => startSession(s, "friday", "main", wed + 120000),
    /scheduled later/,
  );
});
test("p.20 missing low bench occupies D; separate rescue cannot be repeated", () => {
  const s = ready();
  s.training.entry = 3;
  const fri = mon + 4 * 86400000;
  s.readiness.date = localDate(new Date(fri));
  for (const day of ["monday", "tuesday", "thursday"])
    omissionRecord(s, day, "main", "Missed", mon);
  const bench = planFor(s, "friday").sessions[0].rows.find(
    (e) => e.id === "bench",
  );
  assert.equal(bench.key, "bench_low");
  startSession(s, "tuesday", "rescue", fri, { rescue: "bench_low" });
  prep(s);
  logSet(s, { weight: 225, reps: 4, endpoint: "failure" }, fri + 1000);
  finishSession(s, "", fri + 1000);
  assert.ok(consumedBench(s, "bench_low"));
  assert.throws(
    () =>
      startSession(s, "tuesday", "rescue", fri + 2000, { rescue: "bench_low" }),
    /already has an exposure/,
  );
  assert.throws(
    () =>
      startSession(s, "friday", "rescue", fri + 2000, {
        rescue: "bench_moderate",
      }),
    /Bench is eligible/,
  );
});
test("p.19 test-week second bench must be after test", () => {
  const s = ready();
  s.training.week = 12;
  assert.throws(
    () =>
      startSession(s, "friday", "rescue", mon, { rescue: "bench_moderate" }),
    /low-rep bench slot comes first/,
  );
  s.records.push({
    id: "low",
    day: "monday",
    session: { id: "main", rows: [] },
    weekId: s.weekId,
    sets: [{ key: "bench_low", exerciseId: "bench", at: mon - 3 * 86400000 }],
  });
  assert.throws(
    () =>
      startSession(s, "friday", "rescue", mon, { rescue: "bench_moderate" }),
    /Complete the Olympic test/,
  );
});
test("p.20 load progression uses actual endpoints, two exposures, overshoot correction in held weeks", () => {
  const e = failure("bench", 1, 3, 5, 270, { key: "bench_low" }),
    ex = (reps, normal = true) => ({
      normal,
      sets: [{ weight: 225, reps, endpoint: "failure" }],
    });
  assert.equal(nextLoad(e, [ex(5)]).weight, 225);
  assert.equal(nextLoad(e, [ex(5), ex(5)]).weight, 227.5);
  assert.equal(nextLoad({ ...e, hold: true }, [ex(6)]).weight, 227.5);
  assert.equal(nextLoad(e, [ex(2)]).weight, 208.125);
  assert.equal(nextLoad(e, [ex(6, false)]).weight, 225);
});
test("reactive reduction restores gradually and does not advance calendar prematurely", () => {
  const s = ready();
  s.training.week = 6;
  s.training.recovery = "targeted";
  const r = {
    notes: "Performance is normal again",
    recovery: "normal",
    green: true,
    action: "advance",
  };
  advanceWeek(s, r, mon);
  assert.equal(s.training.recovery, "restore");
  assert.equal(s.training.week, 6);
  advanceWeek(s, r, mon);
  assert.equal(s.training.week, 6);
});
test("controlled additions require source gates; continuity survives pause and week change", () => {
  const s = ready();
  const change = {
    kind: "press",
    ready: true,
    stable: true,
    reason:
      "Three comparable observations; fixation support; two stable weeks.",
  };
  assert.throws(() => applyChange(s, change), /not eligible/);
  s.training.entry = 3;
  applyChange(s, change, mon);
  assert.equal(s.training.trials[0].day, "friday");
  assert.throws(
    () =>
      applyChange(s, {
        ...change,
        kind: "squat",
        exercise: "front_squat",
        day: "tuesday",
      }),
    /existing controlled trial/,
  );
  const id = s.training.trials[0].id;
  reviewTrial(s, id, "pause", "Reassess after interruption");
  assert.equal(s.training.trials[0].id, id);
  reviewTrial(s, id, "resume", "Secure load and repeat tolerance check");
  assert.equal(s.training.trials[0].startedAt, mon);
  s.training.week = 9;
  assert.throws(
    () => applyChange(s, { ...change, kind: "cardio_start" }),
    /not eligible/,
  );
});
test("validated storage recovery, cross-tab conflicts, failure atomicity and archives", () => {
  const m = memory(),
    s = ready();
  const saved = saveStore(m, s);
  assert.equal(saved.version, 1);
  assert.equal(loadStore(m).state.version, 1);
  assert.throws(() => saveStore(m, s), /Another tab/);
  m.setItem(BACKUP, JSON.stringify(saved));
  m.setItem(KEY, "{broken");
  const recovered = loadStore(m);
  assert.equal(recovered.state.version, 1);
  assert.ok(recovered.recovered);
  const old = {
    revision: 6,
    training: { week: 8 },
    records: [],
    activeWorkout: { notes: "preserve exact" },
  };
  const migrated = importData(old);
  assert.deepEqual(migrated.archives[0], old);
  assert.equal(migrated.training.entry, 1);
  const bad = structuredClone(saved);
  bad.training.anchors.cj = -1;
  assert.throws(() => validate(bad), /anchors/);
  assert.throws(() => importData({ hello: "world" }), /not a recognized/);
  const full = {
    getItem: () => null,
    setItem: () => {
      throw Error("QuotaExceeded");
    },
  };
  assert.throws(() => saveStore(full, s), /QuotaExceeded/);
  assert.equal(s.version, 0);
});
test("p.17 easy return is capped by remaining attempts and removes failure work", () => {
  const s = ready();
  omissionRecord(s, "monday", "main", "skip", mon);
  s.readiness.date = "2026-09-15";
  startSession(s, "tuesday", "main", mon + 86400000);
  prep(s);
  logSet(s, made(130), mon + 86401000);
  const remaining = attempts(nextRow(s.active)) - 1;
  easyReturn(s);
  assert.ok(attempts(nextRow(s.active)) <= 1 + Math.min(4, remaining));
  assert.ok(
    s.active.session.rows
      .filter((e) => e.kind === "failure")
      .every((e) => rowStatus(s.active, e).done),
  );
});
test("a reviewed repeat opens a new exposure without changing phase week or duplicating old work", () => {
  const s = ready(),
    weekId = s.weekId;
  omissionRecord(s, "monday", "main", "Synthetic hold", mon);
  advanceWeek(
    s,
    {
      action: "hold",
      green: true,
      recovery: "normal",
      notes: "Repeat the current phase dose",
    },
    mon,
  );
  assert.equal(s.training.week, 1);
  assert.notEqual(s.weekId, weekId);
  assert.equal(s.weekStart, "2026-09-21");
});
test("Olympic double timer uses reset between reps and full rest between sets", () => {
  const s = ready();
  startSession(s, "monday", "main", mon);
  prep(s);
  logSet(s, made(100), mon);
  assert.equal(s.restEnd, mon + 15000);
  logSet(s, made(100), mon + 20000);
  assert.equal(s.restEnd, mon + 20000 + 150000);
});
test("restoration grows from a recovered reduced exposure, not only from normal-dose records", () => {
  const s = ready();
  s.training.recovery = "restore";
  startSession(s, "monday", "main", mon);
  prep(s);
  logSet(s, made(100), mon);
  logSet(s, made(100), mon + 20000);
  stopSession(s, "Other lift omitted for fixture", mon + 60000);
  s.records[0].followup = { normal: true };
  const row = planFor(s, "monday").sessions[0].rows.find(
    (e) => e.id === "snatch",
  );
  assert.equal(row.sets, 2);
});
test("direct rack progression remains available in Realization but not checkpoints", () => {
  const s = ready();
  Object.assign(s.training, { entry: 3, week: 9, gate: "R" });
  s.training.anchors.jerk = 200;
  applyChange(s, {
    kind: "rack",
    ready: true,
    stable: true,
    reason: "Two secure C exposures at 190",
    baselineLoad: 190,
    load: 195,
  });
  assert.equal(s.training.rackLoad, 195);
  s.training.week = 8;
  assert.throws(
    () =>
      applyChange(s, {
        kind: "rack",
        ready: true,
        stable: true,
        reason: "test",
        baselineLoad: 195,
        load: 200,
      }),
    /not eligible/,
  );
});

test("nested restored archives still enforce the most recent real bench timestamp", () => {
  const s = ready();
  s.archives = [
    {
      archives: [
        {
          legacy: {
            log: { a: { setsLogged: { bench: [{ exId: "bench", ts: mon }] } } },
          },
        },
      ],
    },
    null,
    { records: "unparsed legacy metadata" },
  ];
  assert.equal(benchWindow(s, mon + 1000).ready, false);
  assert.equal(benchWindow(s, mon + 48 * 3600000).ready, true);
});
