import test from "node:test";
import assert from "node:assert/strict";
import { defaults, dayPlan } from "../src/prescription.js";
import {
  fresh,
  startSession,
  startMobility,
  completeMobilityStep,
  startAerobic,
  pauseAerobic,
  finishAerobic,
  reassessActive,
  stopSession,
  finishSession,
  logSet,
  localDate,
} from "../src/training.js";
import {
  mobilitySteps,
  startPreparation,
  pausePreparation,
  finishPreparation,
  preparationElapsed,
} from "../src/routines.js";
import { estimateDay, estimateSession } from "../src/duration.js";
import { validate } from "../src/storage.js";
const wednesday = new Date("2026-09-16T10:00:00").getTime();
function state(now = wednesday) {
  const s = fresh("2026-09-14", "source");
  s.training.mobility = [
    "Ankle · bent-knee calf stretch, heel down",
    "Front rack · supported wrist stretch or unloaded elbow lifts",
  ];
  s.readiness = {
    date: localDate(new Date(now)),
    level: "green",
    local: "",
    event: "normal",
  };
  return s;
}
test("mobility is an executable session in every cycle/week, counted once in the day budget", () => {
  for (let cycle = 1; cycle <= 4; cycle++)
    for (let week = 1; week <= 13; week++)
      for (const day of ["wednesday", "saturday", "sunday"]) {
        const c = {
            ...defaults(),
            cycle,
            week,
            mobility: ["Ankle", "Front rack"],
          },
          p = dayPlan(c, day),
          t = estimateDay(p, c);
        const s = p.sessions.find((s) => s.kind === "mobility");
        assert.equal(s.rows.length, 2);
        assert.equal(s.rows[0].holdSeconds, 30);
        assert.equal(s.rows[0].reps, 5);
        assert.deepEqual(
          t.seconds,
          t.sessions.reduce(
            (a, s) => a.map((n, i) => n + s.seconds[i]),
            [0, 0],
          ),
        );
        assert.deepEqual(t.mobility, [420, 500]);
        if (day !== "saturday" || week !== 12)
          assert.deepEqual(t.seconds, [420, 500]);
      }
});
test("a stretch-only run times four holds and three rests, saves five active reps and survives restoration", () => {
  let s = state(),
    now = wednesday;
  startSession(s, "wednesday", "mobility", now);
  assert.equal(s.active.warmup, true);
  assert.deepEqual(
    estimateSession(s.active.session, s.training).overhead.general,
    [0, 0],
  );
  for (const e of s.active.session.rows) {
    startMobility(s, now);
    const before = structuredClone(s);
    assert.throws(() => completeMobilityStep(s, now + 29000), /timed hold/);
    assert.deepEqual(s, before);
    for (const step of mobilitySteps(e)) {
      now += step.seconds * 1000 + (step.seconds === 0 ? 20000 : 0);
      completeMobilityStep(s, now);
      s = validate(JSON.parse(JSON.stringify(s)));
    }
  }
  assert.equal(s.active.sets.length, 2);
  assert.equal(s.active.mobilityRun, null);
  finishSession(s, "Positions comfortable after active reps.", now);
  assert.equal(s.records[0].status, "complete");
  assert.equal(s.records[0].sets[0].stepLog.length, 8);
  assert.equal(s.records[0].sets[0].elapsedSeconds, 185);
  assert.deepEqual(validate(s), s);
});
test("mobility uses its frozen dose; pain/early termination preserves partial status and actual work", () => {
  const s = state();
  startSession(s, "wednesday", "mobility", wednesday);
  startMobility(s, wednesday);
  s.training.mobilitySeconds = 45;
  assert.equal(mobilitySteps(s.active.session.rows[0])[0].seconds, 30);
  completeMobilityStep(s, wednesday + 30000);
  stopSession(s, "Position uncomfortable; stop.", wednesday + 35000);
  assert.equal(s.records[0].status, "partial");
  assert.equal(s.records[0].sets.length, 0);
  assert.equal(s.records[0].omissions.length, 2);
  assert.equal(s.records[0].mobilityRun, null);
  assert.equal(s.records[0].mobilityPartials[0].steps.length, 1);
  assert.equal(s.records[0].mobilityPartials[0].steps[0].seconds, 30);
  assert.deepEqual(validate(s), s);
});
test("mobility respects affected regions and safety restrictions while gentle unaffected work remains available", () => {
  const c = state().training;
  const lower = dayPlan(c, "wednesday", { level: "green", local: "lower" });
  assert.equal(lower.sessions[0].rows.length, 1);
  assert.equal(lower.sessions[0].rows[0].region, "upper");
  const amber = dayPlan(c, "wednesday", { level: "amber" });
  assert.equal(amber.sessions[0].skipped, undefined);
  assert.deepEqual(
    estimateDay(dayPlan(c, "wednesday", { level: "red" }), c).seconds,
    [0, 0],
  );
});
test("general, exercise and interruption preparation have resumable clocks and separate journal records", () => {
  let now = new Date("2026-09-14T10:00:00").getTime(),
    s = state(now);
  startSession(s, "monday", "main", now);
  startPreparation(s, "general", now);
  now += 120000;
  pausePreparation(s, now);
  s = validate(JSON.parse(JSON.stringify(s)));
  now += 60000;
  assert.equal(preparationElapsed(s.active.preparationTimer, now), 120);
  pausePreparation(s, now);
  now += 300000;
  finishPreparation(s, "general", now);
  assert.equal(s.active.preparationLog[0].seconds, 420);
  const key = s.active.session.rows[0].key;
  finishPreparation(s, key, now);
  assert.equal(s.active.preparationLog[1].seconds, null);
  startPreparation(s, key, now);
  assert.throws(
    () =>
      logSet(s, { weight: 100, outcome: "make", grade: "A", effort: 6 }, now),
    /running preparation/,
  );
  now += 60000;
  finishPreparation(s, key, now);
  startPreparation(s, "rewarm", now);
  now += 180000;
  finishPreparation(s, "rewarm", now);
  assert.equal(
    s.active.preparationLog.at(-1).name,
    "Re-warm after interruption",
  );
  assert.ok(!s.active.preparations.includes("rewarm"));
  assert.deepEqual(validate(s), s);
});
test("malformed routine data is rejected before importing it", () => {
  const s = state();
  startSession(s, "wednesday", "mobility", wednesday);
  startMobility(s, wednesday);
  for (const mutate of [
    (x) => (x.active.mobilityRun.index = 8),
    (x) =>
      (x.active.mobilityRun.steps = [
        { title: "fake", seconds: 30, startedAt: 0, endedAt: 0 },
      ]),
    (x) => (x.active.session.rows[0].holdSeconds = 90),
  ]) {
    const bad = structuredClone(s);
    mutate(bad);
    assert.throws(() => validate(bad), /Invalid backup/);
  }
});
function cardioState() {
  const s = state();
  s.training.cardio = { enabled: true, minutes: 150 };
  startSession(s, "wednesday", "cardio", wednesday);
  return s;
}
test("aerobic moving clock excludes paused time, freezes target, restores offline and saves each bout separately", () => {
  let s = cardioState(),
    now = wednesday;
  assert.equal(s.active.warmup, true);
  startAerobic(s, now);
  now += 600000;
  pauseAerobic(s, now);
  now += 120000;
  s = validate(JSON.parse(JSON.stringify(s)));
  assert.equal(preparationElapsed(s.active.aerobicRun, now), 600);
  pauseAerobic(s, now);
  now += 1200000;
  s.training.cardio.minutes = 40;
  assert.equal(s.active.session.rows[0].minutes, 30);
  finishAerobic(s, 30, now);
  assert.equal(s.active.sets[0].timedSeconds, 1800);
  assert.equal(s.active.sets[0].pausedSeconds, 120);
  assert.equal(s.active.aerobicRun, null);
  assert.equal(s.active.session.rows[1].minutes, 10);
  finishAerobic(s, 10, now);
  finishSession(s, "Easy, full sentences throughout.", now);
  assert.equal(s.records[0].status, "complete");
  assert.equal(s.records[0].sets[1].timingMethod, "confirmed");
  assert.deepEqual(validate(s), s);
});
test("shortened aerobic bouts are partial; stopped unconfirmed clock time survives without invented moving minutes", () => {
  const short = cardioState();
  finishAerobic(short, 12, wednesday + 720000);
  finishAerobic(short, 10, wednesday + 1320000);
  finishSession(short, "Reduced main bout.", wednesday + 1320000);
  assert.equal(short.records[0].status, "partial");
  assert.equal(short.records[0].sets[0].minutes, 12);
  const stopped = cardioState();
  startAerobic(stopped, wednesday);
  pauseAerobic(stopped, wednesday + 180000);
  stopSession(stopped, "Stopped early.", wednesday + 240000);
  const r = stopped.records[0];
  assert.equal(r.status, "partial");
  assert.equal(r.sets.length, 0);
  assert.equal(r.aerobicPartials[0].movingSeconds, 180);
  assert.equal(r.aerobicRun, null);
  assert.deepEqual(validate(stopped), stopped);
});
test("aerobic timer stops on a readiness deferral, and invalid timing cannot be imported", () => {
  const s = cardioState();
  startAerobic(s, wednesday);
  s.readiness.level = "red";
  reassessActive(s, wednesday + 60000);
  assert.equal(s.active.aerobicRun, null);
  assert.equal(s.active.omissions.length, 2);
  const good = cardioState();
  startAerobic(good, wednesday);
  for (const mutate of [
    (x) => (x.active.aerobicRun.key = "invented"),
    (x) => (x.active.aerobicRun.pausedMs = -1),
    (x) => (x.active.aerobicRun.pausedAt = wednesday - 1000),
  ]) {
    const bad = structuredClone(good);
    mutate(bad);
    assert.throws(() => validate(bad), /aerobic timer/);
  }
  assert.throws(() => finishAerobic(good, 31, wednesday + 60000), /planned 30/);
});
