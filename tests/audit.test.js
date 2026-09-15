import test from "node:test";
import assert from "node:assert/strict";
import { defaults, dayPlan, DAYS, quality } from "../src/prescription.js";
import {
  fresh,
  localDate,
  startSession,
  stopSession,
  finishSession,
  nextRow,
  logSet,
  omissionRecord,
  advanceWeek,
  scheduledDate,
  consumedBench,
  reassessActive,
  planFor,
  attempts,
} from "../src/training.js";
import { validate } from "../src/storage.js";
const start = new Date("2026-09-14T10:00:00").getTime();
function ready() {
  const s = fresh("2026-09-14");
  s.readiness = {
    date: "2026-09-14",
    level: "green",
    event: "normal",
    local: "",
  };
  return s;
}
test("full 52-week execution uses every scheduled row, records valid snapshots, ends at week 52", () => {
  const s = ready();
  let completed = 0;
  for (let annual = 1; annual <= 52; annual++) {
    assert.equal((s.training.cycle - 1) * 13 + s.training.week, annual);
    for (const day of DAYS) {
      const p = dayPlan(s.training, day);
      if (!p.sessions.some((x) => x.id === "main")) continue;
      let now = new Date(scheduledDate(s, day) + "T10:00:00").getTime();
      s.readiness = {
        date: localDate(new Date(now)),
        level: "green",
        event: "normal",
        local: "",
      };
      startSession(s, day, "main", now);
      s.active.warmup = true;
      while (nextRow(s.active)) {
        const e = nextRow(s.active);
        s.active.preparations.push(e.key);
        let data;
        if (e.kind === "quality")
          data = { weight: 45, outcome: "make", grade: "A", effort: 5 };
        else data = { weight: 100, reps: e.repRange[0], endpoint: "failure" };
        now += 300000;
        logSet(s, data, now);
      }
      // finish through a normal explicit boundary, without fabricating rest or recovery.
      finishSession(s, "Synthetic end-to-end audit", now + 1000);
      s.records.at(-1).followup = { normal: true };
      completed++;
      validate(s);
    }
    assert.ok(consumedBench(s, "bench_low"));
    assert.ok(consumedBench(s, "bench_moderate"));
    advanceWeek(s, {
      action: "advance",
      green: true,
      recovery: "normal",
      buildReady: true,
      realizationReady: true,
      notes: "Synthetic source audit; all prerequisite work resolved.",
    });
  }
  assert.ok(s.completed);
  assert.equal(s.training.cycle, 4);
  assert.equal(s.training.week, 13);
  assert.equal(completed, 212);
  const sets = s.records
    .flatMap((r) => r.sets)
    .filter((e) => e.endpoint === "failure");
  assert.equal(sets.length, 2064);
});
test("all source overrides remain bounded with established trials, heavy replacements, and equipment choices", () => {
  let combinations = 0;
  for (let week = 1; week <= 13; week++)
    for (const split of [false, true])
      for (const recovery of ["normal", "targeted", "reset", "restore"])
        for (const context of [
          { level: "green" },
          { level: "amber" },
          { level: "green", event: "verification" },
          { level: "green", local: "upper" },
          { level: "green", local: "lower" },
          { level: "red" },
        ])
          for (const day of DAYS) {
            const c = {
              ...defaults(),
              entry: 3,
              week,
              gate: "R",
              split,
              recovery,
              anchors: { snatch: 155, cj: 205, jerk: 220, clean: 225 },
              heavy: { snatch: 95, cj: 95, extraSnatch: 6, extraCj: 6 },
              trials: [
                {
                  id: "s",
                  kind: "squat",
                  day: "tuesday",
                  exercise: "front_squat",
                },
                { id: "p", kind: "press", day: "friday" },
                { id: "j", kind: "pause_jerk", day: "thursday" },
                { id: "c", kind: "calf_partial", day: "friday" },
                { id: "h", kind: "set", day: "friday", exercise: "shrug" },
              ],
              athletics: {
                ...defaults().athletics,
                enabled: true,
                stage: 7,
                secondary: 2,
                variation: "fly",
              },
              cardio: { enabled: true, minutes: 150 },
            };
            const plan = dayPlan(c, day, context);
            combinations++;
            for (const session of plan.sessions)
              for (const e of session.rows) {
                assert.ok(e.minutes || e.sets > 0);
                if (e.repSequence) assert.equal(e.repSequence.length, e.sets);
                if (e.sequence) assert.equal(e.sequence.length, e.sets);
                if (e.kind === "quality") assert.ok(attempts(e) > 0);
              }
            if (week === 12)
              assert.ok(
                plan.sessions
                  .flatMap((s) => s.rows)
                  .every((e) => e.kind === "quality" || e.id === "bench"),
              );
          }
  assert.equal(combinations, 4368);
});
test("a restrictive readiness update cannot leave an active failure block trainable", () => {
  const s = ready();
  s.training.week = 13;
  omissionRecord(s, "monday", "main", "Fixture", start);
  s.readiness.date = "2026-09-15";
  startSession(s, "tuesday", "main", start + 86400000);
  s.readiness = { ...s.readiness, level: "red" };
  reassessActive(s, start + 86400000);
  assert.equal(nextRow(s.active), undefined);
  assert.ok(s.active.omissions.length > 0);
});
test("malformed imports cannot introduce executable rows, invalid ranges or unknown endpoints", () => {
  const s = ready();
  startSession(s, "monday", "main", start);
  const variants = [
    (x) => (x.active.session.rows[0].range = [90, 10]),
    (x) => (x.active.session.rows[0].repSequence = ["bogus"]),
    (x) => (x.active.session.rows[0].id = "hip_thrust"),
    (x) => (x.active.preparations = ["unknown"]),
  ];
  for (const change of variants) {
    const x = structuredClone(s);
    change(x);
    assert.throws(() => validate(x), /Invalid backup/);
  }
});
