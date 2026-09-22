import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  startSession,
  nextRow,
  rowStatus,
  chooseOlympicLoad,
  logOlympicSet,
  correctOlympicSet,
  moveExerciseNext,
  stopSession,
  planFor,
  nextQualityRange,
  reassessActive,
  logSet,
  finishSession,
} from "../src/training.js";
import { validate } from "../src/storage.js";
import { fixedSession } from "../src/timeline.js";
import { syncPacing, paceStage, completePaceStage } from "../src/pacing.js";

const now = Date.parse("2026-09-21T15:00:00-05:00");
function ready(stage = 1) {
  const s = fresh("2026-09-21", "weekday", "all-failure");
  Object.assign(s.training, { entry: 3, failureEntry: stage });
  s.readiness = {
    date: "2026-09-21",
    level: "green",
    event: "normal",
    local: "",
  };
  startSession(s, "tuesday", "main", now);
  s.active.warmup = true;
  return s;
}
function prepare(s, weight) {
  const e = nextRow(s.active);
  chooseOlympicLoad(s, e.key, weight);
  s.active.preparations.push(e.key);
  return e;
}
const sync = (w, at) =>
  syncPacing(
    w,
    Object.fromEntries(w.session.rows.map((e) => [e.key, rowStatus(w, e)])),
    at,
  );

test("Olympic weights are self-selected; concise warm-ups use that weight and share preparation", () => {
  const s = ready(),
    w = s.active,
    e = nextRow(w);
  assert.equal(nextQualityRange(w, e), null);
  assert.equal(e.range, undefined);
  prepare(s, 165);
  const sn = w.session.rows.find((e) => e.id === "snatch");
  chooseOlympicLoad(s, sn.key, 125);
  const plan = fixedSession(w.session, w.timeConfig);
  assert.equal(
    plan.stages.filter((p) => p.key === e.key && p.role === "ramp").length,
    4,
  );
  assert.equal(
    plan.stages.filter((p) => p.key === sn.key && p.role === "ramp").length,
    3,
  );
  assert(
    plan.stages.some((p) => p.label.includes("105 lb") && p.key === sn.key),
  );
  assert(
    plan.stages.some(
      (p) => p.key === e.key && p.role === "rest" && p.seconds === 40,
    ),
  );
  assert.deepEqual(validate(s), s);
});

test("one whole-set entry records six good clean-and-jerks and a seventh jerk miss without invented ratings", () => {
  const s = ready(),
    e = prepare(s, 165);
  logOlympicSet(s, { weight: 165, reps: 6, finish: "jerk_miss" }, now + 300000);
  const status = rowStatus(s.active, e);
  assert.equal(status.validReps, 6);
  assert.equal(status.completedSets, 1);
  assert.equal(status.logs.length, 7);
  assert.equal(status.logs.at(-1).outcome, "jerk_miss");
  assert(
    status.logs.every(
      (x) => x.reportedAsSet && x.effort === null && x.at === now + 300000,
    ),
  );
  assert.equal(nextRow(s.active).id, "snatch");
  validate(s);
  stopSession(s, "Stopped synthetic workout", now + 310000);
  const r = s.records[0];
  correctOlympicSet(
    s,
    r.id,
    e.key,
    1,
    { weight: 165, reps: 5, finish: "jerk_miss" },
    now + 400000,
  );
  assert.equal(rowStatus(r, e).validReps, 5);
  assert.equal(r.corrections[0].previous.length, 7);
  r.followup = { normal: true };
  const next = planFor(s, "thursday")
    .sessions.flatMap((x) => x.rows)
    .find((x) => x.id === "cj");
  assert.equal(
    next.workingLoad,
    170,
    "starting-load correction crosses weekdays during introduction",
  );
  validate(s);
});

test("a fatigue stop is not recorded as a missed rep or a completed failure set", () => {
  const s = ready(),
    e = prepare(s, 165);
  logOlympicSet(s, { weight: 165, reps: 6, finish: "fatigue" }, now + 300000);
  const status = rowStatus(s.active, e);
  assert.equal(status.validReps, 6);
  assert.equal(status.done, true);
  assert.equal(status.endpointReached, false);
  assert.equal(status.completedSets, 0);
  assert.match(status.reason, /not logged as a missed rep/);
  validate(s);
});

test("early work-rest endings are explicit, persist, and do not fabricate full recovery", () => {
  const s = ready(4),
    e = prepare(s, 165),
    w = s.active;
  logOlympicSet(s, { weight: 165, reps: 3, finish: "jerk_miss" }, now + 300000);
  sync(w, now + 300000);
  assert.equal(paceStage(w).id, `${e.key}:rest:0`);
  assert.throws(
    () =>
      logOlympicSet(
        s,
        { weight: 165, reps: 2, finish: "jerk_miss" },
        now + 330000,
      ),
    /5 minutes/,
  );
  completePaceStage(w, now + 330000, true);
  sync(w, now + 330000);
  logOlympicSet(s, { weight: 165, reps: 2, finish: "jerk_miss" }, now + 350000);
  assert.equal(rowStatus(s.active, e).completedSets, 2);
  assert.equal(s.active.restOverrides[0].actualSeconds, 30);
  assert.equal(s.active.restOverrides[0].recommendedSeconds, 300);
  validate(s);
});

test("moving an available assistance station keeps Olympic work first, preserves all rows and survives save", () => {
  const s = ready(),
    w = s.active;
  assert.throws(
    () => moveExerciseNext(s, "lateral", now),
    /Olympic lifts first/,
  );
  for (let i = 0; i < 2; i++) {
    prepare(s, 100);
    logOlympicSet(
      s,
      { weight: 100, reps: 3, finish: "miss" },
      now + (i + 1) * 600000,
    );
  }
  const original = w.session.rows.map((e) => e.key).sort();
  moveExerciseNext(s, "lateral", now + 1300000);
  sync(w, now + 1300000);
  assert.equal(nextRow(w).id, "lateral");
  assert.equal(paceStage(w).key, "lateral");
  assert.deepEqual(w.session.rows.map((e) => e.key).sort(), original);
  assert.equal(w.originalSession.rows[2].id, "front_squat");
  validate(s);
});

test("a readiness recheck preserves the user's chosen Olympic weight", () => {
  const s = ready(),
    e = prepare(s, 165);
  s.active.baseSession.rows.find((row) => row.key === e.key).workingLoad = 160;
  reassessActive(s, now + 1000);
  assert.equal(nextQualityRange(s.active, e)[0], 165);
  validate(s);
});

test("correcting Olympic reps preserves incomplete strength work", () => {
  const s = ready(),
    e = nextRow(s.active);
  for (let i = 0; i < 2; i++) {
    prepare(s, 100);
    logOlympicSet(
      s,
      { weight: 100, reps: 3, finish: "miss" },
      now + (i + 1) * 600000,
    );
  }
  let row;
  while ((row = nextRow(s.active))) {
    s.active.preparations.push(row.key);
    logSet(s, { weight: 100, reps: 1, endpoint: "tech" }, now + 1800000);
  }
  finishSession(s, "Synthetic stopped-set test", now + 1900000);
  const r = s.records[0];
  assert.equal(r.omissions.length, 0);
  assert.equal(r.status, "partial");
  correctOlympicSet(
    s,
    r.id,
    e.key,
    1,
    { weight: 100, reps: 2, finish: "miss" },
    now + 2000000,
  );
  assert.equal(r.status, "partial");
  validate(s);
});
