import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  dayPlan,
  DAYS,
  quality,
  failure,
} from "../src/prescription.js";
import { fixedSession, fixedDay } from "../src/timeline.js";
import {
  fresh,
  startSession,
  logSet,
  stopSession,
  nextRow,
  rowStatus,
  reassessActive,
} from "../src/training.js";
import {
  syncPacing,
  paceStage,
  paceStatus,
  paceSeconds,
  paceElapsed,
  startPaceStage,
  pausePace,
  endPaceSet,
  completePaceStage,
  takePaceBreak,
  finishPaceBreak,
} from "../src/pacing.js";
import { validate, saveStore, loadStore } from "../src/storage.js";
const now = new Date("2026-09-14T10:00:00").getTime();
const sync = (s, at = now) =>
  syncPacing(
    s.active,
    Object.fromEntries(
      s.active.session.rows.map((e) => [e.key, rowStatus(s.active, e)]),
    ),
    at,
  );
function ready() {
  const s = fresh("2026-09-14", "source");
  s.readiness = {
    date: "2026-09-14",
    level: "green",
    event: "normal",
    local: "",
  };
  startSession(s, "monday", "main", now);
  sync(s);
  return s;
}
function workReady() {
  const s = ready();
  s.active.warmup = true;
  s.active.preparations.push(nextRow(s.active).key);
  sync(s);
  return s;
}
test("fixed plans use one target for every phase, set and day without changing the prescription", () => {
  for (const week of [1, 3, 4, 5, 8, 9, 11, 12, 13])
    for (const level of ["green", "amber", "red"])
      for (const day of DAYS) {
        const c = defaults();
        Object.assign(c, { week, entry: 3, mobility: ["ankle"] });
        c.athletics.enabled = true;
        c.cardio.enabled = true;
        const p = dayPlan(c, day, { level }),
          original = structuredClone(p),
          t = fixedDay(p, c);
        assert.deepEqual(p, original);
        assert.equal(t.seconds[0], t.seconds[1]);
        assert.equal(
          t.seconds[0],
          t.sessions.reduce((n, s) => n + s.seconds[0], 0),
        );
        for (const s of t.sessions) {
          assert.equal(
            s.seconds[0],
            s.stages.reduce((n, x) => n + x.seconds, 0),
          );
          assert.equal(
            s.seconds[0],
            Object.values(s.overhead).reduce((n, x) => n + x[0], 0) +
              s.rows.reduce((n, x) => n + x.seconds[0], 0),
          );
          assert.equal(
            new Set(s.stages.map((x) => x.id)).size,
            s.stages.length,
          );
          for (const x of s.stages)
            assert.ok(Number.isInteger(x.seconds) && x.seconds >= 0);
        }
      }
});
test("guide preserves separate Olympic attempts, within-set resets, all work rests and no final extra rest", () => {
  const c = defaults(),
    e = quality("snatch", 3, 2, [65, 70], "snatch", 7, 150);
  const t = fixedSession({ id: "main", kind: "lifting", rows: [e] }, c);
  assert.equal(t.stages.filter((s) => s.role === "work").length, 6);
  assert.deepEqual(
    t.stages.filter((s) => s.role === "rest").map((s) => s.seconds),
    [15, 150, 15, 150, 15],
  );
  assert.equal(t.stages.filter((s) => s.role === "waiting")[0].seconds, 120);
  assert.equal(t.overhead.breaks[0], 600);
  const b = fixedSession(
    { id: "main", kind: "lifting", rows: [failure("bench", 1, 3, 5, 270)] },
    c,
  );
  assert.equal(b.stages.filter((s) => s.role === "work").length, 1);
  assert.equal(b.stages.filter((s) => s.role === "rest").length, 0);
  assert.match(b.stages.filter((s) => s.role === "ramp").at(-1).label, /90%/);
  assert.equal(
    b.stages.filter((s) => s.role === "ramp-rest").at(-1).minSeconds,
    180,
  );
});
test("zero does not log work; set-end starts real recovery while outcome entry takes time", () => {
  const s = workReady(),
    w = s.active,
    stage = paceStage(w);
  assert.equal(stage.role, "work");
  assert.equal(w.pacing.timer, null);
  startPaceStage(w, now);
  assert.ok(paceStatus(w, now + 60000).phaseRemaining < 0);
  assert.equal(w.sets.length, 0);
  assert.throws(() => completePaceStage(w, now + 60000), /actual work/);
  endPaceSet(w, now + 10000);
  logSet(
    s,
    { weight: 100, outcome: "make", grade: "A", effort: 6 },
    w.pacing.workEndedAt,
  );
  sync(s, now + 15000);
  assert.equal(paceStage(w).role, "rest");
  assert.equal(paceStatus(w, now + 15000).phaseRemaining, 10);
  assert.equal(w.sets[0].at, now + 10000);
  assert.throws(() => completePaceStage(w, now + 15000), /prescribed rest/);
  completePaceStage(w, now + 25000);
  sync(s, now + 25000);
  assert.equal(paceStage(w).attempt, 1);
  assert.equal(w.pacing.timer, null);
  validate(s);
});
test("pauses preserve phase seconds but keep the session deadline honest across persisted reloads", () => {
  let s = workReady();
  startPaceStage(s.active, now);
  pausePace(s.active, now + 5000);
  const initial = paceStatus(s.active, now + 5000),
    map = new Map();
  const store = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  s = saveStore(store, s);
  s = loadStore(store).state;
  const later = paceStatus(s.active, now + 65000);
  assert.equal(later.phaseRemaining, initial.phaseRemaining);
  assert.equal(later.budgetRemaining, initial.budgetRemaining - 60);
  pausePace(s.active, now + 65000);
  assert.equal(paceElapsed(s.active.pacing.timer, now + 70000), 10);
  validate(s);
});
test("breaks use the pool once, preserve paused setup and consume actual overrun", () => {
  const s = ready(),
    w = s.active;
  takePaceBreak(w, 120, now + 10000);
  assert.equal(w.pacing.breakUsed, 120);
  finishPaceBreak(w, now + 190000);
  assert.equal(w.pacing.breakUsed, 180);
  assert.equal(paceElapsed(w.pacing.timer, now + 200000), 20);
  takePaceBreak(w, 120, now + 200000);
  finishPaceBreak(w, now + 230000);
  assert.equal(w.pacing.breakUsed, 210);
  assert.equal(
    paceSeconds(
      w,
      w.pacing.plan.find((s) => s.role === "break-pool"),
    ),
    390,
  );
  validate(s);
});
test("a bathroom break overlapping recovery does not restart or pause that recovery", () => {
  const s = workReady(),
    w = s.active;
  startPaceStage(w, now);
  endPaceSet(w, now + 10000);
  logSet(
    s,
    { weight: 100, outcome: "make", grade: "A", effort: 6 },
    now + 10000,
  );
  sync(s, now + 10000);
  takePaceBreak(w, 120, now + 11000);
  finishPaceBreak(w, now + 131000);
  assert.ok(paceStatus(w, now + 131000).phaseRemaining < 0);
  assert.equal(w.pacing.timer.pausedMs, 0);
  assert.equal(w.pacing.breakUsed, 120);
});
test("readiness reductions remove abandoned stages and never resurrect omitted work", () => {
  const s = workReady();
  startPaceStage(s.active, now);
  s.readiness.level = "red";
  reassessActive(s, now + 1000);
  sync(s, now + 1000);
  assert.ok(
    !s.active.pacing.plan
      .filter((x) => x.role === "work")
      .some((x) => !s.active.pacing.completed.some((c) => c.id === x.id)),
  );
  validate(s);
});
test("finishing keeps measured timing history but drops the executable plan and unmeasured placeholders", () => {
  const s = ready();
  completePaceStage(s.active, now + 240000);
  sync(s, now + 240000);
  stopSession(s, "Test only", now + 245000);
  const p = s.records[0].pacing;
  assert.deepEqual(p.plan, []);
  assert.equal(p.timer, null);
  assert.ok(p.completed.some((s) => s.seconds === 240));
  assert.ok(p.completed.every((s) => s.seconds !== null));
  validate(s);
});
test("malformed or impossible timer data is rejected before journal replacement", () => {
  const s = ready();
  const bad = structuredClone(s);
  bad.active.pacing.plan[0].seconds = -1;
  assert.throws(() => validate(bad), /pacing timer/);
  const duplicate = structuredClone(s);
  duplicate.active.pacing.plan.push(duplicate.active.pacing.plan[0]);
  assert.throws(() => validate(duplicate), /pacing timer/);
  const timer = structuredClone(s);
  timer.active.pacing.timer.pausedAt = now - 1;
  assert.throws(() => validate(timer), /pacing timer/);
});
