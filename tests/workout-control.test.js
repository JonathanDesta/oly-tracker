import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  startSession,
  stopSession,
  finishSession,
  logSet,
  nextRow,
  moveExerciseNext,
  scheduledDate,
  deferDay,
  normal,
  reassessActive,
  useFullWorkout,
  omitRow,
} from "../src/training.js";
import { validate } from "../src/storage.js";

const monday = Date.parse("2026-09-21T12:00:00-05:00");
const base = () => fresh("2026-09-21", "weekday", "all-failure");
function prepare(s) {
  s.active.warmup = true;
  s.active.preparations.push(nextRow(s.active).key);
}
function bench(s, at = monday) {
  startSession(s, "tuesday", "rescue", at, { rescue: "bench_low" });
  prepare(s);
  logSet(s, { weight: 200, reps: 4, endpoint: "failure" }, at + 1000);
  finishSession(s, "Actual bench exposure", at + 2000);
}

test("next-day workouts start without a readiness form, with real dates and unchanged later plans", () => {
  const s = base();
  startSession(s, "tuesday", "main", monday);
  stopSession(s, "First visit ended", monday + 3000);
  const prior = structuredClone(s.records);
  startSession(s, "thursday", "main", monday + 86400000);
  assert.equal(s.active.date, "2026-09-22");
  assert.equal(s.active.context.level, "unchecked");
  assert.equal(
    normal(s.active),
    false,
    "missing readiness must not be fabricated as green",
  );
  assert.equal(scheduledDate(s, "friday"), "2026-09-25");
  assert.deepEqual(s.records, prior);
  assert.deepEqual(validate(s), s);
});

test("bench can start and log the day after another bench exposure", () => {
  const s = base();
  bench(s);
  const prior = structuredClone(s.records);
  startSession(s, "friday", "main", monday + 86400000);
  moveExerciseNext(s, "bench_moderate", monday + 86400000);
  prepare(s);
  logSet(s, { weight: 190, reps: 7, endpoint: "failure" }, monday + 86401000);
  assert.equal(s.active.sets[0].benchSlot, "bench_moderate");
  assert(s.active.warnings.some((w) => w.includes("48 hours")));
  assert.deepEqual(s.records, prior);
  validate(s);
});

test("repeat sessions preserve previous logs and include bench that was already performed", () => {
  const s = base();
  startSession(s, "tuesday", "main", monday);
  moveExerciseNext(s, "bench_low", monday);
  prepare(s);
  logSet(s, { weight: 200, reps: 4, endpoint: "failure" }, monday + 1000);
  stopSession(s, "First visit", monday + 2000);
  const prior = structuredClone(s.records);
  startSession(s, "tuesday", "main", monday + 86400000, {
    repeat: true,
    fullPlan: true,
  });
  assert(s.active.session.rows.some((e) => e.key === "bench_low"));
  assert.notEqual(s.active.id, prior[0].id);
  assert.equal(s.active.repeated, true);
  assert.deepEqual(s.records, prior);
  validate(s);
});

test("dates can move earlier independently or with an explicitly selected roll", () => {
  const s = base();
  deferDay(s, "thursday", "2026-09-22", { rollLater: false });
  assert.equal(scheduledDate(s, "thursday"), "2026-09-22");
  assert.equal(scheduledDate(s, "friday"), "2026-09-25");
  deferDay(s, "thursday", "2026-09-21", { rollLater: true });
  assert.equal(scheduledDate(s, "friday"), "2026-09-24");
  assert.throws(() => deferDay(s, "thursday", "2026-02-30"), /valid calendar/);
  validate(s);
});

test("a full-plan override retains adverse readiness and allows actual logging across a recheck", () => {
  const s = base();
  s.readiness = {
    date: "2026-09-21",
    level: "red",
    event: "unsafe",
    local: "",
    noProtection: true,
  };
  startSession(s, "tuesday", "main", monday, { fullPlan: true });
  const rows = structuredClone(s.active.session.rows);
  reassessActive(s, monday + 1000);
  assert.deepEqual(s.active.session.rows, rows);
  assert.equal(s.active.context.level, "red");
  moveExerciseNext(s, "bench_low", monday + 1000);
  prepare(s);
  logSet(s, { weight: 100, reps: 3, endpoint: "stop" }, monday + 2000);
  assert.equal(s.active.sets.length, 1);
  assert.equal(normal(s.active), false);
  validate(s);
});

test("restoring the full active workout preserves actual sets and deliberate omissions", () => {
  const s = base();
  s.readiness = {
    date: "2026-09-21",
    level: "green",
    event: "normal",
    local: "",
  };
  startSession(s, "tuesday", "main", monday);
  moveExerciseNext(s, "lateral", monday);
  prepare(s);
  logSet(s, { weight: 15, reps: 12, endpoint: "failure" }, monday + 1000);
  omitRow(s, "leg_curl", "Machine broken", monday + 2000);
  s.readiness.level = "red";
  reassessActive(s, monday + 3000);
  const actual = structuredClone(s.active.sets);
  useFullWorkout(s, monday + 4000);
  assert.deepEqual(s.active.sets, actual);
  assert(s.active.omissions.some((o) => o.reason === "Machine broken"));
  assert(
    !s.active.omissions.some((o) => o.reason.includes("updated readiness")),
  );
  assert(nextRow(s.active));
  validate(s);
});
