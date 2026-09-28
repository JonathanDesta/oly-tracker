import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  planFor,
  startSession,
  moveExerciseNext,
  logSet,
  stopSession,
  exposureHistory,
  nextLoad,
} from "../src/training.js";
import { dayPlan, DAYS } from "../src/prescription.js";
import { validate } from "../src/storage.js";
import { fixedSession } from "../src/timeline.js";
import { journalEntities, adoptJournalEntities } from "../src/planner-feed.js";
const at = Date.parse("2026-09-28T12:00:00-05:00");
const shrug = (s) =>
  planFor(s, "tuesday")
    .sessions.flatMap((s) => s.rows)
    .find((r) => r.id === "shrug");
function previous() {
  const s = fresh("2026-09-28", "weekday", "all-failure");
  s.training.equipment.shrug = "db";
  delete s.training.shrugEquipmentRevision;
  s.readiness = {
    date: "2026-09-28",
    level: "green",
    event: "normal",
    local: "",
  };
  startSession(s, "tuesday", "main", at);
  s.active.warmup = true;
  moveExerciseNext(s, "shrug", at);
  s.active.preparations.push("shrug");
  logSet(s, { weight: 115, reps: 18, endpoint: "failure" }, at + 60000);
  return s;
}
test("barbell-shrug migration preserves active and historical dumbbell logs and runs only once", () => {
  let s = previous();
  const active = structuredClone(s.active);
  s = validate(s);
  assert.deepEqual(s.active, active);
  assert.equal(s.training.equipment.shrug, "barbell");
  assert.equal(shrug(s).name, "Barbell shrug · from rack");
  stopSession(s, "Synthetic prior dumbbell workout", at + 120000);
  const records = structuredClone(s.records);
  validate(s);
  assert.deepEqual(s.records, records);
  assert.equal(s.records[0].sets[0].weight, 115);
  assert.equal(s.records[0].sets[0].loadUnit, "per dumbbell");
  const row = shrug(s),
    history = exposureHistory(s, row);
  assert.equal(history.length, 0);
  assert.equal(nextLoad(row, history).weight, undefined);
  assert.match(
    nextLoad(row, history).text,
    /Previous dumbbell weights are not a barbell estimate/,
  );
  s.training.equipment.shrug = "db";
  assert.equal(validate(s).training.equipment.shrug, "db");
  const restored = adoptJournalEntities(fresh(), journalEntities(s));
  assert.equal(validate(restored).training.equipment.shrug, "db");
  assert.deepEqual(restored.records, records);
});
test("shrug replacement keeps every week's exercise sets, rep ranges and rests", () => {
  const s = fresh("2026-09-28", "weekday", "all-failure");
  const dose = (c) =>
    DAYS.flatMap((day) =>
      dayPlan(c, day).sessions.flatMap((session) =>
        session.rows.map(({ id, key, sets, repRange, rest }) => ({
          day,
          id,
          key,
          sets,
          repRange,
          rest,
        })),
      ),
    );
  for (let week = 1; week <= 13; week++)
    for (let stage = 1; stage <= 4; stage++) {
      Object.assign(s.training, {
        week,
        failureEntry: stage,
        gate: week <= 4 ? "F" : week <= 8 ? "B" : "R",
      });
      const before = {
        ...s.training,
        equipment: { ...s.training.equipment, shrug: "db" },
      };
      assert.deepEqual(dose(s.training), dose(before));
    }
});
test("rack setup and preparation are timed; barbell shrugs progress by total 10 lb after all sets qualify", () => {
  const s = fresh("2026-09-28", "weekday", "all-failure"),
    row = shrug(s);
  assert.deepEqual(row.repRange, [10, 15]);
  assert.equal(row.loadUnit, "total barbell");
  const timing = fixedSession(
    { id: "main", kind: "lifting", rows: [row] },
    s.training,
  );
  assert.equal(timing.rows[0].station, "rack");
  assert(timing.stages.some((s) => /Set rack supports/.test(s.label)));
  assert(timing.stages.some((s) => /Light-bar shrugs/.test(s.label)));
  assert(timing.rows[0].parts.setup[0] > 0);
  assert(timing.rows[0].parts.waiting[0] > 0);
  assert.equal(
    timing.seconds[0],
    timing.stages.reduce((n, s) => n + s.seconds, 0),
  );
  const e = { ...row, sets: 2 },
    history = (reps) => [
      {
        row: e,
        sets: reps.map((reps) => ({ weight: 225, reps, endpoint: "failure" })),
      },
    ];
  assert.equal(nextLoad(e, history([15, 18])).weight, 235);
  assert.equal(nextLoad(e, history([18, 14])).weight, 225);
  assert.equal(nextLoad(e, history([15, 9])).weight, 215);
});
