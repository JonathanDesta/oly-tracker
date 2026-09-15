import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  localDate,
  startSession,
  stopSession,
  omissionRecord,
  deleteSession,
  benchWindow,
  consumedBench,
  exposureHistory,
  nextLoad,
} from "../src/training.js";
import { failure } from "../src/prescription.js";
import { trialExposures } from "../src/review.js";
import { validate, saveStore, loadStore } from "../src/storage.js";

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
function ended(s, day = "monday", id = "main", now = mon) {
  startSession(s, day, id, now);
  stopSession(s, "Test run", now + 5000);
  return s.records.at(-1);
}
function reference(s, id, lift, load, previousLoad, legacy = false) {
  const r = {
    ...structuredClone(s.records[0]),
    id,
    anchors: { ...s.training.anchors, [lift]: previousLoad },
  };
  s.records.push(r);
  s.reviews.push({
    at: mon,
    type: "Demonstrated reference",
    sessionId: id,
    lift,
    load,
    ...(legacy ? {} : { previousLoad }),
  });
  s.training.anchors[lift] = load;
}

test("deleting an ended test persists and reopens the same workout", () => {
  let s = ready();
  const r = ended(s),
    store = new Map(),
    storage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    };
  assert.equal(r.sets.length, 0);
  assert.throws(
    () => startSession(s, "monday", "main", mon),
    /already resolved/,
  );
  s = saveStore(storage, s);
  const settings = structuredClone(s.training);
  assert.deepEqual(deleteSession(s, r.id), {
    day: "monday",
    currentWeek: true,
  });
  assert.deepEqual(s.training, settings);
  s = saveStore(storage, s);
  const restored = loadStore(storage).state;
  assert.equal(restored.records.length, 0);
  startSession(restored, "monday", "main", mon + 6000);
  assert.notEqual(restored.active.id, r.id);
  validate(restored);
});

test("deletion rejects missing IDs and active workouts without mutations", () => {
  const s = ready(),
    r = ended(s);
  const before = structuredClone(s);
  assert.throws(() => deleteSession(s, "missing"), /no longer exists/);
  assert.deepEqual(s, before);
  const tue = mon + 86400000;
  s.readiness.date = localDate(new Date(tue));
  startSession(s, "tuesday", "main", tue);
  const active = structuredClone(s);
  assert.throws(() => deleteSession(s, r.id), /Finish the active session/);
  assert.deepEqual(s, active);
});

test("omitted, mobility-only and aerobic sessions can all be removed and run again", () => {
  const omitted = ready();
  omissionRecord(omitted, "monday", "main", "Testing", mon);
  deleteSession(omitted, omitted.records[0].id);
  startSession(omitted, "monday", "main", mon);
  validate(omitted);
  const wed = mon + 2 * 86400000;
  for (const id of ["mobility", "cardio"]) {
    const s = ready(wed);
    s.training.mobility = ["Ankle · bent-knee calf stretch, heel down"];
    s.training.cardio.enabled = true;
    const r = ended(s, "wednesday", id, wed);
    deleteSession(s, r.id);
    startSession(s, "wednesday", id, wed + 10000);
    assert.equal(s.active.session.id, id);
    validate(s);
  }
});

test("deleting older history preserves the current schedule and unrelated records and reviews", () => {
  const s = ready(),
    r = ended(s);
  r.weekId = "older-week";
  const retained = structuredClone(r);
  retained.id = "keep";
  s.records.push(retained);
  s.reviews.push({ at: mon, type: "Weekly review", notes: "Keep this review" });
  s.dates.friday = "2026-09-19";
  const before = structuredClone(s);
  assert.deepEqual(deleteSession(s, r.id), {
    day: "monday",
    currentWeek: false,
  });
  assert.deepEqual(s.records, [retained]);
  for (const key of ["training", "dates", "weekId", "weekStart", "reviews"])
    assert.deepEqual(s[key], before[key]);
  validate(s);
});

test("deleted bench work and archived copies stop blocking spacing and relocated slots", () => {
  for (const linked of [true, false]) {
    const s = ready(),
      r = ended(s);
    r.session.id = "rescue-bench_low";
    r.sets = [{ key: "bench_low", exerciseId: "bench", weight: 225, at: mon }];
    const older = structuredClone(r);
    older.id = "keep-older-bench";
    older.weekId = "old";
    older.sets[0].at = mon - 3 * 86400000;
    s.records.unshift(older);
    s.benchReservations.push({
      weekId: s.weekId,
      slot: "bench_low",
      ...(linked ? { sessionId: r.id } : {}),
    });
    const snapshot = structuredClone(s);
    snapshot.active = structuredClone(r);
    snapshot.legacy = { log: { copy: structuredClone(r) } };
    snapshot.legacyArchives = [{ activeWorkout: structuredClone(r) }];
    s.archives.push(snapshot);
    assert.equal(benchWindow(s, mon + 10000).ready, false);
    assert.equal(consumedBench(s, "bench_low"), true);
    deleteSession(s, r.id);
    assert.equal(benchWindow(s, mon + 10000).ready, true);
    assert.equal(consumedBench(s, "bench_low"), false);
    assert.deepEqual(s.benchReservations, []);
    assert.deepEqual(s.archives[0].benchReservations, []);
    assert.deepEqual(s.records, [older]);
    assert.equal(s.archives[0].active, null);
    assert.deepEqual(s.archives[0].legacy.log, {});
    assert.equal(s.archives[0].legacyArchives[0].activeWorkout, null);
  }
});

test("deletion removes progression and assistance exposure credit", () => {
  const s = ready(),
    r = ended(s);
  const e = failure("bench", 1, 3, 5, 270, {
    key: "bench_low",
    trialId: "trial",
  });
  r.session.rows = [e];
  r.context = { level: "green", event: "normal", recovery: "normal" };
  r.followup = { normal: true };
  r.status = "complete";
  r.omissions = [];
  r.sets = [
    {
      key: e.key,
      exerciseId: "bench",
      weight: 225,
      reps: 5,
      endpoint: "failure",
      at: mon,
    },
  ];
  const second = structuredClone(r);
  second.id = "second";
  s.records.push(second);
  const trial = { id: "trial", day: "tuesday" };
  assert.equal(nextLoad(e, exposureHistory(s, e)).weight, 227.5);
  assert.equal(trialExposures(s, trial).length, 2);
  deleteSession(s, second.id);
  assert.equal(nextLoad(e, exposureHistory(s, e)).weight, 225);
  assert.equal(trialExposures(s, trial).length, 1);
});

test("reference rollback supports new and existing records and any deletion order", () => {
  for (const legacy of [true, false]) {
    for (const order of [
      ["first", "second"],
      ["second", "first"],
    ]) {
      const s = ready();
      ended(s);
      reference(s, "first", "snatch", 160, 155, legacy);
      reference(s, "second", "snatch", 165, 160, legacy);
      const snapshots = structuredClone(s.records);
      deleteSession(s, order[0]);
      assert.equal(s.training.anchors.snatch, order[0] === "first" ? 165 : 160);
      for (const r of s.records)
        assert.deepEqual(
          r,
          snapshots.find((old) => old.id === r.id),
        );
      deleteSession(s, order[1]);
      assert.equal(s.training.anchors.snatch, 155);
      assert.deepEqual(s.reviews, []);
      validate(s);
    }
  }
});

test("deleting an assessment restores an unset or lower reference but preserves later manual changes", () => {
  const s = ready();
  ended(s);
  reference(s, "assessment", "jerk", 190, null);
  deleteSession(s, "assessment");
  assert.equal(s.training.anchors.jerk, null);
  reference(s, "assessment-lower", "snatch", 150, 155);
  deleteSession(s, "assessment-lower");
  assert.equal(s.training.anchors.snatch, 155);
  reference(s, "test", "snatch", 160, 155);
  s.reviews.push({
    at: mon,
    type: "Demonstrated reference",
    lift: "snatch",
    load: 170,
    previousLoad: 160,
  });
  s.training.anchors.snatch = 170;
  deleteSession(s, "test");
  assert.equal(s.training.anchors.snatch, 170);
  assert.equal(s.reviews.length, 1);
  validate(s);
  s.reviews[0].previousLoad = "invalid";
  assert.throws(() => validate(s), /review/);
});
